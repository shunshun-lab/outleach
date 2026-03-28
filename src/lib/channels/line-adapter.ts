/**
 * LINE チャネルアダプタ
 *
 * lineUserId が存在し、LINE 連携済みで、opt-out でなければ送信可能。
 * 実際の送信は LINE Messaging API を呼び出す。
 * 現時点ではインターフェースのみ定義し、送信は stub。
 */
import type {
  ChannelAdapter,
  ChannelContact,
  ChannelCampaignContext,
  ChannelSendContext,
  ChannelMessageDraft,
  ChannelSendResult,
  CanSendResult,
} from "@/types/channel";

export class LineChannelAdapter implements ChannelAdapter {
  readonly channelType = "line" as const;

  canSend(
    contact: ChannelContact,
    _campaign: ChannelCampaignContext,
    _context?: ChannelSendContext
  ): CanSendResult {
    if (!contact.lineUserId) {
      return { available: false, reason: "LINE ユーザーIDが未登録" };
    }

    if (!contact.lineLinkedAt) {
      return { available: false, reason: "LINE 連携が未完了" };
    }

    if (contact.optOutChannels?.includes("line")) {
      return { available: false, reason: "LINE 配信をオプトアウト済み" };
    }

    return { available: true };
  }

  async send(
    draft: ChannelMessageDraft,
    contact: ChannelContact,
    context: ChannelSendContext
  ): Promise<ChannelSendResult> {
    if (!contact.lineUserId) {
      return {
        success: false,
        channel: "line",
        deliveryStatus: "rejected",
        error: "LINE ユーザーIDが未登録",
        sentAt: new Date(),
      };
    }

    // TODO: LINE Messaging API 呼び出し
    // POST https://api.line.me/v2/bot/message/push
    // {
    //   "to": contact.lineUserId,
    //   "messages": [{ "type": "text", "text": draft.body }]
    // }
    const providerMessageId = `line_${context.idempotencyKey}`;

    return {
      success: true,
      channel: "line",
      providerMessageId,
      deliveryStatus: "sent",
      sentAt: new Date(),
    };
  }

  normalizeResult(providerResponse: unknown): ChannelSendResult {
    const res = providerResponse as Record<string, unknown>;
    return {
      success: !res.message, // LINE API returns { message: "error" } on failure
      channel: "line",
      providerMessageId: res.requestId as string | undefined,
      deliveryStatus: res.message ? "failed" : "sent",
      error: res.message as string | undefined,
      sentAt: new Date(),
    };
  }
}
