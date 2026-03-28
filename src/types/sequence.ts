/**
 * シーケンス（ケイデンス）型定義
 *
 * 複数ステップのアプローチシナリオを管理する。
 * 「点」ではなく「線」のアプローチを実現。
 */
import type { ChannelType } from "./channel";
import type { MessageVariant } from "./message";

// ─── シーケンス ───

export type SequenceStatus =
  | "draft"       // AI生成直後、未承認
  | "approved"    // 人間が承認済み、スケジューリング待ち
  | "active"      // 配信進行中（少なくとも1ステップがスケジュール済み/送信済み）
  | "paused"      // 手動一時停止
  | "completed"   // 全ステップ送信完了
  | "cancelled"   // キャンセル（手動 or Auto-Pause）
  | "responded";  // 返信/コンバージョン検知で自動停止

export type Sequence = {
  id: string;
  campaignId: string;
  contactId: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

// ─── シーケンスステップ ───

export type SequenceStepStatus =
  | "pending"     // 未スケジュール
  | "scheduled"   // スケジュール済み（遅延ジョブ投入済み）
  | "sent"        // 送信完了
  | "delivered"   // 配達確認済み
  | "cancelled"   // キャンセル（Auto-Pause等）
  | "failed";     // 送信失敗

export type SequenceStep = {
  id: string;
  sequenceId: string;
  stepOrder: number;
  delayHours: number;
  channel: ChannelType;
  body: string;
  angle: string;
  subject?: string;
  status: SequenceStepStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  idempotencyKey?: string;
  jobId?: string;
  variants?: MessageVariant[];
};

// ─── AI生成用の入出力型 ───

/** AIが生成するシーケンス案（1つのContact向け） */
export type GeneratedSequence = {
  contactId: string;
  contactName: string;
  steps: GeneratedSequenceStep[];
};

/** AIが生成するシーケンスの各ステップ */
export type GeneratedSequenceStep = {
  stepOrder: number;
  delayHours: number;
  channel: ChannelType;
  body: string;
  angle: string;
  subject?: string;
  variants: MessageVariant[];
};

// ─── トラッキング ───

export type TrackingLink = {
  id: string;
  sequenceStepId: string;
  originalUrl: string;
  trackingToken: string;
  clickedAt?: Date;
  clickCount: number;
};

// ─── アクションログ ───

export type ActionType =
  | "reply"        // 返信
  | "conversion"   // コンバージョン（目的達成）
  | "link_click"   // URLクリック
  | "opt_out"      // オプトアウト
  | "tag_added";   // タグ自動追加

export type ActionLog = {
  id: string;
  contactId: string;
  sequenceId?: string;
  type: ActionType;
  payload?: Record<string, unknown>;
  createdAt: Date;
};

// ─── スケジューラ抽象化 ───

export interface SequenceScheduler {
  /** ステップをスケジュールに投入し、jobIdを返す */
  scheduleStep(step: SequenceStep, executeAt: Date): Promise<string>;
  /** 特定ステップのスケジュールをキャンセル */
  cancelStep(stepId: string): Promise<void>;
  /** 特定Contactの全進行中ステップをキャンセル */
  cancelAllForContact(contactId: string): Promise<void>;
}
