# MONADBOY build plan

This is the **live task tracker** for the current repo, not a claim that planned services are running. **Update the checkbox, proof and phase count in the same commit as the work.** Keep commits at 50 to 250 changed lines; split long docs at heading boundaries.

Labels: **[V]** verified with a real commit, recorded check or source; **[I]** inference / intended behavior; **[U]** unresolved, with the spike or evidence that settles it. Status vocabulary: `TODO / DOING / DONE / BLOCKED / CUT`. DONE requires all task boxes and acceptance evidence; BLOCKED names the external gate, not a reason to stop independent work.

Read a task as `box + task ID + deliverable + proof`. `[x]` means the named deliverable has evidence, not that its dependent live integration works. `[ ]` names the command or observable evidence required before checking it. Letter suffixes split partial tasks; only checkbox lines count in Done/Total. Commit references below are [V] from `git log --oneline`; historical command results are explicitly attributed to the external handoff `PROGRESS.md`.

## Status at a glance

As of **2026-10-10 UTC**. The live blocker register is [../BLOCKERS.md](../BLOCKERS.md); user-facing asks are mirrored in the external handoff.

**Latest integrated unit:** DEMO x20 demand-only frontend/worker are deployed at the unchanged canonical RP ID. Six controlled heartbeats produced eight successful cancellation/quote receipts,0.383914332MON cost and0.459191652MON reserved under the2MON UTC/day cap. Lease expiry held BOT nonce161; source/Envio recovered green. Real Chrome rendered desktop and native412x915 card/guide without overflow.7.1 closes on native HTTPS lifecycle proof; no physical-device, new maker-fill, automatic re-center or24-hour acceptance is claimed.

| Phase                          | Status  | Done/Total tasks | Next action                                                                         | Blocker                                     |
| ------------------------------ | ------- | ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| 0 — Repo bootstrap             | DONE    | 2/2              | Maintain guard and commit discipline                                                | None                                        |
| 1 — Docs first                 | DONE    | 4/4              | Keep docs aligned with implementation                                               | None                                        |
| 2 — Frontend shell and screens | DONE    | 23/23            | Maintain the rendered and behavior checks                                           | None                                        |
| 2b — Experience pass           | DONE    | 14/14            | Preserve setup/review and honest venue-labeled play, adaptive desktop and phones     | None for local experience work              |
| 3 — Pure SDK                   | DONE    | 9/9              | Maintain receipt-backed units and shape-specific gas                                | None                                        |
| 4 — Funded spikes              | DOING   | 5/6              | Record physical iPhone/Android S4 results                                           | B8                                          |
| 5 — DiskRegistry v2            | DONE    | 6/6              | Preserve receipt/artifact identity and stateless device proof                       | B8 for physical restore, outside deployment |
| 6 — Worker                     | DOING   | 11/12            | Measure demand-only cost/alignment and finish policy calibration                     | B10 runtime calibration                     |
| 7 — Web integration            | DOING   | 8/14             | Close partial-load/audio acceptance and remaining restore/PWA/device proofs          | B8; remaining runtime acceptance            |
| 8 — Envio indexer              | DONE    | 5/5              | Preserve public read-only parity; wait for complete worker maker-basis backfill       | Full worker coverage remains open           |
| 9 — Deploy and submission      | DOING   | 3/8              | Record24-hour operational proof, physical-device rehearsal and submission package    | B8 / B10; upstream live proof               |

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
- [ ] **4.4** S4: test supported-phone Mera create/restore on production HTTPS — user approved deferring devices until production. Proof required: observed Samsung S22 Chrome and later iPhone Safari results at the canonical hostname, authenticator/browser and create/restore outcomes without PRF/key export. Disposable tunnel cards remain separate; `/dev/passkey` stays absent from production.
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
- [x] **6.3** Mirror toward mainnet with capped notional, explicit gas and nonce management — proof: final bounded external-maker transition preserved cancellation/trade hashes and refused a crossing target quote before broadcast; source revalidation, cap/direction, same-nonce sequencing and actual-chain regressions.2026-10-09 bounded run exposed quote sizing from free-only inventory; same-block decision inventory now includes remaining authoritative-live owned quotes. Three failing-before/passing-after regressions cover coherent balances, stale storage and other owners;27targeted chain/mirror tests passed. Real historical quote161/162 at69588055 read free1.003822731225MON but total3.432019928325MON, preserving a valid replacement budget without double-counting. Actual placement still uses post-take free balances. This implementation proof does not itself close6.9continuous alignment/economics.
  Checks for the reclaimable-inventory fix: `bun run verify` passed558web/153SDK/137worker with all typechecks and lint; Foundry17passed. Targeted mirror/fill tests passed27. The real historical-order smoke passed on the VPS without signing; the bounded live replay is separate6.9 evidence.
