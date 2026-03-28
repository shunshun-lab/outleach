/**
 * LINE アダプタ送信テスト
 *
 * 使い方:
 *   npx tsx --tsconfig tsconfig.json -r tsconfig-paths/register scripts/test-line.ts [lineUserId]
 *
 * lineUserId を省略するとトークン検証のみ行う（実送信しない）。
 */
import "dotenv/config";

// @line/bot-sdk を直接使用してトークン検証
import { Client } from "@line/bot-sdk";

async function main() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("❌ LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
    process.exit(1);
  }

  // --- Step 1: ボット情報取得でトークン有効性を確認 ---
  console.log("--- Step 1: トークン検証 ---");
  const client = new Client({ channelAccessToken: token });

  try {
    const botInfo = await client.getBotInfo();
    console.log("✅ LINE Messaging API 接続成功!");
    console.log("  ボット名:", botInfo.displayName);
    console.log("  Basic ID:", botInfo.basicId);
  } catch (err) {
    console.error("❌ LINE API 接続失敗:", err);
    process.exit(1);
  }

  // --- Step 2: アダプタの canSend テスト ---
  console.log("\n--- Step 2: LineChannelAdapter.canSend テスト ---");

  // 動的インポートで path alias を解決
  const { LineChannelAdapter } = await import("../src/lib/channels/line-adapter");
  const adapter = new LineChannelAdapter();
  const campaign = { campaignId: "test-001", campaignName: "テストキャンペーン" };

  const noLineContact = { id: "c1", name: "テスト太郎" };
  const notLinkedContact = { id: "c2", name: "テスト次郎", lineUserId: "U1234" };
  const validContact = {
    id: "c3",
    name: "テスト三郎",
    lineUserId: "U1234",
    lineLinkedAt: new Date(),
  };

  console.log("  lineUserId なし:", adapter.canSend(noLineContact, campaign));
  console.log("  未連携:", adapter.canSend(notLinkedContact, campaign));
  console.log("  正常:", adapter.canSend(validContact, campaign));

  // --- Step 3: 実送信テスト（lineUserId 引数がある場合のみ） ---
  const targetUserId = process.argv[2];
  if (!targetUserId) {
    console.log("\n⏭  lineUserId が未指定のため実送信テストはスキップ");
    console.log("  実送信する場合: npx tsx -r tsconfig-paths/register scripts/test-line.ts <lineUserId>");
    return;
  }

  console.log(`\n--- Step 3: 実送信テスト (to: ${targetUserId}) ---`);
  const sendContact = {
    id: "test-send",
    name: "送信テスト",
    lineUserId: targetUserId,
    lineLinkedAt: new Date(),
  };

  const draft = {
    body: "🔧 Outreach App LINE送信テスト（自動テストメッセージです）",
    angle: "test",
  };

  const context = {
    campaignId: "test-001",
    idempotencyKey: `test-${Date.now()}`,
    approvedBy: "test-script",
    approvedAt: new Date(),
  };

  const result = await adapter.send(draft, sendContact, context);
  console.log("  送信結果:", JSON.stringify(result, null, 2));

  if (result.success) {
    console.log("✅ LINE メッセージ送信成功!");
  } else {
    console.error("❌ 送信失敗:", result.error);
  }
}

main().catch(console.error);
