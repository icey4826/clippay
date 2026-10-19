import { NextResponse } from "next/server";
import { ClaimError, startCheckout } from "@/lib/claims";

export const runtime = "nodejs";

// Form POST from the shop page -> PayPal approval page.
export async function POST(req: Request) {
  const form = await req.formData();
  try {
    return NextResponse.redirect(await startCheckout(String(form.get("sku") ?? "")), 303);
  } catch (err) {
    console.error("Checkout failed:", err instanceof Error ? err.message : err);
    const reason = err instanceof ClaimError ? err.message : "PayPal is unavailable. Try again.";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(reason)}`, req.url), 303);
  }
}
