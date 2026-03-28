import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Message, Contact } from "@/generated/prisma/client";

/**
 * GET /api/campaigns/[id]/review
 *
 * キャンペーンに紐づくレビュー待ちメッセージとContact情報を
 * Prisma経由でDBから取得して返す。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "キャンペーンが見つかりません" },
      { status: 404 }
    );
  }

  // review / paused / draft ステータスのメッセージを取得
  const messages = await prisma.message.findMany({
    where: {
      campaignId,
      status: { in: ["draft", "review", "approved"] },
    },
    include: {
      contact: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // メッセージをContact単位でグループ化してReviewTarget形式に変換
  const contactMap = new Map<
    string,
    {
      contact: typeof messages[0]["contact"];
      messages: typeof messages;
    }
  >();

  for (const msg of messages) {
    const existing = contactMap.get(msg.contactId);
    if (existing) {
      existing.messages.push(msg);
    } else {
      contactMap.set(msg.contactId, {
        contact: msg.contact,
        messages: [msg],
      });
    }
  }

  const targets = Array.from(contactMap.entries()).map(
    ([contactId, { contact, messages: msgs }]) => {
      // variantsJson から MessageVariant[] を復元
      const firstMsg = msgs[0];
      const variants = (firstMsg.variantsJson as Array<{
        body: string;
        angle: string;
        qualityScore?: number;
        passedWordCheck: boolean;
      }>) ?? [];

      // Contact属性からrelevanceScoreとangle情報を取得
      const attributes = contact.attributesJson as Record<string, unknown> ?? {};
      const behaviors = contact.behaviorsJson as Array<Record<string, unknown>> ?? [];

      // チャネル解決情報を構築
      const availableChannels = [
        {
          channel: "mail" as const,
          available: !!contact.email && !contact.optOutEmail,
          reason: !contact.email ? "メール未設定" : contact.optOutEmail ? "オプトアウト済み" : undefined,
        },
        {
          channel: "line" as const,
          available: !!contact.lineUserId && !contact.optOutLine,
          reason: !contact.lineUserId ? "LINE未連携" : contact.optOutLine ? "オプトアウト済み" : undefined,
        },
        {
          channel: "messenger" as const,
          available: !!contact.messengerPsid && !contact.optOutMessenger,
          reason: !contact.messengerPsid ? "Messenger未連携" : contact.optOutMessenger ? "オプトアウト済み" : undefined,
        },
      ];

      const recommendedChannel =
        contact.preferredChannel ??
        (contact.lineUserId && !contact.optOutLine ? "line" : "mail");

      return {
        contactId,
        contactName: contact.name,
        contactPlatform: contact.platform ?? undefined,
        relevanceScore: (attributes.relevanceScore as number) ?? 50,
        matchedAngle: (attributes.matchedAngle as string) ?? variants[0]?.angle ?? "",
        matchReason: (attributes.matchReason as string) ?? "",
        messageVariants: variants.map((v) => ({
          body: v.body,
          angle: v.angle,
          qualityScore: v.qualityScore,
          passedWordCheck: v.passedWordCheck ?? true,
        })),
        channelResolution: {
          contactId,
          availableChannels,
          recommendedChannel,
          fallbackChannel: "mail" as const,
        },
        selectedChannel: firstMsg.channel ?? recommendedChannel,
        // DB上のメッセージIDを返す（approve時に使う）
        messageId: firstMsg.id,
        messageStatus: firstMsg.status,
      };
    }
  );

  return NextResponse.json({
    runId: campaignId, // DB駆動なのでcampaignIdをrunIdとして使う
    campaignId,
    campaignName: campaign.name,
    status: messages.some((m: Message & { contact: Contact }) => m.status === "draft" || m.status === "review")
      ? "paused"
      : messages.every((m: Message & { contact: Contact }) => m.status === "approved")
        ? "completed"
        : campaign.status,
    currentStep: "review",
    targets,
    approvedTargetIds: messages
      .filter((m: Message & { contact: Contact }) => m.status === "approved")
      .map((m: Message & { contact: Contact }) => m.contactId),
    error: null,
  });
}
