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
| 2 — Frontend shell and screens | DOING | 10/21 | Build S1..S8, routes and phone smoke | None |
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
- [ ] **2.1b** Generate TanStack Intent package guidance after install — proof required: `bunx @tanstack/intent@latest install`; record generated mapping for installed packages in AGENTS.md.
- [x] **2.2** Add palette, tokens, font/license, brand and venue-neutral types — proof: `e25ef50`, `814e87d`, `3f3a96a`, `9d3e9e7`.
- [x] **2.3** Add console intents, input store, controls, volume, fit scale and shell — proof: `6f3c1b1`, `02e9494`, `10690c9`, `c73e4d5`, `b25e087`, `e2979de`.
- [x] **2.4** Add pixel UI primitives, motion, selection/data states and grid / money-boundary checks — proof: `2d621d0`, `cb40837`, `a68f5c0`, `fe3a861`, `a7e107c`, `d4c887f`.
- [x] **2.5** Add three mascot sprite sets and source-art tools — proof: `c7c75f3`, `43203db`, `dc5da52`, `e07cd7f`..`e4d3fa8`.
- [x] **2.6** Add difficulty thresholds and market gates — proof: `4a33687`; measured Kuru calibration remains Phase 6 work.
- [x] **2.7** Add scoring, source/freshness envelopes, formatters and SDK-backed range planner — proof: `d521fdb`, `de3147d`, `08ead36`, `35d86e1`, `92e7aac`.
- [x] **2.8** Add game domain, marked fixtures, simulation, map, stepped chart and GOD MODE confirmation — proof: `5dcbb3a`, `d63415e`, `4048c17`, `ec17799`, `e5699f5`, `2dd9f76`, `80ab394`, `8e968b7`, `f70bd98`.
- [ ] **2.9a** S1 MemoryCard screen, INSERT / NEW CARD fixture actions — proof required: keyboard screenshot at 412x915 with reachable selection and visible FIXTURE marker.
- [ ] **2.9b** S2 DiskSelect screen — proof required: 412x915 screenshot and keyboard selection of all three isolated fixture slots.
- [ ] **2.9c** S3 CartridgeSelect screen — proof required: 412x915 screenshot; keyboard opens STAY IN RANGE and preserves locked cartridge state.
- [ ] **2.9d** S4 Difficulty screen — proof required: 412x915 screenshot; difficulty binds mascot and GOD MODE requires typed confirmation.
- [ ] **2.9e** S5 PoolTracker screen — proof required: 412x915 screenshot; gates, selection and fixture source labels remain visible.
- [ ] **2.9f** S6 SetRange screen — proof required: 412x915 screenshot; manual range overrides WIDE/TIGHT and cursor differs from applied state.
- [ ] **2.9g** S7 InRange screen — proof required: 412x915 screenshot; stepped chart, SCORE/DAMAGE, NAD-SENSE and contextual key labels render.
- [ ] **2.9h** S8 Results screen — proof required: 412x915 screenshot; fixture results and return navigation are reachable.
- [x] **2.9i** Session state preserves choices and binds mascot to difficulty — proof: `a62a8d4`.
- [ ] **2.9j** Assemble routes, root and router without absent imports — proof required: `bun run generate-routes`, tracked routeTree.gen.ts and a successful `bun run dev` page load.
- [x] **2.9k** Add console screen-input test harness — proof: `1a74224`; harness existence does not prove screens exist.
- [ ] **2.10** Verify assembled web and walk S1..S8 on phone viewport — proof required: `bun run verify`; `bun run dev`, keyboard walkthrough at 412x915, eight screenshots and observed console output.

**Acceptance**
- Node-runtime verify and guard pass; no imports of absent modules.
- All eight screens render with sprites and unchanged visual constants; fixtures are visibly marked.
- Keyboard / touch selections, no silent 320px clipping, screenshots compared to the earlier version; record any known dev warnings rather than hiding errors.

