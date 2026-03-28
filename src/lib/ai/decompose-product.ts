/**
 * 商材要素分解モジュール
 *
 * 商材（イベント・サービス等）を受け取り、
 * ターゲットペルソナごとの切り口・キーワード・差別化ポイントに分解する。
 */
import { getClient, MODEL } from "./client";
import type { ProductInput, ProductAnalysis } from "@/types";

const SYSTEM_PROMPT = `あなたは営業戦略の専門家です。
与えられた商材情報を分析し、以下の要素に分解してください：

1. coreValue: この商材が提供する本質的な価値（1文）
2. angles: ターゲットペルソナごとの「刺さる切り口」（最低3つ）
   - persona: ペルソナ名（例: "技術者", "旅行好き", "地域コミュニティ関心層"）
   - hook: そのペルソナに刺さる一文（受け手目線で書く）
   - reasoning: なぜこの切り口が刺さるかの根拠
3. keywords: 検索・発見に使えるキーワード群
4. differentiators: 類似商材との差別化ポイント
5. objections: 想定される反論・懸念とその対処

重要: 切り口は「発信者目線」ではなく「受け手の文脈を主語」にすること。
❌「我々のイベントは〜」
✅「〇〇に関心がある方にとって〜」

JSON形式で出力してください。`;

export async function decomposeProduct(
  product: ProductInput
): Promise<ProductAnalysis> {
  const client = getClient();

  const userMessage = `以下の商材を要素分解してください：

名前: ${product.name}
種別: ${product.type}
説明: ${product.description}
${product.url ? `URL: ${product.url}` : ""}
${product.date ? `日時: ${product.date}` : ""}
${product.location ? `場所: ${product.location}` : ""}
${product.tags?.length ? `タグ: ${product.tags.join(", ")}` : ""}`;

  const response = await client.models.generateContent({
    model: MODEL,
    contents: userMessage,
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const text = response.text ?? "";

  // JSONブロックを抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("商材分解の結果をパースできませんでした");
  }

  const parsed = JSON.parse(jsonMatch[0]) as ProductAnalysis;
  return parsed;
}
