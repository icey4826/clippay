// Captures the app screens the video uses, at 2× for crisp zooms. Needs the app running locally
// as a production build (`npm run build && npm start` in the repo root; the dev overlay crashes headless
// Chrome), with `npm run seed:demo` data. Runs with tsx as an in-process loader: under the `tsx` CLI's
// child process, Chrome's helpers can't receive their ICU data and crash.
//
//   npx remotion browser ensure && npm run capture
//
// Creates three short-lived VIDEO- orders in the local store (one per claim state), captures, then removes them.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Page } from "puppeteer-core";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const OUT = join(__dirname, "../public/screens");
const ROOT = join(__dirname, "../..");
process.env.CLIPPAY_DATA_DIR = join(ROOT, "data");

function findChrome(): string {
  const base = join(__dirname, "../node_modules/.remotion/chrome-headless-shell");
  const walk = (dir: string): string | null => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isFile() && e.name === "chrome-headless-shell") return p;
      if (e.isDirectory()) {
        const hit = walk(p);
        if (hit) return hit;
      }
    }
    return null;
  };
  const hit = walk(base);
  if (!hit) throw new Error("Run `npx remotion browser ensure` first.");
  return hit;
}

async function seedVideoOrders() {
  // Loaded after CLIPPAY_DATA_DIR is set, so the store points at the repo's data/.
  const { transact } = await import("../../src/lib/store");
  const { newClaim } = await import("../../src/lib/claims");
  const { decideOffer, evaluateCounter, DEFAULT_POLICY } = await import("../../src/lib/rules");
  const { findProduct } = await import("../../src/lib/catalog");
  type Grade = import("../../src/lib/grading").Grade;

  const product = findProduct("mug-set")!;
  const grade: Grade = {
    photo_usable: true,
    looks_like_real_photo: true,
    item_seen: "blue stoneware mug",
    matches_claimed_item: true,
    verification_code_read: "7KQ4",
    overall_severity: "minor",
    functional_impact: "none",
    confidence: "high",
    reviewer_note: "",
    defects: [
      { type: "chip", location: "rim of the blue mug", severity: "minor", description: "A small chip, about 4 mm wide, on the rim. The clay underneath is exposed." },
    ],
  };
  return transact((db) => {
    const tokens: Record<"await" | "offer" | "done", string> = { await: "", offer: "", done: "" };
    const now = Date.now();
    for (const [i, state] of (["await", "offer", "done"] as const).entries()) {
      const id = `VIDEO-${state.toUpperCase()}`;
      const token = `video-${state}`;
      tokens[state] = token;
      const order = {
        id,
        claimToken: token,
        productSku: product.sku,
        productName: product.name,
        priceCents: product.priceCents,
        currency: product.currency,
        captureId: `VIDEO-CAPTURE-${i}`,
        capturedAt: new Date(now - 2 * 86400_000).toISOString(),
        payerId: null,
        payerEmail: "buyer@example.com",
        refundedCents: 0,
        demo: true,
      };
      db.orders[id] = order;
      for (const [cid, c] of Object.entries(db.claims)) if (c.orderId === id) delete db.claims[cid];
      const claim = newClaim(id, new Date(now - 60_000));
      claim.code = "7KQ4";
      if (state !== "await") {
        const decision = decideOffer(
          { grade, codeMatches: true, duplicateImage: false, buyerClaimsLast90Days: 0 },
          { priceCents: order.priceCents, currency: order.currency, capturedAt: new Date(order.capturedAt), alreadyRefundedCents: 0 },
          DEFAULT_POLICY,
          new Date(now - 40_000),
        );
        Object.assign(claim, {
          grade,
          gradeModel: "gemini-3.5-flash",
          codeMatches: true,
          decision,
          status: "offered",
          description: "One mug has a chip on the rim",
          submittedAt: new Date(now - 40_000).toISOString(),
        });
        if (state === "done" && decision.kind === "offer") {
          const counter = evaluateCounter(decision, 1000, 0);
          const cents = counter.kind === "accepted" ? counter.refundCents : decision.refundCents;
          order.refundedCents = cents;
          Object.assign(claim, {
            status: "refunded",
            countersUsed: 1,
            counterCents: 1000,
            agreedCents: cents,
            resolution: "auto_counter",
            refund: { id: "DEMO-7KQ4", status: "COMPLETED", amountCents: cents },
            settledAt: new Date(now - 2_000).toISOString(),
          });
        }
      }
      db.claims[claim.id] = claim;
    }
    return tokens;
  });
}

async function removeVideoOrders() {
  const { transact } = await import("../../src/lib/store");
  await transact((db) => {
    for (const [cid, c] of Object.entries(db.claims)) if (c.orderId.startsWith("VIDEO-")) delete db.claims[cid];
    for (const id of Object.keys(db.orders)) if (id.startsWith("VIDEO-")) delete db.orders[id];
  });
}

async function shot(page: Page, name: string, path: string, prepare?: (p: Page) => Promise<void>) {
  // The page can navigate once more right after load (router refresh), detaching the frame; settle and retry.
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(APP + path, { waitUntil: "networkidle0", timeout: 90_000 });
      await new Promise((r) => setTimeout(r, 1200));
      await page.evaluate(() => document.fonts.ready);
      break;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  // Hide the Next.js dev badge and freeze animations so frames are clean.
  await page.addStyleTag({
    content: `nextjs-portal{display:none!important} *,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}`,
  });
  if (prepare) await prepare(page);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: join(OUT, `${name}.png`) as `${string}.png` });
  console.log("captured", name);
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: "shell", args: ["--hide-scrollbars"] });
  const tokens = await seedVideoOrders();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    const { mkdirSync } = await import("node:fs");
    mkdirSync(OUT, { recursive: true });

    await shot(page, "home", "/");
    await shot(page, "receipt", `/orders/${tokens.await}`);
    await shot(page, "claim-code", `/claim/${tokens.await}`);
    await shot(page, "offer", `/claim/${tokens.offer}`);
    await shot(page, "counter", `/claim/${tokens.offer}`, async (p) => {
      await p.locator("::-p-text(Think it's worth more?)").click();
      await p.locator("input[inputmode]").fill("10");
    });
    await shot(page, "refunded", `/claim/${tokens.done}`);
    await removeVideoOrders(); // keep the dashboard to the seeded demo claims
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
    await shot(page, "dashboard", "/merchant"); // opens with the first claim needing review selected
  } finally {
    await browser.close();
    await removeVideoOrders();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
