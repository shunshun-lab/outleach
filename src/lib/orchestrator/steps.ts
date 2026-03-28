/**
 * 各パイプラインステップのハンドラ実装
 *
 * 各ハンドラは PipelineRun を受け取り、StepResult を返す純粋な関数。
 * 既存の src/lib/ai/ モジュールを呼び出す薄いアダプタ層。
 */
import { decomposeProduct } from "@/lib/ai/decompose-product";
import { analyzeCustomer } from "@/lib/ai/analyze-customer";
import { generateMessages } from "@/lib/ai/generate-message";
import { getAdapter, resolveChannels } from "@/lib/channels";
import { generateIdempotencyKey } from "@/lib/channels/idempotency";
import type { ContactContext, ChannelContact, ChannelType } from "@/types";
import type {
  PipelineStep,
  PipelineRun,
  StepResult,
  StepHandler,
  CustomerResult,
  GeneratedTarget,
} from "./types";

const DEFAULT_RELEVANCE_THRESHOLD = 30;

// ─── Step 1: 商材要素分解 ───

const handleDecompose: StepHandler = async (run) => {
  const analysis = await decomposeProduct(run.input.product);
  return {
    status: "completed",
    stateUpdate: { analysis },
  };
};

// ─── Step 2: カスタマー調査 ───

const handleAnalyze: StepHandler = async (run) => {
  const analysis = run.state.analysis;
  if (!analysis) {
    return { status: "failed", stateUpdate: {}, error: "analysis が未完了" };
  }

  const threshold =
    run.input.options?.relevanceThreshold ?? DEFAULT_RELEVANCE_THRESHOLD;

  const results = await Promise.all(
    run.input.contacts.map(async (contact): Promise<CustomerResult> => {
      const result = await analyzeCustomer(contact, analysis);
      const skipped = result.relevanceScore < threshold;
      return {
        contact,
        matchedAngle: result.matchedAngle ?? "",
        matchReason: result.matchReason ?? "",
        relevanceScore: result.relevanceScore,
        skipped,
        skipReason: skipped
          ? `relevanceScore (${result.relevanceScore}) < threshold (${threshold})`
          : undefined,
      };
    })
  );

  return {
    status: "completed",
    stateUpdate: { customerResults: results },
  };
};

// ─── Step 3: アプローチ文生成 ───

const handleGenerate: StepHandler = async (run) => {
  const customerResults = run.state.customerResults;
  if (!customerResults) {
    return { status: "failed", stateUpdate: {}, error: "customerResults が未完了" };
  }

  const eligible = customerResults.filter((r) => !r.skipped);
  const targets: GeneratedTarget[] = [];

  for (const result of eligible) {
    const context: ContactContext = {
      contact: result.contact,
      matchedAngle: result.matchedAngle,
      matchReason: result.matchReason,
    };

    const messages = await generateMessages(run.input.product, context, {
      customPrompt: run.input.options?.customPrompt,
    });

    // チャネル解決
    const channelContact: ChannelContact = {
      id: result.contact.id,
      name: result.contact.name,
      email: result.contact.email,
      lineUserId: result.contact.lineUserId,
      messengerPsid: result.contact.messengerPsid,
      preferredChannel: result.contact.preferredChannel,
      optOutChannels: result.contact.optOutChannels,
      platform: result.contact.platform,
      lineLinkedAt: result.contact.lineLinkedAt,
      messengerLastInboundAt: result.contact.messengerLastInboundAt,
    };
    const channelResolution = resolveChannels(channelContact, {
      campaignId: run.campaignId,
      campaignName: "",
    });

    targets.push({
      contactId: result.contact.id,
      contact: result.contact,
      matchedAngle: result.matchedAngle,
      matchReason: result.matchReason,
      relevanceScore: result.relevanceScore,
      messages,
      channelResolution,
    });
  }

  return {
    status: "completed",
    stateUpdate: { generatedMessages: targets },
  };
};

// ─── Step 4: 人間の承認待ち ───

