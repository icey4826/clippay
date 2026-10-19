import { NextResponse } from "next/server";
import { buyerView, submitClaim, type PhotoUpload } from "@/lib/claims";
import { errorResponse } from "@/lib/http";
import { getOrderByToken } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const form = await req.formData();
    const uploads: PhotoUpload[] = await Promise.all(
      form
        .getAll("photos")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .map(async (f) => ({ bytes: Buffer.from(await f.arrayBuffer()), type: f.type })),
    );
    const claim = await submitClaim(token, String(form.get("description") ?? ""), uploads);
    return NextResponse.json(buyerView((await getOrderByToken(token))!, claim));
  } catch (err) {
    return errorResponse(err);
  }
}
