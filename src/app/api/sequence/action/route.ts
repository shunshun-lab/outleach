/**
 * POST /api/sequence/action
 *
 * アクション検知エンドポイント。
 * Webhook等から返信/コンバージョン/URLクリックの通知を受け取り、
 * Auto-Pause と動的タグ付けを実行する。
 */
import { NextRequest, NextResponse } from "next/server";
import {
  handleAction,
  InMemorySequenceStore,
  InMemorySequenceScheduler,
} from "@/lib/orchestrator";
import type { ActionType } from "@/types";

// プロトタイプ用（本番では DI で差し替え）
const store = new InMemorySequenceStore();
const scheduler = new InMemorySequenceScheduler();

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { contactId, sequenceId, type, payload } = body as {
    contactId: string;
    sequenceId?: string;
    type: ActionType;
    payload?: Record<string, unknown>;
  };

  if (!contactId || !type) {
    return NextResponse.json(
      { error: "contactId, type は必須です" },
      { status: 400 }
    );
  }

  const validTypes: ActionType[] = [
    "reply",
    "conversion",
    "link_click",
    "opt_out",
    "tag_added",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type は ${validTypes.join(", ")} のいずれかでなければなりません` },
      { status: 400 }
    );
  }

  const result = await handleAction(
    { contactId, sequenceId, type, payload },
    store,
    scheduler
  );

  return NextResponse.json({
    actionLogId: result.actionLogId,
    cancelledSequences: result.cancelledSequences,
    addedTags: result.addedTags,
    autoPaused: result.cancelledSequences.length > 0,
  });
}
