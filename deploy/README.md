# Worker deployment

The worker is one Bun process (`apps/worker`) behind Caddy on the VPS. It signs only
with two dedicated testnet operations keys; its mainnet client is read-only. No route
signs for a player. The frontend is public at **https://monadboy-play.vercel.app**.
Target evidence and remaining acceptance gates are recorded below, not inferred from configuration.

## Selected hosting boundary

- Frontend: Vercel, using a fixed production hostname rather than per-commit URLs.
- Backend: this Bun worker on the VPS; SQLite remains its local cache and drip ledger.
- Indexing: Envio, PostgreSQL and Hasura remain self-hosted on the VPS.
- Local Docker proves integration only; it cannot supply public availability.
- A managed PostgreSQL migration is conditional on measured VPS capacity, not required at startup.

Keep frontend, worker and GraphQL origins distinct in configuration:

1. Fix the Vercel production hostname before creating production cards.
2. Set web `VITE_RP_ID` to that hostname, without a scheme or path.
3. Set web `VITE_WORKER_URL` to the backend HTTPS origin.
4. Set web `VITE_ENVIO_GRAPHQL_URL` to the public read-only GraphQL HTTPS endpoint.
5. Set worker `APP_ORIGIN` to the exact Vercel HTTPS origin.
6. Keep database passwords, Hasura admin authentication and operation keys server-only.

Vercel hosts the frontend, not this continuously running Bun process. A successful
web build does not prove Vercel deployment compatibility, public judge access,
backend HTTPS or passkey restore on physical devices.

Start public infrastructure read-only with `ENABLE_TRANSACTIONS=false`. Complete
source/index coverage, HTTPS and service-restart checks before claiming health.
Enable unattended signing only after B10's final mirror alignment/cost acceptance.
Do not run a second signing worker against the same operations accounts.

Before target deployment, obtain SSH host/port, user, private authentication method
and installation permission. Inspect the VPS's capacity and existing services
before allocating ports or installing Docker, Bun, Node, Caddy and service files.
Private keys/passwords never belong in chat, tracked files or command arguments.

SQLite and PostgreSQL require persistent storage and recoverable backups. A
container recreation must not discard the drip ledger; an indexer rebuild needs
time to recover coverage. Keep PostgreSQL and Hasura administration private;
expose only the intended read-only GraphQL route through HTTPS.

[V, local restart] Docker services became healthy, but the worker still refused
incomplete indexed maker basis and served PARTIAL direct-log results. Check the
worker's actual coverage and provenance, not just container health or HTTP200.

## Install

1. Inspect existing services, disk/RAM and the proxy network first. Create the
   `monadboy` system user and `/opt/monadboy`; install pinned Bun1.3.14 at
   `/usr/local/bin/bun` after checking the release checksum. Reuse an existing
   Caddy; do not install another listener on ports80/443.
2. Transfer source and locks without `.env`, keys, dependencies or generated output.
   Run `bun install --production --filter @monadboy/worker --frozen-lockfile --ignore-scripts`.
3. Create `/opt/monadboy/apps/worker/.env`, mode0600, owned by `monadboy`. Keep
   private tokens and any later operation keys only there, never in CLI arguments.
   Set `APP_ORIGIN=https://monadboy-play.vercel.app`, `WORKER_PORT=8787` and
   `ENABLE_TRANSACTIONS=false`. The unit sets persistent
   `SQLITE_PATH=/var/lib/monadboy/worker.sqlite` and limits the process to192MiB.
4. Host Caddy uses default `WORKER_BIND=127.0.0.1`. Container Caddy requires its
   actual host bridge gateway; on the inspected target this is172.18.0.1.
   Bind there, not0.0.0.0, and set `TRUSTED_PROXY_IP` to the exact Caddy container
   peer172.18.0.4. Other peers cannot spoof forwarded drip quota addresses.
   Reinspect after proxy/network recreation; never trust an entire bridge CIDR.
5. Install and validate the actual unit, then start it:

```sh
install -m 0644 deploy/monadboy-worker.service /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/monadboy-worker.service
systemctl daemon-reload
systemctl enable --now monadboy-worker
systemctl is-active monadboy-worker
curl http://172.18.0.1:8787/v1/health
```

