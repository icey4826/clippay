// Claim photos: prepare (resize + fingerprint) and store. Files under data/ locally, a D1 table on Workers.

import type { PreparedPhoto } from "./images";
import { cfEnv, onWorkers } from "./runtime";
import { DATA_DIR } from "./store";

export async function preparePhoto(bytes: Uint8Array): Promise<PreparedPhoto> {
  if (onWorkers) return (await import("./images-cf")).preparePhoto((await cfEnv()).IMAGES, bytes);
  return (await import("./images-node")).preparePhoto(bytes);
}

/** `key` is the store's photo path, e.g. photos/<claimId>-1.jpg. */
export async function savePhoto(key: string, jpeg: Uint8Array): Promise<void> {
  if (onWorkers) {
    const { DB } = await cfEnv();
    await DB.prepare("INSERT OR REPLACE INTO photos (key, bytes) VALUES (?, ?)").bind(key, jpeg).run();
    return;
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  await mkdir(dirname(join(DATA_DIR, key)), { recursive: true });
  await writeFile(join(DATA_DIR, key), jpeg);
}

export async function loadPhoto(key: string): Promise<Uint8Array | null> {
  if (onWorkers) {
    const { DB } = await cfEnv();
    const row = await DB.prepare("SELECT bytes FROM photos WHERE key = ?").bind(key).first<{ bytes: ArrayBuffer | number[] }>();
    return row ? new Uint8Array(row.bytes) : null;
  }
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    return new Uint8Array(await readFile(join(DATA_DIR, key)));
  } catch {
    return null;
  }
}
