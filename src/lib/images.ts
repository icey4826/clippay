import { createHash } from "node:crypto";
import sharp from "sharp";

// Phone photos are often 4-8MB; shrink to keep grading requests small and fast.
export function toGradingJpeg(input: Buffer | string): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// Exact-match fingerprint. Week 3 adds a perceptual hash to catch resized or recropped copies.
export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
