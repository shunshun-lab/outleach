import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/ai";
import type { ProductInput, Contact } from "@/types";

/**
 * POST /api/campaign/pipeline
 * フルパイプライン実行（要素分解→調査→生成）
 * 結果は承認待ち状態で返却（自動送信しない）
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    product: ProductInput;
    contacts: Contact[];
    customPrompt?: string;
    relevanceThreshold?: number;
  };

  if (!body.product?.name || !body.contacts?.length) {
    return NextResponse.json(
      { error: "product と contacts（1件以上）は必須です" },
      { status: 400 }
    );
  }

  const result = await runPipeline(body.product, body.contacts, {
    customPrompt: body.customPrompt,
    relevanceThreshold: body.relevanceThreshold,
  });

  return NextResponse.json({
    status: "review",
    analysis: result.analysis,
    targets: result.targets.map((t) => ({
      contact: { name: t.contact.name, platform: t.contact.platform },
      relevanceScore: t.relevanceScore,
      matchedAngle: t.matchedAngle,
      matchReason: t.matchReason,
      messages: t.messages,
    })),
    skipped: result.skipped.map((s) => ({
      contact: { name: s.contact.name },
      relevanceScore: s.relevanceScore,
      reason: s.reason,
    })),
    note: "送信には別途承認が必要です",
  });
}
