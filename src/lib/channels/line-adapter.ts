/**
 * LINE チャネルアダプタ
 *
 * lineUserId が存在し、LINE 連携済みで、opt-out でなければ送信可能。
 * LINE Messaging API (Push Message) を使用してメッセージを送信する。
 */
import { Client, type MessageAPIResponseBase } from "@line/bot-sdk";
import type {
  ChannelAdapter,
  ChannelContact,
  ChannelCampaignContext,
  ChannelSendContext,
  ChannelMessageDraft,
  ChannelSendResult,
  CanSendResult,
} from "@/types/channel";

function getLineClient(): Client {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  }
  return new Client({ channelAccessToken: token });
}

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

    try {
      const client = getLineClient();
      const response = await client.pushMessage(contact.lineUserId, [
        { type: "text", text: draft.body },
      ]);

      return this.normalizeResult(response);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "LINE API 送信エラー";
      return {
        success: false,
        channel: "line",
        deliveryStatus: "failed",
        error: errorMessage,
        sentAt: new Date(),
      };
    }
  }

  normalizeResult(providerResponse: unknown): ChannelSendResult {
    const res = providerResponse as Partial<MessageAPIResponseBase> &
      Record<string, unknown>;

    // LINE Push API の成功レスポンスは { } (空オブジェクト) で、
    // x-line-request-id ヘッダにリクエストIDが含まれる。
    // SDK は内部で requestId をレスポンスに含めてくれる場合がある。
    const hasError = typeof res.message === "string" && res.message.length > 0;

    return {
      success: !hasError,
      channel: "line",
      providerMessageId: (res as Record<string, unknown>)["x-line-request-id"] as string | undefined,
      deliveryStatus: hasError ? "failed" : "sent",
      error: hasError ? (res.message as string) : undefined,
      sentAt: new Date(),
    };
  }
}
