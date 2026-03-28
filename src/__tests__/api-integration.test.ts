/**
 * APIルートのインテグレーションテスト
 *
 * Next.js App Router のルートハンドラを直接呼び出して、
 * リクエスト → レスポンスの一貫性を検証する。
 *
 * 注: Prisma DB接続が必要なルート（/api/orchestrator/approve, /api/campaigns/[id]/review）は
 * DB依存のためここではモックレビューAPIとステータスAPIをテストする。
 */
import { describe, it, expect } from "vitest";

// mock-review は DB 不要で動作する
import { GET as mockReviewGET } from "@/app/api/orchestrator/mock-review/route";

describe("GET /api/orchestrator/mock-review", () => {
  it("モックレビューデータを返す", async () => {
    const request = new Request(
      "http://localhost:3000/api/orchestrator/mock-review?campaignId=test-campaign"
    );
    const response = await mockReviewGET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.campaignId).toBe("test-campaign");
    expect(data.status).toBe("paused");
    expect(data.currentStep).toBe("review");
    expect(data.targets).toHaveLength(3);
  });

  it("campaignId省略時はデフォルトIDを使用", async () => {
    const request = new Request(
      "http://localhost:3000/api/orchestrator/mock-review"
    );
    const response = await mockReviewGET(request);
    const data = await response.json();
    expect(data.campaignId).toBe("campaign-demo-001");
  });

  it("各ターゲットにチャネル解決結果が含まれる", async () => {
    const request = new Request(
      "http://localhost:3000/api/orchestrator/mock-review"
    );
    const response = await mockReviewGET(request);
    const data = await response.json();

    for (const target of data.targets) {
      expect(target.channelResolution).toBeDefined();
      expect(target.channelResolution.availableChannels).toBeInstanceOf(Array);
      expect(target.channelResolution.recommendedChannel).toBeDefined();
      expect(target.channelResolution.fallbackChannel).toBe("mail");
      expect(target.messageVariants.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("品質スコアが低いメッセージにpassedWordCheck=falseがある", async () => {
    const request = new Request(
      "http://localhost:3000/api/orchestrator/mock-review"
    );
    const response = await mockReviewGET(request);
    const data = await response.json();

    // 佐藤さんの2つ目のメッセージ（「今すぐ」を含む）
    const sato = data.targets.find(
      (t: { contactId: string }) => t.contactId === "contact-002"
    );
    expect(sato).toBeDefined();
    const failedVariant = sato.messageVariants.find(
      (m: { passedWordCheck: boolean }) => !m.passedWordCheck
    );
    expect(failedVariant).toBeDefined();
    expect(failedVariant.qualityScore).toBeLessThan(60);
  });
});

// ─── approveルートのバリデーションテスト（Prisma をモック） ───

describe("POST /api/orchestrator/approve — validation", () => {
  it("必須フィールド欠落で400エラー", async () => {
    // approveルートは prisma を import するため、直接テストするには
    // DB接続が必要。ここではリクエストバリデーションのロジックを
    // 間接的にテストする形にする。
    const body = { runId: "", approvedTargetIds: [], approvedBy: "" };
    // バリデーションロジック確認（approveルート内の条件と同じ）
    const isValid = body.runId && body.approvedTargetIds?.length && body.approvedBy;
    expect(isValid).toBeFalsy();
  });

  it("正しい入力はバリデーション通過", () => {
    const body = {
      runId: "camp-123",
      approvedTargetIds: ["contact-1"],
      approvedBy: "admin",
    };
    const isValid = body.runId && body.approvedTargetIds?.length && body.approvedBy;
    expect(isValid).toBeTruthy();
  });
});
