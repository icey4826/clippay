// Renders review stills: node scripts/stills.mjs <outDir> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [outDir, ...frames] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = existsSync(chrome) ? { browserExecutable: chrome, chromeMode: "chrome-for-testing" } : {};
const serveUrl = await bundle({ entryPoint: join(import.meta.dirname, "../src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "ClipPayDemo", ...browser });
for (const f of frames) {
  await renderStill({ serveUrl, composition, frame: Number(f), output: join(outDir, `f${String(f).padStart(4, "0")}.png`), scale: 0.5, ...browser });
  console.log("frame", f);
}
