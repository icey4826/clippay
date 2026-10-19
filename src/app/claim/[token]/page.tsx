import { notFound } from "next/navigation";
import { buyerView, ClaimError, openClaim } from "@/lib/claims";
import ClaimFlow from "./ClaimFlow";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let opened;
  try {
    opened = await openClaim(token);
  } catch (err) {
    if (err instanceof ClaimError && err.status === 404) notFound();
    throw err;
  }
  return <ClaimFlow token={token} initial={buyerView(opened.order, opened.claim)} />;
}
