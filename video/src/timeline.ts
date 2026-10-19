// Scene timing follows the narration: each scene is its voice clip plus a short lead-in and tail.
// `cue()` estimates when a phrase is spoken from its position in the line, so visuals land on the word.

import timing from "../public/voice/timing.json";
import script from "../script.json";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Seconds of silence before each line starts, and after it ends. */
const LEAD = 0.45;
const TAIL = 0.95;
/** Extra hold at the end of some scenes (the end card stays up after the last word). */
const HOLD: Record<string, number> = { close: 3.2 };

export type SceneId = "hook" | "cost" | "reveal" | "proof" | "grade" | "rules" | "offer" | "refund" | "merchant" | "close";

export type Scene = {
  id: SceneId;
  vo: string;
  voiceSeconds: number;
  /** Global start frame. */
  from: number;
  durationInFrames: number;
  /** Local frame where the voice starts. */
  voiceFrom: number;
};

const voiceTiming = timing as Record<string, number>;

export const SCENES: Scene[] = (() => {
  let from = 0;
  return script.scenes.map((s) => {
    const voiceSeconds = voiceTiming[s.id];
    const durationInFrames = Math.ceil((LEAD + voiceSeconds + TAIL + (HOLD[s.id] ?? 0)) * FPS);
    const scene: Scene = { id: s.id as SceneId, vo: s.vo, voiceSeconds, from, durationInFrames, voiceFrom: Math.round(LEAD * FPS) };
    from += durationInFrames;
    return scene;
  });
})();

export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + s.durationInFrames, 0);

export function scene(id: SceneId): Scene {
  return SCENES.find((s) => s.id === id)!;
}

/** Speech weight per character: punctuation adds the pause a narrator takes there. */
function weight(ch: string) {
  if (".!?".includes(ch)) return 9;
  if (",:;".includes(ch)) return 5;
  return 1;
}

function progressAt(vo: string, index: number) {
  let before = 0;
  let total = 0;
  for (let i = 0; i < vo.length; i++) {
    const w = weight(vo[i]);
    total += w;
    if (i < index) before += w;
  }
  return before / total;
}

/** Local frame (within the scene) at which `phrase` starts being spoken. `offset` is in seconds. */
export function cue(id: SceneId, phrase: string, offset = 0): number {
  const s = scene(id);
  const index = s.vo.indexOf(phrase);
  if (index < 0) throw new Error(`cue: "${phrase}" not in ${id}`);
  return Math.round(s.voiceFrom + (progressAt(s.vo, index) * s.voiceSeconds + offset) * FPS);
}

/** Caption chunks for a scene: clauses split at sentence and clause punctuation, with local frame ranges. */
export function captions(id: SceneId): { text: string; from: number; to: number }[] {
  const s = scene(id);
  const parts: { text: string; index: number }[] = [];
  const re = /[^.,:;!?]+[.,:;!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s.vo))) {
    const text = m[0].trim();
    // Very short pieces ("ClipPay.") read better joined to the next one.
    if (parts.length && parts[parts.length - 1].text.split(" ").length < 3 && !/[.!?]$/.test(parts[parts.length - 1].text)) {
      parts[parts.length - 1].text += " " + text;
    } else parts.push({ text, index: m.index + (m[0].length - m[0].trimStart().length) });
  }
  // Merge adjacent clauses into lines of a comfortable length.
  const lines: { text: string; index: number }[] = [];
  for (const p of parts) {
    const last = lines[lines.length - 1];
    if (last && !/[.!?]$/.test(last.text) && (last.text + " " + p.text).length <= 64) last.text += " " + p.text;
    else lines.push({ ...p });
  }
  const end = s.voiceFrom + Math.round(s.voiceSeconds * FPS);
  return lines.map((l, i) => ({
    text: l.text,
    from: Math.round(s.voiceFrom + progressAt(s.vo, l.index) * s.voiceSeconds * FPS),
    to: i + 1 < lines.length ? Math.round(s.voiceFrom + progressAt(s.vo, lines[i + 1].index) * s.voiceSeconds * FPS) : end + 8,
  }));
}
