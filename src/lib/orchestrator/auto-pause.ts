/**
 * Auto-Pause（自動停止）ロジック
 *
 * 返信・コンバージョンを検知した際に、
 * 対象Contactの進行中シーケンスを自動キャンセルし、
 * 動的タグを追加する。
 */
import type {
  ActionType,
  ActionLog,
  Sequence,
  SequenceStep,
  SequenceScheduler,
} from "@/types";
import { randomUUID } from "crypto";

// ─── ストア抽象化 ───

export interface SequenceStore {
  /** 特定Contactの進行中（active）シーケンスを取得 */
  getActiveSequences(contactId: string): Promise<Sequence[]>;
  /** シーケンスを取得 */
  getSequence(sequenceId: string): Sequence | undefined;
  /** シーケンスを保存 */
  addSequence(seq: Sequence): void;
  /** シーケンスのステータスを更新 */
  updateSequenceStatus(
    sequenceId: string,
    status: Sequence["status"]
  ): Promise<void>;
  /** ステップのステータスを更新 */
  updateStepStatus(
    stepId: string,
    status: SequenceStep["status"]
  ): Promise<void>;
  /** Contactのタグを追加 */
  addContactTags(contactId: string, tags: string[]): Promise<void>;
  /** ActionLogを保存 */
  saveActionLog(log: ActionLog): Promise<void>;
}

// ─── Auto-Pause 本体 ───

export type ActionInput = {
  contactId: string;
  sequenceId?: string;
  type: ActionType;
  payload?: Record<string, unknown>;
};

/**
 * アクション検知のハンドラ
 *
 * Webhook等で返信/コンバージョン/クリックを受け取った際に呼ぶ。
 * 1. ActionLogに記録
 * 2. Auto-Pause対象ならシーケンスをキャンセル
 * 3. 動的タグを追加（該当する場合）
 */
export async function handleAction(
  input: ActionInput,
  store: SequenceStore,
  scheduler: SequenceScheduler
): Promise<{
  actionLogId: string;
  cancelledSequences: string[];
  addedTags: string[];
}> {
  // 1. ActionLogに記録
  const actionLog: ActionLog = {
    id: randomUUID(),
    contactId: input.contactId,
    sequenceId: input.sequenceId,
    type: input.type,
    payload: input.payload,
    createdAt: new Date(),
  };
  await store.saveActionLog(actionLog);

  // 2. Auto-Pause（返信 or コンバージョンの場合）
  const cancelledSequences: string[] = [];
  if (shouldAutoPause(input.type)) {
    const cancelled = await cancelActiveSequences(
      input.contactId,
      store,
      scheduler
    );
    cancelledSequences.push(...cancelled);
  }

  // 3. 動的タグ付け
  const addedTags = extractTags(input);
  if (addedTags.length > 0) {
    await store.addContactTags(input.contactId, addedTags);

    // タグ追加のActionLogも記録
    await store.saveActionLog({
      id: randomUUID(),
      contactId: input.contactId,
      sequenceId: input.sequenceId,
      type: "tag_added",
      payload: { tags: addedTags },
      createdAt: new Date(),
    });
  }

  return {
    actionLogId: actionLog.id,
    cancelledSequences,
    addedTags,
  };
}

/**
 * 特定Contactの進行中シーケンスをすべてキャンセルする
 *
 * Auto-Pauseの中核ロジック:
 * - activeステータスのシーケンスを取得
 * - 未送信（pending/scheduled）のステップをcancelledに変更
 * - スケジューラからジョブをキャンセル
 * - シーケンスをrespondedに変更
 */
export async function cancelActiveSequences(
  contactId: string,
  store: SequenceStore,
  scheduler: SequenceScheduler
): Promise<string[]> {
  const activeSequences = await store.getActiveSequences(contactId);
  const cancelledIds: string[] = [];

  for (const seq of activeSequences) {
    // 未送信ステップをキャンセル
    for (const step of seq.steps) {
      if (step.status === "pending" || step.status === "scheduled") {
        await store.updateStepStatus(step.id, "cancelled");
        // スケジューラからもキャンセル
        await scheduler.cancelStep(step.id);
      }
    }

    // シーケンスを responded に変更
    await store.updateSequenceStatus(seq.id, "responded");
    cancelledIds.push(seq.id);
  }

  return cancelledIds;
}

/** Auto-Pauseを発動すべきアクションかどうか */
function shouldAutoPause(actionType: ActionType): boolean {
  return actionType === "reply" || actionType === "conversion";
}

/** アクションから動的タグを抽出する */
function extractTags(input: ActionInput): string[] {
  const tags: string[] = [];

  if (input.type === "link_click" && input.payload?.url) {
    // URLからタグを推定（簡易版）
    const url = String(input.payload.url);
    if (input.payload.tags && Array.isArray(input.payload.tags)) {
      tags.push(...(input.payload.tags as string[]));
    } else {
      // URLパスから簡易的にタグを抽出
      const pathSegments = url.split("/").filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment) {
        tags.push(lastSegment);
      }
    }
  }

  if (input.type === "conversion" && input.payload?.conversionType) {
    tags.push(`converted:${input.payload.conversionType}`);
  }

  return tags;
}

// ─── インメモリ SequenceStore（プロトタイプ用） ───

export class InMemorySequenceStore implements SequenceStore {
  private sequences = new Map<string, Sequence>();
  private actionLogs: ActionLog[] = [];
  private contactTags = new Map<string, string[]>();

  /** シーケンスを保存（テスト用） */
  addSequence(seq: Sequence): void {
    this.sequences.set(seq.id, seq);
  }

  async getActiveSequences(contactId: string): Promise<Sequence[]> {
    return Array.from(this.sequences.values()).filter(
      (s) => s.contactId === contactId && s.status === "active"
    );
  }

  async updateSequenceStatus(
    sequenceId: string,
    status: Sequence["status"]
  ): Promise<void> {
    const seq = this.sequences.get(sequenceId);
    if (seq) {
      seq.status = status;
      seq.updatedAt = new Date();
    }
  }

  async updateStepStatus(
    stepId: string,
    status: SequenceStep["status"]
  ): Promise<void> {
    for (const seq of this.sequences.values()) {
      const step = seq.steps.find((s) => s.id === stepId);
      if (step) {
        step.status = status;
        break;
      }
    }
  }

  async addContactTags(contactId: string, tags: string[]): Promise<void> {
    const existing = this.contactTags.get(contactId) ?? [];
    const merged = [...new Set([...existing, ...tags])];
    this.contactTags.set(contactId, merged);
  }

  async saveActionLog(log: ActionLog): Promise<void> {
    this.actionLogs.push(log);
  }

  /** テスト用 */
  getContactTags(contactId: string): string[] {
    return this.contactTags.get(contactId) ?? [];
  }

  /** テスト用 */
  getActionLogs(): ActionLog[] {
    return this.actionLogs;
  }

  /** テスト用 */
  getSequence(id: string): Sequence | undefined {
    return this.sequences.get(id);
  }
}
