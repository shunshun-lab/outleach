/**
 * オーケストレータ型定義
 *
 * パイプラインの各ステップを独立したジョブとして定義し、
 * ステートマシンで状態遷移を管理する。
 */
import type {
  ProductInput,
  ProductAnalysis,
  Contact,
  ContactContext,
  MessageVariant,
  ChannelType,
  ChannelResolution,
} from "@/types";

// ─── パイプラインステップ ───

export type PipelineStep =
  | "decompose"       // 商材要素分解
  | "analyze"         // カスタマー調査
  | "generate"        // アプローチ文生成
  | "review"          // 人間の承認待ち
  | "send";           // 送信実行

export const PIPELINE_STEPS: PipelineStep[] = [
  "decompose",
  "analyze",
  "generate",
  "review",
  "send",
];

// ─── ジョブステータス ───

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "paused"        // 人間の承認待ち等で一時停止
  | "cancelled";

// ─── パイプライン実行の状態 ───

export type PipelineRun = {
  id: string;
  campaignId: string;
  currentStep: PipelineStep;
  status: JobStatus;
  input: PipelineInput;
  state: PipelineState;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PipelineInput = {
  product: ProductInput;
  contacts: Contact[];
  options?: {
    customPrompt?: string;
    relevanceThreshold?: number;
  };
};

/** 各ステップの中間結果を蓄積する状態オブジェクト */
export type PipelineState = {
  analysis?: ProductAnalysis;
  customerResults?: CustomerResult[];
  generatedMessages?: GeneratedTarget[];
  approvedTargetIds?: string[];
  /** 承認時のチャネル選択（contactId -> channel） */
  approvedChannels?: Record<string, ChannelType>;
  /** 承認者情報 */
  approvedBy?: string;
  /** 承認日時 */
  approvedAt?: string; // ISO string for serialization
};

export type CustomerResult = {
  contact: Contact;
  matchedAngle: string;
  matchReason: string;
  relevanceScore: number;
  skipped: boolean;
  skipReason?: string;
};

export type GeneratedTarget = {
  contactId: string;
  contact: Contact;
  matchedAngle: string;
  matchReason: string;
  relevanceScore: number;
  messages: MessageVariant[];
  /** チャネル解決結果 */
  channelResolution?: ChannelResolution;
  /** 承認時に選択されたチャネル */
  selectedChannel?: ChannelType;
};

// ─── ステップハンドラの型 ───

export type StepHandler = (run: PipelineRun) => Promise<StepResult>;

export type StepResult = {
  status: "completed" | "failed" | "paused";
  stateUpdate: Partial<PipelineState>;
  error?: string;
};

// ─── イベント（状態変更の通知用） ───

export type PipelineEvent =
  | { type: "step:start"; runId: string; step: PipelineStep }
  | { type: "step:complete"; runId: string; step: PipelineStep }
  | { type: "step:failed"; runId: string; step: PipelineStep; error: string }
  | { type: "pipeline:paused"; runId: string; step: PipelineStep; reason: string }
  | { type: "pipeline:resumed"; runId: string; step: PipelineStep }
  | { type: "pipeline:completed"; runId: string }
  | { type: "pipeline:cancelled"; runId: string };

export type PipelineEventHandler = (event: PipelineEvent) => void;
