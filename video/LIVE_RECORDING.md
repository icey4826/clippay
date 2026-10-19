# Live segment

About 30 s of the video plays a real run of the deployed app in the PayPal sandbox (`src/scenes/Live.tsx`). The clips and their source times are in `src/live.ts`.

## Recording it

```sh
npm run record-live
```

This opens a visible Chrome window, drives the app and records the page with the DevTools screencast. Keep the window on screen. Two steps are yours:

1. **Pay:** log in as the sandbox buyer and approve the payment.
2. **Photo:** recording pauses on the claim code. Write the code on paper next to the damage, take the photo and save it as `public/live/photo.jpg` (`.png`, `.heic` and `.webp` also work). The code is valid for 30 minutes.

After that, the recorder uploads the photo. If Gemini makes an offer, it accepts it; then it opens sandbox.paypal.com, where you may need to log in again.

If a claim goes to review (as in the current cut, where the crack graded "unusable", above the 60% ceiling), record a second part. This part shows the review screen, the merchant approving the claim, the buyer's refunded screen and the PayPal activity list:

```sh
RESUME_CLAIM=https://clippay.productivityappsforwindows.com/claim/<token> npm run record-live
```

Then build the clips. Each part becomes `public/live/recording*.mov`, plus marks of when each step starts:

```sh
npm run assemble-live
node scripts/assemble-live.mjs frames-2 recording-2
```

## Current cut

The photo is an AI-generated stand-in (no chipped mug was at hand), and the video labels it as such. Everything else is real: the PayPal sandbox payment, Gemini's grade (it read the code 9JC8), the rules engine's $24.00 cap, the merchant approval and the partial refund in the sandbox account.
