/**
 * POST /api/sequence/create
 *
 * シーケンスを生成する。
 * AI が複数ステップのアプローチシナリオを設計し、
 * draft ステータスで保存する。
 */
import { NextRequest, NextResponse } from "next/server";
import { createSequence, InMemorySequenceStore } from "@/lib/orchestrator";
import type { ProductInput, ContactContext } from "@/types";

// プロトタイプ用のインメモリストア（本番では DI で差し替え）
const store = new InMemorySequenceStore();

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { campaignId, product, context, options } = body as {
    campaignId: string;
    product: ProductInput;
    context: ContactContext;
    options?: { stepCount?: number; variantCount?: number };
  };

  if (!campaignId || !product || !context) {
    return NextResponse.json(
      { error: "campaignId, product, context は必須です" },
      { status: 400 }
    );
  }

  const sequence = await createSequence(
    { campaignId, product, context, options },
    store
  );

  return NextResponse.json({
    sequenceId: sequence.id,
    status: sequence.status,
    steps: sequence.steps.map((s) => ({
      stepOrder: s.stepOrder,
      delayHours: s.delayHours,
      channel: s.channel,
      body: s.body,
      angle: s.angle,
      subject: s.subject,
      variantCount: s.variants?.length ?? 0,
    })),
  });
}
