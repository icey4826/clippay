import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Grade } from "./grading";
import {
  DEFAULT_POLICY,
  decideOffer,
  estimateSavingsCents,
  evaluateCounter,
  type ClaimSignals,
  type Decision,
  type MerchantPolicy,
  type OrderInfo,
} from "./rules";

const NOW = new Date("2026-10-19T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function grade(overrides: Partial<Grade> = {}): Grade {
  return {
    photo_usable: true,
    looks_like_real_photo: true,
    item_seen: "white ceramic mug",
    matches_claimed_item: true,
    verification_code_read: "K7Q4",
    defects: [{ type: "chip", location: "rim", severity: "minor", description: "Small chip on the rim" }],
    overall_severity: "minor",
    functional_impact: "none",
    confidence: "high",
    reviewer_note: "",
    ...overrides,
  };
}

function signals(overrides: Partial<ClaimSignals> = {}, gradeOverrides: Partial<Grade> = {}): ClaimSignals {
  return {
    grade: grade(gradeOverrides),
    codeMatches: true,
    duplicateImage: false,
    buyerClaimsLast90Days: 0,
    ...overrides,
  };
}

function order(overrides: Partial<OrderInfo> = {}): OrderInfo {
  return { priceCents: 4000, currency: "USD", capturedAt: daysAgo(3), alreadyRefundedCents: 0, ...overrides };
}

function decide(s = signals(), o = order(), p: MerchantPolicy = DEFAULT_POLICY): Decision {
  return decideOffer(s, o, p, NOW);
}

function codes(d: Decision) {
  return d.reasons.map((r) => r.code).sort();
}

function asOffer(d: Decision) {
  assert.equal(d.kind, "offer", `expected offer, got ${d.kind}: ${JSON.stringify(d.reasons)}`);
  return d as Extract<Decision, { kind: "offer" }>;
}

describe("decideOffer: amounts", () => {
  it("offers the severity band for a clean claim", () => {
    const d = asOffer(decide());
    assert.equal(d.refundCents, 800); // 20% of $40
    assert.equal(d.refundPct, 20);
    assert.equal(d.currency, "USD");
    assert.deepEqual(d.reasons, []);
  });

  it("maps every severity to its band", () => {
    const expected = { cosmetic: 400, minor: 800, moderate: 1400, severe: 2400 } as const;
    for (const [sev, cents] of Object.entries(expected)) {
      const d = asOffer(decide(signals({}, { overall_severity: sev as Grade["overall_severity"] })));
      assert.equal(d.refundCents, cents, sev);
    }
  });

  it("rounds down to whole cents", () => {
    const d = asOffer(decide(signals(), order({ priceCents: 1999 })));
    assert.equal(d.refundCents, 399); // 20% of 19.99 = 3.998
  });

  it("reviews instead of paying more than is left after earlier refunds", () => {
    const d = decide(signals(), order({ alreadyRefundedCents: 3500 }));
    assert.equal(d.kind, "review");
    assert.deepEqual(codes(d), ["ABOVE_CEILING"]);
    assert.equal((d as Extract<Decision, { kind: "review" }>).suggestedRefundCents, 500);
    assert.match(d.reasons[0].message, /left after earlier refunds/);
  });

  it("caps the counter limit at what is left after earlier refunds", () => {
    const d = asOffer(decide(signals(), order({ alreadyRefundedCents: 2900 })));
    assert.equal(d.refundCents, 800);
    assert.equal(d.maxCounterCents, 1100);
  });

  it("caps the counter limit at band + headroom", () => {
    const d = asOffer(decide());
    assert.equal(d.maxCounterCents, 1200); // 30% of $40
  });

  it("caps the counter limit at the ceiling", () => {
    const d = asOffer(decide(signals({}, { overall_severity: "severe" })));
    assert.equal(d.refundCents, 2400); // 60% = ceiling
    assert.equal(d.maxCounterCents, 2400);
  });

  it("caps the counter limit at the auto-approve limit", () => {
    const d = asOffer(decide(signals(), order({ priceCents: 45_000 })));
    assert.equal(d.refundCents, 9000);
    assert.equal(d.maxCounterCents, 10_000);
  });
});

describe("decideOffer: eligibility", () => {
  it("rejects orders older than the policy window", () => {
    const d = decide(signals(), order({ capturedAt: daysAgo(31) }));
    assert.equal(d.kind, "ineligible");
    assert.deepEqual(codes(d), ["ORDER_TOO_OLD"]);
  });

  it("accepts an order exactly at the age limit", () => {
    assert.equal(decide(signals(), order({ capturedAt: daysAgo(30) })).kind, "offer");
  });

  it("never exceeds PayPal's 180-day refund window, even if the policy allows it", () => {
    const d = decide(signals(), order({ capturedAt: daysAgo(181) }), { ...DEFAULT_POLICY, maxOrderAgeDays: 365 });
    assert.deepEqual(codes(d), ["ORDER_TOO_OLD"]);
  });

  it("rejects fully refunded orders", () => {
    const d = decide(signals(), order({ alreadyRefundedCents: 4000 }));
    assert.deepEqual(codes(d), ["NOTHING_LEFT_TO_REFUND"]);
  });

  it("rejects a trustworthy photo that shows no damage", () => {
    const d = decide(signals({}, { overall_severity: "none", defects: [] }));
    assert.equal(d.kind, "ineligible");
    assert.deepEqual(codes(d), ["NO_DAMAGE_VISIBLE"]);
  });

  it("sends 'no damage' to review instead of rejecting when the photo itself is suspect", () => {
    const d = decide(signals({}, { overall_severity: "none", photo_usable: false }));
    assert.equal(d.kind, "review");
  });
});

