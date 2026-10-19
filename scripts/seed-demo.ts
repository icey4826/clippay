// Seeds realistic demo claims so the merchant dashboard has something to show.
// Every decision is computed by the real rules engine. Demo orders never call PayPal.
//
//   npm run seed:demo            add demo claims (replaces earlier demo data)
//   npm run seed:demo -- --reset remove demo data only

import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { findProduct } from "../src/lib/catalog";
import { newClaim } from "../src/lib/claims";
import type { Grade } from "../src/lib/grading";
import { decideOffer, DEFAULT_POLICY, evaluateCounter } from "../src/lib/rules";
import { transact, type Db, type StoredClaim } from "../src/lib/store";

const { values: args } = parseArgs({ options: { reset: { type: "boolean", default: false } } });

const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

interface DemoCase {
  sku: string;
  buyer: string;
  filedAgo: number; // ms before now
  description: string;
  grade: Partial<Grade> & Pick<Grade, "overall_severity" | "defects">;
  codeMatches?: boolean;
  duplicateImage?: boolean;
  priorClaims?: number;
  /** What happened after the decision. */
  then?: { accept?: true; counter?: number; settleAfterSec?: number; merchant?: { approve?: number; deny?: string; afterMin: number } };
}

const CASES: DemoCase[] = [
  {
    sku: "mug-set", buyer: "maya.r@example.com", filedAgo: 9 * DAY + 3 * HOUR,
    description: "One mug has a chip on the rim",
    grade: { overall_severity: "minor", defects: [d("chip", "rim of the blue mug", "minor", "Small chip, about 3 mm, on the rim.")] },
    then: { accept: true, settleAfterSec: 41 },
  },
  {
    sku: "pour-over", buyer: "dan.k@example.com", filedAgo: 8 * DAY + 5 * HOUR,
    description: "Scratches all over the glass",
    grade: { overall_severity: "cosmetic", defects: [d("scratch", "side of the carafe", "cosmetic", "Two faint surface scratches, visible up close.")] },
    then: { counter: 900, settleAfterSec: 63 },
  },
  {
    sku: "table-lamp", buyer: "priya.s@example.com", filedAgo: 7 * DAY,
    description: "The base is cracked through and wobbles",
    grade: {
      overall_severity: "severe", functional_impact: "partial",
      defects: [d("crack", "ceramic base, front", "severe", "Crack runs from the bottom edge to the switch; the base rocks.")],
    },
    then: { merchant: { approve: 9000, afterMin: 190 } },
  },
  {
    sku: "mug-set", buyer: "alex.m@example.com", filedAgo: 6 * DAY + 2 * HOUR,
    description: "Handle snapped off",
    grade: {
      overall_severity: "unusable", functional_impact: "total",
      defects: [d("broken_part", "handle of the white mug", "unusable", "Handle broken off cleanly; piece is in the photo.")],
    },
    then: { merchant: { approve: 1000, afterMin: 45 } },
  },
  {
    sku: "pour-over", buyer: "sam.t@example.com", filedAgo: 5 * DAY,
    description: "Lid is dented",
    grade: { overall_severity: "minor", defects: [d("dent", "lid, near the knob", "minor", "Shallow dent in the metal lid.")] },
    codeMatches: false,
    then: { merchant: { deny: "The photo didn't include your claim code and we couldn't verify it was taken recently.", afterMin: 300 } },
  },
  {
    sku: "mug-set", buyer: "jo.l@example.com", filedAgo: 3 * DAY + 4 * HOUR,
    description: "Mug is damaged",
    grade: { overall_severity: "none", defects: [], reviewer_note: "Mug looks intact; no chips or cracks visible." },
  },
  {
    sku: "mug-set", buyer: "maya.r@example.com", filedAgo: 2 * DAY + 6 * HOUR,
    description: "Small crack on the bottom",
    grade: { overall_severity: "moderate", defects: [d("crack", "base of the brown mug", "moderate", "Hairline crack across the foot ring.")] },
    then: { accept: true, settleAfterSec: 37 },
  },
  {
    sku: "pour-over", buyer: "chris.w@example.com", filedAgo: 1 * DAY + 2 * HOUR,
    description: "Spout chipped",
    grade: { overall_severity: "minor", defects: [d("chip", "tip of the spout", "minor", "Chip on the spout tip; pours unevenly.")] },
    duplicateImage: true,
  },
  {
    sku: "table-lamp", buyer: "nina.p@example.com", filedAgo: 5 * HOUR,
    description: "Shade has a tear",
    grade: { overall_severity: "moderate", defects: [d("tear", "linen shade, back seam", "moderate", "4 cm tear along the seam.")] },
    then: { accept: true, settleAfterSec: 29 },
  },
  {
    sku: "mug-set", buyer: "ben.h@example.com", filedAgo: 40 * MIN,
    description: "Glaze is scratched on two mugs",
    grade: { overall_severity: "cosmetic", confidence: "low", defects: [d("scratch", "outside of two mugs", "cosmetic", "Possible light scratches; glare hides detail.")] },
  },
];

