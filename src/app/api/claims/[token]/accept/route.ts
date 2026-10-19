import { NextResponse } from "next/server";
import { acceptOffer, buyerView } from "@/lib/claims";
import { errorResponse } from "@/lib/http";
import { getOrderByToken } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const claim = await acceptOffer(token);
    return NextResponse.json(buyerView((await getOrderByToken(token))!, claim));
  } catch (err) {
    return errorResponse(err);
  }
}
