/**
 * AI文章生成パイプライン
 *
 * ContactContextを元にパーソナライズされたメッセージを生成する。
 * messaging.md のルールに従い:
 * - 受け手の文脈を主語にする
 * - 150字以内
 * - 禁止ワードを含まない
 * - A/Bテスト用に複数案を生成
 */
import { getClient, MODEL } from "./client";
import type { ProductInput, ContactContext, MessageVariant } from "@/types";

const FORBIDDEN_WORDS = [
  "今すぐ",
  "必ず",
  "絶対に",
  "特別価格",
  "限定",
  "していただけますでしょうか",
];

/**
 * カスタムプロンプトを受け取れるようにし、改善ループで差し替え可能にする
 */
export async function generateMessages(
  product: ProductInput,
  context: ContactContext,
  options?: {
    /** 改善ループで進化したプロンプトを渡す */
    customPrompt?: string;
    variantCount?: number;
  }
): Promise<MessageVariant[]> {
  const client = getClient();
  const variantCount = options?.variantCount ?? 2;

  const systemPrompt =
    options?.customPrompt ??
    `あなたは営業メッセージのプロフェッショナルです。
以下のルールに厳密に従ってメッセージを生成してください：

【必須ルール】
1. 受け手の文脈を主語にする（❌「〇〇イベントを開催します」→ ✅「〇〇に参加されていた△△さんにとって〜」）
2. 参加する意味を1文で入れる（受け手にとってのベネフィット）
3. 押し売りしない（「ぜひ」「絶対」「今すぐ」などの強制表現を避ける）
4. 150字以内に収める
5. 選択肢として提示する形にする

【禁止ワード】
${FORBIDDEN_WORDS.join("、")}

JSON配列形式で ${variantCount} 案を出力:
[
  {
    "body": "メッセージ本文",
    "angle": "使用した切り口の説明"
  }
]`;

  const userMessage = `## 商材
名前: ${product.name}
種別: ${product.type}
説明: ${product.description}

## 送り先の情報
名前: ${context.contact.name}
${context.matchedAngle ? `刺さる切り口: ${context.matchedAngle}` : ""}
${context.matchReason ? `理由: ${context.matchReason}` : ""}

${variantCount}案のメッセージを生成してください。`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("メッセージ生成の結果をパースできませんでした");
  }

  const raw = JSON.parse(jsonMatch[0]) as Array<{
    body: string;
    angle: string;
  }>;

  return raw.map((item) => ({
    body: item.body,
    angle: item.angle,
    passedWordCheck: !FORBIDDEN_WORDS.some((w) => item.body.includes(w)),
  }));
}

/** 禁止ワードチェックのユーティリティ（外部からも使える） */
export function checkForbiddenWords(text: string): string[] {
  return FORBIDDEN_WORDS.filter((w) => text.includes(w));
}
