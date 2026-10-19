// Rules engine: turns an AI grade + merchant policy into an offer.
// Pure and deterministic: no I/O, no model calls, no clock reads (pass `now`).
// This is the only place refund amounts are decided, so the AI can never overspend.
// All money is integer cents.

import type { Grade, Severity } from "./grading";

export type Confidence = Grade["confidence"];

export interface MerchantPolicy {
  /** Refund % of the item price for each overall severity. */
  refundPctBySeverity: Record<Severity, number>;
  /** Hard ceiling for any automatic offer or accepted counter, % of price. */
  maxRefundPct: number;
  /** Refunds above this go to the merchant, even if under the ceiling. */
  autoApproveLimitCents: number;
  /** Claims on orders older than this are ineligible. PayPal itself stops at 180. */
  maxOrderAgeDays: number;
  /** More claims than this from one buyer in 90 days goes to review. */
  maxClaimsPer90Days: number;
  /** Grades below this confidence go to review. */
  minConfidence: Confidence;
  /** Whether the live-capture code must be readable in the photo. */
  requireCode: boolean;
  /** A counter can ask for up to this many % points above the offer (still capped by maxRefundPct). */
  counterHeadroomPct: number;
}

export const DEFAULT_POLICY: MerchantPolicy = {
  refundPctBySeverity: { none: 0, cosmetic: 10, minor: 20, moderate: 35, severe: 60, unusable: 80 },
  maxRefundPct: 60,
  autoApproveLimitCents: 10_000,
  maxOrderAgeDays: 30,
  maxClaimsPer90Days: 2,
  minConfidence: "medium",
  requireCode: true,
  counterHeadroomPct: 10,
};

export const PAYPAL_MAX_REFUND_AGE_DAYS = 180;

export interface OrderInfo {
  priceCents: number;
  currency: string;
  capturedAt: Date;
  alreadyRefundedCents: number;
}

export interface ClaimSignals {
  grade: Grade;
  /** From the grader: null when no code was issued. */
  codeMatches: boolean | null;
  /** Same image fingerprint seen on another claim. */
  duplicateImage: boolean;
  /** Claims this buyer filed in the last 90 days, not counting this one. */
  buyerClaimsLast90Days: number;
}

export type ReasonCode =
  | "ORDER_TOO_OLD"
  | "NOTHING_LEFT_TO_REFUND"
  | "NO_DAMAGE_VISIBLE"
  | "PHOTO_UNUSABLE"
  | "NOT_REAL_PHOTO"
  | "ITEM_MISMATCH"
  | "CODE_MISSING_OR_WRONG"
  | "DUPLICATE_IMAGE"
  | "TOO_MANY_CLAIMS"
  | "LOW_CONFIDENCE"
  | "ABOVE_CEILING"
  | "ABOVE_AUTO_APPROVE_LIMIT";

export interface Reason {
  code: ReasonCode;
  message: string;
}

export type Decision =
  | {
      kind: "offer";
      refundCents: number;
      refundPct: number;
      /** Highest counter that can be auto-accepted. */
      maxCounterCents: number;
      currency: string;
      reasons: Reason[];
    }
  | {
      kind: "review";
      /** What the rules would offer, for the merchant's convenience; never paid automatically. */
      suggestedRefundCents: number;
      currency: string;
      reasons: Reason[];
    }
  | { kind: "ineligible"; reasons: Reason[] };

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

function pctOf(priceCents: number, pct: number): number {
  return Math.floor((priceCents * pct) / 100);
}

/** Largest amount the policy (and PayPal) ever allows for this order. */
function ceilingCents(order: OrderInfo, policy: MerchantPolicy): number {
  const remaining = order.priceCents - order.alreadyRefundedCents;
  return Math.max(0, Math.min(pctOf(order.priceCents, policy.maxRefundPct), remaining));
}

