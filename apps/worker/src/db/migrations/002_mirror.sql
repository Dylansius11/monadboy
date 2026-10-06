-- One row per mirror tick, including pauses and errors (SPEC 5.2, 7.2).
CREATE TABLE mirror_ticks (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  source_mid REAL,
  testnet_mid_before REAL,
  action TEXT NOT NULL CHECK (action IN ('paused', 'hold', 'quote', 'buy', 'sell')),
  notional REAL NOT NULL DEFAULT 0,
  tx_hash TEXT,
  error TEXT
) STRICT;
CREATE INDEX mirror_ticks_at ON mirror_ticks (at);

-- Resting quote order ids owned by the bot, replaced on every refresh.
CREATE TABLE mirror_quotes (
  market TEXT NOT NULL,
  order_id TEXT NOT NULL,
  PRIMARY KEY (market, order_id)
) STRICT;
