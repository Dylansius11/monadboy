# Worker deployment

The worker is one Bun process (`apps/worker`) behind Caddy on the VPS. It signs only
with two dedicated testnet operations keys; its mainnet client is read-only. No route
signs for a player. Nothing here is deployed yet: the VPS and hostname are still
outstanding, so every command below is an instruction, not a record.

## Install

1. Create the `monadboy` system user and `/opt/monadboy`. Install Bun at
   `/usr/local/bin/bun` and Caddy from the distribution's supported packages.
2. Place the repository at `/opt/monadboy` and run `bun install --frozen-lockfile`.
3. Create `/opt/monadboy/apps/worker/.env`, mode `0600`, owned by `monadboy`, starting
   from `apps/worker/.env.example`. Blank values count as unset. Keys live only in that
   file: never in a unit, the Caddy config, a command line, SQLite or a log.
4. Set `APP_ORIGIN` to the fixed HTTPS web origin. The unit already sets
   `SQLITE_PATH=/var/lib/monadboy/worker.sqlite` (created by `StateDirectory=`) and binds
   the listener to `127.0.0.1`; keep `WORKER_PORT=8787` to match the Caddyfile.
5. Install the unit and start it:

```sh
install -m 0644 deploy/monadboy-worker.service /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/monadboy-worker.service
systemctl daemon-reload
systemctl enable --now monadboy-worker
systemctl status monadboy-worker
curl http://127.0.0.1:8787/v1/health
```

6. Set `WORKER_HOST` in Caddy's service environment, install the example as
   `/etc/caddy/Caddyfile`, then:

```sh
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
curl https://$WORKER_HOST/v1/health
```

The drip quota hashes the client address. The worker trusts `X-Forwarded-For` only when
the TCP peer is loopback (Caddy), and Caddy replaces the header with the real peer. Keep
the listener on loopback and do not open its port; local users could otherwise claim any
address. Fix the web hostname before the first production passkey.

## Enabling transactions

`ENABLE_TRANSACTIONS` defaults to `false`: the worker then only reads (mid sampling,
tracker, leaderboard) and `/v1/health` reports the mirror and drip as disabled. To enable
sends, set it to `true` together with distinct `BOT_PRIVATE_KEY` and `DRIP_PRIVATE_KEY`
(`cast wallet new`, funded by the owner), a stable `DRIP_IP_SALT` of at least 32
characters, and `MARKETS_JSON` once the testnet market exists. At start the worker
refuses to sign unless the RPC reports chain 10143 and every configured contract has
bytecode. Never use these keys on mainnet.

[U, S2] `GAS_MARKET_ORDER`, `GAS_BATCH_UPDATE` (1,000,000 each), `GAS_ERC20` (100,000)
and `GAS_FAUCET` (200,000) are conservative defaults, not measured limits. Replace them
with limits taken from spike S2 receipts before live enablement. Native MON transfers use
the 21,000 protocol constant. Every write declares its gas, and nothing estimates at send
time, because Monad charges the limit: <https://docs.monad.xyz/developer-essentials/gas-pricing>.

[V] Reserve-balance rule: <https://docs.monad.xyz/developer-essentials/reserve-balance>.
Each treasury key sends through one queue that waits until the head is at least three
blocks past its previous transaction (measured in blocks, re-scanned from the chain after
a restart or a failed send). The keys must not be used from any other sender or delegated.

## Price feed and history sources

Mainnet reads use `MAINNET_RPC_URL` (public `https://rpc.monad.xyz` by default). That RPC
caps `eth_getLogs` at 100 blocks [V], so without a token the 24h trade window backfills
in 100-block chunks and is cached in SQLite; `/v1/tracker` serves what it has with its
coverage while that runs. Setting `HYPERSYNC_API_TOKEN` switches the window to HyperSync
(`HYPERSYNC_URL`, default `https://monad.hypersync.xyz`). [V] Measured 2026-10-06: a page
holds about 1,100 Trade logs, the 24h window is about 15 pages (about 16,000 logs, 25 s
including one rate-limit wait), and each request costs 1000 of a 15000-per-60-second budget.
The worker therefore runs one HyperSync chunk at a time, waits out a 429 using
`x-ratelimit-reset`, and polls every 30 s. Keep the token in `.env` only.

The mainnet MON_USDC source pauses immediately for an empty/crossed book or relative
spread `(ask - bid) / mid > 2%`. This fixed operator maximum is user-approved policy,
not measured calibration. Transport failures retain the three-failure pause. Testnet
book observations expire after 30 seconds; mirror freshness is checked after inventory
reads. Tracker rows older than 45 minutes become stale and non-playable.

Top-three maker concentration is bounded at 1, preserving its mathematical ratio
despite floating-point summation order. The strict web `[0,1]` schema is unchanged.

For a safe isolated local run, use an unused loopback port and a separate SQLite path:

```sh
# From apps/worker. Existing .env supplies credentials; the last file wins.
bun --env-file=.env --env-file=<temporary-overrides> src/index.ts
```

Overrides include `ENABLE_TRANSACTIONS=false`, `WORKER_PORT`, `SQLITE_PATH` and the
exact `APP_ORIGIN`. Blank env values are unset; no operations keys are needed for reads.
`/v1/health` HTTP 200 can still be amber/red. With no testnet market, leaderboard returns
`no-market-configured`, and structurally valid drip requests return 503 without a send.

## Operations

- `/v1/health` is `green`, `amber` (degraded: mirror disabled, low treasury, stale
  tracker, failing job) or `red` (price feed paused). Point the uptime monitor at it.
- SQLite is a cache and ledger, never the truth for chain data. Stop the service before
  copying the file and its `-wal` / `-shm` siblings, or use SQLite's online backup.
- Never delete `drips` rows with status `pending` after a crash: look up their hashes on
  the chain before permitting another grant to that address.

## Validation record

Fresh checks on 2026-10-06 used the installed Windows/WSL environment, not a target VPS.
Original `systemd-analyze verify deploy/monadboy-worker.service` exited 1 because
`/usr/local/bin/bun` is absent. A temporary syntax-only copy with ExecStart changed to
`/usr/bin/true` exited 0, with Windows-mount permission warnings. This does not prove
the original executable, user, service start or restart. Caddy was unavailable on both
installed command paths; the earlier Caddy-success record cannot be reproduced here.
Re-run the actual unit and Caddy validation on the target. Public HTTPS, service restart
and 24-hour uptime remain B2/B3 gates.

The isolated read-only worker served all seven live markets with authenticated complete
HyperSync trade coverage. One recorded snapshot contained 21,668 trades; later counts
advance with the head. No mirror/drip/fill broadcast was observed. Full evidence and
remaining funded checks live in BUILD-PLAN and the external progress log.
