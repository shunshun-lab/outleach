import { Segment } from "./segment";
import type { GeneratedMessage } from "./message";

/** キャンペーン（営業施策の単位） */
export type Campaign = {
  id: string;
  name: string;
  /** 商材の情報 */
  product: ProductInput;
  /** 商材の要素分解結果 */
  analysis?: ProductAnalysis;
  /** ターゲットセグメント */
  segment: Segment;
  /** 生成されたメッセージ群 */
  messages: GeneratedMessage[];
  /** ステータス */
  status: "draft" | "analyzing" | "generating" | "review" | "approved" | "sent";
  createdAt: Date;
  updatedAt: Date;
};

/** 商材の入力情報 */
export type ProductInput = {
  name: string;
  type: "event" | "service" | "community" | "content";
  description: string;
  url?: string;
  date?: string;
  location?: string;
  tags?: string[];
};

/** 商材の要素分解結果 */
export type ProductAnalysis = {
  /** コアバリュー（この商材が提供する本質的な価値） */
  coreValue: string;
  /** ターゲットペルソナごとの刺さる切り口 */
  angles: PersonaAngle[];
  /** キーワード群 */
  keywords: string[];
  /** 差別化ポイント */
  differentiators: string[];
  /** 想定される反論・懸念 */
  objections: string[];
};

/** ペルソナごとの切り口 */
export type PersonaAngle = {
  persona: string;
  hook: string;
  reasoning: string;
};
