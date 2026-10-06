-- Aggregated rows per window, recomputed every 60 s (SPEC 7.2).
CREATE TABLE leaderboard_cache (
  window TEXT PRIMARY KEY CHECK (window IN ('24h', '7d', 'all')),
  json TEXT NOT NULL CHECK (json_valid(json)),
  computed_at INTEGER NOT NULL
) STRICT;

-- Direct-log fill source: decoded Trade and flip-order events of the testnet
-- market, plus the next block to scan. A cache of chain data, never the truth.
CREATE TABLE fill_events (
  market TEXT NOT NULL,
  block INTEGER NOT NULL,
  log_index INTEGER NOT NULL,
  at INTEGER NOT NULL,
  json TEXT NOT NULL CHECK (json_valid(json)),
  PRIMARY KEY (market, block, log_index)
) STRICT, WITHOUT ROWID;
CREATE TABLE fill_cursors (
  market TEXT PRIMARY KEY,
  next_block INTEGER NOT NULL
) STRICT;