const handleReview: StepHandler = async (_run) => {
  // review ステップは即座に paused を返す。
  // 人間が承認した後、orchestrator.approve() で再開する。
  return {
    status: "paused",
    stateUpdate: {},
  };
};

// ─── Step 5: 送信実行 ───

const handleSend: StepHandler = async (run) => {
  const approvedIds = run.state.approvedTargetIds ?? [];
  if (approvedIds.length === 0) {
    return {
      status: "failed",
      stateUpdate: {},
      error: "承認されたターゲットがありません",
    };
  }

  const targets = run.state.generatedMessages ?? [];
  const approvedChannels = run.state.approvedChannels ?? {};
  const approvedSet = new Set(approvedIds);

  const results: Array<{
    contactId: string;
    channel: ChannelType;
    success: boolean;
    error?: string;
  }> = [];

  for (const target of targets) {
    if (!approvedSet.has(target.contactId)) continue;

    // チャネル決定: 承認時の明示選択 > resolver の推奨 > mail fallback
    const channel: ChannelType =
      approvedChannels[target.contactId] ??
      target.channelResolution?.recommendedChannel ??
      "mail";

    const adapter = getAdapter(channel);

    // 冪等性キー生成
    const idempotencyKey = generateIdempotencyKey(
      run.campaignId,
      target.contactId,
      channel
    );

    // 送信メッセージ選択（最初のバリアントを使用）
    const message = target.messages[0];
    if (!message) continue;

    const channelContact: ChannelContact = {
      id: target.contact.id,
      name: target.contact.name,
      email: target.contact.email,
      lineUserId: target.contact.lineUserId,
      messengerPsid: target.contact.messengerPsid,
      preferredChannel: target.contact.preferredChannel,
      optOutChannels: target.contact.optOutChannels,
      platform: target.contact.platform,
      lineLinkedAt: target.contact.lineLinkedAt,
      messengerLastInboundAt: target.contact.messengerLastInboundAt,
    };

    // canSend 再チェック（送信直前の安全確認）
    const canSendResult = adapter.canSend(channelContact, {
      campaignId: run.campaignId,
      campaignName: "",
    });

    if (!canSendResult.available) {
      // フォールバックを試行
      if (channel !== "mail") {
        const mailAdapter = getAdapter("mail");
        const mailCheck = mailAdapter.canSend(channelContact, {
          campaignId: run.campaignId,
          campaignName: "",
        });

        if (mailCheck.available) {
          const mailResult = await mailAdapter.send(
            { body: message.body, angle: message.angle },
            channelContact,
            {
              campaignId: run.campaignId,
              idempotencyKey: generateIdempotencyKey(run.campaignId, target.contactId, "mail"),
              approvedBy: run.state.approvedBy ?? "unknown",
              approvedAt: run.state.approvedAt ? new Date(run.state.approvedAt) : new Date(),
            }
          );
          results.push({
            contactId: target.contactId,
            channel: "mail",
            success: mailResult.success,
            error: mailResult.error,
          });
          continue;
        }
      }

      results.push({
        contactId: target.contactId,
        channel,
        success: false,
        error: canSendResult.reason,
      });
      continue;
    }

    // 送信実行
    const sendResult = await adapter.send(
      { body: message.body, angle: message.angle },
      channelContact,
      {
        campaignId: run.campaignId,
        idempotencyKey,
        approvedBy: run.state.approvedBy ?? "unknown",
        approvedAt: run.state.approvedAt ? new Date(run.state.approvedAt) : new Date(),
      }
    );

    results.push({
      contactId: target.contactId,
      channel,
      success: sendResult.success,
      error: sendResult.error,
    });
  }

  const allFailed = results.length > 0 && results.every((r) => !r.success);
  if (allFailed) {
    return {
      status: "failed",
      stateUpdate: {},
      error: "全ターゲットの送信に失敗しました",
    };
  }

  return {
    status: "completed",
    stateUpdate: {},
  };
};

// ─── ハンドラマップ ───

export const stepHandlers: Record<PipelineStep, StepHandler> = {
  decompose: handleDecompose,
  analyze: handleAnalyze,
  generate: handleGenerate,
  review: handleReview,
  send: handleSend,
};
