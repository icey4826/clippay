// The live segment: a real run of the deployed app, screen-recorded by hand (see LIVE_RECORDING.md).
// Each clip is a span of a recording in public/live, in source seconds, tagged with the step it shows.
// The scene fits each step's clips to the narration, speeding them up as needed.

import { FPS, cue } from "./timeline";

export type LiveStep = "pay" | "code" | "review" | "refund";

export type LiveClip = {
  file: string;
  from: number;
  to: number;
  step: LiveStep;
  /** Optional zoom into the recording: z is the scale, x and y the focus point as fractions of the frame. */
  zoom?: { z: number; x: number; y: number; instant?: boolean };
};

/** Width / height of the recordings, and their size in pixels. */
export const LIVE_ASPECT = 1.6;
const SRC_W = 1440;
const SRC_H = 900;

export const LIVE_PHOTO = "live/photo.jpg";

// Part one: shop → PayPal checkout → receipt → claim code. Part two (after the photo): review → the merchant
// approves → the buyer's refunded screen → the refund in the sandbox PayPal account. Logins are cut.
// The two buyer pages are cropped slightly (instant zoom) so the page footer stays out of frame.
export const LIVE_CLIPS: LiveClip[] = [
  { file: "live/recording.mov", from: 0.5, to: 7.5, step: "pay" },
  { file: "live/recording.mov", from: 44, to: 50, step: "pay", zoom: { z: 1.3, x: 0.5, y: 0.2 } },
  { file: "live/recording.mov", from: 55, to: 60.3, step: "pay" },
  { file: "live/recording.mov", from: 60.5, to: 65.5, step: "code", zoom: { z: 1.35, x: 0.35, y: 0.35 } },
  { file: "live/recording-2.mov", from: 0.5, to: 4, step: "review", zoom: { z: 1.12, x: 0.5, y: 0.3, instant: true } },
  { file: "live/recording-2.mov", from: 9, to: 17.4, step: "review", zoom: { z: 1.25, x: 0.8, y: 0.3 } },
  { file: "live/recording-2.mov", from: 18, to: 22, step: "refund", zoom: { z: 1.12, x: 0.5, y: 0.3, instant: true } },
  { file: "live/recording-2.mov", from: 44, to: 58, step: "refund", zoom: { z: 1.3, x: 0.5, y: 0.3 } },
];

/** A moment in a recording, in source seconds and source pixels: a click, or a highlighted rectangle. */
export type LiveMark = { file: string; t: number; x: number; y: number; w?: number; h?: number; label?: string; tone?: "good" | "warn"; until?: number; align?: "left" | "right" };

// The clicks the recorder made. The Pay click itself falls in the cut between clips, so it sits on the clip's last frames.
export const LIVE_CLICKS: LiveMark[] = [
  { file: "live/recording.mov", t: 6.9, x: 302, y: 858 }, // Buy with PayPal
  { file: "live/recording.mov", t: 49.5, x: 720, y: 693 }, // PayPal: Pay
];

export const LIVE_RINGS: LiveMark[] = [
  { file: "live/recording-2.mov", t: 9.8, until: 13.8, x: 1017, y: 645, w: 298, h: 50, label: "Above the 60% ceiling: capped at $24", tone: "warn", align: "right" },
  { file: "live/recording-2.mov", t: 13.95, until: 15, x: 466, y: 384, w: 92, h: 24, label: "Merchant approved: refunded", tone: "good" },
  { file: "live/recording-2.mov", t: 45.5, x: 249, y: 440, w: 941, h: 98, label: "+$24.00 partial refund. The buyer keeps the mug.", tone: "good" },
];

export const LIVE_STEPS: { id: LiveStep; label: string; icon: string; phrase: string }[] = [
  { id: "pay", label: "Pay with PayPal", icon: "tag", phrase: "We buy" },
  { id: "code", label: "Photo with the code", icon: "camera", phrase: "The claim gives" },
  { id: "review", label: "Too severe: merchant approves", icon: "user", phrase: "This crack" },
  { id: "refund", label: "Refund in PayPal", icon: "refund", phrase: "One click" },
];

export type Placed = { clip: LiveClip; from: number; frames: number; rate: number };

/** Lays a step's clips into its window: sped up to fit, never slowed below 0.8×, holding the last frame if short. */
function place(step: LiveStep, start: number, end: number): { clips: Placed[]; hold: number; rate: number } {
  const clips = LIVE_CLIPS.filter((c) => c.step === step);
  const window = end - start;
  const source = clips.reduce((n, c) => n + (c.to - c.from) * FPS, 0);
  if (!clips.length || window <= 0) return { clips: [], hold: 0, rate: 1 };
  const rate = Math.max(0.8, source / window);
  let at = start;
  const placed = clips.map((clip) => {
    const frames = Math.max(1, Math.floor(((clip.to - clip.from) * FPS) / rate));
    const p = { clip, from: at, frames, rate };
    at += frames;
    return p;
  });
  return { clips: placed, hold: Math.max(0, end - at), rate };
}

/** Each step's frame window in the scene (the first starts with the scene, the last runs to its end) and its clips. */
export function liveLayout(duration: number) {
  return LIVE_STEPS.map((s, i) => {
    const start = i === 0 ? 0 : cue("live", s.phrase, -0.25);
    const end = i + 1 < LIVE_STEPS.length ? cue("live", LIVE_STEPS[i + 1].phrase, -0.25) : duration;
    return { ...s, start, end, ...place(s.id, start, end) };
  });
}

export type LiveLayout = ReturnType<typeof liveLayout>;

/** Scene frame at which a source moment is on screen, and the frame its step leaves the screen. */
export function liveFrame(layout: LiveLayout, file: string, t: number): { at: number; stepEnd: number; clip: LiveClip } | null {
  for (const s of layout)
    for (const p of s.clips)
      if (p.clip.file === file && t >= p.clip.from && t <= p.clip.to)
        return { at: p.from + Math.round(((t - p.clip.from) * FPS) / p.rate), stepEnd: s.end, clip: p.clip };
  return null;
}

/** Source pixels to box pixels, through the clip's (settled) zoom. */
export function toBox(clip: LiveClip, box: { width: number; height: number }, x: number, y: number, w = 0, h = 0) {
  const z = clip.zoom?.z ?? 1;
  const ox = clip.zoom?.x ?? 0.5;
  const oy = clip.zoom?.y ?? 0.5;
  return {
    x: (ox + (x / SRC_W - ox) * z) * box.width,
    y: (oy + (y / SRC_H - oy) * z) * box.height,
    w: (w / SRC_W) * z * box.width,
    h: (h / SRC_H) * z * box.height,
  };
}
