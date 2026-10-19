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

## Code

- `src/lib/paypal.ts`: fetch-only PayPal client (OAuth, orders, capture, refund). Works in Node, Next.js and Cloudflare Workers.
- `scripts/paypal-week1.ts`: the Week 1 end-to-end script.

## Timeline

- **Week 1 (Oct 18–25):** sandbox create → capture → partial refund ✅ (verified Oct 18: $40 captured, $12 refunded, capture `PARTIALLY_REFUNDED`); vision grading prototype on 15–20 photos.
- **Week 2 (Oct 26–Nov 1):** claim page, rules engine, one-round negotiation, real refunds.
- **Week 3 (Nov 2–8):** AG Grid dashboard, fraud checks, deploy with seeded demo orders.
- **Nov 9–12:** README, video, submit by Nov 11.
