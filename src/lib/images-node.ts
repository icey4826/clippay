// sharp-based photo prep for local dev and scripts. Never bundled into the Worker: sharp is loaded
// through an import the bundlers leave alone.

import type { Sharp, SharpOptions } from "sharp";
import { dHashFromGray, GRADING_MAX_SIDE, type PreparedPhoto } from "./images";

const SHARP = "sharp";
type SharpFn = (input?: Buffer | Uint8Array | string, options?: SharpOptions) => Sharp;
let sharpFn: Promise<SharpFn> | undefined;
const sharp = () => (sharpFn ??= import(/* webpackIgnore: true */ SHARP).then((m) => (m.default ?? m) as SharpFn));

export async function toGradingJpeg(input: Buffer | Uint8Array | string): Promise<Buffer> {
  return (await sharp())(input)
    .rotate()
    .resize({ width: GRADING_MAX_SIDE, height: GRADING_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function dHash(input: Buffer | Uint8Array): Promise<string> {
  const px = await (await sharp())(input).rotate().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  return dHashFromGray(px);
}

export async function preparePhoto(bytes: Uint8Array): Promise<PreparedPhoto> {
  const jpeg = await toGradingJpeg(bytes);
  return { jpeg, dhash: await dHash(jpeg) };
}
