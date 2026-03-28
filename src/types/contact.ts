import type { ChannelType } from "./channel";

/** 連絡先（ターゲット個人） */
export type Contact = {
  id: string;
  /** 名前（フルネームは避ける — privacy.md） */
  name: string;
  /** プラットフォーム上のID/URL */
  platformId?: string;
  platform?: "twitter" | "connpass" | "line" | "did-event";
  /** 公開属性 */
  attributes: ContactAttributes;
  /** 行動履歴（公開情報のみ） */
  behaviors: ContactBehavior[];

  // ─── チャネル到達情報 ───
  /** メールアドレス（mail チャネル用） */
  email?: string;
  /** LINE ユーザーID（line チャネル用） */
  lineUserId?: string;
  /** Messenger PSID（messenger チャネル用） */
  messengerPsid?: string;
  /** ユーザーが希望するチャネル */
  preferredChannel?: ChannelType;
  /** LINE 連携日時 */
  lineLinkedAt?: Date;
  /** Messenger 最終受信日時 */
  messengerLastInboundAt?: Date;
  /** チャネルごとのオプトアウト */
  optOutChannels?: ChannelType[];
};

export type ContactAttributes = {
  occupation?: string;
  location?: string;
  interests?: string[];
};

export type ContactBehavior = {
  type: "event-attended" | "post-about" | "follows";
  detail: string;
  date?: string;
};

/** AI生成に渡すコンテキスト */
export type ContactContext = {
  contact: Contact;
  /** この人に刺さりそうな切り口 */
  matchedAngle?: string;
  /** マッチ理由 */
  matchReason?: string;
};
