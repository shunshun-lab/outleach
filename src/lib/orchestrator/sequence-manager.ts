/**
 * シーケンス・マネージャ
 *
 * シーケンスのライフサイクルを管理する。
 * - AI生成 → 承認 → スケジューリング → 送信 → 完了
 *
 * 既存の PipelineOrchestrator と連携し、
 * generateステップで単発メッセージの代わりにシーケンスを生成する。
 */
import { randomUUID } from "crypto";
import { generateSequence } from "@/lib/ai/generate-sequence";
import { generateSequenceIdempotencyKey } from "@/lib/channels/idempotency";
import { resolveChannels } from "@/lib/channels";
import type {
  ProductInput,
  ContactContext,
  ChannelContact,
  ChannelType,
  Sequence,
  SequenceStep,
  SequenceScheduler,
  GeneratedSequenceStep,
} from "@/types";
import type { SequenceStore } from "./auto-pause";
import type { SequenceGenerationOptions } from "@/lib/ai/generate-sequence";

// ─── シーケンス生成 ───

export type SequenceGenerationInput = {
  campaignId: string;
  product: ProductInput;
  context: ContactContext;
  options?: SequenceGenerationOptions;
};

/**
 * 1つのContact向けにシーケンスを生成してストアに保存する
 */
export async function createSequence(
  input: SequenceGenerationInput,
  store: SequenceStore
): Promise<Sequence> {
  // チャネル解決
  const channelContact: ChannelContact = {
    id: input.context.contact.id,
    name: input.context.contact.name,
    email: input.context.contact.email,
    lineUserId: input.context.contact.lineUserId,
    messengerPsid: input.context.contact.messengerPsid,
    preferredChannel: input.context.contact.preferredChannel,
    optOutChannels: input.context.contact.optOutChannels,
    platform: input.context.contact.platform,
    lineLinkedAt: input.context.contact.lineLinkedAt,
    messengerLastInboundAt: input.context.contact.messengerLastInboundAt,
  };

  const channelResolution = resolveChannels(channelContact, {
    campaignId: input.campaignId,
    campaignName: "",
  });

  // AI生成
  const generatedSteps = await generateSequence(
    input.product,
    input.context,
    { ...input.options, channelResolution }
  );

  // Sequenceオブジェクト構築
  const sequenceId = randomUUID();
  const steps: SequenceStep[] = generatedSteps.map((gs) =>
    toSequenceStep(gs, sequenceId, input.campaignId, input.context.contact.id)
  );

  const sequence: Sequence = {
    id: sequenceId,
    campaignId: input.campaignId,
    contactId: input.context.contact.id,
    status: "draft",
    steps,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  store.addSequence(sequence);
  return sequence;
}

// ─── シーケンス承認 ───

/**
 * シーケンスを承認する
 *
 * 人間がシーケンス全体を確認・承認した後に呼ばれる。
 * ステータスを approved に変更。
 */
export async function approveSequence(
  sequenceId: string,
  approvedBy: string,
  store: SequenceStore
): Promise<void> {
  await store.updateSequenceStatus(sequenceId, "approved");
  // approvedBy/approvedAt はストア側で管理（Prisma版で対応）
}

// ─── シーケンス・スケジューリング ───

/**
 * 承認済みシーケンスのステップをスケジューリングする
 *
 * Step[0]は即座に、Step[1+]はdelayHours後にスケジューリング。
 * BullMQ統合時は遅延ジョブとしてキューに投入される。
 */
export async function scheduleSequence(
  sequenceId: string,
  store: SequenceStore,
  scheduler: SequenceScheduler
): Promise<void> {
  const seq = store.getSequence(sequenceId);
  if (!seq) {
    throw new Error(`Sequence ${sequenceId} が見つかりません`);
  }

  if (seq.status !== "approved") {
    throw new Error(
      `Sequence ${sequenceId} は承認済みでないためスケジューリングできません（現在: ${seq.status}）`
    );
  }

  const now = new Date();
  const sortedSteps = [...seq.steps].sort(
    (a, b) => a.stepOrder - b.stepOrder
  );

  for (const step of sortedSteps) {
    const executeAt = new Date(
      now.getTime() + step.delayHours * 60 * 60 * 1000
    );
    const jobId = await scheduler.scheduleStep(step, executeAt);

    step.jobId = jobId;
    step.scheduledAt = executeAt;
    step.status = "scheduled";
    await store.updateStepStatus(step.id, "scheduled");
  }

  // シーケンスを active に
  await store.updateSequenceStatus(sequenceId, "active");
}

// ─── ヘルパー ───

function toSequenceStep(
  generated: GeneratedSequenceStep,
  sequenceId: string,
  campaignId: string,
  contactId: string
): SequenceStep {
  return {
    id: randomUUID(),
    sequenceId,
    stepOrder: generated.stepOrder,
    delayHours: generated.delayHours,
    channel: generated.channel,
    body: generated.body,
    angle: generated.angle,
    subject: generated.subject,
    status: "pending",
    idempotencyKey: generateSequenceIdempotencyKey(
      campaignId,
      contactId,
      generated.channel,
      generated.stepOrder
    ),
    variants: generated.variants,
  };
}
