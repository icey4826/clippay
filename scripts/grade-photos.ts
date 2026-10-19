// Week 1 grading prototype: grade every photo in samples/ and check the model is consistent.
//
//   npm run grade                       all photos, 2 runs each
//   npm run grade -- --runs 3 --only mug
//
// Optional samples/manifest.json gives each photo its claim context and the grade you expect:
//   { "mug-chip.jpg": { "product": "Ceramic mug", "description": "Chipped rim", "code": "K7Q4", "expected": "minor" } }

import "dotenv/config";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";
import { SEVERITIES, graderFromEnv, type GradeResult, type ImageInput, type Severity } from "../src/lib/grading";
import { toGradingJpeg } from "../src/lib/images-node";

const { values: args } = parseArgs({
  options: {
    dir: { type: "string", default: "samples" },
    runs: { type: "string", default: "2" },
    only: { type: "string" },
    delay: { type: "string", default: "4000" }, // ms between calls; free tier allows only a few per minute
  },
});

interface ManifestEntry {
  product?: string;
  description?: string;
  code?: string;
  expected?: Severity;
}

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadImage(path: string): Promise<ImageInput> {
  return { data: (await toGradingJpeg(path)).toString("base64"), mimeType: "image/jpeg" };
}

function severityDistance(a: Severity, b: Severity) {
  return Math.abs(SEVERITIES.indexOf(a) - SEVERITIES.indexOf(b));
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY. Get one at aistudio.google.com/apikey and add it to .env.");
    process.exit(1);
  }
  const grader = graderFromEnv();
  const runs = Number(args.runs);
  const delay = Number(args.delay);

  const manifest: Record<string, ManifestEntry> = await readFile(join(args.dir, "manifest.json"), "utf8")
    .then((t) => JSON.parse(t))
    .catch(() => ({}));

  const all = await readdir(args.dir);
  const skipped = all.filter((f) => [".heic", ".heif"].includes(extname(f).toLowerCase()));
  if (skipped.length) console.warn(`Skipping HEIC photos (export them as JPEG): ${skipped.join(", ")}`);
  const files = all
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .filter((f) => !args.only || f.includes(args.only))
    .sort();
  if (files.length === 0) {
    console.error(`No .jpg/.png/.webp photos in ${args.dir}/`);
    process.exit(1);
  }

  console.log(`Grading ${files.length} photo(s) x ${runs} run(s) with ${grader.model} (thinking ${grader.thinkingLevel})\n`);
  const report: { file: string; claim: ManifestEntry; runs: (GradeResult | { error: string })[] }[] = [];

  for (const file of files) {
    const claim = manifest[file] ?? {};
    const image = await loadImage(join(args.dir, file));
    const results: (GradeResult | { error: string })[] = [];

    for (let i = 0; i < runs; i++) {
      if (report.length || i) await sleep(delay);
      try {
        results.push(
          await grader.grade([image], {
            productName: claim.product ?? "unknown item",
            buyerDescription: claim.description,
            expectedCode: claim.code,
          }),
        );
      } catch (err) {
        results.push({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    report.push({ file, claim, runs: results });

    const ok = results.filter((r): r is GradeResult => "grade" in r);
    const sevs = ok.map((r) => r.grade.overall_severity);
    const consistent = new Set(sevs).size <= 1;
    const expected = claim.expected && sevs.length
      ? sevs.every((s) => severityDistance(s, claim.expected!) <= 1)
        ? `ok (expected ${claim.expected})`
        : `OFF (expected ${claim.expected})`
      : "";
    const code = ok[0]?.codeMatches === null || !ok.length ? "" : ok.every((r) => r.codeMatches) ? "code ok" : "CODE MISMATCH";
    const first = ok[0]?.grade;

    console.log(`${file}`);
    console.log(`  severity: ${sevs.join(" / ") || "-"} ${consistent ? "" : "INCONSISTENT"} ${expected}`.trimEnd());
    if (first) {
      console.log(`  seen: ${first.item_seen} | confidence ${first.confidence} | impact ${first.functional_impact} ${code}`.trimEnd());
      for (const d of first.defects) console.log(`  - ${d.severity} ${d.type} @ ${d.location}: ${d.description}`);
      if (!first.photo_usable) console.log("  ! photo not usable");
      if (!first.looks_like_real_photo) console.log("  ! not a real photo");
      if (!first.matches_claimed_item) console.log("  ! doesn't match claimed item");
      if (first.reviewer_note) console.log(`  note: ${first.reviewer_note}`);
    }
    for (const r of results) if ("error" in r) console.log(`  error: ${r.error}`);
    console.log();
  }

  // Summary
  const graded = report.filter((r) => r.runs.some((x) => "grade" in x));
  const consistentCount = graded.filter(
    (r) => new Set(r.runs.filter((x): x is GradeResult => "grade" in x).map((x) => x.grade.overall_severity)).size === 1,
  ).length;
  const withExpected = graded.filter((r) => r.claim.expected);
  const nearExpected = withExpected.filter((r) =>
    r.runs.every((x) => !("grade" in x) || severityDistance(x.grade.overall_severity, r.claim.expected!) <= 1),
  ).length;
  const latencies = report.flatMap((r) => r.runs.filter((x): x is GradeResult => "grade" in x).map((x) => x.latencyMs));

  console.log("== Summary");
  console.log(`Graded: ${graded.length}/${report.length} photos`);
  console.log(`Same severity on every run: ${consistentCount}/${graded.length}`);
  if (withExpected.length) console.log(`Within one level of expected: ${nearExpected}/${withExpected.length}`);
  if (latencies.length) {
    console.log(`Avg latency: ${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)} ms`);
  }

  await mkdir("results", { recursive: true });
  const out = join("results", `grades-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(out, JSON.stringify({ model: grader.model, runs, report }, null, 2));
  console.log(`Full results: ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
