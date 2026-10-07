# MONADBOY build plan

This is the **live task tracker** for the current repo, not a claim that planned services are running. **Update the checkbox, proof and phase count in the same commit as the work.** Keep commits at 50 to 250 changed lines; split long docs at heading boundaries.

Labels: **[V]** verified with a real commit, recorded check or source; **[I]** inference / intended behavior; **[U]** unresolved, with the spike or evidence that settles it. Status vocabulary: `TODO / DOING / DONE / BLOCKED / CUT`. DONE requires all task boxes and acceptance evidence; BLOCKED names the external gate, not a reason to stop independent work.

Read a task as `box + task ID + deliverable + proof`. `[x]` means the named deliverable has evidence, not that its dependent live integration works. `[ ]` names the command or observable evidence required before checking it. Letter suffixes split partial tasks; only checkbox lines count in Done/Total. Commit references below are [V] from `git log --oneline`; historical command results are explicitly attributed to the external handoff `PROGRESS.md`.

## Status at a glance

As of **2026-10-07 local / UTC**. The live blocker register is [../BLOCKERS.md](../BLOCKERS.md); user-facing asks are mirrored in the external handoff.

**Latest integrated unit:** Funded testnet registry/market, browser gameplay, signed cash-flow accounting and local Envio cutover. Fresh assembled `bun run verify` passed web543 / SDK153 / worker133 tests, typecheck and lint; `bun run build` passed. Foundry17tests/snapshot and indexer4projection tests/typecheck passed. These checks cover the assembled working tree, not independent historical snapshots. Physical devices, production hosting and final continuous mirror acceptance remain open.

| Phase | Status | Done/Total tasks | Next action | Blocker |
|---|---|---|---|---|
| 0 — Repo bootstrap | DONE | 2/2 | Maintain guard and commit discipline | None |
| 1 — Docs first | DONE | 4/4 | Keep docs aligned with implementation | None |
| 2 — Frontend shell and screens | DONE | 23/23 | Maintain the rendered and behavior checks | None |
| 2b — Experience pass | DONE | 5/5 | Preserve portrait, help and native sound | None for local experience work |
| 3 — Pure SDK | DONE | 9/9 | Maintain receipt-backed units and shape-specific gas | None |
| 4 — Funded spikes | DOING | 5/6 | Record physical iPhone/Android S4 results | B8 |
| 5 — DiskRegistry v2 | DONE | 6/6 | Preserve receipt/artifact identity and stateless device proof | B8 for physical restore, outside deployment |
| 6 — Worker | DOING | 8/12 | Prove final continuous mirror alignment/cost and deploy | B10; B3 for VPS |
| 7 — Web integration | DOING | 6/14 | Close partial-load recovery/audio boundary proof, then supported-phone/domain gates | B2 / B8; remaining runtime acceptance |
| 8 — Envio indexer | DONE | 5/5 | Preserve indexed parity and outage recovery | Public hosting remains Phase9/B3 |
| 9 — Deploy and submission | BLOCKED | 0/7 | Obtain fixed hostname and VPS access | B2 / B3; upstream live proof |

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
- [x] **2.9f** S6 SetRange screen — proof: `b8920ac`, `df7cc8e`, `4f73087`, `272d8b5`, `392a7d4`; WIDE 0.980065–1.020069 vs TIGHT 0.990066–1.010068 on the AUSD_USDC fixture (numbers in `S6-wide.png`), manual edges apply only on A, clamp notice and SDK funding split render; `S6-set-range.png`, `S6-error.png`.
- [x] **2.9g** S7 InRange screen — proof: `57b220f`, `3c4010f`, `c503d0d`; stepped chart, equal-weight SCORE/DAMAGE, NAD-SENSE and contextual keys; PRICE FEED PAUSED is driven by the `priceFeed` prop until Phase 7 wires the feed; `S7-in-range.png`.
- [x] **2.9h** S8 Results screen — proof: `c96cd81`, `a360707`, `abd6c88`; START opens the inputs (the same key as S6 and S7), A/B return to the shelf; `S8-results.png`.
- [x] **2.9i** Session state preserves choices and binds mascot to difficulty — proof: `a62a8d4`.
- [x] **2.9j** Assemble routes, root and router without absent imports — proof: `2264eb0`, `54ef7d3`, `91a7cbc`; `bun run generate-routes` output is byte-identical to the tree the dev server writes (shared Start footer in tsr.config.json); `bun run dev` serves /card with HTTP 200.
- [x] **2.9k** Add console screen-input test harness — proof: `1a74224`; harness existence does not prove screens exist.
- [x] **2.10** Verify assembled web and walk S1..S8 on phone viewport — proof: `bun run verify` passed (web 524, SDK 146, worker 118); actual headless Edge 412x915 keyboard/touch walk, eight `screens/phase2b/resume/assembled-S{1..8}-*.png` screenshots. Manual range, inputs, out-of-range sitting, recenter cost, withdrawal and completed result observed without injected run state. jsdom lacks scrollTo/canvas; its warnings remain visible and browser renders supply visual proof.
- [x] **2.11** Meet the touch minimum after the fit scale on phones — proof: getBoundingClientRect after the change: A/B 50.1 / 52.2 / 54.4 / 57.5 px, D-pad arm hit 46 / 48 / 50 / 52.8 px, START/SELECT 47.4x46 / 49.4x48 / 51.4x50 / 54.4x52.8 px at 360x640 / 375x667 / 390x844 / 412x915; the screen keeps 324.9 / 338.8 / 352.6 / 372.9 px width; desktop screenshots hash-identical at 1280x720, 641x900, 800x1000 and 1920x1080; edge taps fire every control. [V] Before: at 412x915 the console scaled 0.777, so A/B rendered 35.7 px, D-pad arms 22.8 px and START/SELECT 36.9x18.8 px while the console used 475 of 915 px of height.
- [x] **2.12** Close the Phase 2 review — proof: M1 URL eligibility `0e4f1ac` (one rule in `game/eligibility.ts` for the tracker and the range/live/results routes; `/play/range/0x…ab` renders Pool not found); M5 single session writer `0e4f1ac`; routed walk and S2 TESTNET labels `29f74cd`; ladder error copy and fine dollars `e1b9665`; M2 AUTOPILOT copy without the unsourced fee, S6 inputs view, now-marker clearance `5e7f2e5`; S7/S8 inputs on START, sim constants, out-of-range copy `abd6c88`; M4 rationale comments `662282c`, `a6a8266`, `913bd96`, `36d4eb8`, `e5e7914`. Phone screenshots are 515x1144 px: 412x915 CSS at device scale 1.25.

