# MONADBOY integrations

This document owns external boundaries and their failure ladders. **[V]** means verified with a linked source or command, **[I]** means inference or planned use, **[U]** means unresolved with the settling spike. Planned UI copy below is literal console copy, not a claim that the UI is implemented. All balance surfaces say "TESTNET"; no player signing happens on mainnet.

## 1. Boundary inventory

| Boundary | Planned use | Evidence / unresolved dependency |
|---|---|---|
| Kuru testnet | Our MON-AUSD flip ladder, native re-arm, manual re-center and exit | [V] Required ABI/code evidence in [SMART-CONTRACTS](SMART-CONTRACTS.md); [U, S2] deploy, encodings and funded fills |
| Kuru mainnet reads | Pool Tracker market depth, age, concentration, volatility and source MON_USDC midpoint | [I] Read-only use; [V] Kuru [OrderBook](https://docs.kuru.io/contracts/OrderBook) and [market API](https://exchange.kuru.io/api/v3/exchangeInfo); live ABI is authoritative over prose |
| Mera | Passkey PRF, per-disk EOAs and signing sessions | [V] [Mera guide](https://docs.monad.xyz/guides/mera); [U, S4] supported real-device create/restore |
| Agora AUSD faucet | Ops top-up of bot/drip AUSD inventories; player receives testnet AUSD via worker | [V] [deployments](https://docs.agora.finance/developer/contract-deployments.md) and code checks; [U, S1] successful request cadence and USDC source |
| Envio HyperIndex | S7 fills, S8 history and leaderboard SCORE from events | [V] [Monad support](https://envio.dev/chains/monad); [U, S5] our testnet sync within 10 s and hosting tier |
| Hono worker on Bun + SQLite | Mid, health, tracker, drip and cached leaderboard | [I] Intended VPS service and endpoint contract, not a deployed service |
| Mainnet RPC | Worker public-client reads only | [V] `https://rpc.monad.xyz`, chain 143 ([network facts](https://docs.monad.xyz/ai/current-facts.md)); provider capacity is not guaranteed |
| DiskRegistry v2 | Save/erase ciphertext; three-slot stateless restore | [I] Contract specified in [SMART-CONTRACTS](SMART-CONTRACTS.md), deployment in Phase 5 |

## 2. Kuru testnet trading ladder

[I] Only markets mapped to a checked testnet deployment are playable. The official MON-USDC testnet market is a fallback, not proof of a funded two-sided book. [U, S2] Test `batchProvisionLiquidity` and a real taker-generated flip before enabling play.

| Failure rung | Exact player copy | Fallback / recovery |
|---|---|---|
| Params unavailable, empty book or execution simulation fails | "MARKET UNAVAILABLE" | Disable confirmation; retain range input; never replace liquidity with fixtures |
| Ladder below minimum after reducing outer levels | "AMOUNT TOO SMALL FOR THIS RANGE" | Let player change amount/range; do not silently change risk |
| Approval, zap, deposit or provision transaction fails | "LOAD FAILED" and "WITHDRAW" | Keep per-step tx links; inspect wallet/margin state; recover accessible funds before retry |
| Batch provision semantics fail S2 gate | "MARKET UNAVAILABLE" until proven | [U, S2] Try single `addFlipBuyOrder` / `addFlipSellOrder` per level; still require observed flip fill |
| Cancellation or withdrawal fails | "WITHDRAW FAILED" | Keep position/receipts visible; retry the failed exit step after reading chain state; no successful-results fiction |

[I] Every confirmation includes the zap taker fee plus explicit transaction cost. WITHDRAW remains available after partial loading. Native flip re-arm is not a worker transaction. RE-CENTER costs cancel + withdraw + replan + provision and needs cost confirmation.

## 3. Kuru mainnet data ladder

[I] Tracker snapshots read all mainnet markets through Kuru data sources every 15 min. SAFETY and HEAT have inspectable input chains. Empty markets score as thin; the honeypot/unsellable gate is never disabled, including GOD MODE.

| Failure rung | Exact player copy | Fallback / recovery |
|---|---|---|
| A listed market has no valid bid/ask | "MAINNET ONLY" for a non-playable pin; "MARKET UNAVAILABLE" when unusable | Render thin/empty stats honestly; no division by sentinel or fabricated midpoint |
| Snapshot refresh fails but prior snapshot exists | "TRACKER STALE" | Keep timestamped last snapshot, distinguish stale from live |
| No usable snapshot exists | "TRACKER OFFLINE" | Keep shell/navigation usable; do not invent pins or bypass safety gates |
| Market has no testnet mirror | "MAINNET ONLY" | Inspect statistics only; starting a position is disabled |

[I] The price mirror reads **mainnet MON_USDC**, not MON_AUSD. Kuru MON_AUSD's approved empty-book observation is documented with chain evidence in [Kuru research](../research/kuru.md); it is not a timeless guarantee about that book. Label every mirrored market "testnet book, mainnet price (Kuru MON/USDC)". Treat USDC and AUSD as 1 USD for the mirror [I]; this is a simplifying assumption, not live peg verification.

## 4. Mera memory-card ladder

[V] Mera requires HTTPS or localhost and PRF-capable authenticators. Desktop Chrome local-profile passkeys can throw `PRF_UNAVAILABLE`; Google Password Manager is the documented desktop Chrome route ([guide](https://docs.monad.xyz/guides/mera), [authenticator support](https://mera.category.xyz/authenticator-support/)). [U, S4] Confirm create/restore on iPhone Safari and Android Chrome and record supported combinations.

| Failure / code | Exact player copy | Fallback / recovery |
|---|---|---|
| `PRF_UNAVAILABLE` | "This card reader can't read your card. Try your phone, or save the passkey to Google Password Manager / iCloud." | Retry on a supported authenticator; no replacement account provider |
| `PASSKEY_OPERATION_FAILED` | "CARD NOT INSERTED" | Offer INSERT CARD again; do not create a new card silently |
| `CRYPTO_UNAVAILABLE` | "CARD READER UNAVAILABLE" | Use HTTPS/localhost; block signing/sealing until crypto is available |
| `SESSION_ENDED` | "INSERT CARD" | Authenticate and derive fresh sessions; do not send with an ended key |
| Fresh device with no credential metadata | "INSERT CARD" | Discoverable authentication, derive slots 1..3, read registry and decrypt locally |
| Blob authentication/decryption fails | "CARD DATA UNREADABLE" | Preserve ciphertext and OPEN proof; do not overwrite with an empty disk |

[V] Passkeys are hostname-bound ([guide](https://docs.monad.xyz/guides/mera)); fix production rpId before real cards. [I] Hold sessions while playing, end on eject or tab hidden over ten minutes. No email/social-provider fallback. Account layer uses Mera exclusively; other embedded-wallet providers are not integrated.

## 5. AUSD / Agora faucet ladder

[V] Token and faucet have non-empty testnet code; exact checks are in [SMART-CONTRACTS](SMART-CONTRACTS.md). [U, S1] `requestFunds(address)` success cadence is unresolved; the approved `MaxFrequencyExceeded()` observation is not evidence of a working drip supply. Never infer Monad mint amounts from Sepolia behavior.

| Failure rung | Exact player copy | Fallback / recovery |
|---|---|---|
| Faucet rate-limit or temporary refusal while treasury has inventory | No interruption to funded play | Ops top-up backs off on `MaxFrequencyExceeded`; worker uses held inventory, never promises an unconfirmed mint |
| Bot/drip inventory below configured thresholds | "TESTNET SUPPLY LOW" | Health amber; inspect balances, refill via faucet only when available |
| Fresh disk drip cannot be funded | "TESTNET SUPPLY UNAVAILABLE" | Keep disk/card accessible; do not enter a position or show imaginary balances |
| S1 cannot obtain AUSD | "MARKET UNAVAILABLE" until fallback funded | Ask Monad/Agora for supply; otherwise official MON-USDC with testnet USDC |
| USDC source unusable for the second market | No separate error required | EASY uses MON-AUSD with WIDE default; AUSD-USDC is cut before core gameplay |

[I] Drip amounts are testnet-only. No fiat redemption, real-money transfer or holder yield promise is part of this integration. Agora mobile-web/PWA bounty qualification and verbatim requirement remain [U, organizer clarification during S4 device spike]; implementation does not claim qualification as fact.

## 6. Envio failure ladder

[I] Index market and registry events using live SDK ABI signatures. `Trade` computes realized spread only for flipped maker fills; leaderboard does not accept disk-submitted scores. [U, S5] Confirm hosted testnet eligibility and <=10 s synchronization; otherwise self-host on the VPS.

| Failure rung | Exact player copy | Fallback / recovery |
|---|---|---|
| GraphQL unreachable | "INDEXER OFFLINE" | S7 reads last 200 blocks of `Trade` via viem `getLogs`; retain observed fills |
| Pipeline lag exceeds expected sync | "INDEXER DELAYED" | Show indexed/observed source age; reconcile from chain rather than generate fills |
| Hosted service fails S5 gate | "INDEXER OFFLINE" during outage | Self-host HyperIndex; if that fails, use `getLogs` fallback only |
| History/cache cannot be refreshed | "HISTORY UNAVAILABLE" or "LEADERBOARD STALE" | Keep explicitly timestamped verified cache where available; no guessed rank or complete totals |

The 200-block fallback is bounded. It cannot prove older history is empty; show unavailable/incomplete history rather than resetting SCORE to zero. `FillSource` lets worker aggregation use indexed fills or direct logs without two scoring definitions.

## 7. Worker failure ladder

[I] Worker JSON endpoints: `/v1/health`, `/v1/mid?market=`, `/v1/tracker`, `/v1/leaderboard?window=24h|7d|all`, `POST /v1/drip {address}`. zod validates every input; CORS is `APP_ORIGIN` only. No route signs a player's transaction.

| Failure rung | Exact player copy | Fallback / recovery |
|---|---|---|
| Health/mid unavailable or mirror paused | "PRICE FEED PAUSED" | Do not invent an advancing target; show source age, keep direct chain exit available |
| Tracker endpoint unavailable | "TRACKER STALE" or "TRACKER OFFLINE" | Timestamped cache if present; otherwise no new tracker selection |
| Leaderboard endpoint unavailable | "LEADERBOARD STALE" or "LEADERBOARD OFFLINE" | Timestamped cache if present; existing positions keep working |
| Drip freshness/quota refusal | "TESTNET SUPPLY LIMIT" | Surface refusal without sending a duplicate funding transaction |
| Whole worker unavailable | "SERVICE OFFLINE" | Mera + registry restore and user-signed cancellation/withdrawal remain independent of worker |

[I] Fresh-disk drip requires nonce 0 and MON below threshold; quota is three per IP hash per 24 h plus global daily cap. SQLite stores the funding ledger, not user keys or plaintext disks. Worker restart-always hosting and `/v1/health` monitoring are planned, not deployed proof.

## 8. Mainnet RPC failure ladder

[V] Mainnet public RPC is `https://rpc.monad.xyz` ([network facts](https://docs.monad.xyz/ai/current-facts.md)). [I] Worker uses a mainnet public client only; optional provider URLs do not change the chain or add mainnet signing.

| Failure rung | Exact player copy | Fallback / recovery |
|---|---|---|
| First or second consecutive source-read failure | "PRICE FEED DELAYED" | Retain last observation with age; no fabricated source or successful mirror tick |
| Three consecutive source-read failures | "PRICE FEED PAUSED" | Bot pauses, health turns red; retry source reads without inventing prices |
| Public provider limited/unavailable | "PRICE FEED PAUSED" while unavailable | [I] Use configured verified alternate RPC; a valid source read is required to resume |

[V] `bestBidAsk` uses 1e18 scaling and the approved empty-book sentinel is `(2^256-1, 0)` (live evidence in [Kuru research](../research/kuru.md)). Reject invalid/empty source reads before averaging; do not use an unrelated market as an undocumented price fallback.

[I, user-approved source policy] Reject empty/crossed source books and relative spread greater than 2% immediately. Keep the prior target only as an aged observation, never an executable fresh replacement. Transport failures retain the three-failure rule. The 2% maximum is an operator limit, not a calibration result; last trade is not substituted for the midpoint.

## 9. Participant resources

Use resources for evidence and reliability, not as new critical dependencies or substitutes for Kuru/Envio. The participant entitlement durations are not asserted here. [U] Claims, quotas, API keys and exact chain coverage must be verified before operational use, at the named spike below; linked provider pages are discovery sources, not proof that our account has access.

| Resource | Intended MONADBOY use | Status and settling check |
|---|---|---|
| QuickNode | Optional testnet/mainnet HTTP or WebSocket RPC for reads and log volume beyond public limits | [I] Optional provider; [U, S2] verify both chain IDs, required RPC methods and account quota; [docs](https://www.quicknode.com/docs/monad) |
| Tenderly | Fork dry runs and traces of flip-ladder deployment/provision/exit before funded broadcast | [I] Debugging only; [U, S2] prove usable Monad fork/simulation and participant entitlement; [announcement](https://tenderly.co/blog/tenderly-supports-monad-from-day-one/) |
| Zerion | Optional external position/transaction cross-check during demo evidence review; not SCORE source | [I] QA aid; [U, S2] verify required testnet/mainnet coverage and access; [chains](https://developers.zerion.io/supported-blockchains) |
| BlockVision | Optional explorer/indexed transaction cross-check for fill and deployment evidence; not private-disk storage | [I] QA aid; [U, S5] verify chain coverage, event fidelity and account limits; [API](https://docs.blockvision.org/reference/monad-indexing-api) |
| Dwellir | Optional alternate read-only mainnet RPC for source/tracker jobs | [I] Provider alternative; [U, S2] verify chain and read methods/quota; [docs](https://www.dwellir.com/docs/monad) |
| Spectrum | Optional RPC/WebSocket alternative for chain reads and fill-observation diagnostics | [I] Provider alternative; [U, S2] verify each needed chain, methods and account limits; [docs](https://spectrumnodes.com/networks/monad-rpc) |

## 10. Save and restore boundary

[I] DiskRegistry v2 stores only public metadata and sealed bytes. Save failure shows "SAVE FAILED" and does not block an already provisioned run. A confirmed save shows "SAVED TO CARD"; OPEN displays ciphertext hash and explorer link. Testnet RPC outage shows "CARD READ UNAVAILABLE" and preserves local transient state without claiming chain confirmation.

Restore must remain passkey -> derived disk addresses -> registry -> browser decrypt, even after clearing site data and with worker/Envio offline. This stateless path and a real flip fill on camera are never cut; see [BUILD-PLAN](BUILD-PLAN.md).

[V, local browser/Anvil smoke 2026-10-06] Three isolated disk saves, matching DiskSaved receipts, profile update and discoverable passkey restore after clearing site data were exercised against an isolated local registry. Physical-phone and funded testnet acceptance remain B1/B8. Preference saves re-read the latest ciphertext and preserve private fields/history; the registry is last-writer-wins across devices, not a compare-and-swap store. A failed read/decryption is never an empty writable slot. Eject/expiry drops decrypted shelf state and invalidates pending operations.
