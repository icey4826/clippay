import { NextResponse } from "next/server";
import { approveClaim } from "@/lib/claims";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const claim = await approveClaim(id, Number(body.cents), body.note);
    return NextResponse.json({ status: claim.status });
  } catch (err) {
    return errorResponse(err);
  }
}
