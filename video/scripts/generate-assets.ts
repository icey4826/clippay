// Generates the video's media with Google AI Studio models (key: GEMINI_API_KEY in ../.env).
//
//   npx tsx scripts/generate-assets.ts photo [model] hero photo of the damaged item (Gemini image)
//   npx tsx scripts/generate-assets.ts voice [id]   narration per scene (Gemini TTS) + public/voice/timing.json
//   npx tsx scripts/generate-assets.ts music        background track (Lyria 3.5, needs a paid key)
//   npx tsx scripts/generate-assets.ts music-rt [s] background track streamed from Lyria RealTime
//
// Outputs go to public/ (gitignored); rerun any step to regenerate it.

import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config({ path: join(__dirname, "../../.env") });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const PUBLIC = join(__dirname, "../public");
const script = JSON.parse(readFileSync(join(__dirname, "../script.json"), "utf8")) as {
  voice: string;
  ttsModel: string;
  scenes: { id: string; vo: string }[];
};

export const HERO_CODE = "7KQ4";

function inlineParts(res: Awaited<ReturnType<typeof ai.models.generateContent>>) {
  return (res.candidates?.[0]?.content?.parts ?? []).filter((p) => p.inlineData?.data);
}

function wav(pcm: Buffer, sampleRate: number, channels = 1, bits = 16) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  h.writeUInt16LE((channels * bits) / 8, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Duration from a WAV's fmt and data chunks. */
function wavSeconds(buf: Buffer) {
  let byteRate = 0;
  for (let off = 12; off + 8 <= buf.length; ) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") return Math.min(size, buf.length - off - 8) / byteRate;
    off += 8 + size + (size % 2);
  }
  throw new Error("WAV without data chunk");
}

async function photo(model = "gemini-3.1-flash-image") {
  const res = await ai.models.generateContent({
    model,
    contents:
      `A realistic smartphone photo, slightly from above, of a hand-thrown stoneware coffee mug in deep blue glaze ` +
      `sitting on a light oak kitchen table in soft morning window light. There is one small, clearly visible chip ` +
      `on the rim of the mug, showing the pale clay underneath, about 4 mm wide. Next to the mug lies a small torn ` +
      `piece of plain white paper with "${HERO_CODE}" handwritten on it in thick black marker, clearly readable. ` +
      `Natural phone camera look: slight grain, shallow depth of field, no text overlays, no watermark, no people.`,
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } },
  });
  const part = inlineParts(res)[0];
  if (!part) throw new Error("No image returned: " + JSON.stringify(res.candidates?.[0]?.finishReason));
  const ext = part.inlineData!.mimeType?.includes("png") ? "png" : "jpg";
  writeFileSync(join(PUBLIC, `hero.${ext}`), Buffer.from(part.inlineData!.data!, "base64"));
  console.log(`public/hero.${ext}`, part.inlineData!.mimeType);
}

async function voice(only?: string) {
  mkdirSync(join(PUBLIC, "voice"), { recursive: true });
  const timingPath = join(PUBLIC, "voice/timing.json");
  let timing: Record<string, number> = {};
  try {
    timing = JSON.parse(readFileSync(timingPath, "utf8"));
  } catch {}
  for (const s of script.scenes) {
    if (only ? s.id !== only : timing[s.id] != null) continue;
    const res = await withRateLimit(() => ai.models.generateContent({
      model: process.env.TTS_MODEL ?? script.ttsModel,
      // Plain text only: the 3.x TTS models read any style prefix aloud and reject system instructions.
      contents: s.vo,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: script.voice } } },
      },
    }));
    const part = inlineParts(res)[0];
    if (!part) throw new Error(`No audio for ${s.id}`);
    const mime = part.inlineData!.mimeType ?? "";
    let data = Buffer.from(part.inlineData!.data!, "base64");
    // Newer TTS models return a finished WAV; older ones return raw 16-bit PCM ("audio/L16;rate=24000").
    if (data.toString("ascii", 0, 4) !== "RIFF") data = wav(data, Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000));
    writeFileSync(join(PUBLIC, `voice/${s.id}.wav`), data);
    timing[s.id] = wavSeconds(data);
    writeFileSync(timingPath, JSON.stringify(timing, null, 2));
    console.log(s.id.padEnd(10), `${timing[s.id].toFixed(2)}s`, mime);
  }
}

/** Waits out per-minute quota errors (free tier: 3 TTS requests a minute). Daily limits fail fast. */
async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Per-minute limits say "retry in 40s"; daily ones say "retry in 12h3m", which fails the match.
      const wait = Number(/retry in ([\d.]+)s/.exec(msg)?.[1]);
      if (!msg.includes("429") || !(wait <= 120)) throw err;
      console.log(`  rate limited, waiting ${Math.ceil(wait)}s`);
      await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
    }
  }
}

