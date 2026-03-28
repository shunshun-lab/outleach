import { NextResponse } from "next/server";
import { orchestrator } from "../start/route";
import { writeAuditLog } from "@/lib/channels/audit";
import type { ChannelType } from "@/types";

/**
 * POST /api/orchestrator/approve
 *
 * review 中のパイプラインを承認し、送信を開始する。
 * 承認されたターゲットIDのみがキューに積まれる。
 *
 * リクエストボディ:
 * - runId: パイプラインのID
 * - approvedTargetIds: 承認する contactId の配列
 * - approvedChannels: (optional) contactId -> チャネル のマップ
 * - approvedBy: 承認者のID
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    runId: string;
    approvedTargetIds: string[];
    approvedChannels?: Record<string, ChannelType>;
    approvedBy: string;
  };

  if (!body.runId || !body.approvedTargetIds?.length || !body.approvedBy) {
    return NextResponse.json(
      { error: "runId, approvedTargetIds（1件以上）, approvedBy は必須です" },
      { status: 400 }
    );
  }

  const run = await orchestrator.getStatus(body.runId);

  // 監査ログ: 承認アクション
  for (const targetId of body.approvedTargetIds) {
    const channel = body.approvedChannels?.[targetId];
    writeAuditLog({
      action: "approve",
      campaignId: run.campaignId,
      targetId,
      contactId: targetId,
      channel,
      performedBy: body.approvedBy,
      details: {
        runId: body.runId,
        channelExplicitlySelected: !!channel,
      },
    });

    if (channel) {
      writeAuditLog({
        action: "channel_select",
        campaignId: run.campaignId,
        targetId,
        contactId: targetId,
        channel,
        performedBy: body.approvedBy,
      });
    }
  }

  await orchestrator.approve(body.runId, body.approvedTargetIds, {
    approvedChannels: body.approvedChannels,
    approvedBy: body.approvedBy,
  });

  const updatedRun = await orchestrator.getStatus(body.runId);

  return NextResponse.json({
    runId: body.runId,
    status: updatedRun.status,
    currentStep: updatedRun.currentStep,
    approvedCount: body.approvedTargetIds.length,
  });
}
