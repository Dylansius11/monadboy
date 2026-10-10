-- A common anchor survives worker restarts; players never get competing prices.
CREATE TABLE demo_anchors (
  market TEXT PRIMARY KEY,
  multiplier INTEGER NOT NULL CHECK (multiplier >= 1),
  source_mid REAL NOT NULL CHECK (source_mid > 0),
  target_mid REAL NOT NULL CHECK (target_mid > 0)
) STRICT;

-- Pessimistic pre-broadcast reservations survive errors and restarts.
CREATE TABLE mirror_gas_reservations (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  max_cost_wei TEXT NOT NULL,
  tx_hash TEXT
) STRICT;
CREATE INDEX mirror_gas_reservations_at ON mirror_gas_reservations (at);
