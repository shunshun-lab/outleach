import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

/**
 * LINE Webhook エンドポイント
 *
 * LINE公式アカウントに友達追加されたら自動でContactを作成する。
 * ブロック（unfollow）されたらoptOutLineをtrueにする。
 *
 * LINE Developers Console の Webhook URL に
 * https://<your-domain>/api/webhook/line を設定する。
 */

type LineEvent = {
  type: string;
  source: { type: string; userId: string };
  timestamp: number;
  replyToken?: string;
};

type LineWebhookBody = {
  destination: string;
  events: LineEvent[];
};

/** 署名検証 — LINE_CHANNEL_SECRET で HMAC-SHA256 を検証 */
function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = crypto
    .createHmac("SHA256", secret)
    .update(body)
    .digest("base64");
  const hashBuf = Buffer.from(hash);
  const sigBuf = Buffer.from(signature);
  if (hashBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, sigBuf);
}

/** LINE Profile API でユーザー名を取得 */
async function getLineProfile(
  userId: string
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;

  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // 署名検証（LINE_CHANNEL_SECRET が設定されている場合）
  const signature = request.headers.get("x-line-signature");
  if (process.env.LINE_CHANNEL_SECRET) {
    if (!signature || !verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: Array<{ userId: string; action: string }> = [];

  for (const event of body.events) {
    const userId = event.source?.userId;
    if (!userId) continue;

    if (event.type === "follow") {
      // 友達追加 → Contact作成 or 復帰
      const existing = await prisma.contact.findFirst({
        where: { lineUserId: userId },
      });

      if (existing) {
        // ブロック解除で戻ってきた場合: optOutLine を解除
        await prisma.contact.update({
          where: { id: existing.id },
          data: { optOutLine: false, lineLinkedAt: new Date() },
        });
        results.push({ userId, action: "reactivated" });
      } else {
        // 新規: LINE Profile API で名前を取得
        const profile = await getLineProfile(userId);
        const name = profile?.displayName ?? "LINE User";

        await prisma.contact.create({
          data: {
            name,
            platform: "line",
            platformId: userId,
            lineUserId: userId,
            lineLinkedAt: new Date(),
            preferredChannel: "line",
            attributesJson: {},
            behaviorsJson: [
              {
                type: "follows",
                detail: "LINE公式アカウント友達追加",
                date: new Date().toISOString(),
              },
            ],
          },
        });
        results.push({ userId, action: "created" });
      }
    } else if (event.type === "unfollow") {
      // ブロック → optOutLine を true に
      const existing = await prisma.contact.findFirst({
        where: { lineUserId: userId },
      });
      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: { optOutLine: true },
        });
        results.push({ userId, action: "opted_out" });
      }
    } else if (event.type === "message") {
      // メッセージ受信 → messengerLastInboundAt 的な用途で記録可能
      // （将来の返信検知 / Auto-Pause 用）
      results.push({ userId, action: "message_received" });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
