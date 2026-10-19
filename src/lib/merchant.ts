// Merchant-side read model: one flat row per claim for the dashboard grid, plus headline numbers.

import type { Grade } from "./grading";
import { estimateSavingsCents, type ReasonCode } from "./rules";
import { read, type StoredClaim } from "./store";

export interface MerchantRow {
  id: string;
  orderId: string;
  createdAt: string;
  submittedAt: string | null;
  settledAt: string | null;
  productSku: string;
  productName: string;
  priceCents: number;
  currency: string;
  buyer: string | null;
  status: StoredClaim["status"];
  severity: Grade["overall_severity"] | null;
  confidence: Grade["confidence"] | null;
  codeMatches: boolean | null;
  reasons: { code: ReasonCode; message: string }[];
  /** Automatic offer, or what the rules would pay for a claim in review. */
  offerCents: number | null;
  counterCents: number | null;
  refundedCents: number | null;
  resolution: StoredClaim["resolution"];
  savingsCents: number | null;
  settleSeconds: number | null;
  photos: string[]; // URLs
  description: string | null;
  grade: Grade | null;
  reviewNote: string | null;
  merchantNote: string | null;
  refundId: string | null;
  refundError: string | null;
  model: string | null;
  demo: boolean;
}

export interface MerchantStats {
  claims: number;
  inReview: number;
  autoSettledPct: number | null;
  refundedCents: number;
  savingsCents: number;
  medianSettleSeconds: number | null;
  avgRefundPct: number | null;
}

export async function merchantRows(): Promise<MerchantRow[]> {
  return read((db) =>
    Object.values(db.claims)
      .filter((c) => c.status !== "awaiting_photos")
      .map((c): MerchantRow => {
        const o = db.orders[c.orderId];
        const d = c.decision;
        const refunded = c.status === "refunded" ? (c.refund?.amountCents ?? c.agreedCents) : null;
        const settledAt = c.settledAt ?? null;
        return {
          id: c.id,
          orderId: c.orderId,
          createdAt: c.createdAt,
          submittedAt: c.submittedAt ?? null,
          settledAt,
          productSku: o?.productSku ?? "",
          productName: o?.productName ?? "Unknown",
          priceCents: o?.priceCents ?? 0,
          currency: o?.currency ?? "USD",
          buyer: o?.payerEmail ?? o?.payerId ?? null,
          status: c.status,
          severity: c.grade?.overall_severity ?? null,
          confidence: c.grade?.confidence ?? null,
          codeMatches: c.codeMatches,
          reasons: d?.reasons ?? [],
          offerCents: d?.kind === "offer" ? d.refundCents : d?.kind === "review" ? d.suggestedRefundCents : null,
          counterCents: c.counterCents,
          refundedCents: refunded,
          resolution: c.resolution ?? null,
          savingsCents: refunded != null && o ? estimateSavingsCents({ ...o, capturedAt: new Date(o.capturedAt), alreadyRefundedCents: 0 }, refunded) : null,
          settleSeconds:
            settledAt && c.submittedAt ? Math.max(0, Math.round((Date.parse(settledAt) - Date.parse(c.submittedAt)) / 1000)) : null,
          photos: c.photos.map((_, i) => `/api/merchant/photos/${c.id}/${i + 1}`),
          description: c.description,
          grade: c.grade,
          reviewNote: c.reviewNote,
          merchantNote: c.merchantNote ?? null,
          refundId: c.refund?.id ?? null,
          refundError: c.refundError,
          model: c.gradeModel,
          demo: o?.demo ?? false,
        };
      })
      .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt)),
  );
}

export function merchantStats(rows: MerchantRow[]): MerchantStats {
  const settled = rows.filter((r) => r.status === "refunded" || r.status === "denied" || r.status === "ineligible");
  const auto = settled.filter((r) => r.resolution === "auto_offer" || r.resolution === "auto_counter" || r.status === "ineligible");
  const refunded = rows.filter((r) => r.refundedCents != null);
  const autoTimes = refunded
    .filter((r) => r.resolution !== "merchant" && r.settleSeconds != null)
    .map((r) => r.settleSeconds!)
    .sort((a, b) => a - b);
  return {
    claims: rows.length,
    inReview: rows.filter((r) => r.status === "review").length,
    autoSettledPct: settled.length ? Math.round((auto.length / settled.length) * 100) : null,
    refundedCents: refunded.reduce((s, r) => s + r.refundedCents!, 0),
    savingsCents: refunded.reduce((s, r) => s + (r.savingsCents ?? 0), 0),
    medianSettleSeconds: autoTimes.length ? autoTimes[Math.floor(autoTimes.length / 2)] : null,
    avgRefundPct: refunded.length
      ? Math.round(refunded.reduce((s, r) => s + (r.refundedCents! / r.priceCents) * 100, 0) / refunded.length)
      : null,
  };
}
