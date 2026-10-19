// Records the live segment: drives a visible Chrome window through the real flow on the deployed app and
// captures the page with the DevTools screencast. Two steps are the person's:
//   - the PayPal sandbox login and payment approval (and again on sandbox.paypal.com if asked), and
//   - the real photo: write the code shown on screen next to the damage, take the photo, and save it as
//     video/public/live/photo.jpg (or .jpeg/.png/.heic). Recording pauses while it waits for the file.
//
//   npm run record-live            then   npm run assemble-live
//
// Frames and a manifest go to public/live/frames; assemble-live turns them into public/live/recording.mov.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer, { type Page } from "puppeteer-core";

const APP = process.env.APP_URL ?? "https://clippay.productivityappsforwindows.com";
const LIVE = join(__dirname, "../public/live");
// RESUME_CLAIM=<claim url> records a second part from the claim page on (photo already in public/live).
const RESUME = process.env.RESUME_CLAIM;
const FRAMES = join(LIVE, RESUME ? "frames-2" : "frames");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (tag: string, msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${tag}: ${msg}`);

type Frame = { file: string; t: number; resumed: boolean };
const frames: Frame[] = [];
const marks: Record<string, number> = {};
let paused = false;
let resumedFlag = false;

async function startScreencast(page: Page) {
  const cdp = await page.createCDPSession();
  cdp.on("Page.screencastFrame", (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    if (paused) return;
    const file = `${String(frames.length).padStart(6, "0")}.jpg`;
    writeFileSync(join(FRAMES, file), Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000, resumed: resumedFlag });
    resumedFlag = false;
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 2880, maxHeight: 1800, everyNthFrame: 1 });
  return cdp;
}

const mark = (name: string) => {
  marks[name] = frames.length;
  log("MARK", name);
};

async function waitForUrl(page: Page, test: (u: string) => boolean, timeoutMs: number) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (test(page.url())) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for the page to leave ${page.url()}`);
}

async function waitForText(page: Page, texts: string[], timeoutMs: number): Promise<string> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const body = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    const hit = texts.find((t) => body.includes(t));
    if (hit) return hit;
    await sleep(400);
  }
  throw new Error(`Timed out waiting for: ${texts.join(" | ")}`);
}

async function waitForPhoto(timeoutMs: number): Promise<string> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const hit = readdirSync(LIVE).find((f) => /^photo\.(jpe?g|png|heic|webp)$/i.test(f));
    if (hit) {
      await sleep(1500); // let the copy finish
      return join(LIVE, hit);
    }
    await sleep(1000);
  }
  throw new Error("Timed out waiting for the photo");
}

/** The upload copy: JPEG, long edge 2400 px. The original stays for the video. */
function uploadCopy(photo: string) {
  const out = join(LIVE, "upload.jpg");
  execFileSync("sips", ["-s", "format", "jpeg", "-Z", "2400", photo, "--out", out], { stdio: "ignore" });
  if (!/\.jpe?g$/i.test(photo)) execFileSync("sips", ["-s", "format", "jpeg", photo, "--out", join(LIVE, "photo.jpg")], { stdio: "ignore" });
  return out;
}

async function clickText(page: Page, selector: string, text: string) {
  await page.waitForFunction(
    (sel, txt) => [...document.querySelectorAll(sel)].some((e) => (e as HTMLElement).innerText.includes(txt) && !(e as HTMLButtonElement).disabled),
    { timeout: 60_000, polling: 500 },
    selector,
    text,
  );
  await page.evaluate(
    (sel, txt) => ([...document.querySelectorAll(sel)].find((e) => (e as HTMLElement).innerText.includes(txt)) as HTMLElement).click(),
    selector,
    text,
  );
}

