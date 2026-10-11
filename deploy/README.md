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
Enable mirror signing only under an approved bounded operating policy with real
source/execution/cost proof. Current approval is demand-only, not a24/7 loop.
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
tracker, leaderboard) and `/v1/health` reports mirror and drip as disabled.
For **drip-only production**, set it to `true`, configure the funded
`DRIP_PRIVATE_KEY` and a stable `DRIP_IP_SALT` of at least32characters, and leave
`BOT_PRIVATE_KEY` absent. The existing operations boundary then creates only the
drip treasury, its inventory monitor and AUSD top-up job; no mirror executor/job exists.
Keep the salt unchanged across restarts so client quotas remain effective.
Configure a separate BOT key only for the approved demand-only policy and verified
bounded execution; never share keys between roles or silently enable24/7 signing.
The verified testnet manifest is the default; custom deployments need `MARKETS_JSON`
and their explicit start block. Startup refuses signing unless the RPC reports
chain10143 and every configured contract has bytecode. Never use these keys on mainnet.

[V, 2026-10-09] Production initially returned503 `supply-unavailable` because
transactions were disabled, not because inventory was empty. Drip-only activation
now reports `drip.enabled=true`, treasury `ok` and mirror disabled with `no-bot-key`.
Actual HTTPS funding of a fresh test-owned account confirmed0.5MON and10AUSD:

- MON receipt: `0x76dc2321f1414ead04a126a6508857ce05dc3c0520c1c315d50c8d23312ee7d9`, block69485927.
- AUSD receipt: `0x42bd24f929e849469d01b0daed71c10ba243896b484b8573dd7742e7232da0fa`, block69485933.
- Both receipts succeeded; six actual blocks separated the sends.
- Retrying the same address returned409 `already-funded`, with no duplicate payout.
- Post-smoke treasury:17.935331184MON /10,960AUSD. No new funding request.

This generated-account smoke is not physical-phone save/restore acceptance.
The worker env remains0600 and owned by monadboy; its pre-activation backup is
root-only0600. Operation keys never enter public web variables or tracked files.

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

### Demand-driven DEMO policy

The approved playable policy is20x relative movement from a durable first-valid
mainnet source anchor, not a decimal shift. `/v1/mid?market=MON_USDC` stays raw;
MON_AUSD returns raw `mainnetMid`, explicit `demo` metadata and the DEMO target.
Deploy the matching frontend labels/schema with this worker. Keep the canonical
RP ID and never reset `demo_anchors` while player positions exist.

For demand-only signing, configure the separate funded `BOT_PRIVATE_KEY`,
`TESTNET_REGISTRY_ADDRESS` from the verified deployment manifest and
`MIRROR_DAILY_GAS_MON=10`. Keep the existing DRIP key/salt unchanged.
`APP_ORIGIN` must exactly match the canonical frontend. Never run a second signer.

#### DEMO mode switch (20x default, 50x on request)

Production runs `DEMO_MULTIPLIER=20`, also the worker's default. Switch to 50x only when the
owner says a demo is starting, and back to 20x when it ends. The script always writes the
line explicitly. From the repo root on the operator machine:

```sh
deploy/demo-mode.sh 50   # demo starting
deploy/demo-mode.sh 20   # demo over; production default
```

The script rewrites only `DEMO_MULTIPLIER` in the worker env through sudo from `/tmp`,
restarts `monadboy-worker` and polls public health every 3 s for up to 90 s until it reports
`green` with the requested multiplier; it exits 1 otherwise. `MONADBOY_SSH` overrides the
host alias (`perago-vps`), `MONADBOY_HEALTH` the health URL and `SSH` the client binary.
On Windows Git Bash both the bundled `/usr/bin/ssh` and
`SSH=/c/Windows/System32/OpenSSH/ssh.exe` work. The DEMO anchor carries the current target
forward on a change, so open ranges never jump. At 50x the mirror re-quotes more often:
budget about 6 to 10.7 MON of gas per active hour against the 10 MON/day cap.