function d(type: Grade["defects"][number]["type"], location: string, severity: Grade["defects"][number]["severity"], description: string) {
  return { type, location, severity, description };
}

function removeDemo(db: Db) {
  const demoOrders = new Set(Object.values(db.orders).filter((o) => o.demo).map((o) => o.id));
  for (const [id, c] of Object.entries(db.claims)) if (demoOrders.has(c.orderId)) delete db.claims[id];
  for (const id of demoOrders) delete db.orders[id];
  return demoOrders.size;
}

transact((db) => {
  const removed = removeDemo(db);
  if (args.reset) return `Removed ${removed} demo orders.`;

  for (const [i, k] of CASES.entries()) {
    const product = findProduct(k.sku)!;
    const filedAt = NOW - k.filedAgo;
    const orderId = `DEMO-${String(i + 1).padStart(2, "0")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const order = {
      id: orderId,
      claimToken: randomBytes(16).toString("base64url"),
      productSku: product.sku,
      productName: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      captureId: `DEMO-CAPTURE-${i + 1}`,
      capturedAt: new Date(filedAt - 3 * DAY).toISOString(),
      payerId: null,
      payerEmail: k.buyer,
      refundedCents: 0,
      demo: true,
    };
    db.orders[orderId] = order;

    const grade: Grade = {
      photo_usable: true,
      looks_like_real_photo: true,
      item_seen: product.name.toLowerCase(),
      matches_claimed_item: true,
      verification_code_read: null,
      functional_impact: "none",
      confidence: "high",
      reviewer_note: "",
      ...k.grade,
    };
    const claim: StoredClaim = newClaim(orderId, new Date(filedAt - 2 * MIN));
    const codeMatches = k.codeMatches ?? true;
    grade.verification_code_read = codeMatches ? claim.code : null;
    const priorClaims = Object.values(db.claims).filter(
      (c) => db.orders[c.orderId]?.payerEmail === k.buyer && Date.parse(c.createdAt) < filedAt,
    ).length;

    const decision = decideOffer(
      { grade, codeMatches, duplicateImage: k.duplicateImage ?? false, buyerClaimsLast90Days: k.priorClaims ?? priorClaims },
      { priceCents: order.priceCents, currency: order.currency, capturedAt: new Date(order.capturedAt), alreadyRefundedCents: 0 },
      DEFAULT_POLICY,
      new Date(filedAt),
    );

    Object.assign(claim, {
      description: k.description,
      grade,
      gradeModel: "gemini-3.5-flash",
      codeMatches,
      decision,
      status: decision.kind === "offer" ? "offered" : decision.kind,
      submittedAt: new Date(filedAt).toISOString(),
      updatedAt: new Date(filedAt).toISOString(),
    } satisfies Partial<StoredClaim>);

    const pay = (cents: number, resolution: StoredClaim["resolution"], at: number) => {
      order.refundedCents += cents;
      Object.assign(claim, {
        status: "refunded",
        agreedCents: cents,
        resolution,
        refund: { id: `DEMO-${claim.id.slice(0, 8).toUpperCase()}`, status: "COMPLETED", amountCents: cents },
        settledAt: new Date(at).toISOString(),
        updatedAt: new Date(at).toISOString(),
      } satisfies Partial<StoredClaim>);
    };

    const t = k.then;
    if (t && decision.kind === "offer") {
      const at = filedAt + (t.settleAfterSec ?? 45) * 1000;
      if (t.accept) pay(decision.refundCents, "auto_offer", at);
      if (t.counter != null) {
        claim.countersUsed = 1;
        claim.counterCents = t.counter;
        const r = evaluateCounter(decision, t.counter, 0);
        if (r.kind === "accepted") pay(r.refundCents, "auto_counter", at);
        else if (r.kind === "review") Object.assign(claim, { status: "review", reviewNote: r.reason });
      }
    }
    if (t?.merchant && claim.status === "review") {
      const at = filedAt + t.merchant.afterMin * MIN;
      if (t.merchant.approve != null) pay(t.merchant.approve, "merchant", at);
      else Object.assign(claim, { status: "denied", resolution: "merchant", merchantNote: t.merchant.deny, settledAt: new Date(at).toISOString() });
    }
    db.claims[claim.id] = claim;
  }

  const summary = Object.values(db.claims)
    .filter((c) => db.orders[c.orderId]?.demo)
    .map((c) => `${db.orders[c.orderId].productName.padEnd(26)} ${c.status}`)
    .join("\n");
  return `Seeded ${CASES.length} demo claims (replaced ${removed}).\n${summary}`;
}).then((msg) => console.log(msg));
