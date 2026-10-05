# MONADBOY build plan

This is the **live task tracker** for the current repo, not a claim that planned services are running. **Update the checkbox, proof and phase count in the same commit as the work.** Keep commits at 50 to 250 changed lines; split long docs at heading boundaries.

Labels: **[V]** verified with a real commit, recorded check or source; **[I]** inference / intended behavior; **[U]** unresolved, with the spike or evidence that settles it. Status vocabulary: `TODO / DOING / DONE / BLOCKED / CUT`. DONE requires all task boxes and acceptance evidence; BLOCKED names the external gate, not a reason to stop independent work.

Read a task as `box + task ID + deliverable + proof`. `[x]` means the named deliverable has evidence, not that its dependent live integration works. `[ ]` names the command or observable evidence required before checking it. Letter suffixes split partial tasks; only checkbox lines count in Done/Total. Commit references below are [V] from `git log --oneline`; historical command results are explicitly attributed to the external handoff `PROGRESS.md`.

## Status at a glance

As of **2026-10-05**. External blocker IDs refer to the handoff `BLOCKERS.md`.

| Phase | Status | Done/Total tasks | Next action | Blocker |
|---|---|---|---|---|
| 0 — Repo bootstrap | DONE | 2/2 | Maintain guard and commit discipline | None |
| 1 — Docs first | DONE | 4/4 | Keep docs aligned with implementation | None |
| 2 — Frontend shell and screens | DOING | 21/22 | Assembled verify walk (2.10); then Phase 2 review | None |
| 3 — Pure SDK | DOING | 7/9 | Record measured gas and a real-order encoding fixture after S2 | B1 / S2 for deferred items |
| 4 — Funded spikes | BLOCKED | 0/6 | Fund DEPLOYER, then broadcast S1/S2; prepare device spike independently | B1; S4 user devices |
| 5 — DiskRegistry v2 | BLOCKED | 5/6 | Broadcast registry and record code/address | B1 |
| 6 — Worker | TODO | 0/11 | Implement Hono, SQLite and health locally | B1 for live run; B3 for VPS |
| 7 — Web integration | TODO | 0/13 | Implement client-only card session after screen work | B1 / S1..S4; B2; B5 for bounty qualification |
| 8 — Envio indexer | TODO | 0/5 | Configure live event handlers after market deployment | B1 / S2 / S5 |
| 9 — Deploy and submission | TODO | 0/7 | Obtain fixed hostname and VPS access | B2 / B3; upstream live proof |

## Phase 0 — Repo bootstrap

**Goal** Establish a clean monorepo, identity and enforceable content policy.

- [x] **0.1** Initialize repo, Dylan identity, MIT license and ignore / LF rules — proof: `67fb40f`; PROGRESS Phase 0 records author/committer Dylan and no remote.
- [x] **0.2** Install staged-file and commit-message guards, including binary text handling — proof: `9b6a98f`, `9a6a360`, `b629e56`, `c628bc8`; PROGRESS records real rejected commits and final review PASS.

**Acceptance**
- Hooks reject prohibited tracked content and messages; allowed files pass.
- Commits use Dylan's repo-local identity, no push or new remote, and heading-bounded work units.

**Proof to record** Guard rejection / clean output and commit identity in external PROGRESS; never quote rejected terms in tracked docs or commit messages.

## Phase 1 — Docs first

**Goal** Define product rules, boundary contracts and sourced research before dependent implementation.

- [x] **1.1** Write all eight research notes with [V]/[I]/[U], links, event shapes and bounty requirements — proof: `555c773`, `b057c2f`, `1a7820a`, `d43a386`, `4c9e626`, `1e06502`, `2f92787`; PROGRESS records 15 address checks and seven reproduced event topics.
- [x] **1.2** Write PRD, architecture, integrations, contract spec, ERD, build tracker and design system — proof: `91f49d7`, `fc8280f`, `234132c`, `14b6521`, `b21dc04`, `aad9511`, `3158580`, `b39afba`, `e7e0e74`, `c14711a`, `ae501fc`.
- [x] **1.3** Write LESSONS, root guidance and judge-facing README outline — proof: `80de92e`, `4dd9fdb`, `aff9fc6`, `fa7851d`; PROGRESS records product/root review PASS after fixes.
- [x] **1.4** Track approved skills, three project skills and wallet source lock — proof: `1df7117`, `972caf0`, `da7b24a`..`557a114`; PROGRESS records 228-file comparison and guard-clean annotations.

