import { NextResponse } from "next/server";
import { improvePrompt, summarizeResults } from "@/lib/ai";
import type { OutreachResult, MessageVariant } from "@/types";

/**
 * POST /api/campaign/improve
 * 送信結果をもとにプロンプトを改善する
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    currentPrompt: string;
    currentVersion: number;
    results: Array<OutreachResult & { variant: MessageVariant }>;
  };

  if (!body.currentPrompt || !body.results?.length) {
    return NextResponse.json(
      { error: "currentPrompt と results は必須です" },
      { status: 400 }
    );
  }

  const summary = summarizeResults(body.results);
  const iteration = await improvePrompt(
    body.currentPrompt,
    summary,
    body.currentVersion ?? 0
  );

  return NextResponse.json({
    summary,
    newIteration: iteration,
  });
}