export function decideOffer(
  signals: ClaimSignals,
  order: OrderInfo,
  policy: MerchantPolicy = DEFAULT_POLICY,
  now: Date = new Date(),
): Decision {
  const { grade } = signals;

  // 1. Eligibility: hard stops, no review needed.
  const ageDays = (now.getTime() - order.capturedAt.getTime()) / DAY_MS;
  const maxAge = Math.min(policy.maxOrderAgeDays, PAYPAL_MAX_REFUND_AGE_DAYS);
  if (ageDays > maxAge) {
    return {
      kind: "ineligible",
      reasons: [{ code: "ORDER_TOO_OLD", message: `Order is ${Math.floor(ageDays)} days old; limit is ${maxAge}.` }],
    };
  }
  if (order.priceCents - order.alreadyRefundedCents <= 0) {
    return {
      kind: "ineligible",
      reasons: [{ code: "NOTHING_LEFT_TO_REFUND", message: "This order has already been fully refunded." }],
    };
  }

  // 2. Trust signals: any of these sends the claim to a human. Fraud signals never auto-reject.
  const review: Reason[] = [];
  if (!grade.photo_usable) review.push({ code: "PHOTO_UNUSABLE", message: "Photo is too unclear to judge." });
  if (!grade.looks_like_real_photo) {
    review.push({ code: "NOT_REAL_PHOTO", message: "Image doesn't look like a real camera photo." });
  }
  if (!grade.matches_claimed_item) {
    review.push({ code: "ITEM_MISMATCH", message: `Photo shows "${grade.item_seen}", not the ordered item.` });
  }
  if (policy.requireCode && signals.codeMatches !== true) {
    review.push({ code: "CODE_MISSING_OR_WRONG", message: "Verification code wasn't visible or didn't match." });
  }
  if (signals.duplicateImage) {
    review.push({ code: "DUPLICATE_IMAGE", message: "The same photo was used on another claim." });
  }
  if (signals.buyerClaimsLast90Days >= policy.maxClaimsPer90Days) {
    review.push({
      code: "TOO_MANY_CLAIMS",
      message: `Buyer already filed ${signals.buyerClaimsLast90Days} claims in 90 days.`,
    });
  }
  if (CONFIDENCE_RANK[grade.confidence] < CONFIDENCE_RANK[policy.minConfidence]) {
    review.push({ code: "LOW_CONFIDENCE", message: `Grader confidence is ${grade.confidence}.` });
  }

  // 3. No visible damage on a trustworthy photo: nothing to offer.
  if (grade.overall_severity === "none" && review.length === 0) {
    return {
      kind: "ineligible",
      reasons: [{ code: "NO_DAMAGE_VISIBLE", message: "No damage is visible in the photos." }],
    };
  }

  // 4. Amount from the severity band, capped by the ceiling.
  const bandPct = policy.refundPctBySeverity[grade.overall_severity];
  const bandCents = pctOf(order.priceCents, bandPct);
  const ceiling = ceilingCents(order, policy);
  const refundCents = Math.min(bandCents, ceiling);

  if (bandCents > ceiling) {
    const remaining = order.priceCents - order.alreadyRefundedCents;
    const limit = remaining < pctOf(order.priceCents, policy.maxRefundPct)
      ? `the ${remaining} cents left after earlier refunds`
      : `the ${policy.maxRefundPct}% ceiling`;
    review.push({
      code: "ABOVE_CEILING",
      message: `Severity "${grade.overall_severity}" suggests ${bandPct}%, above ${limit}.`,
    });
  }
  if (refundCents > policy.autoApproveLimitCents) {
    review.push({ code: "ABOVE_AUTO_APPROVE_LIMIT", message: "Refund is above the auto-approve limit." });
  }

  if (review.length > 0) {
    return { kind: "review", suggestedRefundCents: refundCents, currency: order.currency, reasons: review };
  }

  const maxCounterCents = Math.min(
    pctOf(order.priceCents, bandPct + policy.counterHeadroomPct),
    ceiling,
    policy.autoApproveLimitCents,
  );

  return {
    kind: "offer",
    refundCents,
    refundPct: bandPct,
    maxCounterCents: Math.max(maxCounterCents, refundCents),
    currency: order.currency,
    reasons: [],
  };
}

export type CounterResult =
  | { kind: "accepted"; refundCents: number }
  | { kind: "review"; requestedCents: number; reason: string }
  | { kind: "invalid"; reason: string };

/**
 * One counter round. Within headroom -> auto-accept at the asked amount.
 * Above it -> goes to the merchant. Only one counter per claim.
 */
export function evaluateCounter(
  offer: Extract<Decision, { kind: "offer" }>,
  requestedCents: number,
  countersUsed: number,
): CounterResult {
  if (countersUsed >= 1) return { kind: "invalid", reason: "Only one counter-offer is allowed per claim." };
  if (!Number.isInteger(requestedCents) || requestedCents <= 0) {
    return { kind: "invalid", reason: "Counter must be a positive amount in cents." };
  }
  if (requestedCents <= offer.maxCounterCents) {
    // Asking for less than the offer is allowed; pay what they asked.
    return { kind: "accepted", refundCents: requestedCents };
  }
  return {
    kind: "review",
    requestedCents,
    reason: `Counter is above the ${offer.maxCounterCents} cent auto-accept limit; sent to the merchant.`,
  };
}

/** Rough merchant savings vs. a full return: refund avoided + return shipping avoided. */
export function estimateSavingsCents(order: OrderInfo, refundCents: number, returnShippingCents = 800): number {
  return order.priceCents - refundCents + returnShippingCents;
}
