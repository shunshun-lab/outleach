/**
 * チャネル関連のユニットテスト
 *
 * - 各アダプタの canSend 判定
 * - チャネル解決ロジック
 * - 冪等性キー生成
 * - 監査ログ
 * - Mail/Messenger のスタブ送信
 */
import { describe, it, expect, beforeEach } from "vitest";
import { MailChannelAdapter } from "@/lib/channels/mail-adapter";
import { LineChannelAdapter } from "@/lib/channels/line-adapter";
import { MessengerChannelAdapter } from "@/lib/channels/messenger-adapter";
import {
  generateIdempotencyKey,
  generateSequenceIdempotencyKey,
} from "@/lib/channels/idempotency";
import {
  resolveChannels,
  resolveChannelsBatch,
  canSendVia,
} from "@/lib/channels/resolver";
import {
  writeAuditLog,
  getAuditLogs,
  getAuditLogsByAction,
} from "@/lib/channels/audit";
import type {
  ChannelContact,
  ChannelCampaignContext,
  ChannelSendContext,
} from "@/types/channel";

// ─── テストヘルパー ───

const campaign: ChannelCampaignContext = {
  campaignId: "camp-001",
  campaignName: "Test Campaign",
};

function makeContact(overrides: Partial<ChannelContact> = {}): ChannelContact {
  return {
    id: "contact-001",
    name: "テスト太郎",
    email: "test@example.com",
    ...overrides,
  };
}

function makeSendContext(
  overrides: Partial<ChannelSendContext> = {}
): ChannelSendContext {
  return {
    campaignId: "camp-001",
    idempotencyKey: "idem_test",
    approvedBy: "admin",
    approvedAt: new Date(),
    ...overrides,
  };
}

// ─── Mail アダプタ ───