- [x] **6.4a** Seven-market L2/trade tracker and shared SDK scoring — proof: actual authenticated 24h backfill (one snapshot 21,668 trades), seven validated live rows, MON_AUSD/WBTC_AUSD thin/null-mid; unchanged strict web schema accepts all seven after FP concentration invariant correction. Workspace decoder/gate/history regressions pass.
- [ ] **6.4b** Calibrate policy and verify playable testnet mapping — verified mapping/deployed parameters now exist. Remaining proof: measured policy calibration; SDK thresholds/USD parity are assumptions, not calibrated constants.
- [x] **6.5** Drip MON then AUSD with refusal ledger and block spacing — proof: three real fresh-account payouts; repeat-after-restart, actual IP quota and invalid/nonfresh requests refused. Twenty-player block-spaced budget is receipt-backed; route/job refusal regressions exercise remaining branches.
- [x] **6.6** Top up AUSD with observed faucet backoff — proof: successful10,000AUSD grant `0xc3849d522ea973d2a17638059b2000273f04ea38285a679d129f9e8789fa68a4`, block68945959; observed frequency-limited health retryInMs3548614 without repeated broadcast. Faucet Transfer is not mint-from-zero.
- [x] **6.7** Aggregate leaderboard via FillSource and mid_samples — proof: actual /v1/leaderboard rows, exact0.000002997833732854715AUSD SCORE parity, indexed/direct outage recovery. Signed lifetime margin cash-flow regression caught phantom post-withdraw DAMAGE; public scope differs from private per-run basis.
- [x] **6.8a** Write systemd/Caddy deployment files and VPS instructions — proof: target `systemd-analyze verify` passed actual installed worker/health units; existing container Caddy validated the appended candidate and reloaded. Only the unrelated legacy agent PIDFile path warning remained; no source warning suppressed.
- [x] **6.8b** Deploy worker on VPS — proof: public HTTPS /v1/health200, canonical browser-origin fetch/CORS, actual service active after restart with migrations1..5 and first sample1791480426610 preserved; bounded memory and durable state directory.2026-10-09 private QuickNode switch verified worker TESTNET_RPC_URL and indexer ENVIO_RPC_URL, chain10143, bytecode, historical calls/receipt/logs and gas estimation. Restart retained the original four drip records and first sample; public indexed fill10143_69014514_2 persisted. A real HTTP429/-32013 account50/sec failure was reproduced; one shared20starts/s dispatcher now covers testnet reads and operations wallets without retries or serialized responses.205real same-cursor hydration calls for all four makers completed without errors; public Envio/leaderboard returned indexed/live. Drip remains enabled; unattended mirror remains deliberately disabled pending B10 operating-budget approval, not a final green-health claim.
- [x] **6.9** Exercise ten-minute final bounded mirror, tracker and drip run —2026-10-09 corrected executor completed609262ms with90samples,89usable price observations all within0.05% (maximum0.0486056%), zero empty sampled books,26successful transactions, no reverted receipts or self-trades and1.247819856MON declared-gas cost. One RPC read refusal was recorded, not counted as a successful sample. The preceding inventory-bug run lasted538200ms, cost1.711103142MON and produced11controlled external-maker fills with zero self-trades; retain it as failed-duration evidence, not the accepted benchmark. Two primary health samples during replay show live Envio lag2, complete tracker trade coverage, enabled DRIP and no job errors; actual repeat drip returned409. Both runs cleaned test-owned quotes and ended with confirmed/pending nonce equality. A subsequent single passive0.06AUSD-per-side seed is recorded in SMART-CONTRACTS; no unattended production loop is enabled. B10 remains open for operating-budget/cadence approval and9.4for24-hour accepted operations.

**Acceptance**

- Workspace verify and scoped route/job checks pass; live run proves drift control, source ages and refusal ledger.
- Move scoring to packages/sdk and migrate web callers; do not duplicate scoring.
- [V] PROGRESS records public RPC getLogs limit of 100 blocks; 24h tracker scan needs HyperSync/Envio or suitable RPC, not an assumed fast raw scan.

**Proof to record** Commands, route outputs and SQL rows in external PROGRESS; measured mainnet inputs/calibration in research; bot/drip receipts and explicit gas in SMART-CONTRACTS.

**2026-10-10 local demand-policy proof:** durable anchor computes relative20x movement
without changing the raw mainnet route or actual chain valuation. Real HTTP smoke
read source0.024884 and TESTNET0.024577, admitted a saved test-owned disk and
refused foreign origin, stale/forged signature and oversized input. Its registry
save succeeded at69765246 with271864declared gas; no mirror broadcast was made
by that route smoke. Capacity-race regression failed before the final admission
check; nonce-wait expiry regression failed before the immediate signing check.
Matching production rollout and fresh demand-only chain/cost evidence remain separate.
Release checks: `bun run verify` passed558web/153SDK/148worker tests with all
typechecks/lint; `forge test --root contracts` passed17tests; staged guard clean.
Existing jsdom scroll/canvas warnings are not browser failures or hidden proof.
Worker integration now gates inventory/execution on demand, checks it inside the
actual signing queue and exposes raw/DEMO source plus persistent gas status.
Idle/cadence and nonce-wait expiry regressions pass; no user-key signing is added.
Frontend visible range/live now refreshes signed demand every15seconds, stops on
hidden/eject/results/unmount and labels DEMO/raw source/actual book separately.
In-range accepted jump uses160ms chip audio; music gain is15% of the previous
mix. Actual user Chrome PCM rendered RMS0.04084380723204596 with silent tail.
Native WebAudio music gain measured0.06750000268220901; VOL/effects are unchanged.
These are digital browser proofs, not physical-speaker or full funded phone acceptance.

**2026-10-10 matched production proof:** original Vercel project/team authorization
and canonical alias were verified. Linux deployment READY and promoted; worker
retains private0600env, migrations1..6, original three sent/two refused drip rows
and first sample1791480426610. Real Chrome production-origin DEMO fetch returned200;
desktop1920x889 and native412x915 card/guide rendered without horizontal overflow.
Six controlled heartbeats yielded four actions at least34seconds apart, with
eight successful cancellation/quote receipts, zero Trade events and0.383914332MON
declared-gas cost. Persistent reservation is0.459191652MON under2MON/day.
After lease expiry nonce161 stayed unchanged, activePlayers0 and health green
with live Envio. This proves real quotes/demand stopping, not player maker fills,
all-day alignment/depth, physical-device restore or24-hour availability.

**2026-10-06 UTC review/runtime:** Authenticated HyperSync query HTTP 200, real book/log inputs and complete SQLite trade window; no broadcast jobs enabled. Expiry is evaluated after inventory awaits; tracker data over 45min cannot remain live/playable. Fresh mid/source reads, CORS allow/deny/preflight, strict invalid queries/bodies and disabled drip 503 observed. Leaderboard truthfully returned no-market-configured, so funded ranking/drip/mirror acceptance remains open. Original WSL systemd verification failed for missing Bun; only a temporary syntax copy passed. Caddy unavailable; target deployment/validation not claimed.

## Phase 7 — Web integration

**Goal** Replace marked fixtures with real data and local passkey signing while preserving every screen.

