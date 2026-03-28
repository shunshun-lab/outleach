"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ReviewPanel, type ReviewTarget } from "@/components/ReviewPanel";

type ReviewData = {
  runId: string;
  campaignId: string;
  campaignName?: string;
  status: string;
  currentStep: string;
  targets: ReviewTarget[];
  error: string | null;
};

export default function CampaignReviewPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false);

  const fetchData = useCallback(
    async (mock: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = mock
          ? `/api/orchestrator/mock-review?campaignId=${campaignId}`
          : `/api/campaigns/${campaignId}/review`;
        const res = await fetch(endpoint);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [campaignId]
  );

  useEffect(() => {
    fetchData(useMock);
  }, [fetchData, useMock]);

  const handleApproved = () => {
    fetchData(useMock);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {data?.campaignName
                ? `${data.campaignName} - レビュー`
                : "キャンペーン レビュー"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Campaign ID: {campaignId}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
                className="rounded"
              />
              モックデータ
            </label>
            <button
              onClick={() => fetchData(useMock)}
              disabled={loading}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "読込中..." : "再読み込み"}
            </button>
          </div>
        </div>
      </header>

      {/* main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading && !data && (
          <div className="text-center py-20 text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500 mb-3" />
            <p>データを読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm font-medium">
              エラーが発生しました
            </p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={() => {
                setUseMock(true);
                fetchData(true);
              }}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              モックデータで表示する
            </button>
          </div>
        )}

        {data && (
          <>
            {/* status summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg border p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  ステータス
                </p>
                <p className="mt-1 text-lg font-semibold">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-sm ${
                      data.status === "paused"
                        ? "bg-yellow-100 text-yellow-800"
                        : data.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : data.status === "running"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {data.status === "paused"
                      ? "レビュー待ち"
                      : data.status === "completed"
                        ? "完了"
                        : data.status === "running"
                          ? "実行中"
                          : data.status}
                  </span>
                </p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  ターゲット数
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.targets.length}
                </p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  平均スコア
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.targets.length > 0
                    ? Math.round(
                        data.targets.reduce(
                          (sum, t) => sum + t.relevanceScore,
                          0
                        ) / data.targets.length
                      )
                    : "-"}
                </p>
              </div>
            </div>

            {/* ReviewPanel */}
            <ReviewPanel
              runId={data.runId}
              campaignId={data.campaignId}
              targets={data.targets}
              status={data.status}
              onApprove={handleApproved}
            />
          </>
        )}
      </main>
    </div>
  );
}
