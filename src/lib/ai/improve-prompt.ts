/**
 * 自己言及的改善ループ
 *
 * 送信結果（OutreachResult）を集計し、
 * 現在のプロンプトの問題点を分析、改善版プロンプトを生成する。
 *
 * フロー:
 * 1. 直近の OutreachResult を集計
 * 2. 成功パターン・失敗パターンを抽出
 * 3. 現在のプロンプトの問題点を特定
 * 4. 改善版プロンプトを生成
 * 5. PromptIteration として保存
 */
import { getClient, MODEL } from "./client";
import type { OutreachResult, PromptIteration, MessageVariant } from "@/types";

const IMPROVEMENT_SYSTEM_PROMPT = `あなたはプロンプトエンジニアリングの専門家です。
営業メッセージ生成プロンプトの改善を行います。

与えられた情報:
- 現在のプロンプト
- 送信結果の集計（成功/失敗パターン）

やること:
1. 成功したメッセージに共通するパターンを特定する
2. 失敗したメッセージに共通するパターンを特定する
3. 現在のプロンプトの問題点を指摘する
4. 改善版プロンプトを生成する

出力形式（JSON）:
{
  "analysis": "分析結果の要約",
  "successPatterns": ["成功パターン1", ...],
  "failurePatterns": ["失敗パターン1", ...],
  "improvements": ["改善点1", ...],
  "newPrompt": "改善版プロンプト全文",
  "changeNote": "何を変えたかの要約（1文）"
}

重要:
- 改善版プロンプトには messaging.md のルール（受け手主語、150字、禁止ワード）を必ず含める
- 大幅な書き換えではなく、インクリメンタルに改善する
- 改善の根拠を明確にする`;

/** 結果を数値スコアに変換 */
function outcomeToScore(outcome: OutreachResult["outcome"]): number {
  switch (outcome) {
    case "converted":
      return 100;
    case "replied":
      return 70;
    case "opened":
      return 30;
    case "no-response":
      return 0;
  }
}

/** 結果集計 */
export type ResultSummary = {
  totalSent: number;
  avgScore: number;
  outcomes: Record<string, number>;
  successExamples: Array<{ body: string; outcome: string }>;
  failureExamples: Array<{ body: string; outcome: string }>;
};

export function summarizeResults(
  results: Array<OutreachResult & { variant: MessageVariant }>
): ResultSummary {
  const outcomes: Record<string, number> = {};
  const scored = results.map((r) => ({
    ...r,
    score: outcomeToScore(r.outcome),
  }));

  for (const r of results) {
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  }

  const avgScore =
    scored.length > 0
      ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length
      : 0;

  const sorted = [...scored].sort((a, b) => b.score - a.score);

  return {
    totalSent: results.length,
    avgScore,
    outcomes,
    successExamples: sorted.slice(0, 3).map((r) => ({
      body: r.variant.body,
      outcome: r.outcome,
    })),
    failureExamples: sorted
      .slice(-3)
      .reverse()
      .map((r) => ({
        body: r.variant.body,
        outcome: r.outcome,
      })),
  };
}

export type ImprovementResult = {
  analysis: string;
  successPatterns: string[];
  failurePatterns: string[];
  improvements: string[];
  newPrompt: string;
  changeNote: string;
};

export async function improvePrompt(
  currentPrompt: string,
  summary: ResultSummary,
  currentVersion: number
): Promise<Omit<PromptIteration, "id">> {
  const client = getClient();

  const userMessage = `## 現在のプロンプト
${currentPrompt}

## 送信結果の集計
送信数: ${summary.totalSent}
平均スコア: ${summary.avgScore.toFixed(1)}
結果内訳: ${Object.entries(summary.outcomes)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ")}

### 成功例
${summary.successExamples.map((e) => `- [${e.outcome}] ${e.body}`).join("\n")}

### 失敗例
${summary.failureExamples.map((e) => `- [${e.outcome}] ${e.body}`).join("\n")}

改善版プロンプトを生成してください。`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: userMessage }],
    system: IMPROVEMENT_SYSTEM_PROMPT,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("プロンプト改善の結果をパースできませんでした");
  }

  const result = JSON.parse(jsonMatch[0]) as ImprovementResult;

  return {
    version: currentVersion + 1,
    prompt: result.newPrompt,
    avgOutcomeScore: summary.avgScore,
    changeNote: result.changeNote,
    createdAt: new Date(),
  };
}
