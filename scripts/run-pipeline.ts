/**
 * パイプライン・シミュレーションスクリプト
 *
 * did-event.vercel.app の商材情報をもとに、
 * 「商材分解 → カスタマー分析 → メッセージ生成 → レビュー待ち（paused）」
 * のフルパイプラインを実行する。
 *
 * 使い方:
 *   npx tsx -r tsconfig-paths/register scripts/run-pipeline.ts
 */
import { PipelineOrchestrator } from "@/lib/orchestrator/orchestrator";
import { InMemoryPipelineStore } from "@/lib/orchestrator/store";
import type { PipelineInput, PipelineEvent } from "@/lib/orchestrator/types";
import type { Contact } from "@/types";

// ─── 商材定義: did-event.vercel.app ───

const productInput: PipelineInput["product"] = {
  name: "did-event（分散型イベント管理プラットフォーム）",
  type: "service",
  description: `did-eventは、Verifiable Credentials（VC）を活用した分散型イベント管理プラットフォーム。
イベント参加証明をNFT/VCとして発行し、参加者のポートフォリオとして機能する。
主催者はノーコードでイベント作成・参加者管理・VC発行が可能。
コミュニティ運営者、Web3プロジェクト、地方自治体の地域イベントなど幅広い用途に対応。
参加履歴がオンチェーンで検証可能なため、信頼性の高いコミュニティ形成を支援する。`,
  url: "https://did-event.vercel.app",
  tags: [
    "Web3",
    "Verifiable Credentials",
    "イベント管理",
    "コミュニティ",
    "分散型ID",
    "地域活性化",
  ],
};

// ─── ダミー Contact 3名 ───

const contacts: Contact[] = [
  {
    id: "contact-1",
    name: "田中",
    platform: "connpass",
    platformId: "connpass.com/user/tanaka-community",
    email: "tanaka@example.com",
    attributes: {
      occupation: "コミュニティマネージャー",
      location: "東京",
      interests: ["テックコミュニティ", "DevRel", "ハッカソン運営"],
    },
    behaviors: [
      {
        type: "event-attended",
        detail: "Web3 Builders Meetup（主催側）",
        date: "2026-02",
      },
      {
        type: "event-attended",
        detail: "DevRel Meetup Tokyo #30",
        date: "2026-01",
      },
      {
        type: "post-about",
        detail: "イベント運営の参加者管理ツールに不満があるとポスト",
        date: "2026-03",
      },
    ],
  },
  {
    id: "contact-2",
    name: "佐藤",
    platform: "twitter",
    platformId: "twitter.com/sato_web3",
    email: "sato@example.com",
    attributes: {
      occupation: "Web3スタートアップ ファウンダー",
      location: "福岡",
      interests: ["DID", "SBT", "DAOガバナンス", "トークンエコノミー"],
    },
    behaviors: [
      {
        type: "post-about",
        detail: "SBTを使ったコミュニティ貢献の可視化について連投",
        date: "2026-03",
      },
      {
        type: "event-attended",
        detail: "ETH Tokyo 2026",
        date: "2026-03",
      },
      {
        type: "follows",
        detail: "Ceramic Network, Spruce ID をフォロー",
      },
    ],
  },
  {
    id: "contact-3",
    name: "鈴木",
    platform: "did-event",
    platformId: "did-event.vercel.app/user/suzuki",
    email: "suzuki@example.com",
    attributes: {
      occupation: "地方自治体 地域振興課 主任",
      location: "三重県",
      interests: ["地域活性化", "関係人口", "祭り", "デジタル田園都市"],
    },
    behaviors: [
      {
        type: "event-attended",
        detail: "デジタル田園都市国家構想推進フォーラム",
        date: "2026-01",
      },
      {
        type: "event-attended",
        detail: "伊勢神宮奉納まつり（主催側）",
        date: "2025-10",
      },
      {
        type: "post-about",
        detail: "地域イベントの参加証明をデジタル化したいと発言",
        date: "2026-02",
      },
    ],
  },
];

// ─── 実行 ───

