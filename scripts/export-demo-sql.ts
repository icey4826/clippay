// Prints SQL that replaces the demo orders and claims in D1 with the ones in the local store.
// Real (PayPal) orders are never exported.
//
//   npm run seed:demo && npm run db:seed-demo

import { randomUUID } from "node:crypto";
import { read } from "../src/lib/store";

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

read((db) => {
  const orders = Object.values(db.orders).filter((o) => o.demo);
  const ids = new Set(orders.map((o) => o.id));
  const claims = Object.values(db.claims).filter((c) => ids.has(c.orderId));
  if (orders.length === 0) throw new Error("No demo orders in the local store. Run `npm run seed:demo` first.");

  const lines = [
    // Seeded orders are the only ones with a "demo" flag; match on it rather than on ids.
    `DELETE FROM claims WHERE order_id IN (SELECT id FROM orders WHERE json_extract(data, '$.demo') = 1);`,
    `DELETE FROM orders WHERE json_extract(data, '$.demo') = 1;`,
    ...orders.map((o) => `INSERT INTO orders (id, claim_token, data) VALUES (${q(o.id)}, ${q(o.claimToken)}, ${q(JSON.stringify(o))});`),
    ...claims.map((c) => `INSERT INTO claims (id, order_id, data) VALUES (${q(c.id)}, ${q(c.orderId)}, ${q(JSON.stringify(c))});`),
    // Invalidate any read in flight, like every other write does.
    `UPDATE meta SET version = ${q(randomUUID())} WHERE id = 1;`,
  ];
  return lines.join("\n");
}).then((sql) => console.log(sql));
