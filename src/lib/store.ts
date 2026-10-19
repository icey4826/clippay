// Persistence for orders and claims, behind one read-modify-write interface.
// Local dev and scripts: one JSON file under data/ (gitignored). Workers: Cloudflare D1 (migrations/).

import { join } from "node:path";
import type { Grade } from "./grading";
import type { Decision } from "./rules";
import { cfEnv, onWorkers, type D1Database } from "./runtime";

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
  /** Seeded demo order: refunds are simulated, PayPal is never called. */
  demo?: boolean;
}

export type ClaimStatus =
  | "awaiting_photos" // code issued, nothing submitted yet
  | "offered" // automatic offer shown to the buyer
  | "review" // waiting for the merchant
  | "ineligible"
  | "denied" // merchant declined after review
  | "refunding" // refund call in flight; blocks a second accept
  | "refunded"
  | "refund_failed";

export interface StoredPhoto {
  path: string; // photo key, e.g. photos/<claimId>-1.jpg (see photos.ts)
  sha256: string;
  dhash?: string; // perceptual hash; missing on claims filed before it existed
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
  /** Who settled it: the automatic offer, an auto-accepted counter, or the merchant after review. */
  resolution: "auto_offer" | "auto_counter" | "merchant" | null;
  merchantNote: string | null;
  submittedAt: string | null;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Db {
  orders: Record<string, StoredOrder>;
  claims: Record<string, StoredClaim>;
}

export const DATA_DIR = process.env.CLIPPAY_DATA_DIR ?? join(process.cwd(), "data");

interface Backend {
  transact<T>(fn: (db: Db) => T | Promise<T>): Promise<T>;
  load(): Promise<Db>;
}

// ---------- JSON file (Node) ----------

const DB_PATH = join(DATA_DIR, "clippay.json");

// One dev server process, so an in-process queue is enough to keep writes from interleaving.
let queue: Promise<unknown> = Promise.resolve();

const fileBackend: Backend = {
  async load() {
    await queue;
    return loadFile();
  },
  transact(fn) {
    const run = queue.then(async () => {
      const db = await loadFile();
      const result = await fn(db);
      await saveFile(db);
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  },
};

async function loadFile(): Promise<Db> {
  const { readFile } = await import("node:fs/promises");
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8")) as Db;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { orders: {}, claims: {} };
    throw err;
  }
}

async function saveFile(db: Db) {
  const { mkdir, rename, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_PATH); // atomic replace: a crash never leaves half a file
}

// ---------- D1 (Workers) ----------
// Every request is its own isolate, so there is no shared lock. Instead each write is a compare-and-swap
// on meta.version: the batch (one D1 transaction) first moves the version from the one we read to a fresh
// random one, and every row write is guarded on that fresh version. If someone else wrote in between,
// the version check matches nothing, so none of our rows are written and we rerun `fn` on fresh data.
// Fine at hackathon scale (the whole store is read per request); a bigger app would query per row.

const MAX_ATTEMPTS = 5;

async function loadD1(d1: D1Database): Promise<{ db: Db; version: string }> {
  const [meta, orders, claims] = await d1.batch([
    d1.prepare("SELECT version FROM meta WHERE id = 1"),
    d1.prepare("SELECT data FROM orders"),
    d1.prepare("SELECT data FROM claims"),
  ]);
  const db: Db = { orders: {}, claims: {} };
  for (const r of orders.results as { data: string }[]) {
    const o = JSON.parse(r.data) as StoredOrder;
    db.orders[o.id] = o;
  }
  for (const r of claims.results as { data: string }[]) {
    const c = JSON.parse(r.data) as StoredClaim;
    db.claims[c.id] = c;
  }
  return { db, version: String((meta.results[0] as { version: string } | undefined)?.version ?? "") };
}

const d1Backend: Backend = {
  async load() {
    return (await loadD1((await cfEnv()).DB)).db;
  },
  async transact(fn) {
    const d1 = (await cfEnv()).DB;
    for (let attempt = 1; ; attempt++) {
      const { db, version } = await loadD1(d1);
      const before = {
        orders: new Map(Object.entries(db.orders).map(([id, o]) => [id, JSON.stringify(o)])),
        claims: new Map(Object.entries(db.claims).map(([id, c]) => [id, JSON.stringify(c)])),
      };
      const result = await fn(db);

      const next = crypto.randomUUID();
      const guard = "(SELECT version FROM meta WHERE id = 1) = ?";
      const writes = [];
      for (const [id, o] of Object.entries(db.orders)) {
        const json = JSON.stringify(o);
        if (before.orders.get(id) === json) continue;
        writes.push(
          d1
            .prepare(
              `INSERT INTO orders (id, claim_token, data) SELECT ?, ?, ? WHERE ${guard}
               ON CONFLICT(id) DO UPDATE SET claim_token = excluded.claim_token, data = excluded.data`,
            )
            .bind(id, o.claimToken, json, next),
        );
      }
      for (const [id, c] of Object.entries(db.claims)) {
        const json = JSON.stringify(c);
        if (before.claims.get(id) === json) continue;
        writes.push(
          d1
            .prepare(
              `INSERT INTO claims (id, order_id, data) SELECT ?, ?, ? WHERE ${guard}
               ON CONFLICT(id) DO UPDATE SET order_id = excluded.order_id, data = excluded.data`,
            )
            .bind(id, c.orderId, json, next),
        );
      }
      for (const id of before.orders.keys()) {
        if (!db.orders[id]) writes.push(d1.prepare(`DELETE FROM orders WHERE id = ? AND ${guard}`).bind(id, next));
      }
      for (const id of before.claims.keys()) {
        if (!db.claims[id]) writes.push(d1.prepare(`DELETE FROM claims WHERE id = ? AND ${guard}`).bind(id, next));
      }
      if (writes.length === 0) return result;

      const [swap] = await d1.batch([
        d1.prepare("UPDATE meta SET version = ? WHERE id = 1 AND version = ?").bind(next, version),
        ...writes,
      ]);
      if (swap.meta.changes === 1) return result;
      if (attempt >= MAX_ATTEMPTS) throw new Error("The store is busy. Please try again.");
    }
  },
};

const backend = (): Backend => (onWorkers ? d1Backend : fileBackend);

/** Read-modify-write. `fn` may run more than once on Workers, so it must only touch `db`. */
export function transact<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  return backend().transact(fn);
}

export async function read<T>(fn: (db: Db) => T): Promise<T> {
  return fn(await backend().load());
}

export const getOrder = (id: string) => read((db) => db.orders[id] ?? null);
export const getOrderByToken = (token: string) =>
  read((db) => Object.values(db.orders).find((o) => o.claimToken === token) ?? null);
export const getClaimForOrder = (orderId: string) =>
  read((db) => Object.values(db.claims).find((c) => c.orderId === orderId) ?? null);