**Acceptance**
- Every required doc and skill exists; docs match approved product rules and each doc owns one subject.
- Network statements carry sources / labels; recorded address checks identify chain and non-empty code, with no-code examples explicitly annotated.
- Full-tree guard is clean; LESSONS uses dated cause/rule entries and root guidance stays concise.

**Proof to record** Doc/review commits and exact checks in external PROGRESS; address commands and byte lengths in SMART-CONTRACTS; source findings in research notes.

## Phase 2 — Frontend shell and screens

**Goal** Preserve the handheld look and feel with marked development fixtures; live wiring belongs to Phase 7.

- [x] **2.1a** Pin web toolchain, Node test guard, CI and Bun lockfile — proof: `5132dfb`, `e25ef50`; tracked root/web packages define verify and Node >=22.
- [x] **2.1b** Generate TanStack Intent package guidance after install — proof: pinned `@tanstack/intent` 0.5.4 with a curated `intent.skills` allowlist (router, router plugin, Start client/React, devtools-vite; Next.js migration, RSC and server-auth skills excluded); `intent install` wrote the AGENTS.md block and `intent list` reports 5 packages, 19 skills.
- [x] **2.2** Add palette, tokens, font/license, brand and venue-neutral types — proof: `e25ef50`, `814e87d`, `3f3a96a`, `9d3e9e7`.
- [x] **2.3** Add console intents, input store, controls, volume, fit scale and shell — proof: `6f3c1b1`, `02e9494`, `10690c9`, `c73e4d5`, `b25e087`, `e2979de`.
- [x] **2.4** Add pixel UI primitives, motion, selection/data states and grid / money-boundary checks — proof: `2d621d0`, `cb40837`, `a68f5c0`, `fe3a861`, `a7e107c`, `d4c887f`.
- [x] **2.5** Add three mascot sprite sets and source-art tools — proof: `c7c75f3`, `43203db`, `dc5da52`, `e07cd7f`..`e4d3fa8`.
- [x] **2.6** Add difficulty thresholds and market gates — proof: `4a33687`; measured Kuru calibration remains Phase 6 work.
- [x] **2.7** Add scoring, source/freshness envelopes, formatters and SDK-backed range planner — proof: `d521fdb`, `de3147d`, `08ead36`, `35d86e1`, `92e7aac`.
- [x] **2.8** Add game domain, marked fixtures, simulation, map, stepped chart and GOD MODE confirmation — proof: `5dcbb3a`, `d63415e`, `4048c17`, `ec17799`, `e5699f5`, `2dd9f76`, `80ab394`, `8e968b7`, `f70bd98`.
- [x] **2.9a** S1 MemoryCard screen, INSERT / NEW CARD fixture actions — proof: `7c20428`, `eea3bad`; screenshot `screens/phase2/S1-memory-card.png` (412x915, FIXTURE marker, passkey copy only).
- [x] **2.9b** S2 DiskSelect screen — proof: `188e760` (third isolated fixture disk), `fecbc08`, `34d8629`; keyboard opens disks 1, 2 and 3 through `session.openDisk`; `S2-disk-select.png`.
- [x] **2.9c** S3 CartridgeSelect screen — proof: `a2ced5e`, `189327d`; locked slots keep COMING SOON while the cursor passes; `S3-cartridge-select.png`.
- [x] **2.9d** S4 Difficulty screen — proof: `0f0b04b`, `fa1c996`, `f03500a`; HARD -> typed confirmation -> session `{difficulty: hard, characterId: mouch, godMode: true}`; `S4-Difficulty.png`.
- [x] **2.9e** S5 PoolTracker screen — proof: `e944dc0`, `61b4cb8`, `362bfbc`, `d574477`, `fb5188c`; PLAYABLE (TESTNET) is decided by the fixture's `network`, not its symbol; the mainnet MON/AUSD empty book reads Thin book and cannot start play; `S5-pool-tracker.png`.
- [x] **2.9f** S6 SetRange screen — proof: `b8920ac`, `df7cc8e`, `4f73087`, `272d8b5`, `392a7d4`; WIDE 0.980065–1.020069 vs TIGHT 0.990066–1.010068 on the AUSD_USDC fixture, manual edges apply only on A, clamp notice and SDK funding split render; `S6-set-range.png`.
- [x] **2.9g** S7 InRange screen — proof: `57b220f`, `3c4010f`, `c503d0d`; stepped chart, equal-weight SCORE/DAMAGE, NAD-SENSE, PRICE FEED PAUSED and contextual keys; `S7-in-range.png`.
- [x] **2.9h** S8 Results screen — proof: `c96cd81`, `a360707`; SELECT opens the inputs, A/B return to the shelf; `S8-results.png`.
- [x] **2.9i** Session state preserves choices and binds mascot to difficulty — proof: `a62a8d4`.
- [x] **2.9j** Assemble routes, root and router without absent imports — proof: `2264eb0`, `54ef7d3`, `91a7cbc`; `bun run generate-routes` output is byte-identical to the tree the dev server writes (shared Start footer in tsr.config.json); `bun run dev` serves /card with HTTP 200.
- [x] **2.9k** Add console screen-input test harness — proof: `1a74224`; harness existence does not prove screens exist.
- [ ] **2.10** Verify assembled web and walk S1..S8 on phone viewport — proof required: `bun run verify`; `bun run dev`, keyboard walkthrough at 412x915, eight screenshots and observed console output.
- [x] **2.11** Meet the touch minimum after the fit scale on phones — proof: getBoundingClientRect after the change: A/B 50.1 / 52.2 / 54.4 / 57.5 px, D-pad arm hit 46 / 48 / 50 / 52.8 px, START/SELECT 47.4x46 / 49.4x48 / 51.4x50 / 54.4x52.8 px at 360x640 / 375x667 / 390x844 / 412x915; the screen keeps 324.9 / 338.8 / 352.6 / 372.9 px width; desktop screenshots hash-identical at 1280x720, 641x900, 800x1000 and 1920x1080; edge taps fire every control. [V] Before: at 412x915 the console scaled 0.777, so A/B rendered 35.7 px, D-pad arms 22.8 px and START/SELECT 36.9x18.8 px while the console used 475 of 915 px of height.

