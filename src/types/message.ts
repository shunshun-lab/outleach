import type { ChannelType, DeliveryStatus } from "./channel";

/** AI生成されたメッセージ */
export type GeneratedMessage = {
  id: string;
  campaignId: string;
  contactId: string;
  /** A/Bテスト用: 複数案 */
  variants: MessageVariant[];
  /** 人間が選択・承認した案 */
  approvedVariantIndex?: number;
  status: "draft" | "approved" | "sent" | "delivered" | "replied";
  sentAt?: Date;

  // ─── チャネル関連 ───
  /** 選択された送信チャネル */
  channel?: ChannelType;
  /** プロバイダ側のメッセージID */
  providerMessageId?: string;
  /** 配信ステータス */
  deliveryStatus?: DeliveryStatus;
  /** 冪等性キー（二重送信防止） */
  idempotencyKey?: string;
  /** 承認者 */
  approvedBy?: string;
  /** 承認日時 */
  approvedAt?: Date;
};

export type MessageVariant = {
  body: string;
  /** どの切り口を使ったか */
  angle: string;
  /** 品質スコア（brushupエンドポイントの結果） */
  qualityScore?: number;
  /** 禁止ワードチェック通過済みか */
  passedWordCheck: boolean;
};

/** 送信結果（改善ループ用） */
export type OutreachResult = {
  messageId: string;
  campaignId: string;
  contactId: string;
  variant: MessageVariant;
  outcome: "no-response" | "opened" | "replied" | "converted";
  /** 返信内容（あれば） */
  replySnippet?: string;
};

/** プロンプト改善の記録 */
export type PromptIteration = {
  version: number;
  prompt: string;
  /** この版で生成したメッセージの平均成果 */
  avgOutcomeScore: number;
  /** 改善メモ */
  changeNote: string;
  createdAt: Date;
};
