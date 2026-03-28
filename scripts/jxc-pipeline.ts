import "dotenv/config";
import { PipelineOrchestrator } from "@/lib/orchestrator/orchestrator";
import { InMemoryPipelineStore } from "@/lib/orchestrator/store";
import type { PipelineInput, PipelineEvent } from "@/lib/orchestrator/types";
import type { Contact } from "@/types";

const productInput = {
  name: "Japan X College (JXC)",
  type: "community" as const,
  description: `観光では味わえない、ありのままの現場へ飛び込み「生きる力」を問う超実践型コミュニティ。
漁師の日常に飛び込む『いとたび』や、北海道標津町での極寒の漁師体験、ウガンダでのオフショア起業・撤退のリアルなど、偏差値や座学が一切通用しないむき出しの現場経験を提供する。
既存の大学教育やレールに乗ったキャリアに違和感を抱える若者、途上国起業や一次産業のリアルに飛び込みたい野心的な若者が集う。`,
  url: "https://note.com/japan_x_college",
  tags: ["教育再考", "一次産業", "地方創生", "アフリカ起業", "コミュニティ", "サバイバル"],
};

const contacts: Contact[] = [
  {
    id: "contact-1",
    name: "大学生A",
    platform: "twitter",
    email: "studentA@example.com",
    attributes: { occupation: "大学3年生", location: "東京" },
    behaviors: [{ type: "post-about", detail: "大学の授業、座学ばかりでリアリティがない。このまま就活していいのかモヤモヤする。", date: "2026-03" }]
  },
  {
    id: "contact-2",
    name: "若手起業家B",
    platform: "twitter",
    email: "entrepreneurB@example.com",
    attributes: { occupation: "休学中の学生起業家", interests: ["途上国ビジネス", "アフリカ"] },
    behaviors: [{ type: "post-about", detail: "来年から休学してアフリカで何か事業を作りたい。綺麗事じゃない泥臭いリアルが知りたい。", date: "2026-03" }]
  }
];

async function main() {
  console.log("=== JXC AI営業パイプライン テスト実行 ===");
  const store = new InMemoryPipelineStore();
  const orchestrator = new PipelineOrchestrator(store);

  orchestrator.on((event: PipelineEvent) => {
    if(event.type === "step:complete") console.log(`✓ ${event.step} 完了`);
    if(event.type === "pipeline:paused") console.log(`⏸ ${event.step} で承認待ち（Paused）`);
  });

  const runId = await orchestrator.start("campaign-jxc-001", { product: productInput, contacts, options: { relevanceThreshold: 30 } });
  const run = await orchestrator.getStatus(runId);

  console.log("\n【AIが生成したパーソナライズ・メッセージ（プレビュー）】");
  run.state.generatedMessages?.forEach(target => {
    console.log(`\n宛先: ${target.contact.name} (スコア: ${target.relevanceScore})`);
    console.log(`切り口: ${target.matchedAngle}`);
    target.messages.forEach((m, i) => console.log(`[案${i+1}] ${m.body}`));
  });
}

main().catch(console.error);
