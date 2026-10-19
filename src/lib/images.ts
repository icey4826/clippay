// Photo fingerprints that work the same on Node and Workers. Decoding and resizing live in
// images-node.ts (sharp) and images-cf.ts (Cloudflare Images); photos.ts picks one.

import { createHash } from "node:crypto";

/** Longest side of the copy we grade and keep. Phone photos are often 4-8 MB. */
export const GRADING_MAX_SIDE = 1536;

/** Exact-match fingerprint of the uploaded bytes. */
export function sha256(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * 64-bit difference hash as 16 hex chars, from a 9×8 grayscale image (row-major, 72 values).
 * Survives resizing, recompression and small edits, so the same photo re-saved or screenshotted still matches.
 */
export function dHashFromGray(px: ArrayLike<number>): string {
  if (px.length !== 72) throw new Error(`dHash needs 9×8 pixels, got ${px.length}`);
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

export interface PreparedPhoto {
  jpeg: Uint8Array;
  dhash: string | null;
}