[V, 2026-10-11] Flip proof from Git Bash: `20 -> 50` turned green at x50 in 33 s
(13:28:47 to 13:29:20 UTC), `50 -> 20` green at x20 30 s later; 50x was live about
30 s. Health afterwards: `green` at `multiplier 20` (DEMO target 0.03110 at x50, 0.03193 after).

The visible range/live client signs a heartbeat every15seconds, not a transaction.
`POST /v1/mirror/demand` verifies its saved registry disk and signature; the45second
deadline cannot be extended by replay. Foreign origins, forged/expired signatures,
unsaved disks, excess capacity and bodies over1024bytes are refused.
Idle means no mirror inventory reads, cancellation or signing. Actions are at least
30seconds apart; demand is checked again inside the block-spaced signing queue.

The UTC daily limit reserves declared gas times maxFeePerGas before broadcast.
Unknown sends remain reserved after failure/restart; unused headroom is not refunded.
Health exposes active players, persistent anchor and daily gas reservations.
This is a bounded policy, not guaranteed depth/alignment or automatic re-centering.

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

### Private testnet RPC

Set `TESTNET_RPC_URL` in the private worker `.env` and `ENVIO_RPC_URL` in the
private indexer `.env`. Compose forwards the latter; HyperIndex's config retains
the public testnet URL as the unset/blank default. Do not put the tokenized URL
in tracked YAML, `VITE_*`, command arguments or public proof artifacts.
Mainnet sampling and HyperSync credentials are separate and remain unchanged.

Before switching, verify chain10143, deployed bytecode, current/historical
`eth_call`, receipt reads, bounded `eth_getLogs` and `eth_estimateGas`.
Back up the two private env files, config and Compose file with restricted access.
Stop only the indexer, run codegen with the existing512MiB one-shot ceiling and
`NODE_OPTIONS=--max-old-space-size=384`, then restore its192MiB steady-state limit:

```sh
dc stop indexer
MONADBOY_INDEXER_MEMORY=512m dc run --rm --no-deps \
  -e NODE_OPTIONS=--max-old-space-size=384 --entrypoint node indexer \
  node_modules/envio/bin.mjs codegen
dc up -d --wait postgres graphql indexer
systemctl restart monadboy-worker
```

Do not run codegen inside the192MiB live container. Restore services even after
a failed codegen; never delete persistent volumes. Check actual resolved RPC
privately, source/indexer recovery, a historical indexed fill and the existing
drip ledger after restart. Generated config may contain the resolved token:
keep it private along with env/backup files. HTTP200 is not a load-test result.

[V,2026-10-09] QuickNode backend switch passed these RPC checks, pinned
HyperIndex3.0.0-alpha.21 interpolation/codegen and native Linux typecheck/tests.
Worker retained four drip records and first mid sample1791480426610; public
GraphQL retained fill10143_69014514_2. The initial in-container probe exited137;
the bounded one-shot codegen succeeded. Codegen still printed an ignored-build
diagnostic for esbuild/rescript despite exit0 and successful compilation/tests.
No build allowlist was weakened; this diagnostic is not silently suppressed.

[V] A later full hydration trace hit QuickNode HTTP429/-32013,
`account limited to50/sec`. A near-head GraphQL cursor alone did not prove the
worker could read its matching chain holdings. The worker now shares one
50ms start dispatcher across testnet public reads and operations wallets
(at most20starts/s per process), without serializing response completion or
adding retries. Mainnet and indexer transports remain separate; the limit
does not guarantee spare capacity across every endpoint on the provider account.
After deployment,205actual margin/order-membership calls for all four indexed
makers completed without RPC errors; public health returned live Envio lag2,
indexed leaderboard and no job errors. Three regressions cover delayed
responses, failed requests and queued cancellation. The disposable trace
script was removed; raw redacted evidence is retained outside the repository.

