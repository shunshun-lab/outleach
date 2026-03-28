import "dotenv/config";
import { getClient, MODEL } from "@/lib/ai/client";
import { decomposeProduct } from "@/lib/ai/decompose-product";

const productInput = {
  name: "Japan X College (JXC)",
  type: "community" as const,
  description: "観光では味わえない、ありのままの現場へ飛び込み「生きる力」を問う超実践型コミュニティ。漁師の日常に飛び込む『いとたび』や、北海道標津町での極寒の漁師体験、ウガンダでのオフショア起業・撤退のリアルなど、偏差値や座学が一切通用しないむき出しの現場経験を提供する。",
  url: "https://note.com/japan_x_college",
  tags: ["教育再考", "一次産業", "地方創生", "アフリカ起業", "コミュニティ", "サバイバル"],
};

async function run() {
  console.log("ANTHROPIC_API_KEY is set?", !!process.env.ANTHROPIC_API_KEY);
  console.log("Running decomposeProduct...");
  try {
    const res = await decomposeProduct(productInput);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
