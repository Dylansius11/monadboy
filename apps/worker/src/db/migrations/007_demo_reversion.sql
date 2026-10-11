-- When the anchor was last carried forward. The DEMO target's gap to mainnet decays from
-- this moment, so a restart never replays or skips reversion.
ALTER TABLE demo_anchors ADD COLUMN anchored_at INTEGER NOT NULL DEFAULT 0;