[V,2026-10-11] Both backends run on the public testnet RPC again: the worker
`TESTNET_RPC_URL` and indexer `ENVIO_RPC_URL` lines were removed and codegen
rerun, because the generated `internal.config.json` keeps the URL resolved at
codegen time and a container env change alone does not move the indexer.
Health afterwards was green with Envio live at lag1. A counting proxy measured
idle load with no active players: the indexer made about380 calls/min
(`eth_blockNumber`, `eth_getLogs` and `eth_getBlockByNumber`, about two of each
per second), and the worker about130–280 calls/min, of which77% were `s_orders`
reads walking price-point lists for order membership during leaderboard
hydration. The public endpoint allows50 requests/s and25 `eth_call`/s [V];
[I] if that is counted per IP, every service on this VPS shares it.

[V,2026-10-11] With Multicall3 batching deployed, the same proxy measured the
worker at33–34 calls/min, nearly all `aggregate3`, `eth_getLogs` or head reads, with no
RPC errors. Raising the indexer `polling_interval` to2000ms still measured about
323 calls/min: the pinned HyperIndex schema states that every block is fetched
for reorg checks whatever the interval, and Monad produces about two blocks per
second. The interval stays at1000ms. Only HyperSync-only live indexing would
remove these calls, and it previously missed a fresh fill by16.620s and would
share the HyperSync token that the tracker uses.

The mainnet MON_USDC source pauses immediately for an empty/crossed book or relative
spread `(ask - bid) / mid > 2%`. This fixed operator maximum is user-approved policy,
not measured calibration. Transport failures retain the three-failure pause. Testnet
book observations expire after 30 seconds. Source validity/freshness is rechecked after
every signing-path await, including treasury queue spacing and gas estimation. Owned
plain quotes are canceled before taker execution to prevent self-taking; only authoritative
live price-point membership counts as resting inventory. Tracker rows older than
45 minutes become stale and non-playable.

Mirror decision inventory is same-block free margin plus the remaining backing
of authoritative-live owned quotes recorded in `mirror_quotes`. Execution cancels
those quotes before taking and reads actual free balances again before replacement.
Do not size the decision from free margin alone: a healthy quote can lock enough
base to make its own replacement appear too small. Filled storage and other
owners' orders are excluded; post-only/source/gas guards remain unchanged.

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

### Reading mirror health

`mirror` and `demo` in `/v1/health` describe the demand-only market maker:

- `execution` must be `enabled`; `disabled` names its reason (for example `no-bot-key`).
- `ticks` counts evaluated ticks since the last restart. Ticks only run while a player
  heartbeat is live (`demo.activePlayers` above 0); with no players `lastAction` is `hold`
  and nothing is read or signed.
- `lastAction` is `hold` (ladder already fits, inside the deadband, or idle), `quote` (one
  atomic `batchUpdate` re-quoted the ladder), `buy` / `sell` (another maker's orders sat on
  the wrong side of the target and were taken; this is how player orders fill) or `paused`
  (source stale or paused).
- `lastError` is null when healthy; any value makes health `amber` with `mirror-error`.
  `Mirror daily gas budget exhausted` (or `gas.exhausted: true`) means the UTC-day cap in
  `MIRROR_DAILY_GAS_MON` is spent; the last ladder keeps resting and signing resumes at
  00:00 UTC. `Mirror gas budget exceeded: <limit> > <ceiling>` means one transaction's
  estimate exceeded `GAS_MARKET_ORDER` / `GAS_BATCH_UPDATE`; nothing was signed.
- `gas.reservedWei` is today's declared-gas reservation against `gas.capWei`.
- Book depth is not in health: read `getL2Book` on the TESTNET MON_AUSD market. The ask
  side must hold at least half the largest funded preset (2 AUSD, so about 1 AUSD of asks
  plus fee and 1% slippage) for a zap to fund; the web quote names the fundable amount.

[V, 2026-10-11] A stale-player-bids failure looked like this: other makers' flip bids
rested above a lower DEMO target, so post-only asks could not be placed below them, and the
take that clears them walked twelve levels (`Mirror gas budget exceeded: 2478352 > 2000000`)
on every tick. The book kept 0.06 AUSD of asks and every zap quote was refused. Takes are
now limited to the six levels nearest the touch, halved again if an estimate still exceeds
the ceiling, so stale bids are cleared over consecutive ticks.