- [x] **7.1** Client-only Mera card session and per-disk viem clients —2026-10-10 actual HTTPS localhost native virtual PRF reader created and inserted the same three disk addresses; EJECT refused old signing. Controlled native hidden-return event past ten minutes ended the session and refused signing. Persisted fields were only credentialId/rpId/transports/v; no key or PRF export. `demand-native-session-proof.json` in external handoff records outcomes. This is browser lifecycle proof, not physical iPhone/S22 acceptance.
- [x] **7.2** S1 MemoryCard: real INSERT / NEW CARD and error copy — user acceptance:2026-10-09 Samsung S22 Chrome / Google Password Manager reports working card access, insert/new disk and sound, then explicitly accepts the tested experience. Production screenshots/public receipts reach funded provision;7.10a independently excludes fixtures. This closes the user-accepted S22 entry flow, not an exhaustive authenticator-error matrix, iPhone PRF support, stateless restore or standalone launch; those unobserved outcomes remain in4.4/7.9/7.11/B8.
- [ ] **7.3** S2 DiskSelect: derive/read/decrypt three slots, create/drip/save and OPEN — user-reported production screenshots show populated desktop/Android slots; S22 disk2 has0.476637308TESTNET MON and SAVED TO CARD. Latest user report confirms insert/new disk and repaired shelf; physical play now reaches provisioned orders. Complete proof still requires all three addresses, registry/hash readbacks, receipt inspection and stateless restore; the supplied screenshots alone do not close the task.
- [x] **7.3a** Decrypted-disk cartridge and leaderboard navigation — proof: native 412x915 local-registry walk kept disk 1/name, locked cartridges stayed locked; leaderboard window URL/back exercised. Unmatched route-context warning fixed with explicit navigation.
- [x] **7.3b** Difficulty preferences and sealed persistence — native/local-registry NORMAL and HARD/GOD MODE changes restored after storage clear; funded native-card NORMAL also saved/restored. Regression preserves private notes/history and prevents GOD MODE below HARD; unsellable gate unchanged. Physical acceptance remains7.11/B8.
- [x] **7.4** Live worker tracker and mainnet-only eligibility — proof: seven validated mainnet rows with source/time and inspectable metrics; manifest-backed MON_AUSD testnet mapping now enables funded gameplay. Unmapped mainnet venues remain read-only; strict honeypot/GOD MODE gates retained.
- [ ] **7.5** S6 SetRange: live ladder, funding split and confirm sequence — two real native-card provision sequences observed with approval/deposit/zap/provision receipts, explicit gas, actual volatility and separate confirmation. Expired quote refused before signing. Full buffered fill-or-kill input now checks exact same-block ask capacity before deposit; a failing-before/passing-after consumer regression and real historical-book smoke reject0.4752AUSD while preserving0.24AUSD funding at block69567406. Quote review now leads with actual endpoints, rendered clamp warning and visible deposit/fee estimates; quote/error transitions reset internal scroll. Minimum size, fee/headroom, funded simulation and signing guards remain unchanged. Remaining proof: actual partial-load failure and in-app recovery.
- [ ] **7.6** S7 InRange:5s mid polling, real fills, SCORE/DAMAGE and re-center/withdraw — historical real initial/flipped fills,0.000003SCORE, OUT OF RANGE sitting,0.062198MON re-center estimate/exit, and actual INDEXER OFFLINE/recovery observed. Latest S22 user report confirms sound and provisioned live screen with zero maker fills. First-sample line/sprite regression passes; live source/testnet/range labeling and in-range A jump render without pretending disabled mirror alignment. Re-center returns to S6 and requires separate confirmation. Remaining proof: actual fill-specific audio and NAD-SENSE boundary transition.
- [x] **7.7** S8 Results: cancel/withdraw, tx-linked result and sealed run — first exit cancel `0xaa74139691576737a3f5e9698e08285d749cb95c4c9e7f05b2209eeb49d1ca5f` / withdraw `0x7b19e8d6c67823cbd7ef746e0379c538759472be84f58bfc8c84ef80f0198c91`; sealed save `0x617e30e5ff6db8abb12b75da3040db0335afb8db859ee77a93d2545a32d332a1`. Eject/storage-clear/reload/discoverable INSERT restored same three addresses and first saved run. Second re-center exit/seal confirmed; shelf displayed two runs, but repeat restore unestablished after disposable reader unavailable.
- [x] **7.8** Leaderboard screen — actual worker-backed phone/desktop renders with window/source/explorer links and six-decimal SCORE. Same16px SCORE/DAMAGE/NET; phone label/value separation8px, desktop figure cells145px with no text overflow. Both actual-font screenshots visually inspected; obsolete table header removed after compact-card cutover.
- [ ] **7.9** Installable portrait PWA — proof required: manifest/icons from assets/logo, Lighthouse installability report and supported-phone standalone launch; this product gate remains required even though Agora is skipped ([SUBMISSIONS](../SUBMISSIONS.md)).
- [x] **7.10a** Exclude fixtures from production gameplay routes — proof: production build deliberately supplied VITE_USE_FIXTURES=true; preview still showed real card-domain errors, actual worker/no-market reads and S6 deployment prerequisite, not simulated position. `/dev/passkey` returned 404; no test surface root.
- [ ] **7.10b** Full production worker/chain/indexer path — funded native virtual-reader path observed; latest S22 screenshot/public receipt checks confirm approval/deposit/zap/provision at69567374/69567393/69567407/69567429. Canonical hosting/HTTPS/restart gates resolved. Supported-phone restore, full physical fill/exit path, complete maker basis and accepted final mirror remain open. Landing development examples stay labeled.
- [ ] **7.11** Record full real-phone play and stateless restore — proof required: HTTPS new card -> funded disk -> tracker/range -> explorer orders -> flipped fill/sound -> withdraw/results; clear site data -> INSERT CARD -> three locally decrypted disks without server restore.

**Acceptance**

- [x] **User acceptance, Samsung S22** — accepted by the user on2026-10-09 for the reported card/disk entry, sound and repaired phone UI. Record as user acceptance, not independently observed physical testing. No new iPhone, restore, fill-specific audio, PWA or24-hour operational result is implied.
- Full real-phone sequence and restore satisfy the evidence contract below; use the fixed `monadboy-play.vercel.app` RP ID before production card creation.
- Review all twelve product rules on every screen; every balance says TESTNET, every number has a source, DAMAGE equals SCORE's visual weight.
- Signing stays in browser; no production fixture or server restore dependency.

**Proof to record** Screen recordings / screenshots outside repo, paths and observed devices in external PROGRESS; tx/address evidence in SMART-CONTRACTS; Mera support/errors in research notes.