async function main() {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  if (!RESUME) for (const f of readdirSync(LIVE)) if (/^(photo|upload)\./i.test(f)) rmSync(join(LIVE, f));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir: join(tmpdir(), "clippay-live-profile"),
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--window-size=1460,1040", "--window-position=40,40", "--disable-blink-features=AutomationControlled", "--hide-scrollbars",
      // Keep rendering (and the screencast) going when the window is behind other windows.
      "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"],
  });
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  page.on("framenavigated", (f) => {
    // Cross-site navigations can swap the renderer; restarting the screencast keeps frames coming.
    if (f === page.mainFrame()) startScreencast(page).catch(() => {});
  });

  try {
    if (RESUME) {
      // The claim went to review (above the ceiling): the buyer's view, then the merchant approves it.
      await page.goto(RESUME, { waitUntil: "networkidle2" });
      await startScreencast(page);
      mark("review");
      await sleep(3500);
      await page.goto(APP + "/merchant", { waitUntil: "networkidle2" });
      mark("merchant");
      await sleep(2500);
      await page.evaluate(() => {
        const row = [...document.querySelectorAll("[role=row]")].find((r) => (r as HTMLElement).innerText.includes("Needs review"));
        (row as HTMLElement | undefined)?.click();
      });
      await sleep(3000);
      await clickText(page, "button", "Refund $");
      mark("approve");
      const end = Date.now() + 60_000;
      while (Date.now() < end && (await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.innerText.startsWith("Refund $"))))) await sleep(400);
      await sleep(3500);
      await page.goto(RESUME, { waitUntil: "networkidle2" });
      await waitForText(page, ["is on its way back"], 30_000);
      mark("refunded");
      await sleep(4500);
      await showSandbox(page);
      return;
    }
    await page.goto(APP, { waitUntil: "networkidle2" });
    await startScreencast(page);
    mark("shop");
    await sleep(3000);
    await page.evaluate(() => (document.querySelector("form[action='/api/checkout'] button") as HTMLElement).click());
    mark("paypal");
    log("YOU", "Log in to the PayPal sandbox buyer account in the Chrome window and approve the payment.");
    await waitForUrl(page, (u) => u.startsWith(APP + "/orders/"), 15 * 60_000);
    await waitForText(page, ["Thanks for your order"], 30_000);
    mark("receipt");
    await sleep(3000);
    await page.evaluate(() => (document.querySelector("a[href^='/claim/']") as HTMLElement).click());
    await page.waitForSelector("[aria-label^='Code ']", { timeout: 60_000 });
    mark("code");
    const code = await page.$eval("[aria-label^='Code ']", (e) => (e.textContent ?? "").trim());
    await sleep(3500);
    paused = true;
    log("YOU", `Write ${code} on paper, put it next to the chip, take the photo and save it as video/public/live/photo.jpg. Recording is paused.`);
    const photo = await waitForPhoto(28 * 60_000);
    resumedFlag = true;
    paused = false;
    await uploadAndSettle(page, photo);
  } finally {
    paused = true;
    writeFileSync(join(FRAMES, "manifest.json"), JSON.stringify({ frames, marks }, null, 1));
    log("DONE", `${frames.length} frames; run npm run assemble-live`);
    await browser.close();
  }
}

async function uploadAndSettle(page: Page, photo: string) {
    const upload = uploadCopy(photo);
    log("PHOTO", `got ${photo.split("/").pop()}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(800);
    mark("upload");
    const input = await page.$("input[type=file]");
    if (!input) throw new Error("No file input on the claim page");
    await input!.uploadFile(upload);
    await sleep(1600);
    await page.type("#description", "One mug has a chip on the rim", { delay: 45 });
    await sleep(900);
    await clickText(page, "button", "Get my offer");
    mark("grading");
    const outcome = await waitForText(page, ["Accept $", "taking a closer look", "can't offer", "Couldn"], 120_000);
    mark("offer");
    log("OUTCOME", outcome);
    await sleep(3500);
    if (outcome === "Accept $") {
      await clickText(page, "button", "Accept $");
      mark("accept");
      await waitForText(page, ["is on its way back"], 90_000);
      mark("refunded");
      await sleep(4500);
    }
    await showSandbox(page);
}

async function showSandbox(page: Page) {
  await page.goto("https://www.sandbox.paypal.com/myaccount/activities/", { waitUntil: "domcontentloaded" });
  mark("sandbox");
  log("YOU", "If PayPal asks, log in as the same sandbox buyer. Click the refund in the activity list to open it.");
  await waitForUrl(page, (u) => u.includes("/myaccount/") && !/signin|login/.test(u), 10 * 60_000);
  mark("activity");
  await sleep(25_000);
  mark("end");
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});