**Acceptance**
- Node-runtime verify and guard pass; no imports of absent modules.
- All eight screens render with sprites and unchanged visual constants; fixtures are visibly marked.
- Keyboard / touch selections, no silent 320px clipping, screenshots compared to the earlier version; record any known dev warnings rather than hiding errors.

**Proof to record** Per-area commits and verify output in external PROGRESS; phone screenshots in external handoff `screens/phase2/` and the earlier version's in `screens/phase2/earlier/`.

**Findings for later phases**
- [V] Under the 8-level x 2% cap the SDK ladder clamps volatile pairs: with the MON_USDC fixture's daily volatility of 0.6, WIDE and TIGHT plan the same range (the clamp notice says so). [U, S2] Re-check with measured testnet volatility before tuning the cap.
- [V] `RunSummary` does not keep the deposited amount, so S8 labels the amount as the current session's. Phase 7 sealed runs must record it per run.
- [V] Fixture markets carry `network`; Phase 7 replaces it with registry-backed deployment eligibility.

## Phase 3 — Pure SDK

**Goal** Centralize typed chain boundaries, ladder arithmetic, valuation and stateless disk cryptography.

- [x] **3.1a** Add chain/RPC config and typed Kuru, token and faucet ABIs with live event-topic checks — proof: `1b689c9`, `369f364`, `733e55f`.
- [x] **3.1b** Catalog seven mainnet markets with live params; keep testnet list empty pending deployment — proof: `eac2203`; PROGRESS records seven non-empty 141-byte code results and live tick-size readbacks.
- [ ] **3.1c** Fill gas-limits.ts from S2 measurements with 20% headroom — proof required: measuring transaction hash, receipt gasUsed and explicit limit for each call; record constants and SMART-CONTRACTS gas table.
- [x] **3.2a** Encode prices/sizes with rounding, bounds and empty-book sentinels — proof: `bf0b906`; PROGRESS records encoding coverage 100%.
- [ ] **3.2b** Pin encoding to a real testnet order — proof required: S2 FlipOrderCreated price/size units, transaction hash and `bun run --cwd packages/sdk test` passing the observed-order regression.
- [x] **3.3** Plan deterministic WIDE/TIGHT/manual flip ladders and batch args — proof: `2e98754`, `733e55f`; PROGRESS independent probe: mid 0.03326, WIDE sigma 0.04, budget 100 -> 2% step, five levels, ten orders.
- [x] **3.4** Implement SCORE, clamped DAMAGE, NET and inclusive NAD-SENSE boundaries — proof: `c01b1fc`, `733e55f`; PROGRESS records position coverage 100% and B6 default (a).
- [x] **3.5** Implement HKDF/AES-GCM seal/open with slot isolation, AAD and bounded plaintext — proof: `ec216f4`; PROGRESS records seal coverage 100%.
- [x] **3.6** Derive Mera card/disk accounts using supported path — proof: `b63cc10`; PROGRESS records derivation equality tests and coverage 100%.