**Reachable integration proof:** Native WebAuthn virtual PRF reader and isolated Anvil proved three-slot seal/restore and profile preservation. Funded Monad testnet then proved two S6 provisions, maker flip, S8 exit, optional sealed saves and first-run discoverable restore without server/localStorage. Pending-operation eject/expiry regressions pass. Two-run shelf was observed before a later repeat restore stalled with the disposable authenticator unavailable; no production recovery claim is made from memory-only test credentials.

**2026-10-10 funded interruption audit:** Provisioning cost checks now end as
`not sent: card ejected` immediately on eject/expiry, while confirmed receipts
remain visible. Pre-broadcast failures terminate the unsent step; interrupted
broadcast/receipt reads retain an honest unknown-confirmation state rather than
claiming the transaction failed. Reinsert/open reads chain-owned margin and
orders independently of an optional sealed basis, preserving re-quote and
withdrawal recovery. Hiding aborts an in-flight mirror-demand renewal; showing
can renew again, and eject stops the demand lease. Regression coverage includes
pending provisioning eject, partial-margin recovery, double confirmation,
quote expiry, network failures and mirror visibility lifecycle. No new
transaction or physical-device restore proof is claimed by these unit tests.
Same-serial card replacement also invalidates a revoked gameplay lease.
Low-balance sender block-spacing waits stop after 30 seconds if the chain
does not advance, without signing or weakening the three-block requirement.
Unavailable Envio/direct-log history no longer discards successfully read
chain balances/orders or blocks withdrawal. It carries an explicit history
error with unavailable totals; exit fill counts seal and restore as null,
not a fabricated zero or a numeric completed run.
Each gameplay tick now reads the chain head, then the six snapshot reads
(order counter, both margin balances, wallet MON and AUSD, book) in one JSON-RPC
batch at that block, and reads each order once per snapshot. The shared 200ms
spacing applies to HTTP dispatch. Read-only measurement against the production
RPC, worker and Envio on the same owner: median tick 1,403ms with 7 RPC requests
before, 411ms with 2 after; a failed sub-read still rejects, never reads as zero.

**2026-10-10 production UI audit:** Production range, live and results screens
now use the fixture screens' layout with real reads only (hand-built-state
screenshots at 1440x900, 1536x730 and 412x915, no screen-level overflow). The
empty tracker no longer says "try an easier tier": EASY is the strictest filter,
and the live read failed EASY on every market (MON/USDC: TVL and safety below
the EASY floor), so it points to NORMAL/HARD and lists each pool's first failed
gate. The no-card disk shelf offers A INSERT CARD. Landing CLS on a 412px phone
was 0.53 because the held console reserved no box before hydration; it now
reserves the shell's aspect ratio. Every page's HTML is cached at the Vercel edge
until the next deployment, since no page renders per-visitor data on the server.

**Production PWA proof:** Built preview manifest parsed without errors; native Chromium Page.getInstallabilityErrors returned an empty error list, with real 192/512/maskable icons. No service worker caches chain responses. Physical-phone standalone launch and Lighthouse report are not recorded, so 7.9 remains open. Live leaderboard no-market and retained OFFLINE state are rendered; no invented ranking or fill is claimed.

## Phase 8 — Envio indexer

**Goal** Index live fills and disk events, then switch consumers without changing SCORE.

- [x] **8.1a** Configure chain10143, deployment start blocks and live event signatures — proof: pinned HyperIndex3.0.0-alpha.21 codegen exits0 in Linux container; actual registry runtime/source and market code/params verified. Config starts68939801, opts into transaction hashes and uses private ENVIO_RPC_URL with the public RPC as default, `for: live` and100block bounds. QuickNode normalized URL resolution was verified without printing the token; codegen uses the512MiB one-shot ceiling, not the192MiB live container. Native Linux typecheck and four projection tests passed after the switch; codegen's ignored-build diagnostic remains recorded in deployment docs.
- [x] **8.1b** Implement entities and handlers with SDK-equivalent SCORE — proof: four native generated-runtime projection tests passed, covering initial/flipped partial spread, duplicate log, missing-origin incompleteness, paired cancellation and rolling volume; Linux typecheck passed. Actual native-card flipped fill has projected spread0.00001998452654220712AUSD. SDK `scoreFromFills` is imported, not copied.
- [x] **8.2** Deploy hosted or self-hosted HyperIndex — proof: initial local Docker Compose Postgres/Hasura/indexer healthy; subsequently deployed the isolated stack on the VPS behind public HTTPS in9.2. Persistent-fill recovery after force-recreation passed. Public-role GraphQL exposes reads, not mutations; admin authentication remains server-only. Fresh2026-10-09T15:41:35.349Z worker health reports Envio live at69577492/head69577494, lag2, lastError null and leaderboard source envio; anonymous HTTPS GraphQL returns query_root with mutationType null. This is self-hosted production evidence, not Envio Cloud or24-hour uptime acceptance.
- [x] **8.3** Switch worker FillSource and S7/S8 to Envio — actual indexed gameplay/history/leaderboard; GraphQL container stop caused INDEXER OFFLINE/direct logs and restart restored indexed provenance. Same-block coverage/holdings and unknown-origin safeguards preserve shared arithmetic.
- [x] **8.4** Prove latency and SCORE parity — fresh sells/native-card buy observed564–570ms after receipt; client/indexer/worker SCORE exactly0.000002997833732854715AUSD. External `indexer-native-observations.json` / `native-score-parity.json`; original failed timing retained.

**Acceptance**

- S5 evidence passes on intended testnet; config uses live rather than prose event signatures.
- Read-model lag/outage is visible; direct logs preserve play but do not count as successful Envio integration.

**Proof to record** Fresh tx, query/output, timestamps/cursor and SCORE comparison in Envio research and external PROGRESS; deployment addresses in SMART-CONTRACTS.

## Phase 9 — Deploy and submission

**Goal** Ship the fixed-domain demo with reproducible setup and inspectable submission evidence.

