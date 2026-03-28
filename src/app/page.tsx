import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function Home() {
  // DBから最新のキャンペーンを取得（レビュー待ちを優先）
  let latestCampaign: { id: string; name: string } | null = null;
  try {
    latestCampaign = await prisma.campaign.findFirst({
      where: { status: { in: ["review", "draft", "approved"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    });
    if (!latestCampaign) {
      latestCampaign = await prisma.campaign.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true },
      });
    }
  } catch {
    // DB接続エラー時はnullのまま
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-20 px-4">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-sm p-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-6">
          Outreach App
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          JXCをはじめとする「熱量」を届けるための、パーソナライズ営業自動化システム。
          AIが相手の文脈を読み解き、最適なチャネルでメッセージを生成します。
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-10 text-left">
          <h2 className="text-lg font-bold text-blue-900 mb-2">現在利用可能な機能</h2>
          <ul className="list-disc list-inside text-blue-800 space-y-2">
            <li>AIによる商材の要素分解とカスタマー分析</li>
            <li>ターゲットに合わせた複数パターンのアプローチ文生成</li>
            <li>送信チャネル（LINE / Mail / Messenger）の自動判定</li>
            <li><strong>【NEW】人間の承認（Approve）を待つレビュー機能</strong></li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {latestCampaign ? (
            <Link
              href={`/campaigns/${latestCampaign.id}/review`}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm"
            >
              {latestCampaign.name} - レビュー画面を開く
            </Link>
          ) : (
            <p className="text-gray-500">
              キャンペーンがまだ作成されていません。シードスクリプトを実行してください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
