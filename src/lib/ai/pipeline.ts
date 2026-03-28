/**
 * 営業自動化パイプライン — オーケストレーション
 *
 * 全体の流れ:
 * 1. 商材要素分解 (decomposeProduct)
 * 2. 各Contactに対してカスタマー調査 (analyzeCustomer)
 * 3. relevanceScore が閾値以上のContactに対してメッセージ生成 (generateMessages)
 * 4. 人間の承認待ち（自動送信禁止）
 *
 * 改善ループ:
 * - 送信結果が蓄積されたら improvePrompt を呼び出し
 * - 次回の生成には改善版プロンプトを使用
 */
import { decomposeProduct } from "./decompose-product";
import { analyzeCustomer } from "./analyze-customer";
import { generateMessages } from "./generate-message";
import type {
  ProductInput,
  ProductAnalysis,
  Contact,
  ContactContext,
  MessageVariant,
} from "@/types";

const RELEVANCE_THRESHOLD = 30;

export type PipelineResult = {
  analysis: ProductAnalysis;
  targets: TargetResult[];
  skipped: SkippedContact[];
};

export type TargetResult = {
  contact: Contact;
  matchedAngle: string;
  matchReason: string;
  relevanceScore: number;
  messages: MessageVariant[];
};

export type SkippedContact = {
  contact: Contact;
  relevanceScore: number;
  reason: string;
};

export async function runPipeline(
  product: ProductInput,
  contacts: Contact[],
  options?: {
    customPrompt?: string;
    relevanceThreshold?: number;
  }
): Promise<PipelineResult> {
  const threshold = options?.relevanceThreshold ?? RELEVANCE_THRESHOLD;

  // Step 1: 商材要素分解
  const analysis = await decomposeProduct(product);

  // Step 2: 各Contactのカスタマー調査（並列実行）
  const customerResults = await Promise.all(
    contacts.map((contact) => analyzeCustomer(contact, analysis))
  );

  const targets: TargetResult[] = [];
  const skipped: SkippedContact[] = [];

  // Step 3: 閾値以上のContactにメッセージ生成
  for (const result of customerResults) {
    if (result.relevanceScore < threshold) {
      skipped.push({
        contact: result.contact,
        relevanceScore: result.relevanceScore,
        reason: `relevanceScore (${result.relevanceScore}) < threshold (${threshold})`,
      });
      continue;
    }

    const context: ContactContext = {
      contact: result.contact,
      matchedAngle: result.matchedAngle,
      matchReason: result.matchReason,
    };

    const messages = await generateMessages(product, context, {
      customPrompt: options?.customPrompt,
    });

    targets.push({
      contact: result.contact,
      matchedAngle: result.matchedAngle ?? "",
      matchReason: result.matchReason ?? "",
      relevanceScore: result.relevanceScore,
      messages,
    });
  }

  // Step 4: ここでは返却のみ。送信は人間の承認後に別途実行する。
  return { analysis, targets, skipped };
}
