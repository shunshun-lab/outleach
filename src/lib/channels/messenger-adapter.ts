/**
 * Messenger チャネルアダプタ（条件付き）
 *
 * Messenger は以下の条件をすべて満たす場合のみ送信候補になる:
 * 1. messengerPsid が存在する
 * 2. 24時間ルール: messengerLastInboundAt が24時間以内
 *    （Meta の Standard Messaging ポリシーに準拠）
 * 3. opt-out でない
 *
 * 条件を満たさない場合は review UI で disabled 表示される。
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

/** Messenger の 24時間ウィンドウ（ミリ秒） */
const MESSENGER_WINDOW_MS = 24 * 60 * 60 * 1000;

export class MessengerChannelAdapter implements ChannelAdapter {
  readonly channelType = "messenger" as const;

  canSend(
    contact: ChannelContact,
    _campaign: ChannelCampaignContext,
    _context?: ChannelSendContext
  ): CanSendResult {
    if (!contact.messengerPsid) {
      return { available: false, reason: "Messenger PSID が未登録" };
    }

    if (contact.optOutChannels?.includes("messenger")) {
      return { available: false, reason: "Messenger 配信をオプトアウト済み" };
    }

    if (!contact.messengerLastInboundAt) {
      return {
        available: false,
        reason: "Messenger からの受信履歴がないため送信不可（24時間ルール）",
      };
    }

    const elapsed =
      Date.now() - new Date(contact.messengerLastInboundAt).getTime();
    if (elapsed > MESSENGER_WINDOW_MS) {
      return {
        available: false,
        reason: "最終受信から24時間を超過（Messenger Standard Messaging ポリシー）",
      };
    }

    return { available: true };
  }

  async send(
    draft: ChannelMessageDraft,
    contact: ChannelContact,
    context: ChannelSendContext
  ): Promise<ChannelSendResult> {
    // 送信前に再度 canSend チェック（24時間ウィンドウは変動する）
    const check = this.canSend(contact, { campaignId: context.campaignId, campaignName: "" });
    if (!check.available) {
      return {
        success: false,
        channel: "messenger",
        deliveryStatus: "rejected",
        error: check.reason,
        sentAt: new Date(),
      };
    }

    // TODO: Facebook Graph API 呼び出し
    // POST https://graph.facebook.com/v18.0/me/messages
    // {
    //   "recipient": { "id": contact.messengerPsid },
    //   "message": { "text": draft.body }
    // }
    const providerMessageId = `messenger_${context.idempotencyKey}`;

    return {
      success: true,
      channel: "messenger",
      providerMessageId,
      deliveryStatus: "sent",
      sentAt: new Date(),
    };
  }

  normalizeResult(providerResponse: unknown): ChannelSendResult {
    const res = providerResponse as Record<string, unknown>;
    return {
      success: !!res.message_id,
      channel: "messenger",
      providerMessageId: res.message_id as string | undefined,
      deliveryStatus: res.message_id ? "sent" : "failed",
      error: (res.error as Record<string, unknown>)?.message as string | undefined,
      sentAt: new Date(),
    };
  }
}
