-- Latest + 7 day history of per-market tracker snapshots (SPEC 7.2).
CREATE TABLE market_snapshots (
  id INTEGER PRIMARY KEY,
  taken_at INTEGER NOT NULL,
  market TEXT NOT NULL,
  json TEXT NOT NULL CHECK (json_valid(json)),
  UNIQUE (taken_at, market)
) STRICT;
CREATE INDEX market_snapshots_market_at ON market_snapshots (market, taken_at);

-- Mainnet Trade logs for the last 24h. One getLogs call covers all seven
-- markets, so a single window [oldest_block, latest_block] describes coverage.
CREATE TABLE tracker_trades (
  market TEXT NOT NULL,
  block INTEGER NOT NULL,
  log_index INTEGER NOT NULL,
  at INTEGER NOT NULL,
  maker TEXT NOT NULL,
  price REAL NOT NULL,
  size REAL NOT NULL,
  tx_hash TEXT NOT NULL,
  PRIMARY KEY (market, block, log_index)
) STRICT, WITHOUT ROWID;
CREATE INDEX tracker_trades_at ON tracker_trades (at);
CREATE TABLE tracker_window (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  oldest_block INTEGER NOT NULL,
  latest_block INTEGER NOT NULL,
  target_block INTEGER NOT NULL,
  synced_at INTEGER,
  updated_at INTEGER NOT NULL
) STRICT;

-- First block whose state shows market bytecode; exact=0 when older state is no longer served,
-- so the market is at least this old. Immutable, so resolved once and kept.
CREATE TABLE market_births (
  market TEXT PRIMARY KEY,
  block INTEGER NOT NULL,
  at INTEGER NOT NULL,
  exact INTEGER NOT NULL CHECK (exact IN (0, 1))
) STRICT;
