import { NextResponse } from "next/server";
import type { ChannelType } from "@/types";

/**
 * GET /api/orchestrator/mock-review?campaignId=xxx
 *
 * DB未接続時にレビュー画面のレイアウトと挙動を確認するための
 * モックデータを返すエンドポイント。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId") ?? "campaign-demo-001";

  const mockTargets = [
    {
      contactId: "contact-001",
      contactName: "田中",
      contactPlatform: "connpass",
      relevanceScore: 82,
      matchedAngle: "Web3 × コミュニティ運営",
      matchReason:
        "過去3回の Web3 イベント参加履歴あり。コミュニティ運営経験も持つ。",
      messageVariants: [
        {
          body: "田中さんが運営されているコミュニティで、Web3のハンズオンを企画されていると伺いました。今回のワークショップは実装を中心にした内容で、コミュニティメンバーの方にもフィットしそうです。",
          angle: "コミュニティ運営者向け",
          qualityScore: 88,
          passedWordCheck: true,
        },
        {
          body: "田中さんがConnpassで参加されていたWeb3ハッカソンの延長として、より実践的な開発体験ができるワークショップを開催します。前回参加者からのフィードバックも反映した内容です。",
          angle: "過去イベント参加者向け",
          qualityScore: 75,
          passedWordCheck: true,
        },
      ],
      channelResolution: {
        contactId: "contact-001",
        availableChannels: [
          { channel: "mail" as ChannelType, available: true },
          { channel: "line" as ChannelType, available: true },
          {
            channel: "messenger" as ChannelType,
            available: false,
            reason: "Messenger未連携",
          },
        ],
        recommendedChannel: "line" as ChannelType,
        fallbackChannel: "mail" as ChannelType,
      },
      selectedChannel: "line" as ChannelType,
    },
    {
      contactId: "contact-002",
      contactName: "佐藤",
      contactPlatform: "twitter",
      relevanceScore: 65,
      matchedAngle: "DeFi プロトコル開発",
      matchReason:
        "DeFi関連のツイートが多く、Solidityの技術投稿も確認。",
      messageVariants: [
        {
          body: "佐藤さんが投稿されていたDeFiプロトコルの設計パターンについて、今回のワークショップでまさにそのテーマを深掘りします。実装を通じて議論できる場になりそうです。",
          angle: "技術投稿者向け",
          qualityScore: 80,
          passedWordCheck: true,
        },
        {
          body: "佐藤さんのSolidity実装に関する知見は、今すぐ参加してほしいレベルです。必ず得るものがあります。",
          angle: "直接アプローチ",
          qualityScore: 45,
          passedWordCheck: false,
        },
      ],
      channelResolution: {
        contactId: "contact-002",
        availableChannels: [
          { channel: "mail" as ChannelType, available: true },
          {
            channel: "line" as ChannelType,
            available: false,
            reason: "LINE未連携",
          },
          {
            channel: "messenger" as ChannelType,
            available: false,
            reason: "Messenger未連携",
          },
        ],
        recommendedChannel: "mail" as ChannelType,
        fallbackChannel: "mail" as ChannelType,
      },
      selectedChannel: "mail" as ChannelType,
    },
    {
      contactId: "contact-003",
      contactName: "鈴木",
      contactPlatform: "connpass",
      relevanceScore: 91,
      matchedAngle: "スマートコントラクト監査",
      matchReason:
        "セキュリティ監査の実務経験あり。直近のCTFイベントでも上位入賞。",
      messageVariants: [
        {
          body: "鈴木さんがCTFで取り組まれていたスマートコントラクトの脆弱性分析、今回のワークショップでは監査の実践的なフレームワークを共有します。実務で使えるチェックリストも用意しています。",
          angle: "セキュリティ専門家向け",
          qualityScore: 92,
          passedWordCheck: true,
        },
        {
          body: "鈴木さんの監査経験を活かして、参加者同士でレビューし合うセッションも予定しています。同じレベル感の方と議論できる貴重な機会です。",
          angle: "ピアレビュー訴求",
          qualityScore: 85,
          passedWordCheck: true,
        },
      ],
      channelResolution: {
        contactId: "contact-003",
        availableChannels: [
          { channel: "mail" as ChannelType, available: true },
          { channel: "line" as ChannelType, available: true },
          { channel: "messenger" as ChannelType, available: true },
        ],
        recommendedChannel: "line" as ChannelType,
        fallbackChannel: "mail" as ChannelType,
      },
      selectedChannel: "line" as ChannelType,
    },
  ];

  return NextResponse.json({
    runId: `run-mock-${Date.now()}`,
    campaignId,
    status: "paused",
    currentStep: "review",
    targets: mockTargets,
    approvedTargetIds: [],
    approvedChannels: {},
    auditLogs: [],
    error: null,
  });
}
