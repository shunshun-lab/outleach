/**
 * 冪等性キー生成
 *
 * campaignId + contactId + channel の組み合わせから一意キーを生成。
 * 同一キャンペーン内で同一コンタクトに同一チャネルで二重送信を防ぐ。
 */
import { createHash } from "crypto";
import type { ChannelType } from "@/types/channel";

export function generateIdempotencyKey(
  campaignId: string,
  contactId: string,
  channel: ChannelType
): string {
  const input = `${campaignId}:${contactId}:${channel}`;
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `idem_${hash}`;
}