6. Configure the private indexer `.env` from `indexer/.env.example`, plus
   `MONADBOY_PROXY_GATEWAY` and `APP_ORIGIN`. Keep it0600. Reuse the base Compose
   file with `deploy/compose.vps.yaml`; its Postgres volume survives recreation.
   No database port is published. GraphQL binds only the proxy gateway.

```sh
# From /opt/monadboy. Use sudo when the deployment account cannot read private env.
dc() {
  docker compose --env-file indexer/.env --project-directory indexer \
    -f indexer/compose.yaml -f deploy/compose.vps.yaml "$@"
}
dc config --quiet
dc build indexer
# Bootstrap has a measured higher peak than the192MiB steady-state process.
MONADBOY_INDEXER_MEMORY=512m dc run --rm --no-deps \
  -e NODE_OPTIONS=--max-old-space-size=384 --entrypoint sh indexer \
  -c "pnpm install --frozen-lockfile"
MONADBOY_INDEXER_MEMORY=512m dc run --rm --no-deps \
  -e NODE_OPTIONS=--max-old-space-size=384 --entrypoint node indexer \
  node_modules/envio/bin.mjs codegen
dc up -d --wait postgres graphql indexer
```

7. Render the two sites from `Caddyfile.example` with the real hosts/upstreams.
   Back up the existing configuration and append only these sites. Validate the
   candidate inside the existing proxy container, then copy into its mounted
   configuration and reload. A file-only bind mount requires preserving its inode;
   renaming a new host file over it can leave Caddy reading the old inode.
   Never replace unrelated sites or expose Hasura administration.
8. Public routes are `https://monadboy-api.43.129.38.115.sslip.io` and
   `https://monadboy-data.43.129.38.115.sslip.io/v1/graphql`. Caddy strips
   supplied `X-Hasura-*` headers and forces the public role; only `/v1/graphql`
   is exposed. Check mutations and role spoofing are refused, metadata/console404,
   exact-origin CORS and restart recovery before acceptance.

The worker trusts forwarded client addresses only from loopback or the configured
exact proxy IP. Caddy must replace untrusted forwarded headers. Do not expose the
worker directly or configure broad proxy trust.

## Enabling transactions

`ENABLE_TRANSACTIONS` defaults to `false`: the worker then only reads (mid sampling,
tracker, leaderboard) and `/v1/health` reports the mirror and drip as disabled. To enable
sends, set it to `true` together with distinct `BOT_PRIVATE_KEY` and `DRIP_PRIVATE_KEY`
(`cast wallet new`, funded by the owner), a stable `DRIP_IP_SALT` of at least 32
characters. The checked-in verified testnet manifest is the default; set `MARKETS_JSON`
and an explicit start block for a custom deployment. At start the worker refuses to
sign unless the RPC reports chain10143 and every configured contract has bytecode.
Never use these keys on mainnet.

[V, S2] `GAS_MARKET_ORDER` and `GAS_BATCH_UPDATE` default to 2,000,000 as bounded
estimation/declared-budget ceilings, not constant paid limits. Each mirror call simulates,
estimates with that ceiling, adds 20% headroom and refuses an over-budget result before
signing. `GAS_ERC20=87502` and `GAS_FAUCET=156720` come from successful receipts;
native transfers use 21,000. Scope and receipt hashes live in SDK `gas-limits.ts` and
[SMART-CONTRACTS](../docs/technical/SMART-CONTRACTS.md). Monad bills the declared limit:
<https://docs.monad.xyz/developer-essentials/gas-pricing>.

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
book observations expire after 30 seconds. Source validity/freshness is rechecked after
every signing-path await, including treasury queue spacing and gas estimation. Owned
plain quotes are canceled before taker execution to prevent self-taking; only authoritative
live price-point membership counts as resting inventory. Tracker rows older than
45 minutes become stale and non-playable.

Top-three maker concentration is bounded at 1, preserving its mathematical ratio
despite floating-point summation order. The strict web `[0,1]` schema is unchanged.

