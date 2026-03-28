/**
 * レビューAPI・承認APIのユニットテスト
 *
 * Prisma をモックしてAPIルートのロジックを検証する。
 * - GET /api/campaigns/[id]/review — レビューデータ取得
 * - POST /api/orchestrator/approve — メッセージ承認
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Prisma モック ───
const mockPrisma = {
  campaign: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

// ─── テストデータ ───
const CAMPAIGN_ID = "test-campaign-001";

const MOCK_CAMPAIGN = {
  id: CAMPAIGN_ID,
  name: "テストキャンペーン",
  status: "review",
  productJson: {},
  segmentJson: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_CONTACT = {
  id: "contact-001",
  name: "テスト太郎",
  platform: "connpass",
  platformId: "taro-connpass",
  email: "taro@example.com",
  lineUserId: "U_taro",
  messengerPsid: null,
  preferredChannel: "line",
  optOutEmail: false,
  optOutLine: false,
  optOutMessenger: false,
  lineLinkedAt: new Date(),
  messengerLastInboundAt: null,
  attributesJson: {
    relevanceScore: 80,
    matchedAngle: "教育体験",
    matchReason: "教育イベント参加歴あり",
  },
  behaviorsJson: [{ type: "event-attended", detail: "教育ハッカソン" }],
  tagsJson: null,
  createdAt: new Date(),
};

const MOCK_VARIANTS = [
  {
    body: "テスト太郎さんの教育体験への関心に合うプログラムがあります。",
    angle: "教育体験",
    qualityScore: 75,
    passedWordCheck: true,
  },
  {
    body: "テスト太郎さんが参加された教育ハッカソンの延長線上にある体験です。",
    angle: "教育体験（簡潔版）",
    qualityScore: 70,
    passedWordCheck: true,
  },
];

const MOCK_MESSAGE = {
  id: "msg-001",
  campaignId: CAMPAIGN_ID,
  contactId: "contact-001",
  variantsJson: MOCK_VARIANTS,
  status: "review",
  channel: "line",
  approvedIndex: null,
  sentAt: null,
  createdAt: new Date(),
  providerMessageId: null,
  deliveryStatus: null,
  idempotencyKey: null,
  approvedBy: null,
  approvedAt: null,
};

// ─── Review API テスト ───
describe("GET /api/campaigns/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Import dynamically to pick up mocks
  async function callReviewAPI(campaignId: string) {
    const { GET } = await import("@/app/api/campaigns/[id]/review/route");
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/review`);
    return GET(request, { params: Promise.resolve({ id: campaignId }) });
  }

  it("キャンペーンが見つからない場合は404を返す", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(null);

    const res = await callReviewAPI("nonexistent-id");
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toContain("見つかりません");
  });

  it("キャンペーンとメッセージが存在する場合、正しいレビューデータを返す", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([
      { ...MOCK_MESSAGE, contact: MOCK_CONTACT },
    ]);

    const res = await callReviewAPI(CAMPAIGN_ID);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.runId).toBe(CAMPAIGN_ID);
    expect(json.campaignId).toBe(CAMPAIGN_ID);
    expect(json.campaignName).toBe("テストキャンペーン");
    expect(json.status).toBe("paused"); // review status messages → paused
    expect(json.targets).toHaveLength(1);

    const target = json.targets[0];
    expect(target.contactId).toBe("contact-001");
    expect(target.contactName).toBe("テスト太郎");
    expect(target.relevanceScore).toBe(80);
    expect(target.matchedAngle).toBe("教育体験");
    expect(target.messageVariants).toHaveLength(2);
    expect(target.messageVariants[0].body).toContain("テスト太郎さん");
  });

  it("メッセージがない場合はtargetsが空配列で返る", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([]);

    const res = await callReviewAPI(CAMPAIGN_ID);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.targets).toHaveLength(0);
  });

  it("チャネル解決情報が正しく構築される", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([
      { ...MOCK_MESSAGE, contact: MOCK_CONTACT },
    ]);

    const res = await callReviewAPI(CAMPAIGN_ID);
    const json = await res.json();
    const target = json.targets[0];

    expect(target.channelResolution).toBeDefined();
    expect(target.channelResolution.availableChannels).toHaveLength(3);

    // mail: available (email exists, not opted out)
    const mail = target.channelResolution.availableChannels.find(
      (c: { channel: string }) => c.channel === "mail"
    );
    expect(mail.available).toBe(true);

    // line: available (lineUserId exists, not opted out)
    const line = target.channelResolution.availableChannels.find(
      (c: { channel: string }) => c.channel === "line"
    );
    expect(line.available).toBe(true);

    // messenger: not available (messengerPsid is null)
    const messenger = target.channelResolution.availableChannels.find(
      (c: { channel: string }) => c.channel === "messenger"
    );
    expect(messenger.available).toBe(false);

    // recommended channel = preferredChannel = "line"
    expect(target.channelResolution.recommendedChannel).toBe("line");
  });

  it("全メッセージがapprovedの場合、statusがcompletedになる", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([
      { ...MOCK_MESSAGE, status: "approved", contact: MOCK_CONTACT },
    ]);

    const res = await callReviewAPI(CAMPAIGN_ID);
    const json = await res.json();
    expect(json.status).toBe("completed");
  });
});

// ─── Approve API テスト ───
describe("POST /api/orchestrator/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function callApproveAPI(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/orchestrator/approve/route");
    const request = new Request("http://localhost/api/orchestrator/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return POST(request);
  }

  it("必須パラメータが欠けている場合は400を返す", async () => {
    const res = await callApproveAPI({ runId: CAMPAIGN_ID });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("必須");
  });

  it("approvedByがない場合は400を返す", async () => {
    const res = await callApproveAPI({
      runId: CAMPAIGN_ID,
      approvedTargetIds: ["contact-001"],
    });
    expect(res.status).toBe(400);
  });

  it("キャンペーンが見つからない場合は404を返す", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(null);

    const res = await callApproveAPI({
      runId: "nonexistent-id",
      approvedTargetIds: ["contact-001"],
      approvedBy: "shun",
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("キャンペーンが見つかりません");
  });

  it("承認対象メッセージが見つからない場合は404を返す", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([]);

    const res = await callApproveAPI({
      runId: CAMPAIGN_ID,
      approvedTargetIds: ["contact-nonexistent"],
      approvedBy: "shun",
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("承認対象のメッセージが見つかりません");
  });

  it("正常な承認リクエストで$transactionが呼ばれ200が返る", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([MOCK_MESSAGE]);
    mockPrisma.$transaction.mockResolvedValue([]);

    const res = await callApproveAPI({
      runId: CAMPAIGN_ID,
      approvedTargetIds: ["contact-001"],
      approvedBy: "shun",
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.runId).toBe(CAMPAIGN_ID);
    expect(json.status).toBe("approved");
    expect(json.currentStep).toBe("sending");
    expect(json.approvedCount).toBe(1);

    // $transactionがバッチ配列で呼ばれた
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
  });

  it("チャネル指定ありの場合、追加の監査ログが作成される", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([MOCK_MESSAGE]);
    mockPrisma.$transaction.mockResolvedValue([]);
    // message.update と auditLog.create は $transaction 内で呼ばれるが、
    // バッチトランザクションなので prisma 直接呼び出しとしてモックされる
    mockPrisma.message.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await callApproveAPI({
      runId: CAMPAIGN_ID,
      approvedTargetIds: ["contact-001"],
      approvedChannels: { "contact-001": "mail" },
      approvedBy: "shun",
    });

    expect(res.status).toBe(200);

    // バッチ配列にchannel_selectのauditLogが含まれているはず
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    // message.update(1) + auditLog approve(1) + auditLog channel_select(1) + campaign.update(1) = 4
    expect(txArg.length).toBe(4);
  });

  it("メッセージ編集ありの場合、message_edit監査ログが追加される", async () => {
    mockPrisma.campaign.findUnique.mockResolvedValue(MOCK_CAMPAIGN);
    mockPrisma.message.findMany.mockResolvedValue([MOCK_MESSAGE]);
    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.message.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const res = await callApproveAPI({
      runId: CAMPAIGN_ID,
      approvedTargetIds: ["contact-001"],
      editedMessages: { "contact-001": { 0: "編集後のメッセージ" } },
      approvedBy: "shun",
    });

    expect(res.status).toBe(200);

    // message.update(1) + auditLog approve(1) + auditLog message_edit(1) + campaign.update(1) = 4
    const txArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(txArg.length).toBe(4);
  });
});
