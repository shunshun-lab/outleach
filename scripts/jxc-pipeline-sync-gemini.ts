import "dotenv/config";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/ai/gemini-client";

const productInput = {
  name: "Japan X College (JXC)",
  type: "community",
  description: "観光では味わえない、ありのままの現場へ飛び込み「生きる力」を問う超実践型コミュニティ。漁師の日常に飛び込む『いとたび』や、北海道標津町での極寒の漁師体験、ウガンダでのオフショア起業・撤退のリアルなど、偏差値や座学が一切通用しないむき出しの現場経験を提供する。",
  url: "https://note.com/japan_x_college",
  tags: ["教育再考", "一次産業", "地方創生", "アフリカ起業", "コミュニティ", "サバイバル"],
};

async function run() {
  const client = getGeminiClient();
  console.log("Running Gemini analyze...");
  const prompt = `あなたは営業戦略の専門家です。以下の商材を分析し、JSONで出力してください：
1. coreValue (1文)
2. angles (ターゲットごとの切り口。persona, hook, reasoning を持つ配列)

商材:
${JSON.stringify(productInput, null, 2)}
`;
  try {
    const res = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    console.log(res.text);
  } catch(e) { console.error(e) }
}
run();