**Acceptance**
- Node-runtime verify and guard pass; no imports of absent modules.
- All eight screens render with sprites and unchanged visual constants; fixtures are visibly marked.
- Keyboard / touch selections, no silent 320px clipping, screenshots compared to the earlier version; record any known dev warnings rather than hiding errors.

**Proof to record** Per-area commits and verify output in external PROGRESS; phone screenshots in external handoff `screens/phase2/` and the earlier version's in `screens/phase2/earlier/`.

**Accepted deviations (review M3, m1)** The screen, test and fix commits through `313b886` did not update this file in the same commit; `14e88be` recorded their status in one docs commit. `2bf5a63` (34 lines) and `14e88be` (28 lines) are under 50 lines, and `54ef7d3` (+206/-8) is over 250 because the typed route graph is one cycle. History is not rewritten for these.

**Findings for later phases**
- [V] Under the 8-level x 2% cap the SDK ladder clamps volatile pairs: with the MON_USDC fixture's daily volatility of 0.6, WIDE and TIGHT plan the same range (the clamp notice says so). [U, S2] Re-check with measured testnet volatility before tuning the cap.
- [V] `RunSummary` does not keep the deposited amount, so S8 labels the amount as the current session's. Phase 7 sealed runs must record it per run.
- [V] Fixture markets carry `network`; Phase 7 replaces it with registry-backed deployment eligibility.

## Phase 2b — Experience pass

**Goal** Make the first minute feel like switching on a handheld: a front door at `/`, a boot at `/play`, readable phones, help on demand and sound.

- [x] **2b.1** Boot screen at `/play`; START or A goes to `/card`, any other key skips, the sequence plays once per browser session and never under reduced motion — proof: `0283592` (Boot, 6 tests), this commit (route, `sessionStorage` flag, B from `/card` returns to `/play`; routed test 9/9); headless Edge at 412x915: Enter on the ready frame lands on `/card`, flag `monadboy.booted=1`; `screens/phase2b/boot-logo-412x915.png`, `boot-ready-412x915.png`.
- [x] **2b.2** Landing page at `/`: seeded pixel city, held console boot, scroll-pinned fixture illustrations, product truths, cast and PRESS START handoff — proof: rendered headless Edge 1440x900, 1536x730 and 412x915; `screens/phase2b/resume/landing-*.png`, `how-phone-412x915.png`; START reached `/play`, `monadboy.booted=1`. Shared skyline checks pass in the integrated verify.
- [x] **2b.3** Native portrait handheld with reflowed screens and compact controls; approved by the user — proof: headless Edge at 360x640, 390x844 and 412x915, all nine surfaces; native viewport 320x376, 350x580 and 372x648, no settled screen overflow. `screens/phase2b/resume/{boot,memory,disks,cartridges,difficulty,tracker,range,live,results}-*.png`. Dense settings scroll inside short screens. Laptop retains 480x320 layout; `play-city-1536x730.png`. Native portrait transform is fixed at 1, including desk-to-phone resize.
- [x] **2b.4** Rule book: `?`/H contextual help and laptop map, including leaderboard — proof: native 344x624 dialog at 360x640, 44x44 opener; input isolation, held-input clearing, Shift-question chord, Escape focus restoration and next-input unlock observed. Native cancel regression passes; obsolete keyhint removed.
- [x] **2b.5** Native WebAudio chip effects, licensed CC0 background loop, VOL and M — proof: decoded 100.1739s loop, no context before trusted input, nonzero postmix PCM, exact silence for M/VOL0, preserved VOL and visibility suspend/resume. Actual `sound-walk.webm`; license record accompanies asset. Digital proof is not physical speaker/listening proof.