describe("decideOffer: escalation to review", () => {
  const cases: [string, ClaimSignals, string][] = [
    ["unusable photo", signals({}, { photo_usable: false }), "PHOTO_UNUSABLE"],
    ["not a real photo", signals({}, { looks_like_real_photo: false }), "NOT_REAL_PHOTO"],
    ["different item", signals({}, { matches_claimed_item: false }), "ITEM_MISMATCH"],
    ["wrong code", signals({ codeMatches: false }), "CODE_MISSING_OR_WRONG"],
    ["no code issued but required", signals({ codeMatches: null }), "CODE_MISSING_OR_WRONG"],
    ["duplicate image", signals({ duplicateImage: true }), "DUPLICATE_IMAGE"],
    ["too many claims", signals({ buyerClaimsLast90Days: 2 }), "TOO_MANY_CLAIMS"],
    ["low confidence", signals({}, { confidence: "low" }), "LOW_CONFIDENCE"],
  ];
  for (const [name, s, code] of cases) {
    it(`reviews: ${name}`, () => {
      const d = decide(s);
      assert.equal(d.kind, "review");
      assert.deepEqual(codes(d), [code]);
    });
  }

  it("collects every reason, not just the first", () => {
    const d = decide(signals({ duplicateImage: true, codeMatches: false }, { confidence: "low" }));
    assert.deepEqual(codes(d), ["CODE_MISSING_OR_WRONG", "DUPLICATE_IMAGE", "LOW_CONFIDENCE"]);
  });

  it("reviews when the band is above the ceiling, suggesting the capped amount", () => {
    const d = decide(signals({}, { overall_severity: "unusable" }));
    assert.equal(d.kind, "review");
    assert.deepEqual(codes(d), ["ABOVE_CEILING"]);
    assert.equal((d as Extract<Decision, { kind: "review" }>).suggestedRefundCents, 2400);
  });

  it("reviews refunds above the auto-approve limit", () => {
    const d = decide(signals({}, { overall_severity: "severe" }), order({ priceCents: 50_000 }));
    assert.equal(d.kind, "review");
    assert.deepEqual(codes(d), ["ABOVE_AUTO_APPROVE_LIMIT"]);
  });

  it("skips the code check when the policy doesn't require it", () => {
    const d = decide(signals({ codeMatches: null }), order(), { ...DEFAULT_POLICY, requireCode: false });
    assert.equal(d.kind, "offer");
  });

  it("allows medium confidence by default", () => {
    assert.equal(decide(signals({}, { confidence: "medium" })).kind, "offer");
  });
});

describe("decideOffer: the AI can't overspend", () => {
  // Whatever the grade says, an automatic offer stays within every limit.
  it("holds for every severity, confidence and price", () => {
    const severities = ["none", "cosmetic", "minor", "moderate", "severe", "unusable"] as const;
    const confidences = ["low", "medium", "high"] as const;
    for (const sev of severities) {
      for (const conf of confidences) {
        for (const price of [1, 99, 1999, 4000, 25_000, 1_000_000]) {
          for (const refunded of [0, Math.floor(price / 2)]) {
            const o = order({ priceCents: price, alreadyRefundedCents: refunded });
            const d = decide(signals({}, { overall_severity: sev, confidence: conf }), o);
            if (d.kind !== "offer") continue;
            const limit = Math.min(
              Math.floor((price * DEFAULT_POLICY.maxRefundPct) / 100),
              price - refunded,
              DEFAULT_POLICY.autoApproveLimitCents,
            );
            assert.ok(d.refundCents <= limit, `${sev}/${conf}/${price}: ${d.refundCents} > ${limit}`);
            assert.ok(d.maxCounterCents <= limit, `${sev}/${conf}/${price}: counter ${d.maxCounterCents} > ${limit}`);
            assert.ok(d.refundCents >= 0 && Number.isInteger(d.refundCents));
          }
        }
      }
    }
  });
});

describe("evaluateCounter", () => {
  const offer = asOffer(decide()); // 800 offered, counter up to 1200

  it("accepts a counter within the limit", () => {
    assert.deepEqual(evaluateCounter(offer, 1100, 0), { kind: "accepted", refundCents: 1100 });
  });

  it("accepts a counter exactly at the limit", () => {
    assert.deepEqual(evaluateCounter(offer, 1200, 0), { kind: "accepted", refundCents: 1200 });
  });

  it("pays the lower amount if the buyer asks for less", () => {
    assert.deepEqual(evaluateCounter(offer, 500, 0), { kind: "accepted", refundCents: 500 });
  });

  it("sends counters above the limit to the merchant", () => {
    const r = evaluateCounter(offer, 1201, 0);
    assert.equal(r.kind, "review");
  });

  it("allows only one counter", () => {
    assert.equal(evaluateCounter(offer, 900, 1).kind, "invalid");
  });

  it("rejects zero, negative and fractional amounts", () => {
    for (const bad of [0, -100, 10.5, Number.NaN]) assert.equal(evaluateCounter(offer, bad, 0).kind, "invalid");
  });
});

describe("estimateSavingsCents", () => {
  it("counts the refund avoided plus return shipping", () => {
    assert.equal(estimateSavingsCents(order(), 800), 4000 - 800 + 800);
    assert.equal(estimateSavingsCents(order(), 800, 0), 3200);
  });
});
