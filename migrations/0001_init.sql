-- ClipPay store on D1. Orders and claims are kept as JSON documents (same shape as the local
-- data/clippay.json); meta.version is the compare-and-swap token every write is guarded on.

CREATE TABLE meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL
);
INSERT INTO meta (id, version) VALUES (1, 'init');

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  claim_token TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL
);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX claims_order_id ON claims (order_id);

-- Resized claim photos (about 200-400 KB each), keyed like photos/<claimId>-1.jpg.
CREATE TABLE photos (
  key TEXT PRIMARY KEY,
  bytes BLOB NOT NULL
);
