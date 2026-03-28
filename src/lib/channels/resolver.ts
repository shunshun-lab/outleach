/**
 * チャネル解決ロジック（DeliveryPolicy / ChannelResolver）
 *
 * contact ごとに利用可能チャネルを判定し、
 * 推奨チャネル・フォールバックチャネルを返す。
 *
 * ルール:
 * - Mail はデフォルト fallback（常に候補に含まれる）
 * - LINE は lineUserId + lineLinkedAt がある場合のみ候補
 * - Messenger は messengerPsid + 24時間以内の受信がある場合のみ候補
 * - preferredChannel が指定されていて利用可能ならそれを推奨
 * - それ以外は Mail を推奨
 */
import type {
  ChannelType,
  ChannelContact,
  ChannelCampaignContext,
  ChannelResolution,
  ChannelAvailability,
  ChannelAdapter,
} from "@/types/channel";
import { getAdapter, getAllAdapters } from "./registry";

/**
 * contact 単位でチャネル解決を行う
 */
export function resolveChannels(
  contact: ChannelContact,
  campaign: ChannelCampaignContext
): ChannelResolution {
  const adapters = getAllAdapters();

  const availableChannels: ChannelAvailability[] = adapters.map((adapter) => {
    const result = adapter.canSend(contact, campaign);
    return {
      channel: adapter.channelType,
      available: result.available,
      reason: result.reason,
    };
  });

  const recommended = determineRecommended(contact, availableChannels);

  return {
    contactId: contact.id,
    availableChannels,
    recommendedChannel: recommended,
    fallbackChannel: "mail",
  };
}

/**
 * 推奨チャネルを決定する
 *
 * 優先順:
 * 1. contact.preferredChannel が利用可能ならそれ
 * 2. LINE が利用可能なら LINE（到達率が高い傾向）
 * 3. Mail（デフォルト）
 *
 * Messenger は条件が厳しいため自動推奨しない（ユーザーが明示的に選択する場合のみ）
 */
function determineRecommended(
  contact: ChannelContact,
  channels: ChannelAvailability[]
): ChannelType {
  const availableSet = new Set(
    channels.filter((c) => c.available).map((c) => c.channel)
  );

  // ユーザーの希望チャネルが利用可能ならそれを使う
  if (contact.preferredChannel && availableSet.has(contact.preferredChannel)) {
    return contact.preferredChannel;
  }

  // LINE が利用可能なら LINE を推奨
  if (availableSet.has("line")) {
    return "line";
  }

  // デフォルトは Mail
  return "mail";
}

/**
 * 複数 contact のチャネル解決を一括で行う
 */
export function resolveChannelsBatch(
  contacts: ChannelContact[],
  campaign: ChannelCampaignContext
): ChannelResolution[] {
  return contacts.map((contact) => resolveChannels(contact, campaign));
}

/**
 * 指定チャネルで送信可能かを単一チェック
 */
export function canSendVia(
  channel: ChannelType,
  contact: ChannelContact,
  campaign: ChannelCampaignContext
): boolean {
  const adapter = getAdapter(channel);
  return adapter.canSend(contact, campaign).available;
}
