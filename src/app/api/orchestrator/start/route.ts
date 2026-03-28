import { NextResponse } from "next/server";
import { PipelineOrchestrator, InMemoryPipelineStore } from "@/lib/orchestrator";
import type { ProductInput, Contact } from "@/types";

// シングルトンストア（Prisma 移行前の暫定）
const store = new InMemoryPipelineStore();
const orchestrator = new PipelineOrchestrator(store);

export { orchestrator, store };

/**
 * POST /api/orchestrator/start
 *
 * オーケストレータでパイプラインを開始する。
 * decompose → analyze → generate → review(paused) まで自動進行する。
 * 送信は review で停止し、approve API で別途承認が必要。
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    campaignId: string;
    product: ProductInput;
    contacts: Contact[];
    customPrompt?: string;
    relevanceThreshold?: number;
  };

  if (!body.campaignId || !body.product?.name || !body.contacts?.length) {
    return NextResponse.json(
      { error: "campaignId, product, contacts（1件以上）は必須です" },
      { status: 400 }
    );
  }

  const runId = await orchestrator.start(body.campaignId, {
    product: body.product,
    contacts: body.contacts,
    options: {
      customPrompt: body.customPrompt,
      relevanceThreshold: body.relevanceThreshold,
    },
  });

  const status = await orchestrator.getStatus(runId);

  return NextResponse.json({
    runId,
    status: status.status,
    currentStep: status.currentStep,
    note: "review ステップで一時停止します。送信には /api/orchestrator/approve が必要です",
  });
}
