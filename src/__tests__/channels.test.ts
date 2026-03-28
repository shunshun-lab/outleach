/**
 * チャネルアダプタ・リゾルバのユニットテスト
 *
 * テストデータは匿名化した fixtures を使用（privacy.md 準拠）
 */
import { MailChannelAdapter } from "@/lib/channels/mail-adapter";
import { LineChannelAdapter } from "@/lib/channels/line-adapter";
import { MessengerChannelAdapter } from "@/lib/channels/messenger-adapter";
import { resolveChannels } from "@/lib/channels/resolver";
import { generateIdempotencyKey } from "@/lib/channels/idempotency";
import type { ChannelContact, ChannelCampaignContext } from "@/types/channel";

// ─── テストフィクスチャ ───

const campaign: ChannelCampaignContext = {
  campaignId: "test-campaign-001",
  campaignName: "テストキャンペーン",
};

const contactMailOnly: ChannelContact = {
  id: "contact-001",
  name: "テスト太郎",
  email: "test@example.com",
};

const contactWithLine: ChannelContact = {
  id: "contact-002",
  name: "テスト花子",
  email: "test2@example.com",
  lineUserId: "U1234567890",
  lineLinkedAt: new Date("2026-03-01"),
};

const contactWithMessenger: ChannelContact = {
  id: "contact-003",
  name: "テスト次郎",
  email: "test3@example.com",
  messengerPsid: "psid_123456",
  messengerLastInboundAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12時間前
};

const contactMessengerExpired: ChannelContact = {
  id: "contact-004",
  name: "テスト三郎",
  messengerPsid: "psid_789012",
  messengerLastInboundAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48時間前
};

const contactNoChannels: ChannelContact = {
  id: "contact-005",
  name: "テスト四郎",
};

const contactOptedOut: ChannelContact = {
  id: "contact-006",
  name: "テスト五郎",
  email: "test6@example.com",
  lineUserId: "U9876543210",
  lineLinkedAt: new Date("2026-03-01"),
  optOutChannels: ["mail", "line"],
};

// ─── MailChannelAdapter ───

describe("MailChannelAdapter", () => {
  const adapter = new MailChannelAdapter();

  test("email がある場合は送信可能", () => {
    const result = adapter.canSend(contactMailOnly, campaign);
    expect(result.available).toBe(true);
  });

  test("email がない場合は送信不可", () => {
    const result = adapter.canSend(contactNoChannels, campaign);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("メールアドレス");
  });

  test("opt-out の場合は送信不可", () => {
    const result = adapter.canSend(contactOptedOut, campaign);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("オプトアウト");
  });

  test("送信成功を返す", async () => {
    const result = await adapter.send(
      { body: "テストメッセージ", angle: "テスト" },
      contactMailOnly,
      {
        campaignId: "test",
        idempotencyKey: "idem_test",
        approvedBy: "test-user",
        approvedAt: new Date(),
      }
    );
    expect(result.success).toBe(true);
    expect(result.channel).toBe("mail");
    expect(result.deliveryStatus).toBe("sent");
  });
});

// ─── LineChannelAdapter ───

describe("LineChannelAdapter", () => {
  const adapter = new LineChannelAdapter();

  test("lineUserId + lineLinkedAt がある場合は送信可能", () => {
    const result = adapter.canSend(contactWithLine, campaign);
    expect(result.available).toBe(true);
  });

  test("lineUserId がない場合は送信不可", () => {
    const result = adapter.canSend(contactMailOnly, campaign);
    expect(result.available).toBe(false);
  });

  test("lineLinkedAt がない場合は送信不可", () => {
    const contact: ChannelContact = {
      id: "test",
      name: "test",
      lineUserId: "U123",
    };
    const result = adapter.canSend(contact, campaign);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("連携が未完了");
  });

  test("opt-out の場合は送信不可", () => {
    const result = adapter.canSend(contactOptedOut, campaign);
    expect(result.available).toBe(false);
  });
});

// ─── MessengerChannelAdapter ───

describe("MessengerChannelAdapter", () => {
  const adapter = new MessengerChannelAdapter();

  test("PSID + 24時間以内の受信がある場合は送信可能", () => {
    const result = adapter.canSend(contactWithMessenger, campaign);
    expect(result.available).toBe(true);
  });

  test("PSID がない場合は送信不可", () => {
    const result = adapter.canSend(contactMailOnly, campaign);
    expect(result.available).toBe(false);
  });

  test("24時間を超過している場合は送信不可", () => {
    const result = adapter.canSend(contactMessengerExpired, campaign);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("24時間");
  });

  test("受信履歴がない場合は送信不可", () => {
    const contact: ChannelContact = {
      id: "test",
      name: "test",
      messengerPsid: "psid_xxx",
    };
    const result = adapter.canSend(contact, campaign);
    expect(result.available).toBe(false);
  });
});

// ─── ChannelResolver ───

describe("resolveChannels", () => {
  test("Mail のみ利用可能な contact", () => {
    const resolution = resolveChannels(contactMailOnly, campaign);
    expect(resolution.recommendedChannel).toBe("mail");
    expect(resolution.fallbackChannel).toBe("mail");
    const mailAvail = resolution.availableChannels.find(
      (c) => c.channel === "mail"
    );
    expect(mailAvail?.available).toBe(true);
  });

  test("LINE 利用可能な contact は LINE を推奨", () => {
    const resolution = resolveChannels(contactWithLine, campaign);
    expect(resolution.recommendedChannel).toBe("line");
    expect(resolution.fallbackChannel).toBe("mail");
  });

  test("preferredChannel が設定されていればそちらを推奨", () => {
    const contact: ChannelContact = {
      ...contactWithLine,
      preferredChannel: "mail",
    };
    const resolution = resolveChannels(contact, campaign);
    expect(resolution.recommendedChannel).toBe("mail");
  });

  test("チャネルなしの contact は mail fallback", () => {
    const resolution = resolveChannels(contactNoChannels, campaign);
    expect(resolution.recommendedChannel).toBe("mail");
    const mailAvail = resolution.availableChannels.find(
      (c) => c.channel === "mail"
    );
    expect(mailAvail?.available).toBe(false); // email もない
  });

  test("全チャネル opt-out 済み", () => {
    const resolution = resolveChannels(contactOptedOut, campaign);
    const available = resolution.availableChannels.filter((c) => c.available);
    expect(available.length).toBe(0);
  });
});

// ─── Idempotency ───

describe("generateIdempotencyKey", () => {
  test("同じ入力で同じキーを生成", () => {
    const key1 = generateIdempotencyKey("c1", "contact1", "mail");
    const key2 = generateIdempotencyKey("c1", "contact1", "mail");
    expect(key1).toBe(key2);
  });

  test("異なるチャネルで異なるキーを生成", () => {
    const key1 = generateIdempotencyKey("c1", "contact1", "mail");
    const key2 = generateIdempotencyKey("c1", "contact1", "line");
    expect(key1).not.toBe(key2);
  });

  test("idem_ プレフィックス付き", () => {
    const key = generateIdempotencyKey("c1", "contact1", "mail");
    expect(key).toMatch(/^idem_[0-9a-f]{16}$/);
  });
});