- [x] **9.1** Resolve VPS access and fixed production hostname — proof: user-approved `monadboy-play.vercel.app`, matching production/preview VITE_RP_ID, persisted verified project domain, anonymous Edge HTTPS render and navigation; restricted SSH key authenticated `ubuntu`, `sudo -n true` and actual capacity/container inventory on2026-10-08 UTC. No credentials tracked.
- [x] **9.2** Deploy Vercel web and VPS worker/indexer behind Caddy HTTPS/systemd — proof: anonymous Edge public412x915 landing/card/data-route loads; worker HTTPS200 and restart/SQLite persistence; indexer force-recreation recovered persistent fill10143_69014514_2. Public spoofed-admin reads remained public-only, mutations refused and admin paths404. This rendered phone viewport is not physical B8 acceptance.
- [ ] **9.3** Rehearse on three fresh devices — proof required: iPhone, Android and desktop Chrome with Google Password Manager recordings, including a phone that never saw the app and stateless restore.
- [ ] **9.4** Observe healthy worker for24hours — five-minute persistent timer remains active; original restart502 and new startup indexer-offline/not-yet-observed state are retained.2026-10-10 matched demand-only rollout subsequently reports green, live Envio and enabled drip/mirror with activePlayers0. A short idle probe is not24-hour uptime. Proof required: complete24-hour samples/source/tick ages and accepted final health, plus availability through judging; retain hosting through4November pending [SUBMISSIONS](../SUBMISSIONS.md).
- [ ] **9.5** Finalize README and clean-clone local setup — [V] fresh local clone of7268a17 installed832packages with `bun install --frozen-lockfile`; `bun run verify` passed web551/SDK153/worker133, typechecks and lint without copied env/generated/dependency directories. README addresses/code paths updated. Remaining proof: public screenshots/GIF, technical demo ≤3 minutes, separate pitch ≤2 minutes, logo ≤3 MB and complete package per [SUBMISSIONS](../SUBMISSIONS.md).
- [ ] **9.6** Complete eligible bounty mapping — proof required: each requirement -> actual code path -> video timestamp in README/research/bounties.md; Agora is skipped (Mera + AUSD + Perpl required), not pending PWA qualification.
- [ ] **9.7** Check public submission package against [SUBMISSIONS](../SUBMISSIONS.md) — proof required: public repo/live URL, MIT license, final address/tx/technical-demo/pitch links, logo, sponsor fields and AI-tool disclosure; saved submission receipt/checklist.
- [x] **9.8** Enable production drip without unattended mirror signing — original public503 `supply-unavailable` traced to disabled transactions, not empty treasury. Configure only DRIP and stable salt; no BOT key/executor/job. Actual HTTPS0.5MON/10AUSD receipts at69485927/69485933 succeeded, balances matched and repeat returned409 `already-funded`. Funding copy distinguishes unavailable service from insufficient inventory. User-reported S22/GPM card access is recorded without closing funded save/restore or B8; receipt/permission evidence in deployment docs and external PROGRESS.

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

| ID  | Question                    | Pass condition                                                                                                                                                                | Fallback                                                                                                                                              | Dependent work                                                             |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| S1  | AUSD testnet supply         | Faucet `requestFunds` succeeds from our wallets at some cadence, or we hold >=1,000 AUSD                                                                                      | Ask Monad/Agora in Discord; else official MON-USDC testnet market with testnet USDC                                                                   | Supply, drip, MON-AUSD execution; second market only if USDC source usable |
| S2  | Flip ladder on Kuru testnet | Deploy our MON-AUSD market, deposit, `batchProvisionLiquidity` 2+2 levels; bot taker fill emits `Trade` + `FlippedOrderCreated`; encodings and `provisionOrRevert` documented | Single `addFlipBuyOrder` / `addFlipSellOrder` per level                                                                                               | Trusted encodings, explicit gas limits, playable market, real flip proof   |
| S3  | Testnet MON budget          | Deployer + bot + drip wallets hold the lean budget: DEPLOYER 50 MON, BOT 80 MON of inventory, DRIP 20 MON for 20 player drips (about 150 MON total)                           | Shrink level sizes via `minSize` and ladder depth until the +/-3% move fits the inventory; ask Monad for a top-up only if the measured need is higher | Live mirror and fresh-disk onboarding                                      |
| S4  | Mera on real devices        | iPhone Safari + Android Chrome create and restore on the dev tunnel hostname                                                                                                  | Document supported authenticators; desktop must use GPM/iCloud/1Password                                                                              | Passkey onboarding and stateless restore                                   |
| S5  | Envio on testnet            | HyperIndex syncs our market events within 10 s                                                                                                                                | Self-host; else `getLogs` fallback only                                                                                                               | S7 indexed fills, S8 history, Envio-driven leaderboard                     |

**S3 measured MON budget:** Twenty0.5MON/10AUSD drips require10MON+200AUSD payouts and0.221344080MON gas at observed102gwei. DRIP20MON covers this under the approved undelegated>=3actualblocks exception; retaining10MON after all payouts would require20.221344080MON. Actual±3% book depth is2.2409591305MON bid/~0.06AUSD ask atblock68947216, covered by inventory but not a guarantee of exact sparse-book price movement. The150MON cap is funded; no new top-up is requested. Deployment/gas rows live in SMART-CONTRACTS; final mirror continuous operating economics remain B10.

