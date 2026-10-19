// Turns the screencast frames from record-live into public/live/recording.mov at 30 fps, and writes
// public/live/marks.json: when each step starts, in seconds of the recording (pauses are cut out).
// A second part (RESUME_CLAIM) assembles with: node scripts/assemble-live.mjs frames-2 recording-2

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = join(dirname(fileURLToPath(import.meta.url)), "../public/live");
const [part = "frames", name = "recording"] = process.argv.slice(2);
const FRAMES = join(LIVE, part);
const { frames, marks } = JSON.parse(readFileSync(join(FRAMES, "manifest.json"), "utf8"));

const lines = [];
const starts = [];
let t = 0;
frames.forEach((f, i) => {
  const next = frames[i + 1];
  // A frame lasts until the next one; across a pause, only briefly.
  const d = next ? (next.resumed ? 0.3 : Math.min(next.t - f.t, 20)) : 1;
  starts.push(t);
  lines.push(`file '${join(FRAMES, f.file)}'`, `duration ${Math.max(d, 0.001).toFixed(4)}`);
  t += d;
});
lines.push(`file '${join(FRAMES, frames[frames.length - 1].file)}'`);
writeFileSync(join(FRAMES, "list.txt"), lines.join("\n"));

const out = Object.fromEntries(Object.entries(marks).map(([k, i]) => [k, +(starts[Math.min(i, starts.length - 1)] ?? t).toFixed(2)]));
writeFileSync(join(LIVE, name === "recording" ? "marks.json" : `marks-${name}.json`), JSON.stringify({ ...out, total: +t.toFixed(2) }, null, 2));

execFileSync(
  "npx",
  ["remotion", "ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(FRAMES, "list.txt"),
   "-vf", "scale=1440:900,format=yuv420p",
   "-r", "30", "-c:v", "libx264", "-crf", "16", join(LIVE, `${name}.mov`)],
  { stdio: "inherit" },
);
console.log(out, `total ${t.toFixed(1)}s`);
