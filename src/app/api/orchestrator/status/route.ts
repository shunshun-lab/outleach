import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator/singleton";
import { getAuditLogs } from "@/lib/channels/audit";

/**
 * GET /api/orchestrator/status?runId=xxx
 *
 * パイプラインの状態と、review ステップのターゲット一覧
 * （チャネル解決結果を含む）を返す。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json(
      { error: "runId クエリパラメータは必須です" },
      { status: 400 }
    );
  }

  const run = await orchestrator.getStatus(runId);

  // review データを整形
  const targets = (run.state.generatedMessages ?? []).map((target) => ({
    contactId: target.contactId,
    contactName: target.contact.name,
    contactPlatform: target.contact.platform,
    relevanceScore: target.relevanceScore,
    matchedAngle: target.matchedAngle,
    matchReason: target.matchReason,
    messageVariants: target.messages.map((m) => ({
      body: m.body,
      angle: m.angle,
      qualityScore: m.qualityScore,
      passedWordCheck: m.passedWordCheck,
    })),
    channelResolution: target.channelResolution,
    selectedChannel: target.selectedChannel,
  }));

  const auditLogs = getAuditLogs(run.campaignId);

  return NextResponse.json({
    runId: run.id,
    campaignId: run.campaignId,
    status: run.status,
    currentStep: run.currentStep,
    targets,
    approvedTargetIds: run.state.approvedTargetIds,
    approvedChannels: run.state.approvedChannels,
    auditLogs: auditLogs.map((log) => ({
      action: log.action,
      targetId: log.targetId,
      channel: log.channel,
      performedBy: log.performedBy,
      createdAt: log.createdAt,
    })),
    error: run.error,
  });
}
