// Claim workflow: checkout -> claim link -> photos + code -> grade -> rules -> accept/counter -> PayPal refund.
// Route handlers stay thin; everything that touches money goes through here.

import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findProduct } from "./catalog";
import { graderFromEnv, type Grade, type ImageInput } from "./grading";
import { dHash, hashDistance, NEAR_DUPLICATE_BITS, sha256, toGradingJpeg } from "./images";
import { approveLink, centsToMoney, firstCapture, moneyToCents, payPalFromEnv, PayPalError } from "./paypal";
import { decideOffer, evaluateCounter, DEFAULT_POLICY, type Decision } from "./rules";
import {
  DATA_DIR,
  getClaimForOrder,
  getOrderByToken,
  read,
  transact,
  type StoredClaim,
  type StoredOrder,
} from "./store";

/** A failure the buyer should see as-is. */
export class ClaimError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "ClaimError";
  }
}

export const CODE_TTL_MS = 30 * 60 * 1000;
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
/** A refund still "in flight" after this long is treated as stuck and can be retried. */
const STUCK_REFUND_MS = 2 * 60 * 1000;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// No 0/O, 1/I/L: easy to write by hand and for the model to read back.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const DAY_MS = 24 * 60 * 60 * 1000;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const nowIso = () => new Date().toISOString();