**Acceptance** Every new surface keeps TESTNET visible, passes the forbidden-term guard, respects reduced motion, and leaves the eight game screens unchanged in behaviour.

**2026-10-06 UTC integrated evidence:** Eight rendered fixture surfaces and outcome walk are recorded under `screens/phase2b/resume/`. Rule-book Escape previously left input locked; native cancel state reconciliation fixed it, and the next X/Shift action worked. Full workspace verify passed with native-cancel and input-lock regressions. Sound evidence is postmix PCM from the actual native graph, not mocked nodes. Phone screenshots use 412x915 CSS (515x1144 pixels at installed Edge scale 1.25). Fixtures remain visibly marked and are not live-chain proof.

## Phase 3 — Pure SDK

**Goal** Centralize typed chain boundaries, ladder arithmetic, valuation and stateless disk cryptography.

- [x] **3.1a** Add chain/RPC config and typed Kuru, token and faucet ABIs with live event-topic checks — proof: `1b689c9`, `369f364`, `733e55f`.
- [x] **3.1b** Catalog seven mainnet markets with live params; keep testnet list empty pending deployment — proof: `eac2203`; PROGRESS records seven non-empty 141-byte code results and live tick-size readbacks.
- [x] **3.1c** Fill gas-limits.ts from S2 measurements with20%headroom — proof:18receipt-backed shape samples include hash/block/estimate/declared limit; native transfer21000 is separately labeled protocol constant. Bounded native payout/provision/exit exercised; samples are not universal ceilings.
- [x] **3.2a** Encode prices/sizes with rounding, bounds and empty-book sentinels — proof: `bf0b906`; PROGRESS records encoding coverage 100%.
- [x] **3.2b** Pin encoding to a real testnet order — proof: captured raw S2 provision `0x2adc195bf81514bbb045bfc72196a65b24bc15a5e8802ca5b752d79efa0a6b59`; observed-order regression checks price/size and quote-input precision. SDK153tests passed in the prior assembled run.
- [x] **3.3** Plan deterministic WIDE/TIGHT/manual flip ladders and batch args — proof: `2e98754`, `733e55f`; PROGRESS independent probe: mid 0.03326, WIDE sigma 0.04, budget 100 -> 2% step, five levels, ten orders.
- [x] **3.4** Implement SCORE, clamped DAMAGE, NET and inclusive NAD-SENSE boundaries — proof: `c01b1fc`, `733e55f`; PROGRESS records position coverage 100% and B6 default (a).
- [x] **3.5** Implement HKDF/AES-GCM seal/open with slot isolation, AAD and bounded plaintext — proof: `ec216f4`; PROGRESS records seal coverage 100%.
- [x] **3.6** Derive Mera card/disk accounts using supported path — proof: `b63cc10`; PROGRESS records derivation equality tests and coverage 100%.

