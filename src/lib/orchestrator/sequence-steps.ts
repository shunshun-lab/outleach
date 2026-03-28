/**
 * シーケンス対応パイプライン・ステップハンドラ
 *
 * 既存の steps.ts を拡張し、generate ステップで
 * 単発メッセージの代わりにシーケンス（複数ステップ）を生成する。
 *
 * 既存のステップハンドラと共存し、パイプライン入力の
 * options.useSequence フラグで切り替え可能。
 */
import { generateSequence } from "@/lib/ai/generate-sequence";
import { resolveChannels } from "@/lib/channels";
import type { ContactContext, ChannelContact, GeneratedSequenceStep } from "@/types";
import type {
  PipelineRun,
  StepResult,
  StepHandler,
  GeneratedTarget,
} from "./types";

/**
 * シーケンス生成ステップハンドラ
 *
 * 既存の handleGenerate と同じインターフェースだが、
 * 各ターゲットに対して複数ステップのシーケンスを生成する。
 * 結果は generatedMessages に格納し、既存の review/send フローと互換性を保つ。
 * 追加で generatedSequences にシーケンス固有のデータを格納する。
 */
export const handleSequenceGenerate: StepHandler = async (run) => {
  const customerResults = run.state.customerResults;
  if (!customerResults) {
    return {
      status: "failed",
      stateUpdate: {},
      error: "customerResults が未完了",
    };
  }

  const eligible = customerResults.filter((r) => !r.skipped);
  const targets: GeneratedTarget[] = [];
  const sequenceData: SequenceGenerationResult[] = [];

  for (const result of eligible) {
    const context: ContactContext = {
      contact: result.contact,
      matchedAngle: result.matchedAngle,
      matchReason: result.matchReason,
    };

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

    // シーケンス生成
    const steps = await generateSequence(run.input.product, context, {
      customPrompt: run.input.options?.customPrompt,
      channelResolution,
    });

    // 既存の GeneratedTarget と互換性を保つため、Step[0] のメッセージを messages に入れる
    const firstStep = steps[0];
    targets.push({
      contactId: result.contact.id,
      contact: result.contact,
      matchedAngle: result.matchedAngle,
      matchReason: result.matchReason,
      relevanceScore: result.relevanceScore,
      messages: firstStep?.variants ?? [],
      channelResolution,
    });

    sequenceData.push({
      contactId: result.contact.id,
      steps,
    });
  }

  return {
    status: "completed",
    stateUpdate: {
      generatedMessages: targets,
      generatedSequences: sequenceData,
    },
  };
};

/** シーケンス生成結果（PipelineState拡張用） */
export type SequenceGenerationResult = {
  contactId: string;
  steps: GeneratedSequenceStep[];
};
