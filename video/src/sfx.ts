// Sound design: when each effect plays, in global frames. The effects are synthesized by scripts/make-sfx.py.
// Each one sits on a visual beat that a scene already times with cue(), so sound and picture land together.

import { LIVE_CLICKS, LIVE_RINGS, liveFrame, liveLayout } from "./live";
import { SCENES, cue, scene, type SceneId } from "./timeline";

export type Sfx = { at: number; name: "whoosh" | "click" | "pop" | "tick" | "chime" | "sting"; volume: number };

/** Mix levels, against narration at full volume. */
const LEVEL: Record<Sfx["name"], number> = { whoosh: 0.3, click: 0.45, pop: 0.28, tick: 0.22, chime: 0.4, sting: 0.5 };

export const SFX: Sfx[] = (() => {
  const out: Sfx[] = [];
  const add = (id: SceneId, local: number, name: Sfx["name"], gain = 1) => out.push({ at: scene(id).from + local, name, volume: LEVEL[name] * gain });

  // Transitions: the whoosh peaks as one scene hands over to the next.
  SCENES.slice(1).forEach((s) => out.push({ at: s.from - 9, name: "whoosh", volume: LEVEL.whoosh }));

  add("hook", cue("hook", "chip on the rim", -0.1), "pop");
  for (const p of ["a label", "a trip", "and a week"]) add("hook", cue("hook", p), "tick");
  for (const p of ["They refund", "pay eight", "throw away", "still lose"]) add("cost", cue("cost", p, p === "throw away" ? -0.3 : 0), "tick");
  for (const p of ["one photo", "a partial", "The buyer keeps", "Nothing"]) add("reveal", cue("reveal", p), "tick");

  add("proof", cue("proof", "gets a four"), "pop");
  for (const p of ["what's damaged", "where", "how badly", "whether it's a real", "whether the code"]) add("grade", cue("grade", p), "tick");
  add("grade", cue("grade", "whether the code"), "pop", 0.8);

  add("rules", cue("rules", "an auto-approve") + 18, "pop");
  add("rules", cue("rules", "Thirty-five") - 4, "pop", 0.8);

  // The offer scene's cursor: accept → counter → approved.
  const click1 = cue("offer", "or counter once") - 2;
  const click2 = cue("offer", "A small counter") + 4;
  add("offer", click1, "click");
  add("offer", click2, "click");
  add("offer", click2 + 10, "chime", 0.8);

  add("refund", cue("refund", "a partial refund") + 26, "pop");
  add("refund", cue("refund", "Photo to money"), "chime");

  for (const p of ["what they refunded", "what they saved", "a short queue"]) add("merchant", cue("merchant", p), "pop", 0.8);

  // Live footage: the recorder's clicks, and the callouts (the refund landing in PayPal gets the chime).
  const live = scene("live");
  const layout = liveLayout(live.durationInFrames);
  for (const m of LIVE_CLICKS) {
    const f = liveFrame(layout, m.file, m.t);
    if (f) add("live", f.at, "click");
  }
  for (const m of LIVE_RINGS) {
    const f = liveFrame(layout, m.file, m.t);
    if (f) add("live", f.at, m.label?.startsWith("+$") ? "chime" : "pop");
  }
  add("live", cue("live", "photograph it", -0.1), "pop");

  add("close", cue("close", "ClipPay.") - 2, "sting");
  return out.sort((a, b) => a.at - b.at);
})();