**Acceptance**
- Arithmetic / boundary tests and authenticated seal/open replay protection pass; supported derivation equals the reference.
- `bun run --cwd packages/sdk test:coverage` reports >=95% lines for kuru/* and seal; PROGRESS records 112 tests and 99.09% overall.
- No ethers runtime import; concrete dependency pins. Default (a) preserves NET surplus and DAMAGE clamp, not a universal false identity.
- Receipt-backed gas samples and real-order fixture now settle the two deferred S2 tasks; no guessed fallback limits are published.

**Proof to record** Red/green checks, coverage and formula review in external PROGRESS; observed params/topics in Kuru research; measured gas and real-order tx in SMART-CONTRACTS.

## Phase 4 — Funded spikes

**Goal** Turn network assumptions into pass/fail evidence before live gameplay depends on them.

- [x] **4.0** Fund separate DEPLOYER / BOT / DRIP wallets — proof: 2026-10-07 UTC `cast balance --ether <role-address> --rpc-url https://testnet-rpc.monad.xyz` returned **50/80/20 MON**, meeting the lean targets after user funding. B1 resolved; no private material is recorded.
- [x] **4.1** S1: broadcast AUSD faucet request with explicit gas — proof: successful `0x80d2b84ddbe529a6f3692cf26f034054957b0c881a43a9278926512d4932737b` at block 68939636 delivered 10,000 AUSD. Observed global 60-second cooldown and MaxFrequencyExceeded refusals; funded role transfers are distinguished from faucet payouts in AUSD research.
- [x] **4.2** S2: deploy MON-AUSD, read params, deposit and provision 2+2 levels, then BOT taker-fill — proof: deployment `0xa7877c745f7d3f3011bd589e78095c3175c845d14f7b1689d41af8d9ca3a52bc`, 141-byte code and live param readback; provision `0x2adc195bf81514bbb045bfc72196a65b24bc15a5e8802ca5b752d79efa0a6b59`; initial/flipped-origin fills and 8+8/cancel/withdraw receipts in SMART-CONTRACTS. Price-precision quote input, margin-prefunded zap, raw-token minOut and linked-pair cancellation are measured, not ABI assumptions.
- [x] **4.3** S3: measure +/-3% bot inventory and twenty player drips — proof: actual L2 at block68947216 has 2.2409591305MON bid depth/~0.06AUSD ask depth in the band, covered by inventory; sparse prices cannot guarantee an exact3% landing. Real0.5MON/10AUSD drip receipts bill21000+87502gas: twenty payouts plus gas require10.221344080MON at102gwei. Nominal20MON fits the approved undelegated>=3actualblocks branch; retaining an unconditional10MON floor instead needs20.221344080MON. After three actual drips,17remaining cost8.688142468MON and leave9.758255920MON; unsigned recent code/authorization/sender-block scans proved eligibility without additional funding. Public worker-funded S3 artifacts record both branches.
- [ ] **4.4** S4: test Mera create/restore on disposable HTTPS tunnel — proof required: user-observed iPhone Safari and Android Chrome results from dev-only /dev/passkey, hostname and authenticator recorded; route absent from production.
- [x] **4.5** S5: initialize testnet Envio spike for our market — proof: fresh native-card flipped buy `0x10883c2ff43adb087f22c17fd798e1b5024219f18ccb17aa72fb4b6f418022aa` and three fresh sells observed in public GraphQL564–570ms after receipt observation;300ms sampling gives observed upper bounds. Exact client/indexer/worker SCORE parity. Original16.620second miss retained.

**Acceptance**
- Each S1..S5 has a pass/fail line with actual evidence, not code existence.
- markets.testnet.json contains verified deployed params/address; Phase 3 deferred gas and real-order proof are filled.
- Device testing can proceed without funding; tunnel passkeys never become production cards.

**Proof to record** Spike scripts in scripts/spikes; receipts, params and gas in SMART-CONTRACTS; findings in Kuru / AUSD / Mera / Envio research notes; outcomes and blocker changes in external PROGRESS.

[V] Funding observed 2026-10-07 UTC: DEPLOYER50, BOT80, DRIP20MON via4.0. This supersedes the earlier zero-balance blocker; roles remain separate. S3 real receipts/book reads support the measured block-spaced budget, not an unobserved guarantee for future gas/delegation changes. Public funding entry point: [Monad faucet](https://faucet.monad.xyz/) ([network facts](https://docs.monad.xyz/ai/current-facts.md)).

## Phase 5 — DiskRegistry v2

**Goal** Save isolated sealed disks onchain without a server restore dependency.

- [x] **5.1** Configure Solidity 0.8.28 Foundry project and pinned forge-std — proof: `00a6d11`; PROGRESS records forge build exit 0.
- [x] **5.2a** Implement per-disk save/overwrite/erase and limits without funds/admin — proof: `d60452a`, `bd4af28`; PROGRESS records Anvil save/read, preserved createdAt, value rejection and erase.
- [x] **5.2b** Cover save/error/isolation/size boundaries and stable gas snapshot — proof: `30c09be`, `bd4af28`; PROGRESS records 17/17 tests, 256 fuzz runs, identical snapshot checks and forge fmt exit 0.
- [x] **5.3a** Add deploy script, contract docs and generated SDK registry ABI — proof: `e7960a7`, `d5b2926`, `bd4af28`; PROGRESS records generated ABI deep-equals out/ (seven entries).
- [x] **5.3b** Broadcast registry to testnet and publish verified deployment config — proof: `0xaf7a396b8f73814ba6fac77829c73e632f4ec1c2e0dfa83cfa1e9f50354229af`, block 68939801, explicit limit 558564, runtime 1885 bytes exactly matched artifact; default deploy command independently read the successful receipt/config without rebroadcast. MonadVision and Sourcify perfect source verification; Monadscan failure is recorded.
- [x] **5.4** Run Foundry contract tests in CI — proof: `d5b2926`; tracked .github/workflows/ci.yml defines the contract job.

**Acceptance**
- In contracts/: `forge test` and `forge snapshot --check` pass; SDK ABI equals generated artifact.
- Testnet deployment has real code and a recorded receipt. Local contract proof alone does not complete this phase.

**Proof to record** Scoped Foundry / Anvil and ABI checks in external PROGRESS; gas snapshot in contracts/.gas-snapshot; deployed address, byte length and transaction in SMART-CONTRACTS.

## Phase 6 — Worker

**Goal** Serve read models and operate the bot/drip continuously without signing for players.

- [x] **6.1a** Hono/Bun server, zod env and migrations — proof: isolated actual Bun worker, fresh SQLite migrations 1..5; routes/job tests within 118 passing worker checks. Absolute SQLite parent resolution fixes observed Windows relative-path startup failure.
- [x] **6.1b** /v1/health with build/source/job state — proof: HTTP 200 amber with explicit transactions-disabled, fresh source ages, complete coverage and mirror ticks 0; not a live-deployment success claim.
- [x] **6.2** Mainnet/testnet sampler and /v1/mid — proof: actual mainnet samples and fresh HTTP answer; boundary regressions for three failures, source spread >2% immediate pause/resume and 30s observed-book expiry pass. Testnet no-market-configured is reported honestly, not an empty usable book.
- [x] **6.3** Mirror toward mainnet with capped notional, explicit gas and nonce management — proof: final bounded external-maker transition preserved cancellation/trade hashes and refused a crossing target quote before broadcast; source revalidation, cap/direction, same-nonce sequencing and actual-chain regressions. This does not close6.9continuous alignment/economics.
- [x] **6.4a** Seven-market L2/trade tracker and shared SDK scoring — proof: actual authenticated 24h backfill (one snapshot 21,668 trades), seven validated live rows, MON_AUSD/WBTC_AUSD thin/null-mid; unchanged strict web schema accepts all seven after FP concentration invariant correction. Workspace decoder/gate/history regressions pass.
- [ ] **6.4b** Calibrate policy and verify playable testnet mapping — verified mapping/deployed parameters now exist. Remaining proof: measured policy calibration; SDK thresholds/USD parity are assumptions, not calibrated constants.
- [x] **6.5** Drip MON then AUSD with refusal ledger and block spacing — proof: three real fresh-account payouts; repeat-after-restart, actual IP quota and invalid/nonfresh requests refused. Twenty-player block-spaced budget is receipt-backed; route/job refusal regressions exercise remaining branches.
- [x] **6.6** Top up AUSD with observed faucet backoff — proof: successful10,000AUSD grant `0xc3849d522ea973d2a17638059b2000273f04ea38285a679d129f9e8789fa68a4`, block68945959; observed frequency-limited health retryInMs3548614 without repeated broadcast. Faucet Transfer is not mint-from-zero.
- [x] **6.7** Aggregate leaderboard via FillSource and mid_samples — proof: actual /v1/leaderboard rows, exact0.000002997833732854715AUSD SCORE parity, indexed/direct outage recovery. Signed lifetime margin cash-flow regression caught phantom post-withdraw DAMAGE; public scope differs from private per-run basis.
- [ ] **6.8a** Write systemd/Caddy deployment files and VPS instructions — proof required: `systemd-analyze verify deploy/monadboy-worker.service` and `caddy validate --config <configured-Caddyfile>` on target-compatible environment.
- [ ] **6.8b** Deploy worker on VPS — proof required: service active after restart and HTTPS /v1/health; B3 access required.
- [ ] **6.9** Exercise ten-minute final live mirror, tracker and drip run — historical10minute self-taking run is not final acceptance. Corrected bounded transition exists; continuous drift/cost proof remains B10. Preview worker has signing disabled.

**Acceptance**
- Workspace verify and scoped route/job checks pass; live run proves drift control, source ages and refusal ledger.
- Move scoring to packages/sdk and migrate web callers; do not duplicate scoring.
- [V] PROGRESS records public RPC getLogs limit of 100 blocks; 24h tracker scan needs HyperSync/Envio or suitable RPC, not an assumed fast raw scan.

**Proof to record** Commands, route outputs and SQL rows in external PROGRESS; measured mainnet inputs/calibration in research; bot/drip receipts and explicit gas in SMART-CONTRACTS.

**2026-10-06 UTC review/runtime:** Authenticated HyperSync query HTTP 200, real book/log inputs and complete SQLite trade window; no broadcast jobs enabled. Expiry is evaluated after inventory awaits; tracker data over 45min cannot remain live/playable. Fresh mid/source reads, CORS allow/deny/preflight, strict invalid queries/bodies and disabled drip 503 observed. Leaderboard truthfully returned no-market-configured, so funded ranking/drip/mirror acceptance remains open. Original WSL systemd verification failed for missing Bun; only a temporary syntax copy passed. Caddy unavailable; target deployment/validation not claimed.


## Phase 7 — Web integration

**Goal** Replace marked fixtures with real data and local passkey signing while preserving every screen.

- [ ] **7.1** Client-only Mera card session and per-disk viem clients — proof required: HTTPS create/insert/eject run; no Mera server import; sessions end on eject / hidden-tab timeout; only credential metadata persists.
- [ ] **7.2** S1 MemoryCard: real INSERT / NEW CARD and error copy — proof required: supported-phone passkey prompts and mapped error screenshots; FIXTURE marker removed only after real actions.
- [ ] **7.3** S2 DiskSelect: derive/read/decrypt three slots, create/drip/save and OPEN — proof required: three disk addresses, registry readbacks, save receipt, ciphertext hash/explorer proof and SAVED TO CARD screenshot.
- [x] **7.3a** Decrypted-disk cartridge and leaderboard navigation — proof: native 412x915 local-registry walk kept disk 1/name, locked cartridges stayed locked; leaderboard window URL/back exercised. Unmatched route-context warning fixed with explicit navigation.
- [x] **7.3b** Difficulty preferences and sealed persistence — native/local-registry NORMAL and HARD/GOD MODE changes restored after storage clear; funded native-card NORMAL also saved/restored. Regression preserves private notes/history and prevents GOD MODE below HARD; unsellable gate unchanged. Physical acceptance remains7.11/B8.
- [x] **7.4** Live worker tracker and mainnet-only eligibility — proof: seven validated mainnet rows with source/time and inspectable metrics; manifest-backed MON_AUSD testnet mapping now enables funded gameplay. Unmapped mainnet venues remain read-only; strict honeypot/GOD MODE gates retained.
- [ ] **7.5** S6 SetRange: live ladder, funding split and confirm sequence — two real native-card provision sequences observed with approval/deposit/zap/provision receipts, explicit gas, actual volatility and separate confirmation. Expired quote refused before signing. Remaining proof: actual partial-load failure and in-app recovery; final clamped-warning rendering. Controller/shared view/S6/S7/S8 are separate files, not one oversized screen module.
- [ ] **7.6** S7 InRange:5s mid polling, real fills, SCORE/DAMAGE and re-center/withdraw — real initial/flipped fills,0.000003SCORE, OUT OF RANGE sitting,0.062198MON re-center estimate/exit, and actual INDEXER OFFLINE/recovery observed. Re-center returns to S6 and requires a separate fresh confirmation. Remaining proof: actual fill-audio output and NAD-SENSE boundary transition; muted runtime is not audio proof.
- [x] **7.7** S8 Results: cancel/withdraw, tx-linked result and sealed run — first exit cancel `0xaa74139691576737a3f5e9698e08285d749cb95c4c9e7f05b2209eeb49d1ca5f` / withdraw `0x7b19e8d6c67823cbd7ef746e0379c538759472be84f58bfc8c84ef80f0198c91`; sealed save `0x617e30e5ff6db8abb12b75da3040db0335afb8db859ee77a93d2545a32d332a1`. Eject/storage-clear/reload/discoverable INSERT restored same three addresses and first saved run. Second re-center exit/seal confirmed; shelf displayed two runs, but repeat restore unestablished after disposable reader unavailable.
- [x] **7.8** Leaderboard screen — actual worker-backed phone/desktop renders with window/source/explorer links and six-decimal SCORE. Same16px SCORE/DAMAGE/NET; phone label/value separation8px, desktop figure cells145px with no text overflow. Both actual-font screenshots visually inspected; obsolete table header removed after compact-card cutover.
- [ ] **7.9** Installable portrait PWA — proof required: manifest/icons from assets/logo, Lighthouse installability report and supported-phone standalone launch; B5 organizer text settles Agora qualification separately.
- [x] **7.10a** Exclude fixtures from production gameplay routes — proof: production build deliberately supplied VITE_USE_FIXTURES=true; preview still showed real card-domain errors, actual worker/no-market reads and S6 deployment prerequisite, not simulated position. `/dev/passkey` returned 404; no test surface root.
- [ ] **7.10b** Full production worker/chain/indexer path — funded native virtual-reader testnet/worker/indexer path observed. Production supported-phone/HTTPS acceptance remains B2/B8/B3. Landing development examples stay labeled.
- [ ] **7.11** Record full real-phone play and stateless restore — proof required: HTTPS new card -> funded disk -> tracker/range -> explorer orders -> flipped fill/sound -> withdraw/results; clear site data -> INSERT CARD -> three locally decrypted disks without server restore.

**Acceptance**
- Full real-phone sequence and restore satisfy the evidence contract below; B2 fixes production rpId first.
- Review all twelve product rules on every screen; every balance says TESTNET, every number has a source, DAMAGE equals SCORE's visual weight.
- Signing stays in browser; no production fixture or server restore dependency.

**Proof to record** Screen recordings / screenshots outside repo, paths and observed devices in external PROGRESS; tx/address evidence in SMART-CONTRACTS; Mera support/errors in research notes.

**Reachable integration proof:** Native WebAuthn virtual PRF reader and isolated Anvil proved three-slot seal/restore and profile preservation. Funded Monad testnet then proved two S6 provisions, maker flip, S8 exit, optional sealed saves and first-run discoverable restore without server/localStorage. Pending-operation eject/expiry regressions pass. Two-run shelf was observed before a later repeat restore stalled with the disposable authenticator unavailable; no production recovery claim is made from memory-only test credentials.

**Production PWA proof:** Built preview manifest parsed without errors; native Chromium Page.getInstallabilityErrors returned an empty error list, with real 192/512/maskable icons. No service worker caches chain responses. Physical-phone standalone launch and Lighthouse report are not recorded, so 7.9 remains open. Live leaderboard no-market and retained OFFLINE state are rendered; no invented ranking or fill is claimed.


## Phase 8 — Envio indexer

**Goal** Index live fills and disk events, then switch consumers without changing SCORE.

- [x] **8.1a** Configure chain10143, deployment start blocks and live event signatures — proof: pinned HyperIndex3.0.0-alpha.21 codegen exits0 in Linux container; actual registry runtime/source and market code/params verified. Config starts68939801, opts into transaction hashes and selects public RPC `for: live` with100block bounds.
- [x] **8.1b** Implement entities and handlers with SDK-equivalent SCORE — proof: four native generated-runtime projection tests passed, covering initial/flipped partial spread, duplicate log, missing-origin incompleteness, paired cancellation and rolling volume; Linux typecheck passed. Actual native-card flipped fill has projected spread0.00001998452654220712AUSD. SDK `scoreFromFills` is imported, not copied.
- [x] **8.2** Deploy hosted or self-hosted HyperIndex — proof: local Docker Compose Postgres/Hasura/indexer healthy; unauthenticated public-role GraphQL HTTP200 returns actual market/registry rows and ready cursor on10143, start68939801. Public mutationType is null; admin authentication remains server-only. This is self-hosted local proof, not VPS/public HTTPS deployment.
- [x] **8.3** Switch worker FillSource and S7/S8 to Envio — actual indexed gameplay/history/leaderboard; GraphQL container stop caused INDEXER OFFLINE/direct logs and restart restored indexed provenance. Same-block coverage/holdings and unknown-origin safeguards preserve shared arithmetic.
- [x] **8.4** Prove latency and SCORE parity — fresh sells/native-card buy observed564–570ms after receipt; client/indexer/worker SCORE exactly0.000002997833732854715AUSD. External `indexer-native-observations.json` / `native-score-parity.json`; original failed timing retained.

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

Each gate requires actual evidence, not declarations. S1/S2/S3/S5 have funded receipt/readback/latency/parity evidence; S4 remains physical-device gated. Preserve S5's original16.620second miss alongside live-RPC564–570ms passing observations. Receipts/logs, params, gas and device/indexer results belong in research and [SMART-CONTRACTS](SMART-CONTRACTS.md).

| ID | Question | Pass condition | Fallback | Dependent work |
|---|---|---|---|---|
| S1 | AUSD testnet supply | Faucet `requestFunds` succeeds from our wallets at some cadence, or we hold >=1,000 AUSD | Ask Monad/Agora in Discord; else official MON-USDC testnet market with testnet USDC | Supply, drip, MON-AUSD execution; second market only if USDC source usable |
| S2 | Flip ladder on Kuru testnet | Deploy our MON-AUSD market, deposit, `batchProvisionLiquidity` 2+2 levels; bot taker fill emits `Trade` + `FlippedOrderCreated`; encodings and `provisionOrRevert` documented | Single `addFlipBuyOrder` / `addFlipSellOrder` per level | Trusted encodings, explicit gas limits, playable market, real flip proof |
| S3 | Testnet MON budget | Deployer + bot + drip wallets hold the lean budget: DEPLOYER 50 MON, BOT 80 MON of inventory, DRIP 20 MON for 20 player drips (about 150 MON total) | Shrink level sizes via `minSize` and ladder depth until the +/-3% move fits the inventory; ask Monad for a top-up only if the measured need is higher | Live mirror and fresh-disk onboarding |
| S4 | Mera on real devices | iPhone Safari + Android Chrome create and restore on the dev tunnel hostname | Document supported authenticators; desktop must use GPM/iCloud/1Password | Passkey onboarding and stateless restore |
| S5 | Envio on testnet | HyperIndex syncs our market events within 10 s | Self-host; else `getLogs` fallback only | S7 indexed fills, S8 history, Envio-driven leaderboard |

**S3 measured MON budget:** Twenty0.5MON/10AUSD drips require10MON+200AUSD payouts and0.221344080MON gas at observed102gwei. DRIP20MON covers this under the approved undelegated>=3actualblocks exception; retaining10MON after all payouts would require20.221344080MON. Actual±3% book depth is2.2409591305MON bid/~0.06AUSD ask atblock68947216, covered by inventory but not a guarantee of exact sparse-book price movement. The150MON cap is funded; no new top-up is requested. Deployment/gas rows live in SMART-CONTRACTS; final mirror continuous operating economics remain B10.

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
5. Phase 2b sound (2b.5), then the portrait shell (2b.3). The landing page and boot stay.

**Never cut:** a real flip fill on camera, the stateless memory-card restore. Cutting GOD MODE polish never disables the honeypot/unsellable gate. Cutting the second market leaves EASY on MON-AUSD with WIDE default. No cut substitutes fixtures for real fills or creates a server-dependent memory card.

A market/funding fallback is not a feature-completion claim. Maintain exact deployed configuration, supply assumptions and gate evidence. [U, organizer clarification during S4] Agora mobile-web/PWA qualification and requirement text remain unresolved; do not make an unverified bounty claim.

## Open decisions

[V] D-SCORE uses B6 default **(a)** in Phase 3 (`c01b1fc`; PROGRESS Phase 3): keep the DAMAGE clamp and show surplus as part of NET only. Owner: user for an override; current tests are final for (a), not blocked pending a new choice.

Keep `DAMAGE = max(0, SCORE - (V_now - V_hodl))` and `NET = V_now - V_hodl`. The identity `NET = SCORE - DAMAGE` is exact only when `NET <= SCORE`; that condition is expected for a two-sided ladder [I], not universally proven. For `NET > SCORE`, DAMAGE is zero and NET displays the surplus. Do not alter the approved DAMAGE clamp or hide surplus with a fake NET.

## Submission readiness

Phase 9 fills README evidence slots with real deployed addresses/transaction hashes, a <=3-minute video, screenshots/GIF and bounty requirement -> code path -> timestamp mapping. Public repository, MIT licensing and AI-tool disclosure remain required delivery checks. The app and worker stay online through Metropolis judging, 14 to 27 October.

Production deploy needs the user's VPS access and fixed domain/subdomain; optional provider credentials are not grounds to block public-RPC development. Never commit secrets. Contract address evidence uses `cast code <addr> --rpc-url <rpc>` with non-empty output on the intended chain; complete commands and code byte lengths live in SMART-CONTRACTS.

## Funded integration commit checkpoints

Each bounded unit below uses the freshly verified assembled tree described above, plus its observed runtime evidence. No push; Dylan identity. Unchecked acceptance is retained rather than inferred from tests.
- Encoding unit: raw funded FlipOrderCreated fixture, quote-input pricePrecision and maker direction; assembled SDK153tests and actual S2 receipt evidence.
- sdk: pin Kuru encodings to funded receipt units — S2 raw provision receipt and maker/taker direction; SDK153 tests. Verified assembled web543/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- sdk: publish measured shape-specific gas budgets — 18 successful receipt samples, 20% headroom; anomalous unbounded payout is not a constant. Verified assembled web543/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- deployment: use verified testnet manifests by default — Registry1885 bytes and market141 bytes; live chain10143 parameters and actual startup. Verified assembled web543/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- registry: reuse and verify confirmed deployment safely — Unsigned deployment command reused receipt/runtime without broadcast; Foundry17 and snapshot passed. Verified assembled web543/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
