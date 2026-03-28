import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ChannelType } from "@/types";

/**
 * POST /api/orchestrator/approve
 *
 * レビュー中のメッセージを承認し、送信ステータスに進める。
 * DBのMessageステータスを更新し、AuditLogに記録する。
 *
 * リクエストボディ:
 * - runId: キャンペーンID（DB駆動ではcampaignId）
 * - approvedTargetIds: 承認する contactId の配列
 * - approvedChannels: (optional) contactId -> チャネル のマップ
 * - editedMessages: (optional) contactId -> { variantIndex: editedBody } のマップ
 * - approvedBy: 承認者のID
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    runId: string;
    approvedTargetIds: string[];
    approvedChannels?: Record<string, ChannelType>;
    editedMessages?: Record<string, Record<number, string>>;
    approvedBy: string;
  };

  if (!body.runId || !body.approvedTargetIds?.length || !body.approvedBy) {
    return NextResponse.json(
      { error: "runId, approvedTargetIds（1件以上）, approvedBy は必須です" },
      { status: 400 }
    );
  }

  const campaignId = body.runId;
  const now = new Date();

  // キャンペーンの存在確認
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "キャンペーンが見つかりません" },
      { status: 404 }
    );
  }

  // 対象メッセージを取得
  const messages = await prisma.message.findMany({
    where: {
      campaignId,
      contactId: { in: body.approvedTargetIds },
      status: { in: ["draft", "review"] },
    },
  });

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "承認対象のメッセージが見つかりません" },
      { status: 404 }
    );
  }

  // バッチトランザクションで一括更新（adapter-pg 互換）
  const operations = [];

  for (const msg of messages) {
    const channel = body.approvedChannels?.[msg.contactId] ?? msg.channel ?? "mail";

    // 編集されたメッセージがあればvariantsJsonを更新
    let variantsJson = msg.variantsJson;
    const edits = body.editedMessages?.[msg.contactId];
    if (edits) {
      const variants = variantsJson as Array<{ body: string; angle: string; qualityScore?: number; passedWordCheck: boolean }>;
      for (const [indexStr, newBody] of Object.entries(edits)) {
        const idx = parseInt(indexStr, 10);
        if (variants[idx]) {
          variants[idx].body = newBody;
        }
      }
      variantsJson = variants;
    }

    // Messageステータスを approved に更新
    operations.push(
      prisma.message.update({
        where: { id: msg.id },
        data: {
          status: "approved",
          channel,
          approvedBy: body.approvedBy,
          approvedAt: now,
          approvedIndex: 0,
          variantsJson: variantsJson ?? undefined,
        },
      })
    );

    // AuditLog に承認アクションを記録
    operations.push(
      prisma.auditLog.create({
        data: {
          action: "approve",
          campaignId,
          targetId: msg.contactId,
          contactId: msg.contactId,
          channel,
          performedBy: body.approvedBy,
          detailsJson: {
            messageId: msg.id,
            channelExplicitlySelected: !!body.approvedChannels?.[msg.contactId],
            edited: !!edits,
          },
        },
      })
    );

    // チャネル選択の監査ログ
    if (body.approvedChannels?.[msg.contactId]) {
      operations.push(
        prisma.auditLog.create({
          data: {
            action: "channel_select",
            campaignId,
            targetId: msg.contactId,
            contactId: msg.contactId,
            channel,
            performedBy: body.approvedBy,
          },
        })
      );
    }

    // メッセージ編集の監査ログ
    if (edits) {
      operations.push(
        prisma.auditLog.create({
          data: {
            action: "message_edit",
            campaignId,
            targetId: msg.contactId,
            contactId: msg.contactId,
            channel,
            performedBy: body.approvedBy,
            detailsJson: { editedVariants: Object.keys(edits).map(Number) },
          },
        })
      );
    }
  }

  // キャンペーンステータスを更新
  operations.push(
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "approved" },
    })
  );

  await prisma.$transaction(operations);

  return NextResponse.json({
    runId: campaignId,
    status: "approved",
    currentStep: "sending",
    approvedCount: messages.length,
  });
}
