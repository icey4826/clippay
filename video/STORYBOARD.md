# ClipPay demo video: storyboard

About 2:08 at 1920×1080, 30 fps, with captions. Built with Remotion; narration (Gemini TTS) and music
(Lyria RealTime) come from Google AI Studio. The chipped mug is a vector illustration in the shop's style
(image models need a paid key), and the app screens are real captures of the production build. Narration lines live in `script.json`; every scene
is as long as its narration plus a short tail, so timing follows the audio.

| # | Scene | On screen |
|---|---|---|
| 1 | hook | Hero photo of the chipped mug, slow push-in. Kinetic type: "$40 mug set." / "Arrived chipped." Then a return label, a post office pin and "7–10 days" stamp in. |
| 2 | cost | A ledger builds line by line: Refund −$40, Return shipping −$8, Item written off, Customer trust ↓. Total "−$48" counts up in red. |
| 3 | reveal | Ledger collapses into the ClipPay mark. Tagline types on: "One photo. Partial refund. Keep the item." |
| 4 | proof | Browser frame: the claim page with the code card. Cursor drops the hero photo in; the code on paper and on screen are linked by a line. |
| 5 | grade | Hero photo with a scan line; findings chips pop in (chip · rim · minor), "code ✓", "real photo ✓". |
| 6 | rules | Diagram: Grade → Rules engine (policy table, severity row lights up "minor 20%") → $8.00 offer. Callout: "The AI never sets the price." |
| 7 | offer | Browser frame: the offer screen. Cursor opens the counter, types 10, sends; "Accepted" badge. |
| 8 | refund | PayPal capture card: $40.00 CAPTURED → partial refund $10.00 → PARTIALLY_REFUNDED. Request id `refund-<claimId>` highlighted. Timer "38 s". |
| 9 | merchant | Browser frame: merchant dashboard. Zoom across KPIs, then the grid, then the detail panel of a review claim with its reason flags. |
| 10 | close | Tech chips (PayPal Orders + Payments, Gemini, Cloudflare Workers + D1, Next.js), then end card with the live URL. |

## Rebuilding the video

Media goes to `public/` and the render to `out/`; both are gitignored.

```sh
cd video && npm install
../node_modules/.bin/tsx scripts/generate-assets.ts voice          # narration + public/voice/timing.json
../node_modules/.bin/tsx scripts/generate-assets.ts music-rt 140   # background track
npm run capture   # app screens; needs `npm run build && npm start` in the repo root
npm run studio    # preview in Remotion Studio
npm run render    # out/clippay-demo.mp4
node scripts/stills.mjs out/stills 300 1200   # half-size review frames
```