**Proof to record** Per-area commits and verify output in external PROGRESS; phone screenshots in external handoff `screens/phase2/`. [V] Git lists game/session/planner/style/harness work, but no screen or route files; Phase 2 is DOING, not complete.

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

[V] Supplied ops balance record, checked 2026-10-05: `cast balance --ether <addr> --rpc-url https://testnet-rpc.monad.xyz` returned `0.000000000000000000` for DEPLOYER, BOT and DRIP. This source observation is the zero-MON blocker, not a repeated funding check. The roles are separate; no wallet address or secret is needed in this status record. Fund DEPLOYER for deployment, BOT for inventory and DRIP for player supply before dependent broadcasts. [V] Public testnet funding entry point: [Monad faucet](https://faucet.monad.xyz/) ([network facts](https://docs.monad.xyz/ai/current-facts.md)). Request builder supply from Monad if public faucet limits cannot cover S3.

## 2. Dependency order

Phase 2 visual/toolchain work and Phase 3 pure SDK work can proceed while Phase 4 is blocked. Funded spikes need chain configs/ABIs/encodings from Phase 3; start them as soon as funding exists, without claiming untested semantics. Phase 5 contract work does not require completed mirror deployment, but its broadcast needs funded deployment capacity.

Phase 6 worker aggregation uses the `FillSource` interface with direct logs before Phase 8; Phase 8 switches to Envio without duplicating scoring. Phase 7's full gameplay proof depends on S1/S2/S3, deployed registry, worker and passkey support. Direct logs preserve live play during indexer outages; they do not replace the S5 evidence gate for a successful Envio integration.

Shared names are fixed: `planLadder`, `batchProvisionArgs`, `scoreCard`, `rangeState`, `deriveSealKey`, `sealDisk`, `openDisk`, `diskAddresses`, `FillSource`, `decideMirrorAction`.

## 3. Spike go / no-go gates

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

## 4. Phase evidence contract

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

## 5. Cut ladder

Cut in this exact order, recording the decision and affected phase status in the same commit:

1. Nansen.
2. AUSD-USDC second market.
3. Leaderboard windows beyond 24h.
4. GOD MODE polish.

**Never cut:** a real flip fill on camera, the stateless memory-card restore. Cutting GOD MODE polish never disables the honeypot/unsellable gate. Cutting the second market leaves EASY on MON-AUSD with WIDE default. No cut substitutes fixtures for real fills or creates a server-dependent memory card.

A market/funding fallback is not a feature-completion claim. Maintain exact deployed configuration, supply assumptions and gate evidence. [U, organizer clarification during S4] Agora mobile-web/PWA qualification and requirement text remain unresolved; do not make an unverified bounty claim.

## 6. Open decisions

D-SCORE: display of NET > SCORE surplus (DAMAGE clamps at 0, identity breaks). Owner: user. Needed before Phase 3.4 tests are final.

Keep `DAMAGE = max(0, SCORE - (V_now - V_hodl))` and `NET = V_now - V_hodl`. The identity `NET = SCORE - DAMAGE` is exact only when `NET <= SCORE`; that condition is expected for a two-sided ladder [I], not universally proven. For `NET > SCORE`, DAMAGE is zero and the surplus needs an explicit display decision. Do not alter the approved DAMAGE clamp or hide surplus with a fake NET.

## 7. Submission readiness

Phase 9 fills README evidence slots with real deployed addresses/transaction hashes, a <=3-minute video, screenshots/GIF and bounty requirement -> code path -> timestamp mapping. Public repository, MIT licensing and AI-tool disclosure remain required delivery checks. The app and worker stay online through Metropolis judging, 14 to 27 October.

Production deploy needs the user's VPS access and fixed domain/subdomain; optional provider credentials are not grounds to block public-RPC development. Never commit secrets. Contract address evidence uses `cast code <addr> --rpc-url <rpc>` with non-empty output on the intended chain; complete commands and code byte lengths live in SMART-CONTRACTS.
