/**
 * AIシーケンス生成
 *
 * 単発メッセージではなく、複数ステップのアプローチシナリオを生成する。
 * 各ステップにチャネル・遅延時間・本文を含む。
 * messaging.md のルールに従う。
 */
import { getClient, MODEL } from "./client";
import { checkForbiddenWords } from "./generate-message";
import type {
  ProductInput,
  ContactContext,
  ChannelType,
  ChannelResolution,
  GeneratedSequenceStep,
} from "@/types";

export type SequenceGenerationOptions = {
  /** 改善ループで進化したプロンプトを渡す */
  customPrompt?: string;
  /** ステップ数（デフォルト3） */
  stepCount?: number;
  /** 各ステップのA/Bテスト案数（デフォルト2） */
  variantCount?: number;
  /** Contact の利用可能チャネル情報 */
  channelResolution?: ChannelResolution;
};

const DEFAULT_STEP_COUNT = 3;
const DEFAULT_VARIANT_COUNT = 2;

/** デフォルトのシーケンス構造（遅延とチャネル） */
const DEFAULT_SEQUENCE_BLUEPRINT = [
  { stepOrder: 0, delayHours: 0, channelHint: "mail" as ChannelType },
  { stepOrder: 1, delayHours: 72, channelHint: "line" as ChannelType },
  { stepOrder: 2, delayHours: 168, channelHint: "mail" as ChannelType },
];

/**
 * 複数ステップのアプローチシーケンスを生成する
 */
export async function generateSequence(
  product: ProductInput,
  context: ContactContext,
  options?: SequenceGenerationOptions
): Promise<GeneratedSequenceStep[]> {
  const client = getClient();
  const stepCount = options?.stepCount ?? DEFAULT_STEP_COUNT;
  const variantCount = options?.variantCount ?? DEFAULT_VARIANT_COUNT;

  // 利用可能チャネルの決定
  const availableChannels = resolveAvailableChannels(options?.channelResolution);

  const systemPrompt =
    options?.customPrompt ??
    buildSequenceSystemPrompt(stepCount, variantCount, availableChannels);

  const userMessage = buildSequenceUserMessage(
    product,
    context,
    stepCount,
    variantCount
  );

  const response = await client.models.generateContent({
    model: MODEL,
    contents: userMessage,
    config: { systemInstruction: systemPrompt },
  });

  const text = response.text ?? "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("シーケンス生成の結果をパースできませんでした");
  }

  const raw = JSON.parse(jsonMatch[0]) as Array<{
    stepOrder: number;
    delayHours: number;
    channel: string;
    body: string;
    angle: string;
    subject?: string;
    variants?: Array<{ body: string; angle: string; subject?: string }>;
  }>;

  return raw.map((step, index) => {
    const blueprint = DEFAULT_SEQUENCE_BLUEPRINT[index];
    const channel = validateChannel(step.channel) ?? blueprint?.channelHint ?? "mail";

    // メインの本文 + バリアント
    const mainVariant = {
      body: step.body,
      angle: step.angle,
      passedWordCheck: checkForbiddenWords(step.body).length === 0,
    };

    const additionalVariants = (step.variants ?? []).map((v) => ({
      body: v.body,
      angle: v.angle,
      passedWordCheck: checkForbiddenWords(v.body).length === 0,
    }));

    return {
      stepOrder: step.stepOrder ?? index,
      delayHours: step.delayHours ?? blueprint?.delayHours ?? index * 72,
      channel,
      body: step.body,
      angle: step.angle,
      subject: step.subject,
      variants: [mainVariant, ...additionalVariants],
    };
  });
}

function buildSequenceSystemPrompt(
  stepCount: number,
  variantCount: number,
  availableChannels: ChannelType[]
): string {
  return `あなたは営業シーケンス設計のプロフェッショナルです。
「点」ではなく「線」のアプローチで、複数回にわたるシナリオを設計します。

【シーケンスの基本構造】
- ステップ数: ${stepCount}
- ステップ0: 初回挨拶（即送信）
- ステップ1: フォローアップ（72時間後 = 3日後）
- ステップ2: クロージング（168時間後 = 7日後）

【各ステップのルール】
1. 受け手の文脈を主語にする
2. 各ステップの役割を明確にする（挨拶→価値提示→アクション促進）
3. 前のステップとの連続性を持たせる（唐突にならない）
4. 押し売りしない（「ぜひ」「絶対」「今すぐ」などの強制表現を避ける）
5. 各メッセージは150字以内
6. チャネルは相手に適した方法を選ぶ

【利用可能チャネル】
${availableChannels.join(", ")}

【禁止ワード】
今すぐ、必ず、絶対に、特別価格、限定、していただけますでしょうか

【出力形式】
JSON配列で ${stepCount} ステップを出力。各ステップに ${variantCount - 1} 個の代替案（variants）を含める:
[
  {
    "stepOrder": 0,
    "delayHours": 0,
    "channel": "mail",
    "body": "メイン案のメッセージ本文",
    "angle": "使用した切り口",
    "subject": "メール件名（mailチャネルの場合のみ）",
    "variants": [
      { "body": "代替案の本文", "angle": "切り口" }
    ]
  }
]`;
}

function buildSequenceUserMessage(
  product: ProductInput,
  context: ContactContext,
  stepCount: number,
  variantCount: number
): string {
  return `## 商材
名前: ${product.name}
種別: ${product.type}
説明: ${product.description}
${product.url ? `URL: ${product.url}` : ""}
${product.date ? `日時: ${product.date}` : ""}

## 送り先の情報
名前: ${context.contact.name}
${context.contact.attributes?.occupation ? `職業: ${context.contact.attributes.occupation}` : ""}
${context.contact.attributes?.location ? `地域: ${context.contact.attributes.location}` : ""}
${context.contact.attributes?.interests?.length ? `興味: ${context.contact.attributes.interests.join(", ")}` : ""}
${context.matchedAngle ? `刺さる切り口: ${context.matchedAngle}` : ""}
${context.matchReason ? `理由: ${context.matchReason}` : ""}

${stepCount}ステップのアプローチシーケンスを設計してください。
各ステップに${variantCount - 1}個の代替案を含めてください。
ステップ間の連続性を意識し、自然な流れにしてください。`;
}

function resolveAvailableChannels(
  resolution?: ChannelResolution
): ChannelType[] {
  if (!resolution) return ["mail", "line", "messenger"];
  return resolution.availableChannels
    .filter((c) => c.available)
    .map((c) => c.channel);
}

function validateChannel(channel: string): ChannelType | null {
  if (channel === "mail" || channel === "line" || channel === "messenger") {
    return channel;
  }
  return null;
}