[V, 2026-10-11, after the fix] Ten minutes of `/v1/health` and `getL2Book` every 15 s with
one live player heartbeat (13:46 to 13:56 UTC): 42/42 samples green at x20, ticks 2 to 12,
actions 36 hold / 5 quote / 1 sell, zero `lastError`, zero ask-depth or gas-budget errors,
gas reserved 1.886 to 2.406 MON of the 10 MON cap. Asks held 2.67 to 2.71 AUSD (about 5.3
AUSD fundable, every sample above the 2 AUSD largest fixed preset); bids 6.7 to 11.1 AUSD.
The same window before the fix had the 2,478,352 error and asks as low as 0.06 AUSD.

[V, 2026-10-11] Real TESTNET player path against this worker and book, driven through the
web chain modules with a disposable key (`0x63d70FE36a940f6a786F2B22a0613A001401D75C`).
Gate PLAYABLE/live/honeypot-clean, source fresh at x20. 2 AUSD WIDE, 8 levels; book before
the zap 2.63 AUSD asks / 7.53 AUSD bids. Every receipt succeeded:

| Step | Block | Transaction |
| --- | --- | --- |
| Drip MON (public HTTPS) | | `0xe708bc2af24f6027e9febd411085c55aa680bcaab0fcaeb7a61e9a2ce584fab7` |
| Drip AUSD | | `0xf3aba14297feb90a2646277dbd124aa9970513feebb66f9eca4da63b200e927a` |
| Disk save | 70124928 | `0xb9b9f88bebe3c065dd4295ce6da8499583fda2c9b458b579aead6084330c1be8` |
| Approve AUSD | 70126667 | `0x5bab166bf1f32fd13a6ad9a531b6a0ad0cd16c8f44f753d7000d168cf69ccff3` |
| Deposit AUSD | 70126679 | `0xebe64c831f8e4c4f355ffd2c4dc7be5d3de9fef70e7c9ce1237925cd5bb1ffc1` |
| Zap MON to margin | 70126693 | `0x659ae9f70e2311b623a06b30fdbacd7d6f0a7727554cf97843029e19f2775a1e` |
| Provision flip ladder | 70126711 | `0x6476020a622fa4acaa870d963480f1da232b94b3ebceb0da48e457a8a4c6dc08` |
| Cancel linked flips | 70128943 | `0x46aed4045434eb78fa5d337d2929ef373b32a930d3c9f38f2c20e2a3dd6e4d0e` |
| Withdraw margin | 70128998 | `0x9a5531c42259d0631cbfa9baff94f7fe7c71089e225c6bd7a40249d9d9774b6e` |

Over 11 minutes the indexed reader saw 4 fills (mirror `sell` then `buy` through the
ladder), last SCORE 0.0025 / DAMAGE 0.0061 AUSD TESTNET; the exit left no orders or margin.
Player gas was 0.469 MON. The first quote right after idle was refused (asks fund 0.55 AUSD)
until the first heartbeat tick re-quoted the ladder. The browser shell was replaced (raw
key, not a Mera passkey; the Origin header the page sends) and the store's mid-run saves
were not made: this is chain-path proof, not physical-phone or flawless end-to-end play.

### Updating worker source

Copy only the changed files to `/tmp/mb-deploy/apps/worker/...`, back the current copies
up under `/opt/monadboy/deploy-backups/<name>/` (root, 0700), then install them as
`monadboy` and restart:

```sh
cd /tmp
sudo install -o monadboy -g monadboy -m 0664 /tmp/mb-deploy/apps/worker/src/chain/<file>.ts \
  /opt/monadboy/apps/worker/src/chain/<file>.ts
sudo systemctl restart monadboy-worker
```

Compare `sha256sum` of the deployed files with the commit first and again after install,
then read public health. A restart resets in-memory mirror counters, not the gas ledger.

