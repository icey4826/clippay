// The live segment: a real run of the deployed app, screen-recorded by hand (see LIVE_RECORDING.md).
// Each clip is a span of a recording in public/live, in source seconds, tagged with the step it shows.
// The scene fits each step's clips to the narration, speeding them up as needed.

export type LiveStep = "pay" | "code" | "review" | "refund";

export type LiveClip = {
  file: string;
  from: number;
  to: number;
  step: LiveStep;
  /** Optional zoom into the recording: z is the scale, x and y the focus point as fractions of the frame. */
  zoom?: { z: number; x: number; y: number };
};

/** Width / height of the recordings. */
export const LIVE_ASPECT = 1.6;

export const LIVE_PHOTO = "live/photo.jpg";

// Part one: shop → PayPal checkout → receipt → claim code. Part two (after the photo): review → the merchant
// approves → the buyer's refunded screen → the refund in the sandbox PayPal account. Logins are cut.
export const LIVE_CLIPS: LiveClip[] = [
  { file: "live/recording.mov", from: 0.5, to: 7.5, step: "pay" },
  { file: "live/recording.mov", from: 44, to: 50, step: "pay", zoom: { z: 1.3, x: 0.5, y: 0.2 } },
  { file: "live/recording.mov", from: 55, to: 60.3, step: "pay" },
  { file: "live/recording.mov", from: 60.5, to: 65.5, step: "code", zoom: { z: 1.35, x: 0.35, y: 0.35 } },
  { file: "live/recording-2.mov", from: 0.5, to: 4, step: "review" },
  { file: "live/recording-2.mov", from: 9, to: 17.4, step: "review", zoom: { z: 1.25, x: 0.8, y: 0.3 } },
  { file: "live/recording-2.mov", from: 18, to: 22, step: "refund" },
  { file: "live/recording-2.mov", from: 44, to: 58, step: "refund", zoom: { z: 1.3, x: 0.5, y: 0.3 } },
];
