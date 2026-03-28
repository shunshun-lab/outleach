/**
 * POST /api/sequence/approve
 *
 * シーケンスを承認し、スケジューリングを開始する。
 * 承認後、Step[0] は即時キュー投入、Step[1+] は遅延ジョブとして投入。
 */
import { NextRequest, NextResponse } from "next/server";
import {
  approveSequence,
  scheduleSequence,
  InMemorySequenceStore,
  InMemorySequenceScheduler,
} from "@/lib/orchestrator";

// プロトタイプ用（本番では DI で差し替え）
const store = new InMemorySequenceStore();
const scheduler = new InMemorySequenceScheduler();

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { sequenceId, approvedBy } = body as {
    sequenceId: string;
    approvedBy: string;
  };

  if (!sequenceId || !approvedBy) {
    return NextResponse.json(
      { error: "sequenceId, approvedBy は必須です" },
      { status: 400 }
    );
  }

  // 承認
  await approveSequence(sequenceId, approvedBy, store);

  // スケジューリング
  await scheduleSequence(sequenceId, store, scheduler);

  return NextResponse.json({
    sequenceId,
    status: "active",
    message: "シーケンスが承認され、スケジューリングが開始されました",
  });
}