describe("MailChannelAdapter", () => {
  const adapter = new MailChannelAdapter();

  it("メールアドレスありで送信可能", () => {
    const result = adapter.canSend(makeContact(), campaign);
    expect(result.available).toBe(true);
  });

  it("メールアドレスなしで送信不可", () => {
    const result = adapter.canSend(
      makeContact({ email: undefined }),
      campaign
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("メールアドレス");
  });

  it("オプトアウト済みで送信不可", () => {
    const result = adapter.canSend(
      makeContact({ optOutChannels: ["mail"] }),
      campaign
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("オプトアウト");
  });

  it("スタブ送信が成功を返す", async () => {
    const result = await adapter.send(
      { body: "テスト", angle: "test" },
      makeContact(),
      makeSendContext()
    );
    expect(result.success).toBe(true);
    expect(result.channel).toBe("mail");
    expect(result.deliveryStatus).toBe("sent");
  });

  it("メールアドレスなしの送信はrejectedを返す", async () => {
    const result = await adapter.send(
      { body: "テスト", angle: "test" },
      makeContact({ email: undefined }),
      makeSendContext()
    );
    expect(result.success).toBe(false);
    expect(result.deliveryStatus).toBe("rejected");
  });

  it("normalizeResultが正しく動作する", () => {
    expect(adapter.normalizeResult({ id: "msg-123" }).success).toBe(true);
    expect(adapter.normalizeResult({}).success).toBe(false);
  });
});

// ─── LINE アダプタ ───

describe("LineChannelAdapter", () => {
  const adapter = new LineChannelAdapter();

  it("LINE連携済みで送信可能", () => {
    const result = adapter.canSend(
      makeContact({
        lineUserId: "U1234",
        lineLinkedAt: new Date(),
      }),
      campaign
    );
    expect(result.available).toBe(true);
  });

  it("lineUserId なしで送信不可", () => {
    const result = adapter.canSend(makeContact(), campaign);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("LINE");
  });

  it("lineLinkedAt なしで送信不可", () => {
    const result = adapter.canSend(
      makeContact({ lineUserId: "U1234" }),
      campaign
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("連携");
  });

  it("オプトアウト済みで送信不可", () => {
    const result = adapter.canSend(
      makeContact({
        lineUserId: "U1234",
        lineLinkedAt: new Date(),
        optOutChannels: ["line"],
      }),
      campaign
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("オプトアウト");
  });
});

// ─── Messenger アダプタ ───

describe("MessengerChannelAdapter", () => {
  const adapter = new MessengerChannelAdapter();

  it("24時間以内の受信ありで送信可能", () => {
    const result = adapter.canSend(
      makeContact({
        messengerPsid: "psid-123",
        messengerLastInboundAt: new Date(), // 今
      }),
      campaign
    );
    expect(result.available).toBe(true);
  });

  it("PSID なしで送信不可", () => {
    const result = adapter.canSend(makeContact(), campaign);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("PSID");
  });

  it("受信履歴なしで送信不可", () => {
    const result = adapter.canSend(
      makeContact({ messengerPsid: "psid-123" }),
      campaign
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("受信履歴");
  });

  it("24時間超過で送信不可", () => {
    const expired = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const result = adapter.canSend(
      makeContact({
        messengerPsid: "psid-123",
        messengerLastInboundAt: expired,
      }),
      campaign
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("24時間");
  });

  it("オプトアウト済みで送信不可", () => {
    const result = adapter.canSend(
      makeContact({
        messengerPsid: "psid-123",
        messengerLastInboundAt: new Date(),
        optOutChannels: ["messenger"],
      }),
      campaign
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("オプトアウト");
  });

  it("スタブ送信が成功を返す", async () => {
    const result = await adapter.send(
      { body: "テスト", angle: "test" },
      makeContact({
        messengerPsid: "psid-123",
        messengerLastInboundAt: new Date(),
      }),
      makeSendContext()
    );
    expect(result.success).toBe(true);
    expect(result.channel).toBe("messenger");
  });
});

// ─── チャネル解決 ───

describe("resolveChannels", () => {
  it("メールのみ利用可能な場合mailを推奨", () => {
    const resolution = resolveChannels(makeContact(), campaign);
    expect(resolution.recommendedChannel).toBe("mail");
    expect(resolution.fallbackChannel).toBe("mail");
    const mailAvail = resolution.availableChannels.find(
      (c) => c.channel === "mail"
    );
    expect(mailAvail?.available).toBe(true);
  });

  it("LINE連携済みならLINEを推奨", () => {
    const resolution = resolveChannels(
      makeContact({ lineUserId: "U123", lineLinkedAt: new Date() }),
      campaign
    );
    expect(resolution.recommendedChannel).toBe("line");
  });

  it("preferredChannelが利用可能ならそれを推奨", () => {
    const resolution = resolveChannels(
      makeContact({ preferredChannel: "mail" }),
      campaign
    );
    expect(resolution.recommendedChannel).toBe("mail");
  });

  it("resolveChannelsBatchで複数contactを一括処理", () => {
    const contacts = [
      makeContact({ id: "c1" }),
      makeContact({ id: "c2", lineUserId: "U1", lineLinkedAt: new Date() }),
    ];
    const results = resolveChannelsBatch(contacts, campaign);
    expect(results).toHaveLength(2);
    expect(results[0].recommendedChannel).toBe("mail");
    expect(results[1].recommendedChannel).toBe("line");
  });

  it("canSendViaで個別チャネル確認", () => {
    expect(canSendVia("mail", makeContact(), campaign)).toBe(true);
    expect(canSendVia("line", makeContact(), campaign)).toBe(false);
  });
});

// ─── 冪等性キー ───

describe("Idempotency", () => {
  it("同一入力で同じキーを生成", () => {
    const k1 = generateIdempotencyKey("c1", "t1", "mail");
    const k2 = generateIdempotencyKey("c1", "t1", "mail");
    expect(k1).toBe(k2);
  });

  it("異なる入力で異なるキーを生成", () => {
    const k1 = generateIdempotencyKey("c1", "t1", "mail");
    const k2 = generateIdempotencyKey("c1", "t1", "line");
    expect(k1).not.toBe(k2);
  });

  it("idem_プレフィクスを持つ", () => {
    const key = generateIdempotencyKey("c1", "t1", "mail");
    expect(key).toMatch(/^idem_/);
  });

  it("シーケンスキーはidem_seq_プレフィクスを持つ", () => {
    const key = generateSequenceIdempotencyKey("c1", "t1", "mail", 1);
    expect(key).toMatch(/^idem_seq_/);
  });

  it("シーケンスキーはステップ番号で異なる", () => {
    const k1 = generateSequenceIdempotencyKey("c1", "t1", "mail", 1);
    const k2 = generateSequenceIdempotencyKey("c1", "t1", "mail", 2);
    expect(k1).not.toBe(k2);
  });
});

// ─── 監査ログ ───

describe("AuditLog", () => {
  it("ログを書き込んで取得できる", () => {
    const uniqueCampaign = `audit-test-${Date.now()}`;
    writeAuditLog({
      action: "approve",
      campaignId: uniqueCampaign,
      targetId: "t1",
      performedBy: "admin",
    });
    writeAuditLog({
      action: "send_success",
      campaignId: uniqueCampaign,
      targetId: "t1",
      performedBy: "system",
    });

    const logs = getAuditLogs(uniqueCampaign);
    expect(logs).toHaveLength(2);

    const approveLogs = getAuditLogsByAction(uniqueCampaign, "approve");
    expect(approveLogs).toHaveLength(1);
    expect(approveLogs[0].performedBy).toBe("admin");
  });
});
