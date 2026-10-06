-- Funding ledger and quota source (SPEC 7.2, 7.3). Amounts are decimal strings: wei exceeds 2^53.
CREATE TABLE drips (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  address TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  mon_wei TEXT NOT NULL,
  ausd_units TEXT NOT NULL,
  mon_tx TEXT,
  ausd_tx TEXT,
  status TEXT NOT NULL
) STRICT;
CREATE INDEX drips_address ON drips (address);
CREATE INDEX drips_ip_at ON drips (ip_hash, at);
CREATE INDEX drips_at ON drips (at);
