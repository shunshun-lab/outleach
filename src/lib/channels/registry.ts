/**
 * チャネルアダプタ・レジストリ
 *
 * 全アダプタのシングルトン管理。
 * channelType からアダプタを引ける。
 */
import type { ChannelType, ChannelAdapter } from "@/types/channel";
import { MailChannelAdapter } from "./mail-adapter";
import { LineChannelAdapter } from "./line-adapter";
import { MessengerChannelAdapter } from "./messenger-adapter";

const adapters: Record<ChannelType, ChannelAdapter> = {
  mail: new MailChannelAdapter(),
  line: new LineChannelAdapter(),
  messenger: new MessengerChannelAdapter(),
};

export function getAdapter(channel: ChannelType): ChannelAdapter {
  const adapter = adapters[channel];
  if (!adapter) {
    throw new Error(`Unknown channel: ${channel}`);
  }
  return adapter;
}

export function getAllAdapters(): ChannelAdapter[] {
  return Object.values(adapters);
}