async function music() {
  const res = await ai.models.generateContent({
    model: "lyria-3.5",
    contents:
      "Instrumental background music for a 2 minute 30 second fintech product launch video. Modern, optimistic, " +
      "minimal: warm felt piano, soft analog synth pads, light plucked arpeggios, a gentle electronic beat that " +
      "enters after 20 seconds, around 100 BPM, major key. Clean and uncluttered so a narrator sits on top. " +
      "Builds slightly toward the end and resolves with a soft final chord. No vocals.",
  });
  const parts = inlineParts(res);
  if (!parts.length) throw new Error("No audio returned: " + JSON.stringify(res.candidates?.[0]?.finishReason));
  for (const [i, p] of parts.entries()) {
    const mime = p.inlineData!.mimeType ?? "";
    const ext = mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "wav";
    const name = `music${i ? `-${i}` : ""}.${ext}`;
    writeFileSync(join(PUBLIC, name), Buffer.from(p.inlineData!.data!, "base64"));
    console.log(`public/${name}`, mime);
  }
  const text = (res.candidates?.[0]?.content?.parts ?? []).map((p) => p.text).filter(Boolean).join(" ");
  if (text) console.log("model notes:", text.slice(0, 300));
}

/**
 * Lyria RealTime streams 48 kHz stereo PCM while we steer it, so the track follows the video:
 * a quiet intro, the beat entering for the product part, a lift for the merchant section, then a soft end.
 */
async function musicRealtime(seconds = 160) {
  const live = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: "v1alpha" } });
  const chunks: Buffer[] = [];
  let bytes = 0;
  const BYTES_PER_SEC = 48000 * 2 * 2;
  let done!: () => void;
  const finished = new Promise<void>((r) => (done = r));
  const session = await live.live.music.connect({
    model: "models/lyria-realtime-exp",
    callbacks: {
      onmessage: (msg) => {
        for (const c of msg.serverContent?.audioChunks ?? []) {
          const b = Buffer.from(c.data ?? "", "base64");
          chunks.push(b);
          bytes += b.length;
        }
        if (msg.filteredPrompt) console.log("filtered prompt:", msg.filteredPrompt);
        if (bytes >= seconds * BYTES_PER_SEC) done();
      },
      onerror: (e) => console.error("lyria error:", e),
      onclose: () => done(),
    },
  });
  const base = "warm felt piano, soft analog synth pads, gentle plucked arpeggios, optimistic, modern, clean, major key, instrumental";
  const sections: [atSec: number, prompts: { text: string; weight: number }[], density: number, brightness: number][] = [
    [0, [{ text: `${base}, sparse ambient intro, no drums`, weight: 1 }], 0.2, 0.45],
    [24, [{ text: `${base}, light electronic beat, soft kick, shaker`, weight: 1 }], 0.45, 0.55],
    [100, [{ text: `${base}, light electronic beat, uplifting build, shimmering synths`, weight: 1 }], 0.6, 0.65],
    [seconds - 18, [{ text: `${base}, resolving, calm outro, no drums`, weight: 1 }], 0.25, 0.5],
  ];
  await session.setWeightedPrompts({ weightedPrompts: sections[0][1] });
  await session.setMusicGenerationConfig({ musicGenerationConfig: { bpm: 100, temperature: 1.0, density: sections[0][2], brightness: sections[0][3] } });
  session.play();
  let next = 1;
  const steer = setInterval(async () => {
    const at = bytes / BYTES_PER_SEC;
    process.stdout.write(`\r  ${at.toFixed(0)}s / ${seconds}s`);
    if (next < sections.length && at >= sections[next][0]) {
      const [, prompts, density, brightness] = sections[next++];
      await session.setWeightedPrompts({ weightedPrompts: prompts });
      await session.setMusicGenerationConfig({ musicGenerationConfig: { bpm: 100, temperature: 1.0, density, brightness } });
    }
  }, 500);
  await finished;
  clearInterval(steer);
  session.close();
  const pcm = Buffer.concat(chunks).subarray(0, seconds * BYTES_PER_SEC);
  writeFileSync(join(PUBLIC, "music.wav"), wav(pcm, 48000, 2));
  console.log(`\npublic/music.wav ${(pcm.length / BYTES_PER_SEC).toFixed(1)}s`);
}

const [cmd, arg] = process.argv.slice(2);
mkdirSync(PUBLIC, { recursive: true });
({ photo: () => photo(arg), voice: () => voice(arg), music, "music-rt": () => musicRealtime(arg ? Number(arg) : undefined) } as Record<string, () => Promise<void>>)[cmd]?.().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}) ?? console.log("usage: generate-assets.ts photo | voice [sceneId] | music");
