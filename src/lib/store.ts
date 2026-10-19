// Persistence for orders and claims.
// Local dev uses one JSON file under data/ (gitignored). Week 3 swaps in Cloudflare D1 behind the same interface.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Grade } from "./grading";
import type { Decision } from "./rules";

export interface StoredOrder {
  id: string; // PayPal order id
  claimToken: string; // secret part of the claim link
  productSku: string;
  productName: string;
  priceCents: number;
  currency: string;
  captureId: string;
  capturedAt: string; // ISO
  payerId: string | null;
  payerEmail: string | null;
  refundedCents: number;
}

export type ClaimStatus =
  | "awaiting_photos" // code issued, nothing submitted yet
  | "offered" // automatic offer shown to the buyer
  | "review" // waiting for the merchant
  | "ineligible"
  | "refunding" // refund call in flight; blocks a second accept
  | "refunded"
  | "refund_failed";

export interface StoredPhoto {
  path: string; // relative to data/
  sha256: string;
}

export interface StoredClaim {
  id: string;
  orderId: string;
  code: string;
  codeIssuedAt: string;
  status: ClaimStatus;
  description: string | null;
  photos: StoredPhoto[];
  grade: Grade | null;
  gradeModel: string | null;
  codeMatches: boolean | null;
  decision: Decision | null;
  countersUsed: number;
  counterCents: number | null;
  agreedCents: number | null; // amount the buyer accepted (offer or auto-accepted counter)
  reviewNote: string | null; // why it went to review after the offer (e.g. counter too high)
  refund: { id: string; status: string; amountCents: number } | null;
  refundError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Db {
  orders: Record<string, StoredOrder>;
  claims: Record<string, StoredClaim>;
}

export const DATA_DIR = process.env.CLIPPAY_DATA_DIR ?? join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "clippay.json");

// One dev server process, so an in-process queue is enough to keep writes from interleaving.
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8")) as Db;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { orders: {}, claims: {} };
    throw err;
  }
}

async function save(db: Db) {
  await mkdir(dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_PATH); // atomic replace: a crash never leaves half a file
}

/** Read-modify-write under the lock. Whatever `fn` returns is passed back. */
export function transact<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function read<T>(fn: (db: Db) => T): Promise<T> {
  await queue;
  return fn(await load());
}

export const getOrder = (id: string) => read((db) => db.orders[id] ?? null);
export const getOrderByToken = (token: string) =>
  read((db) => Object.values(db.orders).find((o) => o.claimToken === token) ?? null);
export const getClaimForOrder = (orderId: string) =>
  read((db) => Object.values(db.claims).find((c) => c.orderId === orderId) ?? null);
