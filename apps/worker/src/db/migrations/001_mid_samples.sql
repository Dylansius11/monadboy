-- Price observations: mainnet source mid and testnet book mid, one row per sample.
CREATE TABLE mid_samples (
  at INTEGER NOT NULL,
  market TEXT NOT NULL,
  mid REAL NOT NULL CHECK (mid > 0),
  PRIMARY KEY (market, at)
) STRICT, WITHOUT ROWID;