**Acceptance**
- Arithmetic / boundary tests and authenticated seal/open replay protection pass; supported derivation equals the reference.
- `bun run --cwd packages/sdk test:coverage` reports >=95% lines for kuru/* and seal; PROGRESS records 112 tests and 99.09% overall.
- No ethers runtime import; concrete dependency pins. Default (a) preserves NET surplus and DAMAGE clamp, not a universal false identity.
- Core SDK is historically verified; phase remains DOING because measured gas and real-order fixture await S2.

**Proof to record** Red/green checks, coverage and formula review in external PROGRESS; observed params/topics in Kuru research; measured gas and real-order tx in SMART-CONTRACTS.

## Phase 4 — Funded spikes

**Goal** Turn network assumptions into pass/fail evidence before live gameplay depends on them.

- [ ] **4.0** Fund separate DEPLOYER / BOT / DRIP wallets — proof required: `cast balance --ether <addr> --rpc-url https://testnet-rpc.monad.xyz` for all three; satisfy S3's lean budget below. B1 blocks broadcasts; 50 MON on DEPLOYER starts spikes.
- [ ] **4.1** S1: broadcast AUSD faucet request with explicit gas — proof required: requestFunds receipt or revert, observed request cadence or >=1,000 AUSD balance; document selected supply fallback if needed.
- [ ] **4.2** S2: deploy MON-AUSD, read params, deposit and provision 2+2 levels, then BOT taker-fill — proof required: deploy/provision/fill tx hashes; non-empty `cast code`; getMarketParams readback; Trade + FlippedOrderCreated; gas and funding / margin / provisionOrRevert semantics.
- [ ] **4.3** S3: measure +/-3% bot inventory and twenty player drips — proof required: deployed-book inventory calculation within BOT 80 MON and measured deployment/drip gas; write measured budget beside the 150 MON cap, shrinking minSize / depth first.
- [ ] **4.4** S4: test Mera create/restore on disposable HTTPS tunnel — proof required: user-observed iPhone Safari and Android Chrome results from dev-only /dev/passkey, hostname and authenticator recorded; route absent from production.
- [ ] **4.5** S5: initialize testnet Envio spike for our market — proof required: fresh fill tx, GraphQL row and elapsed time <=10 s, or recorded no-go/fallback.

**Acceptance**
- Each S1..S5 has a pass/fail line with actual evidence, not code existence.
- markets.testnet.json contains verified deployed params/address; Phase 3 deferred gas and real-order proof are filled.
- Device testing can proceed without funding; tunnel passkeys never become production cards.

**Proof to record** Spike scripts in scripts/spikes; receipts, params and gas in SMART-CONTRACTS; findings in Kuru / AUSD / Mera / Envio research notes; outcomes and blocker changes in external PROGRESS.

[V] Supplied ops balance record, checked 2026-10-05: `cast balance --ether <addr> --rpc-url https://testnet-rpc.monad.xyz` returned `0.000000000000000000` for DEPLOYER, BOT and DRIP. This source observation is the zero-MON blocker, not a repeated funding check. The roles are separate; no wallet address or secret is needed in this status record. Fund DEPLOYER for deployment, BOT for inventory and DRIP for player supply before dependent broadcasts. [V] Public testnet funding entry point: [Monad faucet](https://faucet.monad.xyz/) ([network facts](https://docs.monad.xyz/ai/current-facts.md)). Request builder supply from Monad if public faucet limits cannot cover S3.

## Phase 5 — DiskRegistry v2

**Goal** Save isolated sealed disks onchain without a server restore dependency.

- [x] **5.1** Configure Solidity 0.8.28 Foundry project and pinned forge-std — proof: `00a6d11`; PROGRESS records forge build exit 0.
- [x] **5.2a** Implement per-disk save/overwrite/erase and limits without funds/admin — proof: `d60452a`, `bd4af28`; PROGRESS records Anvil save/read, preserved createdAt, value rejection and erase.
- [x] **5.2b** Cover save/error/isolation/size boundaries and stable gas snapshot — proof: `30c09be`, `bd4af28`; PROGRESS records 17/17 tests, 256 fuzz runs, identical snapshot checks and forge fmt exit 0.
- [x] **5.3a** Add deploy script, contract docs and generated SDK registry ABI — proof: `e7960a7`, `d5b2926`, `bd4af28`; PROGRESS records generated ABI deep-equals out/ (seven entries).
- [ ] **5.3b** Broadcast registry to testnet and publish verified deployment config — proof required: explicit-gas deploy receipt, `cast code <registry> --rpc-url https://testnet-rpc.monad.xyz` non-empty, address/tx in SMART-CONTRACTS and packages/sdk/src/deployments.testnet.json; explorer verification if supported. B1.
- [x] **5.4** Run Foundry contract tests in CI — proof: `d5b2926`; tracked .github/workflows/ci.yml defines the contract job.

**Acceptance**
- In contracts/: `forge test` and `forge snapshot --check` pass; SDK ABI equals generated artifact.
- Testnet deployment has real code and a recorded receipt. Local contract proof alone does not complete this phase.

**Proof to record** Scoped Foundry / Anvil and ABI checks in external PROGRESS; gas snapshot in contracts/.gas-snapshot; deployed address, byte length and transaction in SMART-CONTRACTS.

## Phase 6 — Worker

**Goal** Serve read models and operate the bot/drip continuously without signing for players.

- [ ] **6.1a** Build Hono/Bun server, zod env and numbered SQLite migrations — proof required: start with `bun run --cwd apps/worker dev`; app.request route checks and a fresh SQLite database with applied migration versions.
- [ ] **6.1b** Serve /v1/health with build/source state — proof required: `curl http://localhost:<WORKER_PORT>/v1/health`; response reports version, ticks and source ages.
- [ ] **6.2** Sample mainnet/testnet bestBidAsk and serve /v1/mid — proof required: recorded mid_samples rows; three consecutive source failures transition to paused; HTTP response exposes freshness.
- [ ] **6.3** Mirror toward mainnet with capped notional, explicit gas and nonce management — proof required: decideMirrorAction behavior tests for threshold/direction/cap/staleness; mirror_ticks rows and transaction receipts under measured limits.
- [ ] **6.4** Serve seven-market tracker with L2 decoder, 24h fills and shared SDK SAFETY/HEAT — proof required: captured getL2Book decoder result; `curl http://localhost:<WORKER_PORT>/v1/tracker` returns seven markets; MON_AUSD empty-book case is thin; honeypot/playable gates and Kuru calibration checked.
- [ ] **6.5** Drip MON then AUSD with refusal ledger and block spacing — proof required: `curl -X POST http://localhost:<WORKER_PORT>/v1/drip -H "Content-Type: application/json" -d '{"address":"<fresh-disk>"}'`; receipts, drips row, repeated request refused and every refusal path exercised.
- [ ] **6.6** Top up AUSD with observed faucet backoff — proof required: job run/log showing successful request and MaxFrequencyExceeded scheduling without repeated broadcasts.
- [ ] **6.7** Aggregate leaderboard via FillSource and mid_samples — proof required: known-fill valuation result plus `curl 'http://localhost:<WORKER_PORT>/v1/leaderboard?window=24h'`; chain-derived rows, no submitted scores.
- [ ] **6.8a** Write systemd/Caddy deployment files and VPS instructions — proof required: `systemd-analyze verify deploy/monadboy-worker.service` and `caddy validate --config <configured-Caddyfile>` on target-compatible environment.
- [ ] **6.8b** Deploy worker on VPS — proof required: service active after restart and HTTPS /v1/health; B3 access required.
- [ ] **6.9** Exercise ten-minute live mirror, tracker and drip run — proof required: elapsed run log, mirror_ticks drift within configured threshold, seven tracker markets, successful fresh drip and second refusal; B1 / S1..S3.

**Acceptance**
- Workspace verify and scoped route/job checks pass; live run proves drift control, source ages and refusal ledger.
- Move scoring to packages/sdk and migrate web callers; do not duplicate scoring.
- [V] PROGRESS records public RPC getLogs limit of 100 blocks; 24h tracker scan needs HyperSync/Envio or suitable RPC, not an assumed fast raw scan.

**Proof to record** Commands, route outputs and SQL rows in external PROGRESS; measured mainnet inputs/calibration in research; bot/drip receipts and explicit gas in SMART-CONTRACTS.

## Phase 7 — Web integration

**Goal** Replace marked fixtures with real data and local passkey signing while preserving every screen.

- [ ] **7.1** Client-only Mera card session and per-disk viem clients — proof required: HTTPS create/insert/eject run; no Mera server import; sessions end on eject / hidden-tab timeout; only credential metadata persists.
- [ ] **7.2** S1 MemoryCard: real INSERT / NEW CARD and error copy — proof required: supported-phone passkey prompts and mapped error screenshots; FIXTURE marker removed only after real actions.
- [ ] **7.3** S2 DiskSelect: derive/read/decrypt three slots, create/drip/save and OPEN — proof required: three disk addresses, registry readbacks, save receipt, ciphertext hash/explorer proof and SAVED TO CARD screenshot.
- [ ] **7.3a** S3 CartridgeSelect: decrypted disk, STAY IN RANGE and leaderboard navigation — proof required: phone walkthrough preserves selected disk; locked COMING SOON stays locked.
- [ ] **7.3b** S4 Difficulty: disk preferences, mascot binding and sealed persistence — proof required: change difficulty/GOD MODE, save and restore same preferences; unsellable gate remains active.
- [ ] **7.4** S5 PoolTracker: live query and playable / mainnet-only gates — proof required: /v1/tracker source/time visible; only PLAYABLE (TESTNET) enters a position.
- [ ] **7.5** S6 SetRange: live SDK ladder, funding split and confirm sequence — proof required: base/quote/cost screenshot; explicit-gas approve/zap/deposit/provision receipts with IDs, loading steps and partial-failure recovery.
- [ ] **7.6** S7 InRange: 5s mid polling, real fills, SCORE/DAMAGE and re-center/withdraw — proof required: flipped-fill receipt -> scoreCard increment with sound; NAD-SENSE boundary, sit, displayed re-center cost, PRICE FEED PAUSED and INDEXER OFFLINE states.
- [ ] **7.7** S8 Results: cancel/withdraw, tx-linked result and sealed run — proof required: batchCancelFlipOrders / batchWithdrawMaxTokens receipts; result inputs inspectable; restored disk contains the appended run.
- [ ] **7.8** Leaderboard screen — proof required: phone screenshot of /v1/leaderboard-backed rows for selected window with source and no self-reported SCORE.
- [ ] **7.9** Installable portrait PWA — proof required: manifest/icons from assets/logo, Lighthouse installability report and supported-phone standalone launch; B5 organizer text settles Agora qualification separately.
- [ ] **7.10** Remove fixtures from production paths — proof required: production route/build review and phone run using real worker/chain/indexer sources; fixtures remain test/dev-only.
- [ ] **7.11** Record full real-phone play and stateless restore — proof required: HTTPS new card -> funded disk -> tracker/range -> explorer orders -> flipped fill/sound -> withdraw/results; clear site data -> INSERT CARD -> three locally decrypted disks without server restore.

**Acceptance**
- Full real-phone sequence and restore satisfy the evidence contract below; B2 fixes production rpId first.
- Review all twelve product rules on every screen; every balance says TESTNET, every number has a source, DAMAGE equals SCORE's visual weight.
- Signing stays in browser; no production fixture or server restore dependency.

**Proof to record** Screen recordings / screenshots outside repo, paths and observed devices in external PROGRESS; tx/address evidence in SMART-CONTRACTS; Mera support/errors in research notes.

## Phase 8 — Envio indexer

**Goal** Index live fills and disk events, then switch consumers without changing SCORE.

- [ ] **8.1a** Configure chain 10143, deployment start blocks and live event signatures — proof required: indexer codegen succeeds against config.yaml/schema.graphql; our market(s) and registry addresses have recorded code checks.
- [ ] **8.1b** Implement entities and handlers with SDK-equivalent SCORE — proof required: same captured fills yield identical handler/client score, including initial vs flipped order behavior.
- [ ] **8.2** Deploy hosted or self-hosted HyperIndex — proof required: live GraphQL endpoint responds with our deployment events; set web/worker GraphQL URLs, record sync cursor.
- [ ] **8.3** Switch worker FillSource and S7/S8 to Envio — proof required: real indexed-fill run populates gameplay/history/leaderboard; outage uses direct logs with INDEXER OFFLINE, not duplicate arithmetic.
- [ ] **8.4** Prove latency and SCORE parity — proof required: fresh fill tx and GraphQL appearance <=10 s; same disk's client, indexer and leaderboard SCORE agree.

**Acceptance**
- S5 evidence passes on intended testnet; config uses live rather than prose event signatures.
- Read-model lag/outage is visible; direct logs preserve play but do not count as successful Envio integration.

**Proof to record** Fresh tx, query/output, timestamps/cursor and SCORE comparison in Envio research and external PROGRESS; deployment addresses in SMART-CONTRACTS.

## Phase 9 — Deploy and submission

**Goal** Ship the fixed-domain demo with reproducible setup and inspectable submission evidence.

- [ ] **9.1** Resolve VPS access and fixed production hostname — proof required: B2/B3 decisions, reachable SSH and final VITE_RP_ID recorded without secrets; optional RPC credentials never block public-RPC work.
- [ ] **9.2** Deploy web/worker behind Caddy HTTPS and systemd — proof required: public phone page load, HTTPS /v1/health and service restart recovery.
- [ ] **9.3** Rehearse on three fresh devices — proof required: iPhone, Android and desktop Chrome with Google Password Manager recordings, including a phone that never saw the app and stateless restore.
- [ ] **9.4** Observe healthy worker for 24 hours — proof required: timestamped health samples and source/tick ages across 24h; operate through judging 14..27 October.
- [ ] **9.5** Finalize README and clean-clone local setup — proof required: verified addresses/txs, screenshots/GIF, <=3-minute video and AI disclosure; `git clone <repo-path> <fresh-dir>`, `bun install`, `bun run verify` in fresh clone with observed output.
- [ ] **9.6** Complete bounty mapping — proof required: each requirement -> actual code path -> video timestamp in README/research/bounties.md; B5 resolved before Agora eligibility claim.
- [ ] **9.7** Check public submission package — proof required: publicly accessible repo/URL, MIT license, final address/tx/video links and AI-tool disclosure; submission receipt / checklist against Metropolis rules.

**Acceptance**
- Fresh-phone HTTPS works, worker health is green for 24h and clean-clone commands pass.
- Non-negotiable real flip fill on camera and stateless restore have evidence; no fixture substitution.
- Public submission contains actual links/addresses and qualifying bounty proof, not pending evidence slots.

**Proof to record** Rehearsal/uptime/clone output in external PROGRESS; public evidence in README and bounties research; addresses/txs in SMART-CONTRACTS; media stored outside repo.

## Dependency order

Phase 2 visual/toolchain work and Phase 3 pure SDK work can proceed while Phase 4 is blocked. Funded spikes need chain configs/ABIs/encodings from Phase 3; start them as soon as funding exists, without claiming untested semantics. Phase 5 contract work does not require completed mirror deployment, but its broadcast needs funded deployment capacity.

Phase 6 worker aggregation uses the `FillSource` interface with direct logs before Phase 8; Phase 8 switches to Envio without duplicating scoring. Phase 7's full gameplay proof depends on S1/S2/S3, deployed registry, worker and passkey support. Direct logs preserve live play during indexer outages; they do not replace the S5 evidence gate for a successful Envio integration.

Shared names are fixed: `planLadder`, `batchProvisionArgs`, `scoreCard`, `rangeState`, `deriveSealKey`, `sealDisk`, `openDisk`, `diskAddresses`, `FillSource`, `decideMirrorAction`.

## Spike go / no-go gates

Each gate is currently [U]. A pass requires actual evidence, not an SDK declaration, code existence or simulated success. Put transaction hashes, receipts/logs, parameter readbacks, gas measurements and observed device/indexer results in the corresponding research note and [SMART-CONTRACTS](SMART-CONTRACTS.md).

| ID | Question | Pass condition | Fallback | Dependent work |
|---|---|---|---|---|
| S1 | AUSD testnet supply | Faucet `requestFunds` succeeds from our wallets at some cadence, or we hold >=1,000 AUSD | Ask Monad/Agora in Discord; else official MON-USDC testnet market with testnet USDC | Supply, drip, MON-AUSD execution; second market only if USDC source usable |
| S2 | Flip ladder on Kuru testnet | Deploy our MON-AUSD market, deposit, `batchProvisionLiquidity` 2+2 levels; bot taker fill emits `Trade` + `FlippedOrderCreated`; encodings and `provisionOrRevert` documented | Single `addFlipBuyOrder` / `addFlipSellOrder` per level | Trusted encodings, explicit gas limits, playable market, real flip proof |
| S3 | Testnet MON budget | Deployer + bot + drip wallets hold the lean budget: DEPLOYER 50 MON, BOT 80 MON of inventory, DRIP 20 MON for 20 player drips (about 150 MON total) | Shrink level sizes via `minSize` and ladder depth until the +/-3% move fits the inventory; ask Monad for a top-up only if the measured need is higher | Live mirror and fresh-disk onboarding |
| S4 | Mera on real devices | iPhone Safari + Android Chrome create and restore on the dev tunnel hostname | Document supported authenticators; desktop must use GPM/iCloud/1Password | Passkey onboarding and stateless restore |
| S5 | Envio on testnet | HyperIndex syncs our market events within 10 s | Self-host; else `getLogs` fallback only | S7 indexed fills, S8 history, Envio-driven leaderboard |

**S3 MON budget: filled after spike S3.** The faucet is rate-limited behind a human check, so the 150 MON above is a deliberate cap, not a measured result. [U, S3] Spike S3 measures deployment allowance, bot inventory needed for +/-3% moves in the deployed book, explicit-limit transaction costs and twenty player drips; if the book needs more than the cap, shrink level sizes via `minSize` before asking for more MON.

S2 additionally records `isMargin`, minimum-output units, zap funding semantics, max-size/spread choices and gas limits. S4 tunnel cards are disposable: [V] Mera passkeys bind to the hostname ([guide](https://docs.monad.xyz/guides/mera)); fix production `VITE_RP_ID` before any real card.

## Phase evidence contract

| Area | Evidence, not merely compilation |
|---|---|
| Market | Deployment receipt, `getMarketParams`, non-empty `cast code`, provision receipt with IDs, real bot-generated `Trade` and `FlippedOrderCreated` |
| SDK | Arithmetic and boundary tests for ladder/valuation; authenticated seal/open replay protection; supported derivation equality |
| Registry | Save/overwrite/erase/error tests, size boundary and gas snapshot; broadcast receipt and code check |
| Worker | Actual `/v1/health`, ticks and source ages; testnet-vs-source drift; refusal ledger for repeated drip |
| Web | Real device, not fixtures: new card -> funded disk -> tracker -> range -> orders -> flipped fill -> sound/SCORE -> withdraw -> results |
| Restore | Clear site data or use a fresh device -> INSERT CARD -> passkey prompt -> three addresses -> registry reads -> local decrypted disks; no server restore dependency |
| Envio | Fresh fill latency and SCORE equality for client/indexer/leaderboard on the same disk |
| Deployment | HTTPS fixed domain, 24-hour healthy worker, three fresh-device rehearsals and clean-clone commands actually run |

[I] Every number exposes its input/source, every balance surface says TESTNET, DAMAGE has SCORE's visual weight, and no AI gates numeric display. Fixtures are test/dev-only and visibly marked while present; production acceptance uses real sources. A paused price source shows "PRICE FEED PAUSED"; indexer fallback shows "INDEXER OFFLINE".

[V] Every transaction declares gas because Monad charges the limit ([gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing)). [V] Low-balance undelegated senders must observe the k=3-block emptying rule, including absence of prior sender transactions/delegation changes ([reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)); block-based spacing is required, not a guessed fixed delay.

## Cut ladder

Cut in this exact order, recording the decision and affected phase status in the same commit:

1. Nansen.
2. AUSD-USDC second market.
3. Leaderboard windows beyond 24h.
4. GOD MODE polish.

**Never cut:** a real flip fill on camera, the stateless memory-card restore. Cutting GOD MODE polish never disables the honeypot/unsellable gate. Cutting the second market leaves EASY on MON-AUSD with WIDE default. No cut substitutes fixtures for real fills or creates a server-dependent memory card.

A market/funding fallback is not a feature-completion claim. Maintain exact deployed configuration, supply assumptions and gate evidence. [U, organizer clarification during S4] Agora mobile-web/PWA qualification and requirement text remain unresolved; do not make an unverified bounty claim.

## Open decisions

[V] D-SCORE uses B6 default **(a)** in Phase 3 (`c01b1fc`; PROGRESS Phase 3): keep the DAMAGE clamp and show surplus as part of NET only. Owner: user for an override; current tests are final for (a), not blocked pending a new choice.

Keep `DAMAGE = max(0, SCORE - (V_now - V_hodl))` and `NET = V_now - V_hodl`. The identity `NET = SCORE - DAMAGE` is exact only when `NET <= SCORE`; that condition is expected for a two-sided ladder [I], not universally proven. For `NET > SCORE`, DAMAGE is zero and NET displays the surplus. Do not alter the approved DAMAGE clamp or hide surplus with a fake NET.

## Submission readiness

Phase 9 fills README evidence slots with real deployed addresses/transaction hashes, a <=3-minute video, screenshots/GIF and bounty requirement -> code path -> timestamp mapping. Public repository, MIT licensing and AI-tool disclosure remain required delivery checks. The app and worker stay online through Metropolis judging, 14 to 27 October.

Production deploy needs the user's VPS access and fixed domain/subdomain; optional provider credentials are not grounds to block public-RPC development. Never commit secrets. Contract address evidence uses `cast code <addr> --rpc-url <rpc>` with non-empty output on the intended chain; complete commands and code byte lengths live in SMART-CONTRACTS.
