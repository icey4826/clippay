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

/** Exact-match fingerprint of the uploaded bytes. */
export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * 64-bit difference hash as 16 hex chars. Survives resizing, recompression and small edits,
 * so the same photo re-saved or screenshotted still matches.
 */
export async function dHash(input: Buffer): Promise<string> {
  const px = await sharp(input).rotate().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) {
      const y = Math.floor((i + b) / 8);
      const x = (i + b) % 8;
      nibble = (nibble << 1) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1 : 0);
    }
    hex += nibble.toString(16);
  }
  return hex;
}

const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Number of differing bits between two dHashes (0 = same picture, 64 = opposite). */
export function hashDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d += POPCOUNT[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

/** At or under this many differing bits, two photos count as the same picture. */
export const NEAR_DUPLICATE_BITS = 6;
