# ClipPay

AI-graded damage claims that settle with a partial PayPal refund instead of a full return.
Built for the PayPal AI hackathon (deadline Nov 12, 2026).

Planned demo URL: `clippay.productivityappsforwindows.com` (separate Cloudflare project; the main site links to it).

## Flow

1. Buyer pays (PayPal Orders v2: create + capture).
2. Buyer opens a claim link, uploads photos holding a live-capture code, and describes the damage.
3. A vision model grades the defect (type, location, severity) as strict JSON.
4. A rules engine (not the AI) turns the grade into an offer using the merchant's policy.
5. Buyer accepts or counters once; anything above the ceiling goes to merchant review.
6. On acceptance, a partial refund is issued on the captured payment (Payments v2 refund).
7. The merchant dashboard (AG Grid) shows claims, grades, refunds and savings versus full returns.

## Setup

```bash
npm install
cp .env.example .env
```

1. Go to [developer.paypal.com](https://developer.paypal.com) → **Apps & Credentials** → **Sandbox** → **Create App** (Merchant).
2. Paste the app's Client ID and Secret into `.env`.
3. Under **Testing Tools → Sandbox Accounts**, note the default **Personal** (buyer) account. You'll log in with it to approve test payments.

## Week 1: sandbox refund check

```bash
npm run paypal:week1
```

This creates a $40 order, prints an approval link, waits while you approve it with the sandbox buyer
account, captures the payment, refunds 30%, and re-reads the capture to confirm `PARTIALLY_REFUNDED`.

Options:

| Command | What it does |
| --- | --- |
| `npm run paypal:week1 -- --amount 80 --refund-pct 25` | Different order size and refund share |
| `npm run paypal:week1 -- --order <orderId>` | Resume: capture an order you already approved |
| `npm run paypal:week1 -- --capture <captureId> --refund 5.00` | Refund only, on an existing capture |

Refunds send a `PayPal-Request-Id`, so re-running the same refund doesn't refund twice.

## Week 1: damage grading prototype

The grader sends claim photos to Gemini (Google AI Studio) and gets back strict JSON, validated with zod:
defects (type, location, severity), overall severity, functional impact, confidence, whether it's a real
camera photo, whether it matches the claimed item, and the live-capture code it reads in the photo.

1. Add `GEMINI_API_KEY` to `.env` (from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
2. Put JPEG/PNG photos in `samples/`. Export iPhone HEIC photos as JPEG first.
3. Optionally copy `samples/manifest.example.json` to `samples/manifest.json` and give each photo its product, buyer description, code and expected severity.
4. Run:

```bash
npm run grade
```

Each photo is graded twice by default (`--runs 3` for more). The script reports whether the runs agreed,
whether the grade is within one level of what you expected, and whether the code matched. Full JSON goes to `results/`.

Model: `gemini-3.5-flash` with low thinking, about 3s per grade. Set `GEMINI_MODEL` to try others.
Newer Flash models also worked but took 30–120s on the free tier under load (Oct 2026).

Free-tier note: Google may use free-tier inputs to improve its products. Use test photos only, and a paid key for real buyer photos.

## Week 2: rules engine

`src/lib/rules.ts` turns a grade plus the merchant's policy into a decision. It has no I/O and no
model calls, and all money is integer cents, so the AI never decides an amount.

- **Offer:** refund = severity band (none 0%, cosmetic 10%, minor 20%, moderate 35%, severe 60%, unusable 80% of price).
- **Review:** any trust signal goes to the merchant instead of being auto-paid or auto-rejected. These are an unusable or fake photo, the wrong item, a missing or wrong code, a duplicate image, too many claims, low confidence, an amount above the 60% ceiling (or above what's left after earlier refunds), or an amount above the $100 auto-approve limit.
- **Ineligible:** the order is older than 30 days (never more than PayPal's 180), it's already fully refunded, or a trustworthy photo shows no damage.
- **Counter:** one per claim. Up to the band + 10 points (capped by the ceiling and auto-approve limit) is accepted automatically; anything higher goes to the merchant.

```bash
npm test
```

## Code

- `src/lib/paypal.ts`: fetch-only PayPal client (OAuth, orders, capture, refund). Works in Node, Next.js and Cloudflare Workers.
- `scripts/paypal-week1.ts`: the Week 1 end-to-end script.
- `src/lib/grading.ts`: Gemini damage grader (schema, prompt, retries, code check).
- `scripts/grade-photos.ts`: grades every photo in `samples/` and checks consistency.
- `src/lib/rules.ts`: rules engine (offer, review or ineligible; one-round counter). Tests in `rules.test.ts`.

## Timeline

- **Week 1 (Oct 18–25):** sandbox create → capture → partial refund ✅ (verified Oct 18: $40 captured, $12 refunded, capture `PARTIALLY_REFUNDED`); vision grading prototype ✅ (pipeline verified on a synthetic photo; still needs 15–20 real damaged-item photos).
- **Week 2 (Oct 26–Nov 1):** rules engine + one-round counter ✅ (35 unit tests, Oct 19); claim page and real refunds next.
- **Week 3 (Nov 2–8):** AG Grid dashboard, fraud checks, deploy with seeded demo orders.
- **Nov 9–12:** README, video, submit by Nov 11.