Set `ENVIO_GRAPHQL_URL` to the read-only HyperIndex endpoint for indexed leaderboard fills.
The adapter validates chain10143/start coverage and freezes one processed cursor for fills,
cash flows and chain holdings. `/v1/health` reports indexed lag/provenance; an actual local
GraphQL outage switched to direct logs, and restart restored indexed reads with SCORE parity.
Leaderboard NET/DAMAGE disclose signed disk-lifetime margin cash flows; they do not expose
or pretend to reconstruct the browser's private per-run basis.

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
- Install `monadboy-health.service` and `.timer`, validate them with
  `systemd-analyze verify`, then `systemctl enable --now monadboy-health.timer`.
  The timer samples public HTTPS every five minutes into root-protected
  `/var/lib/monadboy/health.jsonl`. Each JSON row carries the worker's epoch
  timestamp and source/job ages. Failed requests are journaled; missing samples
  are not healthy uptime. Read evidence with sudo and retain it through judging.
- Keep consistent, private backups: SQLite `VACUUM INTO` under `umask077`, not a
  live file/WAL copy; PostgreSQL `pg_dump -Fc` under `umask077`. Validate SQLite
  integrity and restore PostgreSQL into an isolated temporary database before
  relying on a backup. The recorded backups are on this VPS, not offsite disaster recovery.
- SQLite is a cache and ledger, never the truth for chain data. Stop the service before
  copying the file and its `-wal` / `-shm` siblings, or use SQLite's online backup.
- Never delete `drips` rows with status `pending` after a crash: look up their hashes on
  the chain before permitting another grant to that address.

## Validation record

**[V, 2026-10-08 target]** Worker unit and health service/timer validated against
the installed Bun1.3.14 binary. Existing container Caddy validated and reloaded
only the appended MONADBOY sites, preserving all prior sites and nine unrelated
running containers. Worker restarted active, with SQLite migrations1..5 and its
first sample1791480426610 preserved. Public HTTPS health and canonical-origin
browser fetch returned200; foreign-origin CORS was refused.

The PostgreSQL/Hasura/indexer containers were force-recreated and became healthy;
the persistent database retained fill `10143_69014514_2`. Public role spoofing
still allowed only reads; mutation was refused and metadata/console returned404.
SQLite online backup passed integrity_check with the same first sample; private
PostgreSQL dump restored that fill into a temporary database, which was removed.

Steady startup RSS measured about54MiB PostgreSQL,197MiB Hasura,153MiB indexer.
Later target snapshot had624MiB available RAM and8.8GiB free disk, with no runtime
OOM or automatic worker restart observed. The192MiB installer failed with a
recorded container OOM; only bootstrap was raised to512MiB and runtime returned
to192MiB. Healthy containers do not close coverage acceptance: GraphQL is ready
and near head, but the worker's bounded direct maker-basis cursor is still
catching up. Health remains amber; mirror/drip signing is disabled.

The first health sample immediately after a manual worker restart returned502;
later timer/manual samples succeeded and are retained. Six timestamped rows span
about20minutes, not24hours. Physical S22/iPhone, complete maker-basis acceptance,
continuous B10 economics and24-hour healthy monitoring remain open.


Fresh checks on 2026-10-06 used the installed Windows/WSL environment, not a target VPS.
Original `systemd-analyze verify deploy/monadboy-worker.service` exited 1 because
`/usr/local/bin/bun` is absent. A temporary syntax-only copy with ExecStart changed to
`/usr/bin/true` exited 0, with Windows-mount permission warnings. This does not prove
the original executable, user, service start or restart. Caddy was unavailable on both
installed command paths; the earlier Caddy-success record cannot be reproduced here.
These historical syntax-only checks were not target deployment evidence. The
2026-10-08 target record above supersedes their hosting-access uncertainty.

The isolated read-only worker served all seven live markets with authenticated complete
HyperSync trade coverage. One recorded snapshot contained 21,668 trades; later counts
advance with the head. Subsequent funded proof recorded real drips, S2 flip fills and
worker transactions. The original ten-minute mirror run self-took its own quotes and
cost 2.990181918 MON, so it is not external-player-fill or production-economics proof.
One corrected bounded transition canceled live owned quotes and filled DEPLOYER/native-card
makers; subsequent target quote preflight honestly refused a crossing third-party bid,
without broadcasting a revert. Continuous final-strategy alignment/operating cost remains
an acceptance gate. Full receipts and remaining checks live in BUILD-PLAN and the external log.
