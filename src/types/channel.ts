/**
 * 送信チャネル型定義
 *
 * adapter pattern でチャネルを抽象化し、
 * contact ごとにチャネル選択・送信可否判定を行う。
 */

// ─── チャネル種別 ───

export type ChannelType = "mail" | "line" | "messenger";

export const ALL_CHANNELS: ChannelType[] = ["mail", "line", "messenger"];

// ─── チャネルアダプタ ───

export interface ChannelAdapter {
  readonly channelType: ChannelType;

  /**
   * この contact にこのチャネルで送信可能かを判定する。
   * 到達条件（email有無, lineUserId有無など）と
   * 運用制約（opt-out, 制約条件など）を両方チェックする。
   */
  canSend(
    contact: ChannelContact,
    campaign: ChannelCampaignContext,
    context?: ChannelSendContext
  ): CanSendResult;

  /**
   * メッセージを送信する。
   * 必ず approve 済みの場合のみ呼ばれる前提。
   */
  send(
    draft: ChannelMessageDraft,
    contact: ChannelContact,
    context: ChannelSendContext
  ): Promise<ChannelSendResult>;

  /**
   * プロバイダ固有のレスポンスを統一フォーマットに変換する。
   */
  normalizeResult(providerResponse: unknown): ChannelSendResult;
}

// ─── canSend の結果 ───

export type CanSendResult = {
  available: boolean;
  reason?: string; // available=false の場合の理由
};

// ─── チャネル解決 ───

export type ChannelResolution = {
  contactId: string;
  availableChannels: ChannelAvailability[];
  recommendedChannel: ChannelType;
  fallbackChannel: ChannelType; // 常に "mail"
};

export type ChannelAvailability = {
  channel: ChannelType;
  available: boolean;
  reason?: string; // 利用不可の場合の理由
};

// ─── 送信関連の型 ───

export type ChannelContact = {
  id: string;
  name: string;
  email?: string;
  lineUserId?: string;
  messengerPsid?: string;
  preferredChannel?: ChannelType;
  optOutChannels?: ChannelType[];
  platform?: string;
  lineLinkedAt?: Date;
  messengerLastInboundAt?: Date;
};

export type ChannelCampaignContext = {
  campaignId: string;
  campaignName: string;
};

export type ChannelSendContext = {
  campaignId: string;
  idempotencyKey: string;
  approvedBy: string;
  approvedAt: Date;
};

export type ChannelMessageDraft = {
  body: string;
  subject?: string; // mail 用
  angle: string;
};

export type ChannelSendResult = {
  success: boolean;
  channel: ChannelType;
  providerMessageId?: string;
  deliveryStatus: DeliveryStatus;
  error?: string;
  sentAt: Date;
};

export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "rejected";

// ─── 監査ログ ───

export type AuditAction =
  | "approve"
  | "reject"
  | "channel_select"
  | "message_edit"
  | "queue_submit"
  | "send_success"
  | "send_failure";

export type AuditLogEntry = {
  id: string;
  action: AuditAction;
  campaignId: string;
  targetId?: string;
  contactId?: string;
  channel?: ChannelType;
  performedBy: string;
  details?: Record<string, unknown>;
  createdAt: Date;
};
