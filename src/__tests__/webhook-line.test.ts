import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted で mock 関数を先に定義（ホイスティング対応）
const { mockFindFirst, mockCreate, mockUpdate, mockFetch } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    contact: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/webhook/line/route";

function makeRequest(body: unknown, signature?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature) headers["x-line-signature"] = signature;

  return new Request("http://localhost/api/webhook/line", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("LINE Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // LINE_CHANNEL_SECRET 未設定 = 署名検証スキップ（テスト用）
    delete process.env.LINE_CHANNEL_SECRET;
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
  });

  describe("follow event (友達追加)", () => {
    it("新規ユーザーをContactとして作成する", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "new-contact" });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ displayName: "テスト太郎" }),
      });

      const res = await POST(
        makeRequest({
          destination: "xxx",
          events: [
            {
              type: "follow",
              source: { type: "user", userId: "U1234567890" },
              timestamp: Date.now(),
            },
          ],
        })
      );

      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.processed).toBe(1);
      expect(data.results[0]).toEqual({
        userId: "U1234567890",
        action: "created",
      });

      // Contactが正しく作成されたか
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "テスト太郎",
          platform: "line",
          platformId: "U1234567890",
          lineUserId: "U1234567890",
          preferredChannel: "line",
        }),
      });
    });

    it("ブロック解除（再follow）でoptOutLineを解除する", async () => {
      mockFindFirst.mockResolvedValue({
        id: "existing-contact",
        lineUserId: "U1234567890",
        optOutLine: true,
      });
      mockUpdate.mockResolvedValue({});

      const res = await POST(
        makeRequest({
          destination: "xxx",
          events: [
            {
              type: "follow",
              source: { type: "user", userId: "U1234567890" },
              timestamp: Date.now(),
            },
          ],
        })
      );

      const data = await res.json();
      expect(data.results[0].action).toBe("reactivated");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "existing-contact" },
        data: expect.objectContaining({ optOutLine: false }),
      });
      // 新規作成はされない
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("unfollow event (ブロック)", () => {
    it("既存ContactのoptOutLineをtrueにする", async () => {
      mockFindFirst.mockResolvedValue({
        id: "existing-contact",
        lineUserId: "U9999",
      });
      mockUpdate.mockResolvedValue({});

      const res = await POST(
        makeRequest({
          destination: "xxx",
          events: [
            {
              type: "unfollow",
              source: { type: "user", userId: "U9999" },
              timestamp: Date.now(),
            },
          ],
        })
      );

      const data = await res.json();
      expect(data.results[0].action).toBe("opted_out");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "existing-contact" },
        data: { optOutLine: true },
      });
    });
  });

  describe("複数イベント", () => {
    it("複数のfollowイベントを一括処理する", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "new" });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ displayName: "ユーザー" }),
      });

      const res = await POST(
        makeRequest({
          destination: "xxx",
          events: [
            {
              type: "follow",
              source: { type: "user", userId: "U001" },
              timestamp: Date.now(),
            },
            {
              type: "follow",
              source: { type: "user", userId: "U002" },
              timestamp: Date.now(),
            },
          ],
        })
      );

      const data = await res.json();
      expect(data.processed).toBe(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe("不正リクエスト", () => {
    it("不正なJSONを400で返す", async () => {
      const req = new Request("http://localhost/api/webhook/line", {
        method: "POST",
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("署名検証が有効な場合、不正な署名を401で返す", async () => {
      process.env.LINE_CHANNEL_SECRET = "test-secret";

      const res = await POST(
        makeRequest(
          { destination: "xxx", events: [] },
          "invalid-signature"
        )
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Profile API", () => {
    it("Profile取得失敗時はデフォルト名を使う", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "new" });
      mockFetch.mockResolvedValue({ ok: false });

      const res = await POST(
        makeRequest({
          destination: "xxx",
          events: [
            {
              type: "follow",
              source: { type: "user", userId: "U_unknown" },
              timestamp: Date.now(),
            },
          ],
        })
      );

      const data = await res.json();
      expect(data.results[0].action).toBe("created");
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "LINE User" }),
      });
    });
  });
});
