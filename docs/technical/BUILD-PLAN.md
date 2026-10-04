# MONADBOY build plan

Phase 1 is docs first: the approved product and integration contracts are written before dependent implementation. This is the live status record, not a claim that planned services or gameplay are already running. **Update status in the same commit as the work.** Keep work units at 50 to 250 changed lines, splitting large documents at heading boundaries.

Labels for network-dependent gates: **[V]** verified source or command, **[I]** inference or intended behavior, **[U]** unresolved with the settling spike. Status vocabulary is `TODO / DOING / DONE / BLOCKED / CUT`; pending work uses the required status token, not prose markers.

## 1. Phases and current status

| Phase | Status | Scope | Completion gate |
|---|---|---|---|
| 0 | DONE | Repo bootstrap, MIT license, ignore rules, forbidden-content guard and small-unit commit discipline | Bootstrap and scoped guard proof recorded |
| 1 | DONE | Research, product/technical/design docs, lessons, root guidance and tracked skills | Every required doc/skill exists; guard clean; each contract address has non-empty code; review against approved spec |
| 2 | DOING | Frontend shell, screens, assets and toolchain with unchanged look and feel | Node-runtime verify passes; keyboard S1..S8 phone-viewport smoke with sprites; screenshots and observed console errors recorded |
| 3 | TODO | Pure `packages/sdk`: typed ABIs, chain/market config, encodings, ladder, SCORE/DAMAGE, seal and Mera derivation | Behavior/boundary tests pass; concrete dependency pins; D-SCORE resolved before Phase 3.4 tests are final |
| 4 | BLOCKED | Funded spikes S1..S5, testnet market deployment, ladder fill, MON budget, passkey devices and indexer | [V] All three ops wallets hold 0 testnet MON as of 2026-10-05 (supplied balance record below); each spike needs pass/fail evidence and documented fallback |
| 5 | BLOCKED | DiskRegistry v2 contract, tests, gas snapshot, deployment and SDK ABI | Foundry tests pass; deployed code non-empty; ABI agrees with output; transaction/address recorded Contract, tests and gas snapshot done; testnet deploy waits on DEPLOYER funding (BLOCKERS B1). |
| 6 | TODO | Hono worker on Bun + SQLite: mirror, sampling, tracker, drip, leaderboard and health | Scoped route/job tests; 10-minute live mirror run; inspect ticks; tracker returns expected markets; fresh drip succeeds and repeated drip refuses |
| 7 | TODO | Real web data and signing S1..S8, leaderboard, PWA, removal of production fixtures | Real-phone create/play/fill/withdraw/restore recording; every product rule reviewed; TESTNET labels; SCORE/DAMAGE parity |
| 8 | TODO | Envio schema/handlers and deployed indexer; worker/web switch to event read model | [U, S5] fresh fill in GraphQL within 10 s; client and leaderboard SCORE agree for the same disk |
| 9 | TODO | VPS/domain deploy, fresh-device rehearsals, evidence, public submission docs | Phone that never saw app works; health green for 24 h; clean-clone verify; final addresses/txs/video/bounty mapping |

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
| S3 | Testnet MON budget | Deployer + bot + drip wallets hold enough MON for bot inventory, target 500+ MON, and 20 player drips | Shrink level sizes via `minSize`; ask Monad for testnet MON | Live mirror and fresh-disk onboarding |
| S4 | Mera on real devices | iPhone Safari + Android Chrome create and restore on the dev tunnel hostname | Document supported authenticators; desktop must use GPM/iCloud/1Password | Passkey onboarding and stateless restore |
| S5 | Envio on testnet | HyperIndex syncs our market events within 10 s | Self-host; else `getLogs` fallback only | S7 indexed fills, S8 history, Envio-driven leaderboard |

**S3 MON budget: filled after spike S3.** [U, S3] Include deployment allowance, bot inventory needed for +/-3% moves in the deployed book, explicit-limit transaction costs and twenty player drips. Do not treat the 500+ MON target as a measured sufficient budget.

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
