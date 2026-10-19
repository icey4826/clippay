import { NextResponse } from "next/server";
import { retryRefund } from "@/lib/claims";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const claim = await retryRefund(id);
    return NextResponse.json({ status: claim.status });
  } catch (err) {
    return errorResponse(err);
  }
}
