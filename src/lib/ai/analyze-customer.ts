/**
 * カスタマー調査モジュール
 *
 * Contactの属性・行動履歴と商材分析結果を照合し、
 * 最適な切り口とマッチ理由を特定する。
 */
import { getClient, MODEL } from "./client";
import type { Contact, ProductAnalysis, ContactContext } from "@/types";

const SYSTEM_PROMPT = `あなたはカスタマーインサイトの専門家です。
与えられた個人の属性・行動履歴と商材分析結果を照合し、
この人に最も刺さる切り口を特定してください。

出力形式（JSON）:
{
  "matchedAngle": "この人に最も刺さる切り口の一文",
  "matchReason": "なぜこの切り口が刺さるかの根拠（行動履歴や属性に基づく）",
  "relevanceScore": 0-100の数値（この人にアプローチする妥当性）
}

注意:
- 個人情報を過度に推測しない（公開情報に基づく）
- 強引なこじつけは避ける
- relevanceScore が 30 未満ならアプローチ非推奨とする`;

export type CustomerAnalysisResult = {
  matchedAngle: string;
  matchReason: string;
  relevanceScore: number;
};

export async function analyzeCustomer(
  contact: Contact,
  analysis: ProductAnalysis
): Promise<ContactContext & { relevanceScore: number }> {
  const client = getClient();

  const userMessage = `## 商材分析結果
コアバリュー: ${analysis.coreValue}

切り口候補:
${analysis.angles.map((a) => `- ${a.persona}: ${a.hook}`).join("\n")}

## ターゲット個人の情報
名前: ${contact.name}
プラットフォーム: ${contact.platform ?? "不明"}
${contact.attributes.occupation ? `職種: ${contact.attributes.occupation}` : ""}
${contact.attributes.location ? `地域: ${contact.attributes.location}` : ""}
${contact.attributes.interests?.length ? `興味タグ: ${contact.attributes.interests.join(", ")}` : ""}

行動履歴:
${contact.behaviors.map((b) => `- ${b.type}: ${b.detail}${b.date ? ` (${b.date})` : ""}`).join("\n") || "なし"}`;

  const response = await client.models.generateContent({
    model: MODEL,
    contents: userMessage,
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const text = response.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("カスタマー分析の結果をパースできませんでした");
  }

  const result = JSON.parse(jsonMatch[0]) as CustomerAnalysisResult;

  return {
    contact,
    matchedAngle: result.matchedAngle,
    matchReason: result.matchReason,
    relevanceScore: result.relevanceScore,
  };
}