### Drip size and treasury moves

Production drips `DRIP_MON=1` and the default 10 AUSD per fresh disk. Half a MON did not
cover a round trip: [V, 2026-10-11 at 102 gwei] the first disk save declared 242,123 gas,
entry (approve, deposit, zap, 8-level provision) 3,235,437, cancel 1,205,181 and withdraw
156,807, plus the store's saves after confirm and after exit, about 0.54 MON in total. The
web quote now refuses unless the disk holds enough TESTNET MON to enter and exit.

Treasury moves between the drip and the BOT use the funding workspace's `sweep.ts`
(outside this repository, next to the funding hub). Run it on the VPS with the worker env so
no key leaves the server: copy it to a `monadboy`-owned `/tmp` folder with `node_modules`
linked to `/opt/monadboy/apps/worker/node_modules`, run
`sudo -u monadboy bun --env-file=/opt/monadboy/apps/worker/.env sweep.ts <mode>` as a dry
run, then again with `--send`, and remove the folder afterwards. It refuses unless both keys
derive to the production drip and BOT addresses, the chain is 10143 and AUSD has code.

- `--surplus` moves drip funds above 12 MON and 300 AUSD (20 drips of 10 AUSD plus the
  100 AUSD faucet top-up floor) to the BOT: AUSD first, MON three blocks later.
- `--refill` tops the drip up to 20 MON (about 20 drips of 1 MON) from the BOT and refuses
  to leave the BOT under 40 MON. The worker also signs with the BOT, so send it while health
  shows `activePlayers: 0`.

[V, 2026-10-11] TESTNET surplus sweep: drip 14.86892796 MON / 10,900 AUSD and BOT
57.1577624114106 MON / 7,897.982809 AUSD before; AUSD 10,600
`0x156db0710089301734df3104c198da6ecc62d75e781e0e9102e8fded5063930c` (block 70124296) and
MON 2.855690716 `0xacbd70c6d4c8f693808ed34b4222fc63bed11844f5fd2537c982fda9129e78ac`
(block 70124304), both successful. After: drip 12.00217004 MON / 300 AUSD, BOT
60.0134531274106 MON / 18,497.982809 AUSD.

[V, 2026-10-11] After `DRIP_MON=1` (health green at x20) the TESTNET refill sent 8.508897164
MON BOT to drip, `0xa73e6a34b82903e4090c5fdc67287970e797048c65518d71c0ab9058ee06b457`
(block 70129383, success): drip 11.491102836 to 20 MON (290 AUSD), BOT 58.8885262374106 to
50.3774870734106 MON (18,497.982809 AUSD).

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

### Demand-only production rollout —2026-10-10 UTC

The global Vercel owner `dylansiusputra` verified the original MONADBOY project/team
and canonical domain. Linux build READY, deployment
`dpl_Ehr8Xnz32zcAWiwbtvW2FQggWQGN` promoted to `monadboy-play.vercel.app`.
Windows compilation succeeded but local CLI output rename failed EPERM; Linux
build/promotion is the observed successful path, not a claimed Windows fix.
Actual user Chrome rendered production desktop1920x889 and native412x915 card/guide;
production-origin DEMO API fetch returned200. RP ID and phone geometry unchanged.

Worker env remains0600monadboy. Migration6 preserves original three sent/two
already-funded drip rows and first sample1791480426610. Restricted online SQLite
backup passed integrity_check before rollout. Restart preserved the20x anchor,
eight receipt hashes and0.459191652MON conservative gas reservations.

Six controlled heartbeats produced four actions at least34seconds apart:
eight successful cancellation/quote receipts, zero Trade events and0.383914332MON
declared-gas cost. Lease expiry stopped signing: BOT nonce153 ->161 then stayed161.
Health recovered green with live Envio after an initial not-yet-observed state.
No new player maker fill, guaranteed book depth or24-hour availability is implied.
Proof files remain outside Git: demand-production-probe.json,
demand-production-receipts.json, demand-release-ledger.json and demand-release-health.json.
