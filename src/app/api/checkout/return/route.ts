import { NextResponse } from "next/server";
import { ClaimError, completeCheckout } from "@/lib/claims";

export const runtime = "nodejs";

// PayPal sends the buyer back here with ?token=<orderId> after they approve.
export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("token");
  if (!orderId) return NextResponse.redirect(new URL("/", req.url), 303);
  try {
    const order = await completeCheckout(orderId);
    return NextResponse.redirect(new URL(`/orders/${order.claimToken}`, req.url), 303);
  } catch (err) {
    console.error("Capture failed:", err instanceof Error ? err.message : err);
    const reason = err instanceof ClaimError ? err.message : "We couldn't confirm the payment. Try again.";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(reason)}`, req.url), 303);
  }
}