S2 additionally records `isMargin`, minimum-output units, zap funding semantics, max-size/spread choices and gas limits. S4 tunnel cards are disposable: [V] Mera passkeys bind to the hostname ([guide](https://docs.monad.xyz/guides/mera)); fix production `VITE_RP_ID` before any real card.

## Phase evidence contract

| Area       | Evidence, not merely compilation                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Market     | Deployment receipt, `getMarketParams`, non-empty `cast code`, provision receipt with IDs, real bot-generated `Trade` and `FlippedOrderCreated`                     |
| SDK        | Arithmetic and boundary tests for ladder/valuation; authenticated seal/open replay protection; supported derivation equality                                       |
| Registry   | Save/overwrite/erase/error tests, size boundary and gas snapshot; broadcast receipt and code check                                                                 |
| Worker     | Actual `/v1/health`, ticks and source ages; testnet-vs-source drift; refusal ledger for repeated drip                                                              |
| Web        | Real device, not fixtures: new card -> funded disk -> tracker -> range -> orders -> flipped fill -> sound/SCORE -> withdraw -> results                             |
| Restore    | Clear site data or use a fresh device -> INSERT CARD -> passkey prompt -> three addresses -> registry reads -> local decrypted disks; no server restore dependency |
| Envio      | Fresh fill latency and SCORE equality for client/indexer/leaderboard on the same disk                                                                              |
| Deployment | HTTPS fixed domain, 24-hour healthy worker, three fresh-device rehearsals and clean-clone commands actually run                                                    |

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

A market/funding fallback is not a feature-completion claim. Maintain exact deployed configuration, supply assumptions and gate evidence. [V, authenticated dashboard 2026-10-08] Agora Mobile Trading requires Perpl and is skipped in the current Kuru-only scope; no PWA ruling is needed for that excluded bounty. Current requirements and unresolved organizer questions live in [SUBMISSIONS](../SUBMISSIONS.md).

## Open decisions

[V] D-SCORE uses B6 default **(a)** in Phase 3 (`c01b1fc`; PROGRESS Phase 3): keep the DAMAGE clamp and show surplus as part of NET only. Owner: user for an override; current tests are final for (a), not blocked pending a new choice.

Keep `DAMAGE = max(0, SCORE - (V_now - V_hodl))` and `NET = V_now - V_hodl`. The identity `NET = SCORE - DAMAGE` is exact only when `NET <= SCORE`; that condition is expected for a two-sided ladder [I], not universally proven. For `NET > SCORE`, DAMAGE is zero and NET displays the surplus. Do not alter the approved DAMAGE clamp or hide surplus with a fake NET.

## Submission readiness

Phase 9 fills README evidence slots with real addresses/transaction hashes, a ≤3-minute technical demo, a separate ≤2-minute pitch, logo ≤3 MB, screenshots/GIF and eligible bounty requirement -> code path -> timestamp mapping. Public repository, MIT license, AI disclosure and judge access remain required. [SUBMISSIONS](../SUBMISSIONS.md) owns the packaging checklist and unresolved judging-date conflict; do not switch hosting off based on the older 27 October date alone.

VPS access, canonical hostname and public HTTPS/recovery are now verified. Physical devices, accepted final runtime health and24-hour evidence remain gates; optional RPC credentials are not grounds to block public-RPC work. Never commit secrets. Contract address evidence uses `cast code <addr> --rpc-url <rpc>` with non-empty output on the intended chain; commands/code byte lengths live in SMART-CONTRACTS.

## Funded integration commit checkpoints

Each bounded unit below uses the freshly verified assembled tree described above, plus its observed runtime evidence. No push; Dylan identity. Unchecked acceptance is retained rather than inferred from tests.

- Encoding unit: raw funded FlipOrderCreated fixture, quote-input pricePrecision and maker direction; assembled SDK153tests and actual S2 receipt evidence.
- sdk: pin Kuru encodings to funded receipt units — S2 raw provision receipt and maker/taker direction; SDK153 tests. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- sdk: publish measured shape-specific gas budgets — 18 successful receipt samples, 20% headroom; anomalous unbounded payout is not a constant. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- deployment: use verified testnet manifests by default — Registry1885 bytes and market141 bytes; live chain10143 parameters and actual startup. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- registry: reuse and verify confirmed deployment safely — Unsigned deployment command reused receipt/runtime without broadcast; Foundry17 and snapshot passed. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- spikes: share bounded funded transaction primitives — Actual explicit-gas testnet receipts and sanitized public gas/parameter reports. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- spikes: measure actual market provision and exit semantics — S2 deposit/provision/fill/cancel/withdraw receipts and parameter readbacks. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- spikes: expose explicit funded experiment commands — Broadcast requires explicit command; dry reads and evidence reports remain separate. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- spikes: capture maximum ladder and zap boundaries — 2+2/8+8, margin-prefunded zap, linked cancellation and faucet grant/cooldown receipts. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- worker: value live order membership and signed cash flows — Actual closed native-card phantom DAMAGE fixed; signed deposit-minus-withdrawal regression and chain-membership safeguards. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- worker: avoid mirror self-taking and retain partial receipts — Corrected external-maker transition; source recheck and crossing-quote refusal before broadcast. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- worker: cover actual-chain mirror execution boundaries — Real Anvil margin behavior, capped fresh execution and deterministic failure/partial-hash regressions. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- worker: consume indexed fills at a frozen chain cursor — Actual Hasura numeric/string fields; native SCORE parity and live GraphQL outage/direct-log fallback. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- worker: cover indexed history coverage failures — Five regressions for pagination, plain zero flipPrice, unknown origins, outages and start coverage. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- worker: wire indexed health and nonoverlapping jobs — Actual read-only worker health/envio provenance; single-flight scheduled jobs and chain-spaced treasury. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- leaderboard: retain micro-score precision and disclose valuation scope — Tiny real spread remains+0.000003; signed lifetime scope; actual phone/desktop figures no longer collide. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- indexer: pin Linux tooling and reproducible dependencies — Clean-volume locked install/codegen/types/native tests passed; build/peer warnings retained. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- indexer: project maker fills and paired cancellations — SDK-only flipped SCORE; origin completeness, pair lifecycle and idempotent registry updates. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- indexer: run read-only live indexing with CI checks — Public GraphQL mutationType null; live-RPC564-570ms observation; Linux package CI defined, not remotely claimed. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- indexer: verify generated projections and observe fresh events — Four native generated-runtime tests and pre-broadcast read-only300ms observer; historical latency miss preserved. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: share card nonce ownership and paced chain reads — Saves/trades use one sender lock and block-based low-balance sequencing; actual receipt waits and native save. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: seal actual run basis and confirmed exit history — First funded stateless restore; incomplete history never becomes fabricated zero, notes/preferences preserved. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: read indexed positions with honest chain fallback — Actual maker fill/SCORE parity, same-block holdings, detached storage membership and real INDEXER OFFLINE recovery. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: fund margin before zap and bound every execution step — Two actual approve/deposit/zap/provision sequences; numeric exit estimate and two confirmed withdrawals. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: manage funded position and sealed save lifecycle — Actual quotes, expiry refusal, first-run restore, optional save and separate re-center confirmation. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: share receipt provenance and valuation views — Inspectable source/receipt links and equally weighted SCORE/DAMAGE from actual data. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: show actual funded range quotes and recovery controls — Actual wallet, observed volatility, deposit-before-zap and measured-shape fee display; clamp warning retained. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: show live fills and explicitly priced re-center review — Real fill/SCORE, out-of-range sit, indexer outage and0.062198MON exit review observed; audio/boundary proof remains open. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: show confirmed exit receipts and saved results — Real S8 cancel/withdraw/seal receipts and first appended-run restore. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- web: route production gameplay through funded controllers — Separate S6/S7/S8 files, actual card gate, cost-null confirmation blocked and zero-valid exit cost. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- spikes: retain bounded worker smoke and budget evidence — Real drip/refusal/faucet/budget evidence; signed smoke is time-bounded and final preview is read-only. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- docs: record funded acceptance and remaining honest gates — at that historical checkpoint, S1/S2/S3/S5 resolved while B2/B3/B5/B8/B10 remained. Current closure/skip status is in BLOCKERS and the status table above. Verified assembled web551/SDK153/worker133 plus build; Foundry17/snapshot and Linux indexer4.
- Setup evidence: fresh-clone frozen install and full verify passed; final raw assembled output also reports551web tests, superseding the earlier543count recorded in commit proof bodies. No history rewrite; contract/indexer/build evidence unchanged.

## Approved interface refinement checkpoints

- [x] **2b.6** Make VOL the only visible sound control — two pre-fix regressions failed; consumer gain/remount, zero and reversible M pass. Native Edge slider/M recovery observed5 ->0 ->5 ->0; saved mute clears on explicit adjustment. Assembled verify web556/SDK153/worker133, build, Foundry17/snapshot passed. No physical speaker or B8 claim.

- [x] **2b.7** Replace obsolete fixture-only guidance with mode-aware actions — live card guide describes passkey restore/create and optional sealed saves; actual source, quote, fixed-range, fill and manual-exit boundaries are explicit. Fixture simulation remains opt-in and distinct. Native live guide inspected; assembled verify web556/SDK153/worker133, build and Foundry17/snapshot passed.

- [x] **2b.8** Unscaled RULE BOOK/GUIDE and concise modal navigation — native Edge launcher119x44 desktop and91x44 phone; card guide defaults to current actions with no key table. Controls opens on demand; Enter stays on/card, Escape restores launcher focus and H reopens the default section. Native dialog/input-lock regressions and assembled verify556/153/133, build, Foundry17/snapshot passed.

- [x] **2b.9** Preserve native portrait controls with city/header framing — actual Edge phone screen372x643 at412x915 and320x388 at360x640, all page widths within viewport. GUIDE stays above the shell, not over game actions; desktop retains480x320 screen. Screenshots inspected with Departure Mono. Assembled verify556/153/133, build, Foundry17/snapshot passed; no physical-device claim.

- [x] **2b.10** Refine the existing landing rather than rebrand — actual landing renders1280x800/768x1024/412x915/360x640 showed no horizontal overflow. A short-phone wrapped CTA was corrected to285.625x64 with16px label; final screenshot inspected. Native PRESS START reached/play. Copy/assets/start behavior preserved; assembled verify556/153/133, final build, Foundry17/snapshot passed.

- [x] **2b.11** Enlarge desktop play adaptively without changing phones — integer-first fitting left desktop at1x despite extra room. Actual rendered scale now1.219x at1440x900 and1.472x at1920x1080, retaining the480x320 logical grid. Nine viewport checks passed shell containment, page width and GUIDE clearance; near-square desktops reserve an unscaled header lane. Phone412x915 and360x640 shell/screen rectangles exactly match baseline, with native transforms and no zoom controls. Actual-font screenshots inspected; START navigation, guide open/close and focus return exercised. This is rendered browser proof, not additional physical-device acceptance.

- [x] **2b.12** Repair populated and receipt-rich live layouts — pre-fix actual desktop/short-phone rows spilled title and SCORE/DAMAGE outside card borders; keyboard-selected disk3 remained below the list. Content-sized nonshrinking rows, compact equal-weight figures and selection scroll passed25 rendered empty/populated/saved/dense/error combinations at1440x900,1920x1080,412x915,412x760 and360x640. Nine actual S6/S7/S8 renders found and corrected a zero-height desktop chart and narrow-phone numeric clipping; final panel/page containment passed with pinned footers. Phone shell/screen rectangles at412x915 and360x640 exactly match baseline. Throwaway states prove layout, not additional chain transactions or physical-device acceptance; screenshots inspected with Departure Mono.
  Checks: `bun run verify` passed556web/153SDK/134worker with typechecks/lint; normal web build, Foundry17 and gas snapshot passed. The first combined runner timed out after web/SDK success; all22 worker files then passed explicitly and the final unchanged project command completed successfully. Existing jsdom canvas/scroll warnings remain visible.

- [x] **2b.13** Repair difficulty and funded range review on native phones — one-line gate labels and wrapping symbol values; tier-change cast visibility; concise width copy with explicit clamping limits; quote/errors first with retained exact deposit, fee, minimum-output and separate-transaction details.28 actual setup renders at1440x900,412x915,412x760 and360x640 had no horizontal/screen overflow and retained pinned footers. Existing-margin/no-swap and missing-volatility states rendered; actual tier/quote/error scroll transitions reset to0. Departure Mono phone/desktop screenshots inspected; no phone shell/scale/signing changes.

- [x] **2b.14** Keep the first live price and venue mismatch legible — first single-point series previously drew no line and placed half the sprite beyond the left edge; failing-before/passing-after geometry regression now holds the observed price across the field. Mainnet price, TESTNET book and both ladder endpoints remain visible even when distant edges leave the chart.12 actual live-state renders cover aligned, mismatched and paused sources across desktop/three phones; in-range A jump and Inputs close exercised. No fabricated price sample, fill, SCORE or automatic re-centering.
  Checks for the S22 repair units: final `bun run verify` passed558web/153SDK/134worker, all typechecks and lint; normal frontend build and Foundry17/gas snapshot passed. Targeted funded/price/chain tests passed15. Disposable probes were removed before verification; existing jsdom canvas/scroll warnings remain visible.
  Release proof: commits27a33eb/112c924 were deployed as READY `dpl_AN1dnkUapAn8AGNLvpLaGfjmVBaU` at the unchanged canonical `https://monadboy-play.vercel.app`; anonymous production card/guide rendering and release assets were observed. No repository push or phone passkey/restore acceptance is implied.

- [x] **2b.15** One control strip per screen instead of wrapping footers — the S22 report showed the disk shelf footer plus "START: OPEN proof"/"Disk account" lines eating a quarter of the screen and SET RANGE's footer wrapping into two rows. Boot, card, disk shelves, cartridges, difficulty (and its no-disk fallback), read states, leaderboard and fixture range/editor/inputs/live/results now end in one 20px `KeyHints` strip; every former footer action keeps its console intent (shelf Eject is SELECT, card Eject is SELECT, the disk account link moved into the START view). Global `.screen-footer` rules and the unused PrerequisiteGate are gone; one 12px safe area covers every portrait screen. Headless Chrome 412x915 DPR 2.625 renders of all of them inspected under `.scratch/shell/after1-412-*`; no multi-row legend, overlap or clipped row. Web typecheck and tests pass.

- [x] **2b.16** Make PLAYABLE unmistakable and the empty EASY tracker not a dead end — playable TESTNET pins carry a reticle (a shape, not a colour), the selected pool's card is framed heavier with an inverted PLAYABLE · TESTNET tag, and the cursor opens on the playable pool. An empty tracker keeps the map (every pin outside the shaded pass region) and the honest gate list, and offers A = TRY the nearest looser tier only when that tier's own SDK gates, applied to the same read, admit an executable market (`nextPlayableTier`). Observed on the live worker read at 412x915: EASY 0 passed offers TRY MOYAKI; NORMAL then shows 1 passed. `.scratch/shell/after1-412-tracker-real-*.png` inspected. Web typecheck and tests pass.

- [x] **2b.17** Funded S6/S7/S8 fit a 412x915 phone and say what happened — the S22 report showed SET RANGE/CONFIRM squeezed into a scroll box with a two-row footer and clipped Low/High and "Capped by depth" lines, live range edges vanishing, a four-line-per-step receipt list and a results footer drawn over the receipts. Live edges: `yDomain` now always contains both edges and every sample (regression test fails on the old cap); the field slides its line in whole pixels between 5s samples without inventing prices. S6 reads how much, how wide, the ladder with LOW/HIGH/now, then YOU WILL HOLD with fees; confirming becomes a live step checklist; a run stopped partway is one recovery card with Withdraw as A. S8 shows RUN ABORTED · FUNDS RETURNED when the exit cancelled nothing and nothing filled (`onBook` recorded at exit); real runs keep Unavailable only where totals are unknown. Every funded footer is one `KeyHints` strip. Rendered at 412x915 DPR 2.625 on the dev server against the production worker/indexer with a virtual PRF card (`.scratch/funded/*.png`); a real quote was refused by thin TESTNET ask depth, so confirm/progress/recovery/live/results renders use injected store states over real chain reads. Web typecheck and tests pass.

- [x] **2b.18** Tracker cursor follows a playable pool that arrives late: the cursor was an index chosen once at mount, so a live read that brought the TESTNET pool in after the first paint left the cursor on pool 0, and a refresh that reordered the list moved a cursor the player had placed. The cursor now follows the playable pool until the player moves or opens a pin, then stays pinned to that pool by address. Two rerender regressions in `PoolTracker.test.tsx` (late arrival lands on PLAYABLE; a moved cursor survives a reordered read) fail on the old index cursor; tracker suite 39/39 passes.

- [x] **2b.19** Give the phone screen the GUIDE lane back: portrait phones reserved a 52px header lane above the shell for a fixed GUIDE launcher that sat over the city and competed with the game screen. GUIDE is now a moulded 28px key (44px hit area) docked in the shell's control row beside VOL; desktop keeps the unscaled portal launcher. Rendered in headless Chromium with touch emulation: the screen grows from 372x643 to 372x680 at 412x915 and from 320x388 to 320x432 at 360x640; a tap on the docked key opens the native book and Close returns focus to it (`.scratch/shell-final/before-*` vs `after-*`, inspected). New RuleBook regression proves the docked launcher lives in the shell, still opens the book and does not press START; RuleBook and loop suites 17/17 pass.

- Hosting decision (before deployment) — user selected Vercel frontend and VPS worker/SQLite plus Envio/PostgreSQL/Hasura, with managed PostgreSQL only if measured capacity fails. Initial local restart exposed partial maker basis. Public deployment/access gates are now resolved by6.8/9.1/9.2; B8, B10 and24-hour operational acceptance remain open.

- Container-proxy quota boundary — two red regressions reproduced different clients sharing an unconfigured bridge peer's quota and invalid trust values being accepted. Exact `TRUSTED_PROXY_IP` now permits only Caddy's peer, preserves separate client quotas and rejects other bridge peers/CIDRs/hostnames;22focused worker tests passed. An isolated actual Bun/Hono/SQLite route on the VPS observed Caddy's172.18.0.4 TCP peer: two forwarded clients stored their distinct expected IP hashes; untrusted host peer10.11.4.200 ignored different spoofed headers. All requests refused signing/supply; probe removed. Full assembled verify passed556web/153SDK/134worker and Foundry17/snapshot.

- Production SSR compatibility — Vercel's first direct tracker render returned HTTP200 but logged `serverSsr.isDehydrated is not a function`; React419 switched the boundary to client rendering. Update the SSR bridge to1.167.3 and Query/devtools to its minimum5.102.0 peer requirement. Fresh production deployment READY; direct tracker/leaderboard/card loads rendered at412x915 without new page errors, and the new deployment's error-log query returned no entries. Assembled verify556/153/134, Nitro build and Foundry17/snapshot passed. HTTP200 or client-only tests do not establish successful SSR.

- Target infrastructure proof — only approved Mandate containers stopped; nine unrelated services and data preserved. Bun1.3.14 release checksum verified; filtered frozen production install used44packages. Existing Caddy reused with exact bridge binding/trust, private persistent databases and public read-only GraphQL. Runtime caps and larger one-shot bootstrap avoid blanket pruning or database migration. SQLite integrity and isolated PostgreSQL restore passed; backups remain private on this VPS, not offsite. Default non-Vercel build and actual local preview card render passed; private temporary probes were removed. Deployment is read-only bring-up, not complete judge-play acceptance.

- Deployment-doc review — canonical live link is judge-first; earlier current-tense hosting/access asks now point to observed target proof. Supported-phone S4 uses the user-approved production timing, without closing B8 or weakening restore acceptance. Integration docs distinguish ready public GraphQL from incomplete worker maker basis; spoofed-header reads remain public-only rather than being misreported as all denied.
