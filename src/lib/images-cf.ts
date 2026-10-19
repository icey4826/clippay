// Photo prep on Workers with the Cloudflare Images binding: resize for grading, then a 9×8 PNG
// that we decode here for the dHash (the binding has no raw-pixel output).

import { dHashFromGray, GRADING_MAX_SIDE, type PreparedPhoto } from "./images";
import type { ImagesBinding } from "./runtime";

const stream = (bytes: Uint8Array) => new Blob([bytes as BlobPart]).stream();

async function bytesOf(res: Response) {
  return new Uint8Array(await res.arrayBuffer());
}

export async function preparePhoto(images: ImagesBinding, bytes: Uint8Array): Promise<PreparedPhoto> {
  const jpeg = await bytesOf(
    (
      await images
        .input(stream(bytes))
        .transform({ width: GRADING_MAX_SIDE, height: GRADING_MAX_SIDE, fit: "scale-down" })
        .output({ format: "image/jpeg", quality: 85 })
    ).response(),
  );
  let dhash: string | null = null;
  try {
    const png = await bytesOf(
      (await images.input(stream(jpeg)).transform({ width: 9, height: 8, fit: "squeeze" }).output({ format: "image/png" })).response(),
    );
    dhash = dHashFromGray(await pngToGray(png));
  } catch (err) {
    // The exact SHA-256 check still runs; a missing dHash only weakens near-duplicate detection.
    console.error("dHash failed:", err instanceof Error ? err.message : err);
  }
  return { jpeg, dhash };
}

/** Minimal PNG decoder for small 8-bit, non-interlaced images. Returns one luma byte per pixel. */
export async function pngToGray(png: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (view.getUint32(0) !== 0x89504e47) throw new Error("not a PNG");
  let width = 0;
  let height = 0;
  let colorType = 0;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let off = 8; off < png.length; ) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(off + 8);
      height = view.getUint32(off + 12);
      const bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || data[12] !== 0) throw new Error(`unsupported PNG (depth ${bitDepth}, interlace ${data[12]})`);
    } else if (type === "PLTE") palette = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);

  const raw = await bytesOf(new Response(new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream("deflate"))));
  const stride = width * channels;
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (src[x] + pred) & 0xff;
    }
  }

  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * channels;
    let r = px[p];
    let g = px[p];
    let bl = px[p];
    if (colorType === 2 || colorType === 6) [r, g, bl] = [px[p], px[p + 1], px[p + 2]];
    if (colorType === 3 && palette) [r, g, bl] = [palette[px[p] * 3], palette[px[p] * 3 + 1], palette[px[p] * 3 + 2]];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * bl);
  }
  return gray;
}
