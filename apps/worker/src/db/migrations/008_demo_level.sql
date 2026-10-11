-- The DEMO level a target reverts to, as a ratio to mainnet. An idle book re-anchors the target
-- at the book itself, so the next run starts where the TESTNET book really is; 1 is mainnet.
ALTER TABLE demo_anchors ADD COLUMN level REAL NOT NULL DEFAULT 1 CHECK (level > 0);
