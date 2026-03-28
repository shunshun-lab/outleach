import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { GoogleGenAI } from "@google/genai";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const JXC_PRODUCT = {
  name: "Japan X College (JXC)",
  type: "community",
  description:
    "観光では味わえない、ありのままの現場へ飛び込み「生きる力」を問う超実践型コミュニティ。漁師の日常に飛び込む『いとたび』や、北海道標津町での極寒の漁師体験、ウガンダでのオフショア起業・撤退のリアルなど、偏差値や座学が一切通用しないむき出しの現場経験を提供する。",
  url: "https://note.com/japan_x_college",
  tags: ["教育再考", "一次産業", "地方創生", "アフリカ起業", "コミュニティ", "サバイバル"],
};

const CONTACTS = [
  {
    name: "高橋",
    platform: "connpass",
    platformId: "takahashi-connpass",
    email: "takahashi@example.com",
    lineUserId: "U_takahashi_line",
    attributes: {
      relevanceScore: 78,
      matchedAngle: "教育 × 一次産業体験",
      matchReason: "地方創生イベントに複数回参加。教育系NPOでの活動歴あり。",
      occupation: "NPO職員",
      location: "東京",
      interests: ["地方創生", "教育", "コミュニティ"],
    },
    behaviors: [
      { type: "event-attended", detail: "地方創生ハッカソン 2025" },
      { type: "event-attended", detail: "教育イノベーション勉強会" },
    ],
  },
  {
    name: "中村",
    platform: "twitter",
    platformId: "nakamura-tw",
    email: "nakamura@example.com",
    attributes: {
      relevanceScore: 85,
      matchedAngle: "アフリカ起業 × リアル体験",
      matchReason: "アフリカでのビジネス経験をツイート。スタートアップ界隈で活動中。",
      occupation: "起業家",
      location: "大阪",
      interests: ["アフリカ", "起業", "グローバル"],
    },
    behaviors: [
      { type: "post-about", detail: "アフリカ × テクノロジー" },
      { type: "event-attended", detail: "Global Startup Weekend" },
    ],
  },
  {
    name: "山田",
    platform: "connpass",
    platformId: "yamada-connpass",
    email: "yamada@example.com",
    lineUserId: "U_yamada_line",
    messengerPsid: "yamada_fb",
    attributes: {
      relevanceScore: 92,
      matchedAngle: "漁師体験 × サバイバル教育",
      matchReason: "アウトドア系イベント常連。子育て中の親として体験教育に強い関心。",
      occupation: "フリーランス",
      location: "福岡",
      interests: ["サバイバル", "体験教育", "自然"],
    },
    behaviors: [
      { type: "event-attended", detail: "親子アウトドアキャンプ" },
      { type: "event-attended", detail: "漁業体験ツアー説明会" },
      { type: "follows", detail: "Japan X College note" },
    ],
  },
];

function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const GEMINI_MODEL = "gemini-2.5-flash";

async function generateMessages(
  contactName: string,
  angle: string,
  reason: string
): Promise<Array<{ body: string; angle: string; qualityScore: number; passedWordCheck: boolean }>> {
  const client = getGeminiClient();

  const prompt = `あなたは営業メッセージのライターです。以下のルールに従い、2つのメッセージ案をJSON配列で出力してください。

ルール:
- 受け手の文脈を主語にする（発信者目線にしない）
- 150字以内
- 「今すぐ」「必ず」「絶対に」「特別価格」「限定」は使わない
- 押し売りしない、選択肢として提示する

商材: Japan X College (JXC) — 観光では味わえない現場体験コミュニティ。漁師体験、アフリカ起業体験など。

宛先: ${contactName}さん
切り口: ${angle}
背景: ${reason}

JSON形式（配列のみ、説明不要）:
[
  { "body": "メッセージ本文", "angle": "使った切り口" },
  { "body": "メッセージ本文", "angle": "使った切り口" }
]`;

  try {
    const res = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    const text = res.text?.trim() ?? "[]";
    // JSON部分を抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ body: string; angle: string }>;

    return parsed.map((m, i) => ({
      body: m.body,
      angle: m.angle,
      qualityScore: 70 + Math.floor(Math.random() * 25),
      passedWordCheck: !["今すぐ", "必ず", "絶対"].some((w) => m.body.includes(w)),
    }));
  } catch (err) {
    console.error(`  Gemini error for ${contactName}:`, err);
    // フォールバック: 静的メッセージ
    return [
      {
        body: `${contactName}さんが関心を持たれている${angle}の分野で、実際の現場に飛び込む体験プログラムがあります。座学では得られない気づきがあるかもしれません。`,
        angle,
        qualityScore: 65,
        passedWordCheck: true,
      },
      {
        body: `${contactName}さんの${angle}への取り組みと重なる部分が多い体験コミュニティです。興味があればご覧ください。`,
        angle: `${angle}（簡潔版）`,
        qualityScore: 60,
        passedWordCheck: true,
      },
    ];
  }
}

async function main() {
  console.log("=== JXC Seed Script ===\n");

  // 1. キャンペーン作成
  console.log("1. Creating campaign...");
  const campaign = await prisma.campaign.create({
    data: {
      name: "JXC 体験プログラム案内 2026春",
      productJson: JXC_PRODUCT,
      analysisJson: {
        coreValue: "偏差値や座学が通用しない「むき出しの現場」で生きる力を問う体験",
        angles: [
          { persona: "教育関係者", hook: "体験教育", reasoning: "座学限界を感じている層" },
          { persona: "起業家", hook: "アフリカ起業リアル", reasoning: "グローバル志向の実践者" },
          { persona: "アウトドア愛好家", hook: "漁師体験", reasoning: "自然体験への高い関心" },
        ],
      },
      segmentJson: {
        operator: "OR",
        filters: [
          { type: "keyword", value: "地方創生" },
          { type: "keyword", value: "体験教育" },
          { type: "behavior", value: "event-attended" },
        ],
      },
      status: "review",
    },
  });
  console.log(`  Campaign created: ${campaign.id}\n`);

  // 2. Contact作成 + メッセージ生成
  for (const c of CONTACTS) {
    console.log(`2. Creating contact: ${c.name}...`);
    const contact = await prisma.contact.create({
      data: {
        name: c.name,
        platform: c.platform,
        platformId: c.platformId,
        email: c.email,
        lineUserId: c.lineUserId ?? null,
        messengerPsid: c.messengerPsid ?? null,
        preferredChannel: c.lineUserId ? "line" : "mail",
        attributesJson: c.attributes,
        behaviorsJson: c.behaviors,
      },
    });
    console.log(`  Contact created: ${contact.id}`);

    // Geminiでメッセージ生成
    console.log(`  Generating messages with Gemini...`);
    const variants = await generateMessages(
      c.name,
      c.attributes.matchedAngle,
      c.attributes.matchReason
    );
    console.log(`  Generated ${variants.length} variants`);

    // Message作成（status: "review"）
    const message = await prisma.message.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        variantsJson: variants,
        status: "review",
        channel: c.lineUserId ? "line" : "mail",
      },
    });
    console.log(`  Message created: ${message.id} (status: review)\n`);
  }

  // 3. 確認
  const msgCount = await prisma.message.count({
    where: { campaignId: campaign.id },
  });
  console.log(`=== Done ===`);
  console.log(`Campaign: ${campaign.id}`);
  console.log(`Messages: ${msgCount} (all status: review)`);
  console.log(`\nReview URL: /campaigns/${campaign.id}/review`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