function newCode(): string {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

// ---------- Checkout ----------

/** Creates a PayPal order and returns the URL the buyer approves it at. */
export async function startCheckout(sku: string): Promise<string> {
  const product = findProduct(sku);
  if (!product) throw new ClaimError("Unknown product.", 404);
  const order = await payPalFromEnv().createOrder({
    amount: centsToMoney(product.priceCents, product.currency),
    description: product.name,
    referenceId: product.sku,
    returnUrl: `${appUrl()}/api/checkout/return`,
    cancelUrl: `${appUrl()}/?cancelled=1`,
  });
  const link = approveLink(order);
  if (!link) throw new Error(`PayPal order ${order.id} has no approval link`);
  return link;
}

/** Captures an approved order and records it. Safe to call twice (reloads, double redirects). */
export async function completeCheckout(orderId: string): Promise<StoredOrder> {
  const existing = await read((db) => db.orders[orderId]);
  if (existing) return existing;

  const paypal = payPalFromEnv();
  let order;
  try {
    order = await paypal.captureOrder(orderId);
  } catch (err) {
    // Already captured (e.g. by an earlier request that crashed before saving): read it back instead.
    if (err instanceof PayPalError && err.status === 422) order = await paypal.getOrder(orderId);
    else throw err;
  }
  const capture = firstCapture(order);
  if (!capture || capture.status === "DECLINED" || capture.status === "FAILED") {
    throw new ClaimError("The payment didn't go through. Nothing was charged.", 402);
  }
  const sku = order.purchase_units?.[0]?.reference_id ?? "";
  const product = findProduct(sku);

  return transact((db) => {
    db.orders[orderId] ??= {
      id: orderId,
      claimToken: randomBytes(16).toString("base64url"),
      productSku: sku,
      productName: product?.name ?? "Item",
      priceCents: moneyToCents(capture.amount),
      currency: capture.amount.currency_code,
      captureId: capture.id,
      capturedAt: capture.create_time ?? nowIso(),
      payerId: order.payer?.payer_id ?? null,
      payerEmail: order.payer?.email_address ?? null,
      refundedCents: 0,
    };
    return db.orders[orderId];
  });
}

// ---------- Claim ----------

export function newClaim(orderId: string, now = new Date()): StoredClaim {
  return {
    id: randomUUID(),
    orderId,
    code: newCode(),
    codeIssuedAt: now.toISOString(),
    status: "awaiting_photos",
    description: null,
    photos: [],
    grade: null,
    gradeModel: null,
    codeMatches: null,
    decision: null,
    countersUsed: 0,
    counterCents: null,
    agreedCents: null,
    reviewNote: null,
    refund: null,
    refundError: null,
    resolution: null,
    merchantNote: null,
    submittedAt: null,
    settledAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Opens (or resumes) the claim for an order link, issuing a fresh code if the old one expired. */
export async function openClaim(token: string): Promise<{ order: StoredOrder; claim: StoredClaim }> {
  const order = await getOrderByToken(token);
  if (!order) throw new ClaimError("This claim link isn't valid.", 404);

  const claim = await transact((db) => {
    const now = new Date();
    let c = Object.values(db.claims).find((x) => x.orderId === order.id);
    if (!c) {
      c = newClaim(order.id, now);
      db.claims[c.id] = c;
    } else if (c.status === "awaiting_photos" && now.getTime() - Date.parse(c.codeIssuedAt) > CODE_TTL_MS) {
      c.code = newCode();
      c.codeIssuedAt = now.toISOString();
      c.updatedAt = now.toISOString();
    }
    return c;
  });
  return { order, claim };
}

export interface PhotoUpload {
  bytes: Buffer;
  type: string;
}

/** Grades the photos, runs the rules engine and stores the decision. */
export async function submitClaim(token: string, description: string, uploads: PhotoUpload[]) {
  const order = await getOrderByToken(token);
  if (!order) throw new ClaimError("This claim link isn't valid.", 404);
  const claim = await getClaimForOrder(order.id);
  if (!claim) throw new ClaimError("Open the claim page first to get your code.");
  if (claim.status !== "awaiting_photos") throw new ClaimError("This claim was already submitted.", 409);
  if (Date.now() - Date.parse(claim.codeIssuedAt) > CODE_TTL_MS) {
    throw new ClaimError("Your code expired. Reload the page for a new one and retake the photo.", 410);
  }

  if (uploads.length === 0) throw new ClaimError("Add at least one photo.");
  if (uploads.length > MAX_PHOTOS) throw new ClaimError(`Add at most ${MAX_PHOTOS} photos.`);
  for (const u of uploads) {
    if (!PHOTO_TYPES.has(u.type)) throw new ClaimError("Photos must be JPEG, PNG or WebP.");
    if (u.bytes.length > MAX_PHOTO_BYTES) throw new ClaimError("Each photo must be under 15 MB.");
  }
  const desc = description.trim().slice(0, 1000);

  // Grade outside the lock: it takes seconds.
  let jpegs: Buffer[];
  let dhashes: string[];
  try {
    jpegs = await Promise.all(uploads.map((u) => toGradingJpeg(u.bytes)));
    dhashes = await Promise.all(jpegs.map((j) => dHash(j)));
  } catch {
    throw new ClaimError("One of the photos couldn't be read. Try a different photo.");
  }
  const hashes = uploads.map((u) => sha256(u.bytes));
  const images: ImageInput[] = jpegs.map((j) => ({ data: j.toString("base64"), mimeType: "image/jpeg" }));

  let result;
  try {
    result = await graderFromEnv().grade(images, {
      productName: order.productName,
      buyerDescription: desc || undefined,
      expectedCode: claim.code,
    });
  } catch (err) {
    console.error(`Grading failed for claim ${claim.id}:`, err instanceof Error ? err.message : err);
    throw new ClaimError("We couldn't check your photos right now. Please try again in a minute.", 503);
  }

  await mkdir(join(DATA_DIR, "photos"), { recursive: true });
  const photos = await Promise.all(
    jpegs.map(async (j, i) => {
      const rel = join("photos", `${claim.id}-${i + 1}.jpg`);
      await writeFile(join(DATA_DIR, rel), j);
      return { path: rel, sha256: hashes[i], dhash: dhashes[i] };
    }),
  );

  return transact((db) => {
    const c = db.claims[claim.id];
    if (c.status !== "awaiting_photos") throw new ClaimError("This claim was already submitted.", 409);
    const o = db.orders[order.id];
    const now = new Date();

    const otherClaims = Object.values(db.claims).filter((x) => x.id !== c.id && x.status !== "awaiting_photos");
    const duplicateImage = otherClaims.some((x) =>
      x.photos.some(
        (p) => hashes.includes(p.sha256) || (p.dhash && dhashes.some((h) => hashDistance(h, p.dhash!) <= NEAR_DUPLICATE_BITS)),
      ),
    );
    const buyerClaimsLast90Days = otherClaims.filter((x) => {
      const xo = db.orders[x.orderId];
      const sameBuyer = (o.payerId && xo?.payerId === o.payerId) || (o.payerEmail && xo?.payerEmail === o.payerEmail);
      return sameBuyer && now.getTime() - Date.parse(x.createdAt) <= 90 * DAY_MS;
    }).length;

    const decision = decideOffer(
      { grade: result.grade, codeMatches: result.codeMatches, duplicateImage, buyerClaimsLast90Days },
      {
        priceCents: o.priceCents,
        currency: o.currency,
        capturedAt: new Date(o.capturedAt),
        alreadyRefundedCents: o.refundedCents,
      },
      DEFAULT_POLICY,
      now,
    );

    Object.assign(c, {
      description: desc || null,
      photos,
      grade: result.grade,
      gradeModel: result.model,
      codeMatches: result.codeMatches,
      decision,
      status: decision.kind === "offer" ? "offered" : decision.kind,
      submittedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    } satisfies Partial<StoredClaim>);
    return c;
  });
}

type Offer = Extract<Decision, { kind: "offer" }>;

/** Buyer takes the automatic offer (or retries a failed refund at the agreed amount). */
export async function acceptOffer(token: string) {
  const claim = await claimForToken(token);
  if (claim.status === "refund_failed" && claim.agreedCents != null) {
    return settle(claim.id, claim.agreedCents, ["refund_failed"], claim.resolution ?? "auto_offer");
  }
  const cents = (claim.decision as Offer | null)?.refundCents;
  if (claim.status !== "offered" || cents == null) throw new ClaimError("There's no offer to accept on this claim.", 409);
  return settle(claim.id, cents, ["offered"], "auto_offer");
}

/** Buyer's one counter. Within headroom it settles straight away; above it goes to the merchant. */
export async function counterOffer(token: string, requestedCents: number) {
  const claim = await claimForToken(token);
  if (claim.status !== "offered" || claim.decision?.kind !== "offer") {
    throw new ClaimError("There's no offer to counter on this claim.", 409);
  }
  const result = evaluateCounter(claim.decision, requestedCents, claim.countersUsed);
  if (result.kind === "invalid") throw new ClaimError(result.reason);

  if (result.kind === "review") {
    return transact((db) => {
      const c = db.claims[claim.id];
      if (c.status !== "offered") throw new ClaimError("This claim changed. Reload the page.", 409);
      Object.assign(c, {
        countersUsed: c.countersUsed + 1,
        counterCents: requestedCents,
        status: "review",
        reviewNote: result.reason,
        updatedAt: nowIso(),
      } satisfies Partial<StoredClaim>);
      return c;
    });
  }

  await transact((db) => {
    const c = db.claims[claim.id];
    if (c.status !== "offered" || c.countersUsed > 0) throw new ClaimError("This claim changed. Reload the page.", 409);
    c.countersUsed += 1;
    c.counterCents = requestedCents;
  });
  return settle(claim.id, result.refundCents, ["offered"], "auto_counter");
}

async function claimForToken(token: string): Promise<StoredClaim> {
  const order = await getOrderByToken(token);
  if (!order) throw new ClaimError("This claim link isn't valid.", 404);
  const claim = await getClaimForOrder(order.id);
  if (!claim) throw new ClaimError("No claim yet for this order.", 404);
  return claim;
}

/** Locks the claim into "refunding", calls PayPal, then records the outcome. */
async function settle(
  claimId: string,
  cents: number,
  from: StoredClaim["status"][],
  resolution: NonNullable<StoredClaim["resolution"]>,
) {
  const { claim, order } = await transact((db) => {
    const c = db.claims[claimId];
    if (!c) throw new ClaimError("Claim not found.", 404);
    if (!from.includes(c.status)) throw new ClaimError("This claim changed. Reload the page.", 409);
    const o = db.orders[c.orderId];
    // A retry of this claim's own refund doesn't count against what's left.
    if (cents > o.priceCents - o.refundedCents) throw new ClaimError("That's more than is left to refund.", 409);
    Object.assign(c, { status: "refunding", agreedCents: cents, resolution, updatedAt: nowIso() } satisfies Partial<StoredClaim>);
    return { claim: { ...c }, order: { ...o } };
  });

  try {
    // Same request id on retries, so PayPal never refunds the same claim twice.
    const refund = order.demo
      ? { id: `DEMO-${claim.id.slice(0, 8).toUpperCase()}`, status: "COMPLETED" }
      : await payPalFromEnv().refundCapture(
          order.captureId,
          centsToMoney(cents, order.currency),
          `refund-${claim.id}`,
          `ClipPay damage claim for ${order.productName}`,
        );
    return transact((db) => {
      const c = db.claims[claimId];
      const o = db.orders[c.orderId];
      if (!c.refund) o.refundedCents += cents;
      Object.assign(c, {
        status: "refunded",
        refund: { id: refund.id, status: refund.status, amountCents: cents },
        refundError: null,
        settledAt: nowIso(),
        updatedAt: nowIso(),
      } satisfies Partial<StoredClaim>);
      return c;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Refund failed for claim ${claimId}:`, message);
    await transact((db) => {
      Object.assign(db.claims[claimId], {
        status: "refund_failed",
        refundError: message,
        updatedAt: nowIso(),
      } satisfies Partial<StoredClaim>);
    });
    throw new ClaimError("The refund didn't go through. Please try again.", 502);
  }
}

// ---------- Merchant ----------

/** Merchant pays a claim that went to review, at the suggested or a custom amount. */
export async function approveClaim(claimId: string, cents: number, note?: string) {
  if (!Number.isInteger(cents) || cents <= 0) throw new ClaimError("Enter a refund amount above zero.");
  await transact((db) => {
    const c = db.claims[claimId];
    if (!c) throw new ClaimError("Claim not found.", 404);
    if (c.status !== "review") throw new ClaimError("Only claims waiting for review can be approved.", 409);
    c.merchantNote = note?.trim() || null;
  });
  return settle(claimId, cents, ["review"], "merchant");
}

/** Merchant declines a claim that went to review. */
export function denyClaim(claimId: string, note?: string) {
  return transact((db) => {
    const c = db.claims[claimId];
    if (!c) throw new ClaimError("Claim not found.", 404);
    if (c.status !== "review") throw new ClaimError("Only claims waiting for review can be declined.", 409);
    Object.assign(c, {
      status: "denied",
      resolution: "merchant",
      merchantNote: note?.trim() || null,
      settledAt: nowIso(),
      updatedAt: nowIso(),
    } satisfies Partial<StoredClaim>);
    return c;
  });
}

/** Retries a failed or stuck refund at the agreed amount. The PayPal request id makes this safe. */
export async function retryRefund(claimId: string) {
  const claim = await read((db) => db.claims[claimId]);
  if (!claim) throw new ClaimError("Claim not found.", 404);
  const stuck = claim.status === "refunding" && Date.now() - Date.parse(claim.updatedAt) > STUCK_REFUND_MS;
  if ((claim.status !== "refund_failed" && !stuck) || claim.agreedCents == null) {
    throw new ClaimError("This claim has no failed refund to retry.", 409);
  }
  return settle(claimId, claim.agreedCents, ["refund_failed", "refunding"], claim.resolution ?? "merchant");
}

// ---------- What the buyer sees ----------

export interface BuyerFinding {
  type: string;
  location: string;
  severity: string;
  description: string;
}

export interface BuyerClaimView {
  status: StoredClaim["status"];
  code: string;
  codeExpiresAt: string;
  productSku: string;
  productName: string;
  priceCents: number;
  currency: string;
  offer: { refundCents: number; refundPct: number } | null;
  canCounter: boolean;
  agreedCents: number | null;
  /** What the grader saw. Only shown when it backs an offer or a "no damage" answer, never alongside fraud review. */
  findings: { severity: Grade["overall_severity"]; defects: BuyerFinding[] } | null;
  /** Shareable explanation. Fraud signals are never shown to the buyer. */
  message: string | null;
}

const SHOW_FINDINGS: StoredClaim["status"][] = ["offered", "refunding", "refunded", "refund_failed", "ineligible"];

export function buyerView(order: StoredOrder, claim: StoredClaim): BuyerClaimView {
  const d = claim.decision;
  let message: string | null = null;
  if (claim.status === "ineligible" && d) message = d.reasons.map((r) => r.message).join(" ");
  if (claim.status === "review") message = "A person will look at your photos and get back to you within 1 business day.";
  if (claim.status === "denied") {
    message = claim.merchantNote ?? "After a closer look, the store couldn't approve a refund for this claim.";
  }
  if (claim.status === "refund_failed") message = "The refund didn't go through. You can try again.";

  const g = claim.grade;
  return {
    status: claim.status,
    code: claim.code,
    codeExpiresAt: new Date(Date.parse(claim.codeIssuedAt) + CODE_TTL_MS).toISOString(),
    productSku: order.productSku,
    productName: order.productName,
    priceCents: order.priceCents,
    currency: order.currency,
    offer: claim.status === "offered" && d?.kind === "offer" ? { refundCents: d.refundCents, refundPct: d.refundPct } : null,
    canCounter: claim.status === "offered" && claim.countersUsed === 0,
    agreedCents: claim.agreedCents,
    findings:
      g && SHOW_FINDINGS.includes(claim.status)
        ? {
            severity: g.overall_severity,
            defects: g.defects.map(({ type, location, severity, description }) => ({ type, location, severity, description })),
          }
        : null,
    message,
  };
}