async function main() {
  console.log("=".repeat(60));
  console.log("  Outreach Pipeline Simulation");
  console.log("  商材: did-event.vercel.app");
  console.log("=".repeat(60));
  console.log();

  const store = new InMemoryPipelineStore();
  const orchestrator = new PipelineOrchestrator(store);

  // イベントリスナー: 進行状況を出力
  orchestrator.on((event: PipelineEvent) => {
    const timestamp = new Date().toLocaleTimeString("ja-JP");
    switch (event.type) {
      case "step:start":
        console.log(`[${timestamp}] >> Step START: ${event.step}`);
        break;
      case "step:complete":
        console.log(`[${timestamp}] << Step DONE:  ${event.step}`);
        break;
      case "step:failed":
        console.log(
          `[${timestamp}] !! Step FAIL:  ${event.step} — ${event.error}`
        );
        break;
      case "pipeline:paused":
        console.log(
          `[${timestamp}] || PAUSED at ${event.step}: ${event.reason}`
        );
        break;
      case "pipeline:completed":
        console.log(`[${timestamp}] ** PIPELINE COMPLETED`);
        break;
      case "pipeline:cancelled":
        console.log(`[${timestamp}] xx PIPELINE CANCELLED`);
        break;
    }
  });

  const input: PipelineInput = {
    product: productInput,
    contacts,
    options: { relevanceThreshold: 30 },
  };

  console.log(`ターゲット: ${contacts.length}名`);
  for (const c of contacts) {
    console.log(
      `  - ${c.name}（${c.attributes.occupation}/ ${c.attributes.location}）`
    );
  }
  console.log();

  // パイプライン実行
  const runId = await orchestrator.start("campaign-did-event-001", input);

  // 結果取得
  const run = await orchestrator.getStatus(runId);

  console.log();
  console.log("=".repeat(60));
  console.log("  PIPELINE RESULT");
  console.log("=".repeat(60));
  console.log(`Run ID:    ${run.id}`);
  console.log(`Status:    ${run.status}`);
  console.log(`Step:      ${run.currentStep}`);
  console.log();

  // ─── 商材分解結果 ───
  if (run.state.analysis) {
    const a = run.state.analysis;
    console.log("--- 商材分解（decompose）---");
    console.log(`Core Value: ${a.coreValue}`);
    console.log(`Angles (${a.angles.length}):`);
    for (const angle of a.angles) {
      console.log(`  [${angle.persona}] ${angle.hook}`);
    }
    console.log(`Keywords: ${a.keywords.join(", ")}`);
    console.log(`Differentiators: ${a.differentiators.join(" / ")}`);
    console.log();
  }

  // ─── カスタマー分析結果 ───
  if (run.state.customerResults) {
    console.log("--- カスタマー分析（analyze）---");
    for (const cr of run.state.customerResults) {
      const status = cr.skipped ? "SKIP" : "OK";
      console.log(
        `  [${status}] ${cr.contact.name}（${cr.contact.attributes.occupation}）`
      );
      console.log(`    relevanceScore: ${cr.relevanceScore}`);
      console.log(`    matchedAngle:   ${cr.matchedAngle}`);
      console.log(`    matchReason:    ${cr.matchReason}`);
      if (cr.skipReason) console.log(`    skipReason:     ${cr.skipReason}`);
      console.log();
    }
  }

  // ─── 生成メッセージ ───
  if (run.state.generatedMessages) {
    console.log("--- 生成メッセージ（generate）---");
    for (const target of run.state.generatedMessages) {
      console.log(
        `  Target: ${target.contact.name}（score: ${target.relevanceScore}）`
      );
      console.log(`  Angle:  ${target.matchedAngle}`);
      if (target.channelResolution) {
        console.log(
          `  Channel: ${target.channelResolution.recommendedChannel} (candidates: ${target.channelResolution.availableChannels.map((c) => c.channel).join(", ")})`
        );
      }
      console.log(`  Messages:`);
      for (let i = 0; i < target.messages.length; i++) {
        const m = target.messages[i];
        console.log(`    [案${i + 1}] ${m.body}`);
        console.log(
          `           angle: ${m.angle} | wordCheck: ${m.passedWordCheck ? "PASS" : "FAIL"}`
        );
      }
      console.log();
    }
  }

  // ─── ステータスサマリー ───
  console.log("=".repeat(60));
  if (run.status === "paused") {
    console.log(
      "  STATUS: PAUSED（レビュー待ち — 人間の承認後に送信ステップへ進みます）"
    );
    console.log(
      '  次のアクション: orchestrator.approve(runId, ["contact-1", ...]) を呼び出す'
    );
  } else if (run.status === "completed") {
    console.log("  STATUS: COMPLETED");
  } else if (run.status === "failed") {
    console.log(`  STATUS: FAILED — ${run.error}`);
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
