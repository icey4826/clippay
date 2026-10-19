import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { dHash, hashDistance, NEAR_DUPLICATE_BITS } from "./images";

// Synthetic "photos": a lit scene with a few shapes, rendered from SVG.
function scene(shapes: string, w = 800, h = 600) {
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 800 600">
        <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#eee"/><stop offset="1" stop-color="#555"/></linearGradient></defs>
        <rect width="800" height="600" fill="url(#g)"/>${shapes}</svg>`,
    ),
  )
    .jpeg({ quality: 90 })
    .toBuffer();
}

const MUG = `<rect x="300" y="200" width="200" height="260" rx="20" fill="#7b3f26"/><circle cx="560" cy="320" r="50" fill="none" stroke="#7b3f26" stroke-width="24"/>`;
const PLATE = `<ellipse cx="250" cy="400" rx="220" ry="90" fill="#fafafa"/><path d="M120 380 L380 420" stroke="#222" stroke-width="6"/><rect x="560" y="60" width="160" height="160" fill="#123"/>`;

describe("dHash", () => {
  it("returns 16 hex chars", async () => {
    assert.match(await dHash(await scene(MUG)), /^[0-9a-f]{16}$/);
  });

  it("matches the same photo after resizing and recompression", async () => {
    const original = await scene(MUG);
    const resaved = await sharp(original).resize(400).jpeg({ quality: 55 }).toBuffer();
    assert.ok(hashDistance(await dHash(original), await dHash(resaved)) <= NEAR_DUPLICATE_BITS);
  });

  it("tells different photos apart", async () => {
    const d = hashDistance(await dHash(await scene(MUG)), await dHash(await scene(PLATE)));
    assert.ok(d > NEAR_DUPLICATE_BITS, `distance ${d}`);
  });
});

describe("hashDistance", () => {
  it("counts differing bits", () => {
    assert.equal(hashDistance("0000000000000000", "0000000000000000"), 0);
    assert.equal(hashDistance("0000000000000000", "000000000000000f"), 4);
    assert.equal(hashDistance("ffffffffffffffff", "0000000000000000"), 64);
  });
});
