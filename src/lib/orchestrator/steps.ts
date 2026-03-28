/**
 * 各パイプラインステップのハンドラ実装
 *
 * 各ハンドラは PipelineRun を受け取り、StepResult を返す純粋な関数。
 * 既存の src/lib/ai/ モジュールを呼び出す薄いアダプタ層。
 */
import { decomposeProduct } from "@/lib/ai/decompose-product";
import { analyzeCustomer } from "@/lib/ai/analyze-customer";
import { generateMessages } from "@/lib/ai/generate-message";
import type { ContactContext } from "@/types";
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

    targets.push({
      contactId: result.contact.id,
      contact: result.contact,
      matchedAngle: result.matchedAngle,
      matchReason: result.matchReason,
      relevanceScore: result.relevanceScore,
      messages,
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
  // 送信ロジックは今後 BullMQ キューに委譲する。
  // 現時点では承認済みターゲットのマーキングのみ行う。
  const approved = run.state.approvedTargetIds ?? [];
  if (approved.length === 0) {
    return {
      status: "failed",
      stateUpdate: {},
      error: "承認されたターゲットがありません",
    };
  }

  // TODO: BullMQ への送信ジョブ投入
  // channels/ モジュールと連携して実際の送信を行う
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
