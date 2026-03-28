/**
 * Mail チャネルアダプタ
 *
 * デフォルトの送信チャネル。
 * email フィールドが存在し、opt-out でなければ送信可能。
 *
 * 実際の送信は外部メールプロバイダ（Gmail API / SMTP 等）を呼び出す。
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

export class MailChannelAdapter implements ChannelAdapter {
  readonly channelType = "mail" as const;

  canSend(
    contact: ChannelContact,
    _campaign: ChannelCampaignContext,
    _context?: ChannelSendContext
  ): CanSendResult {
    if (!contact.email) {
      return { available: false, reason: "メールアドレスが未登録" };
    }

    if (contact.optOutChannels?.includes("mail")) {
      return { available: false, reason: "メール配信をオプトアウト済み" };
    }

    return { available: true };
  }

  async send(
    draft: ChannelMessageDraft,
    contact: ChannelContact,
    context: ChannelSendContext
  ): Promise<ChannelSendResult> {
    if (!contact.email) {
      return {
        success: false,
        channel: "mail",
        deliveryStatus: "rejected",
        error: "メールアドレスが未登録",
        sentAt: new Date(),
      };
    }

    // TODO: 実際のメール送信処理（Gmail API / SMTP）
    // 現時点では送信成功をシミュレート
    const providerMessageId = `mail_${context.idempotencyKey}`;

    return {
      success: true,
      channel: "mail",
      providerMessageId,
      deliveryStatus: "sent",
      sentAt: new Date(),
    };
  }

  normalizeResult(providerResponse: unknown): ChannelSendResult {
    const res = providerResponse as Record<string, unknown>;
    return {
      success: !!res.id,
      channel: "mail",
      providerMessageId: res.id as string | undefined,
      deliveryStatus: res.id ? "sent" : "failed",
      error: res.error as string | undefined,
      sentAt: new Date(),
    };
  }
}
