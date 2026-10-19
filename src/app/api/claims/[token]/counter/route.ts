import { NextResponse } from "next/server";
import { buyerView, counterOffer } from "@/lib/claims";
import { errorResponse } from "@/lib/http";
import { getOrderByToken } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const claim = await counterOffer(token, Number(body.cents));
    return NextResponse.json(buyerView((await getOrderByToken(token))!, claim));
  } catch (err) {
    return errorResponse(err);
  }
}
