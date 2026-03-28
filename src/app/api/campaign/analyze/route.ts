import { NextResponse } from "next/server";
import { decomposeProduct } from "@/lib/ai";
import type { ProductInput } from "@/types";

/**
 * POST /api/campaign/analyze
 * 商材の要素分解を実行する
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { product: ProductInput };

  if (!body.product?.name || !body.product?.description) {
    return NextResponse.json(
      { error: "product.name と product.description は必須です" },
      { status: 400 }
    );
  }

  const analysis = await decomposeProduct(body.product);
  return NextResponse.json({ analysis });
}
