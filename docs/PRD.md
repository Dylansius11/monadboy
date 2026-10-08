# MONADBOY product requirements

This document owns the product: what the player does, why it matters, and what counts as honest play.
Architecture, chain surfaces, deployment evidence, and visual tokens have their own documents.
The approved SPEC governs scope; this document turns its decisions into player-facing requirements.

## 1. The product and its audience

**MONADBOY** is a handheld game console where your liquidity is the game.
Its first cartridge is **STAY IN RANGE**.
Pick a Monanimal, set your range, and your character runs while your position can earn realized spread.
**The handheld that plays your liquidity.**

Every playable position is on testnet. No real money is moved by the app.
Mainnet contributes read-only market information, not a spending destination.
A TESTNET marker accompanies every balance, including previews, live play, results, and rankings.

The primary player has tried swapping but has bounced off liquidity interfaces.
The secondary player accepts risk but does not want screening to become a research project.
Professional market-making controls are not the default experience.
The console replaces a front-loaded vocabulary exam with a small number of legible actions.

The problem is not just that liquidity provision is complicated.
Screening, selecting a range, understanding inventory, and checking losses arrive before the first useful feedback.
A beginner can leave before doing the action that would teach the mechanic.
An inviting interface lowers that first barrier; inspectable numbers keep it from becoming another barrier later.

The handheld metaphor is functional, not decorative.
A memory card owns progress. A save disk isolates a strategy. Difficulty determines which markets pass checks.
The ground is the selected price ladder. Sitting means the mid has left that ladder.
The costume must never change what the underlying number means.

There is no promise that a running character guarantees a fill.
Available liquidity, taker activity, and order priority still matter [V: Kuru flip-order documentation](https://docs.kuru.io/concepts/flip-orders).
The game makes market-making understandable, not profitable by assertion.

## 2. Names, vocabulary, and twelve rules

Names live as tokens in `apps/web/src/config/brand.ts` (the web-local path is `src/config/brand.ts`).
Product names in application copy resolve through that file rather than scattered literals.

| Token          | Value                                   | Meaning                        |
| -------------- | --------------------------------------- | ------------------------------ |
| `CONSOLE_NAME` | MONADBOY                                | The handheld platform          |
| `CARTRIDGE_01` | STAY IN RANGE                           | The playable range cartridge   |
| `ALERT_NAME`   | NAD-SENSE                               | Edge warning, not a prediction |
| `TAGLINE`      | The handheld that plays your liquidity. | Product tagline                |

### Vocabulary map

| DeFi             | MONADBOY                                      | Implementation intent                                                                                           |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Connect wallet   | INSERT MEMORY CARD                            | Mera passkey ceremony                                                                                           |
| Account          | Memory Card                                   | 32-byte passkey PRF output [V: Mera guide](https://docs.monad.xyz/guides/mera)                                  |
| Portfolio        | SAVE DISK, three slots                        | BIP-44 account indexes 1 through 3, isolated EOAs [V: derivation mechanism](https://docs.monad.xyz/guides/mera) |
| Risk profile     | DIFFICULTY                                    | EASY Molandak, NORMAL Moyaki, HARD Mouch; GOD MODE modifier                                                     |
| Screening        | done by difficulty                            | Hard gates, then SAFETY and HEAT                                                                                |
| Pool discovery   | POOL TRACKER                                  | SAFETY x HEAT scatter of Kuru mainnet markets                                                                   |
| Price range      | the ground the character stands on            | Ladder of flip-order pairs                                                                                      |
| In range         | character runs, SCORE ticks on eligible fills | Mid inside the ladder                                                                                           |
| Out of range     | character sits, counter freezes               | Mid outside the ladder                                                                                          |
| Near the edge    | NAD-SENSE                                     | Mid within one step of an edge                                                                                  |
| Impermanent loss | DAMAGE                                        | HODL-relative accounting in section 7                                                                           |
| Fees earned      | SCORE                                         | Realized flip spread, not projected yield                                                                       |
| Auto rebalance   | AUTOPILOT                                     | Native flip re-arming; manual re-centering has a visible cost                                                   |
| Tick / bin step  | never shown                                   | Width and step are one coupled control                                                                          |

The primary account flow uses INSERT CARD and NEW CARD.
Words such as wallet, connect, seed phrase, and gas do not appear in its player copy.
Proof views can show transaction links and formulas without turning the primary flow into a terminal.

### Twelve non-negotiable rules

1. Never claim a prediction. Range advice is arithmetic.
2. Never hide a loss. DAMAGE has the same visual weight as SCORE everywhere SCORE appears.
3. Never let a model block a number. No AI belongs in a number's critical path.
4. Width and step are one coupled control. Raw tick or step is never exposed.
5. The honeypot / unsellable gate is never disabled, including GOD MODE.
6. No Marvel or Nintendo IP. NAD-SENSE borrows a feeling, not a mark.
7. No em-dashes in user-facing copy.
8. Names are tokens in `src/config/brand.ts` within the web app.
9. Verify every onchain address with `eth_getCode` before committing it; use `cast code` on the right chain.
10. Landscape 480x320 logical grid, native portrait phone layout, 4px snap and integer pixelated sprites. Game UI is DOM/CSS and stepped SVG; decorative scenery outside the screen may use canvas.
11. Every number on screen has a source the player can open.
12. Label testnet on every balance screen. Never imply real money.

## 3. Difficulty is a teaching mechanism

### Mascot binding: Path A

The mascot is bound to difficulty.
Molandak is EASY, Moyaki is NORMAL, and Mouch is HARD.
GOD MODE modifies HARD; it does not introduce a fourth character.

| Difficulty | Monanimal                              | Teaching role                                  |
| ---------- | -------------------------------------- | ---------------------------------------------- |
| EASY       | Molandak, armoured purple hedgehog     | Fewer things can hurt you                      |
| NORMAL     | Moyaki, purple cat-fish with pink fins | Balanced exposure, riding the current          |
| HARD       | Mouch, purple fly                      | More volatile conditions, fewer comfort checks |
| GOD MODE   | Mouch, red palette and skull           | Explicit absence of comfort filters            |

Binding makes the character itself the risk profile.
A player who identifies with Molandak has learned the safety preference without a risk questionnaire.
Decoupling would turn that teaching mechanism back into two unrelated settings.
Three meaningful combinations also keep art, audio, and copy coherent.
Palette expression may change without changing difficulty.

### Deterministic, inspectable scoring

SAFETY and HEAT are transparent heuristics, not a model's judgement.
An unexplainable oracle would relocate the fear rather than remove it.
Latency, nondeterminism, or a model outage must not prevent a price, formula, or range from appearing.
No narrator expansion is required for this cartridge.
Existing character copy is enough; numbers come from arithmetic and identified sources.

### Two axes: SAFETY x HEAT

Do not collapse the signals into one quality score.
EASY means high SAFETY and limited HEAT, not simply a high aggregate number.
A quiet, deep market and a volatile, deep market should remain visibly different.
One blended score can obscure that difference.

The tracker, tier filter, and scatter are the same model seen three ways.
SAFETY is the horizontal axis; HEAT is the vertical axis.
Each input is normalized to 0 through 100 before weighting.
Weights sum to 1 on each axis.

```text
SAFETY = 0.35 * liquidity_depth
       + 0.25 * market_age
       + 0.20 * quote_asset_quality
       + 0.20 * (100 - maker_concentration)

HEAT   = 0.45 * realized_volatility
       + 0.30 * turnover
       + 0.25 * momentum
```

Depth means L2 book liquidity within +/-2% of mid, not an AMM balance.
Market age uses the first Trade block.
Concentration uses the top three makers' share of 24-hour Trade volume.
Volatility uses log returns of 24-hour Trade prices.
Momentum means 24-hour trade-count acceleration, not social scraping.
These are planned worker snapshot inputs; their complete live acquisition is [U], settled by S2 event / book validation and Phase 6 snapshot measurement.

Turnover is 24-hour volume divided by depth and is banded, not monotonic.
The score peaks around 0.5x through 3x, falling on both sides.
More activity per unit of depth is not always better; extreme turnover can be manipulation or shallow liquidity.
The formula must not reward the very condition its filter is intended to expose.

### Gates first, scores second

Hard gates decide eligibility. Scores rank only survivors.
Thresholds live in `apps/web/src/config/thresholds.ts` and are re-measured against the Kuru snapshot in Phase 6.
The depth floors below retain the tier shape; they are calibration targets, not verified liquidity measurements.

| Tier     | Required gates                                                  | SAFETY        | HEAT          |
| -------- | --------------------------------------------------------------- | ------------- | ------------- |
| EASY     | depth >= $250k; age >= 14d; strong quote; unsellable gate clean | >= 70         | <= 60         |
| NORMAL   | depth >= $75k; age >= 3d; strong or mid quote; gate clean       | >= 50         | <= 80         |
| HARD     | depth >= $20k; age >= 6h; strong or mid quote; gate clean       | >= 30         | <= 100        |
| GOD MODE | unsellable gate clean, nothing else                             | raw, unranked | raw, unranked |

Strong quotes are `{USDC, AUSD, MON}`.
Mid quotes are `{WETH, WBTC, cbBTC, XAUT}`.
HARD still restricts the quote asset.
The quote sets express product policy, not a guarantee about any token.
The unsellable gate uses token transfer simulation via `eth_call`; adequacy on supported markets is [U], confirmed in S2 and Phase 6 gate validation.
An empty book is thin, not an exception and not a reassuring midpoint.

### GOD MODE

GOD MODE removes comfort filters, never the unsellable gate.
Sending a player into an asset they cannot exit is negligence, not an edgy difficulty.
Red palette, skull, raw inputs, and an explicit typed confirmation make the missing protections visible.
The confirmation copy is `TYPE "I KNOW" TO CONTINUE`.
No reassurance or forecast accompanies it.

### The credibility rule

Copy says `THESE PASSED MOLANDAK'S CHECKS`.
Copy does not say that a market will make money.
A heuristic describes present measurements and policy, never future returns.
Every score term has an inspectable input, timestamp, unit, formula, and source.
If an input is missing, its absence is shown rather than hidden inside a plausible number.

## 4. Testnet market and real-data boundaries

The playable venue is Kuru flip orders on our MON-AUSD testnet market.
Mainnet markets supply read-only tracker measurements.
Only a market with an entry in `packages/sdk/src/markets.testnet.json` can start a run.
All other pins say MAINNET ONLY and remain useful for inspection.

Monad testnet is chain 10143 and mainnet is chain 143 [V: current facts](https://docs.monad.xyz/ai/current-facts.md).
The testnet RPC is `https://testnet-rpc.monad.xyz`; the mainnet RPC is `https://rpc.monad.xyz` [V: same source](https://docs.monad.xyz/ai/current-facts.md).
Deployed app addresses and transaction evidence live in README and the smart-contract document, not scattered across screens.

The mirror bot targets mainnet MON_USDC, not MON_AUSD.
The approved source choice reflects an empty MON_AUSD book; current source liveness remains [U], verified in S2 / Phase 6 before dependent play.
The primary label is `TESTNET BOOK, MAINNET PRICE (KURU MON/USDC)`.
Treating USDC and AUSD as one USD each is an explicit conversion assumption [I], not measured parity.

The worker reads the source every 5 seconds.
When relative deviation exceeds 0.05%, the planned bot trades toward the source, within its configured notional cap.
Thin resting quotes refresh at target +/-0.1% to support the zap.
Three consecutive transport/read failures pause the bot. An empty, crossed, or source book wider than `(ask - bid) / mid > 2%` pauses immediately; a valid tight book resumes sampling. The 2% maximum is a user-approved operator policy [I], not measured market calibration.
Health turns red and the screen says PRICE FEED PAUSED. No last-trade substitution or invented replacement price is used.
Low bot inventory turns health amber.
The exact execution surface and successful bot behavior are [U], settled by S2 and the Phase 6 mirror smoke.

AUSD testnet token and faucet have deployed code [V: README cast checks, 2026-10-05].
That does not prove funding is currently obtainable.
Faucet cadence and usable supply remain [U], spike S1.
Testnet MON budget remains [U], spike S3.
An optional AUSD-USDC EASY market depends on S1 finding a usable USDC source.
Otherwise EASY plays MON-AUSD with a WIDE default and the interface says so.
The official testnet MON-USDC market is the venue fallback, with liquidity checked before use [U: S1/S2].

The frontend signs for the disk. The worker never signs for a player.
Chain state is truth; Envio and SQLite are read models.
Envio HyperIndex is intended to drive the fill feed, results history, and leaderboard.
Hosted testnet indexing and lag remain [U], spike S5.
A viem read of the last 200 blocks of Trade logs is the live-screen fallback; its decoding is [U], spike S2.
When that fallback is active, show INDEXER OFFLINE rather than implying the service is healthy.

## 5. Memory card and three save disks

The card is a Mera passkey, not an account held by a service.
Face ID, Touch ID, or a supported security key begins the ceremony [V: Mera guide](https://docs.monad.xyz/guides/mera).
The same passkey reproduces account keys through its PRF output [V: same guide](https://docs.monad.xyz/guides/mera).
Real iPhone Safari and Android Chrome creation / restore remain [U], spike S4.

NEW CARD invokes `createPasskeyWithPrfOutput`.
INSERT CARD invokes `getPasskeyPrfOutput`.
Without stored credential metadata, discoverable mode can select the passkey [V: Mera guide](https://docs.monad.xyz/guides/mera).
Only credential identifiers and transports may live in localStorage, never secret key material.
The production hostname is fixed before the first real card: passkeys bind to `rpId` [V: same guide](https://docs.monad.xyz/guides/mera).

The card serial uses account index 0 for display.
Disk slots 1, 2, and 3 use the matching derivation indexes and isolated signing sessions.
Hold the session while the console is on; end it on eject, explicit EJECT CARD, or tab hiding longer than ten minutes.
Desktop Chrome local-profile passkeys may return PRF_UNAVAILABLE [V: Mera guide](https://docs.monad.xyz/guides/mera).
Copy explains the supported reader, not an unexplained cryptography failure.

Each disk has a separate seal key as well as an account key.
`deriveSealKey` uses HKDF-SHA256 with salt `monadboy/v1` and info `disk:{k}:seal`.
`sealDisk` encrypts with a non-extractable AES-GCM-256 WebCrypto key.
`openDisk` restores the plaintext only in the browser.
AAD binds chain ID, registry address, and disk address.
The blob is version byte 0x01, a 12-byte IV, and ciphertext with authentication tag.
Plaintext is capped at 1,536 bytes; oldest runs are removed first, with at most the last ten retained.

Private fields include name, character, palette, difficulty, GOD MODE, notes, creation time, and recent runs.
DiskRegistry v2 stores ciphertext keyed by the disk account.
It has no funds, administrator, or custody role in the product design.
`diskAddresses` derives all three disk addresses, then the browser reads and decrypts their registry records.
Restore requires no application server and no localStorage history.

SAVED TO CARD appears only after a save transaction confirms.
OPEN reveals the ciphertext hash and explorer link, not the plaintext in a server request.
A fresh disk requests MON and AUSD from the worker drip.
Drip guards require a fresh address, enforce per-IP and daily caps, and keep an operational ledger.
Funding availability is [U], S1 and S3, never a silently simulated success.

The decisive demo is clearing site data or using another phone, inserting the same card, and recovering disks.
It demonstrates ownership and the non-wallet use of passkey-derived material in one understandable moment.

## 6. Range control and entry

The player controls three things, not an order-book parameter sheet:

1. Amount, one number in AUSD.
2. WIDE or TIGHT.
3. An advanced manual range behind a toggle, never the default.

Manual range overrides the WIDE / TIGHT preset when enabled.
AUTOPILOT means native re-arming after fills [V: Kuru flip orders](https://docs.kuru.io/concepts/flip-orders).
It is not an automatic re-centering service or a discretionary user-key bot.

### Arithmetic, not intelligence

The shared SDK owns `planLadder` and `batchProvisionArgs`.
Inputs are mid, mode, quote budget, daily realized volatility, and market precision / size parameters.
Advice is derived from observed volatility, not predicted prices.

```text
halfWidth = clamp(k * sigmaDaily * sqrt(horizonDays), 0.5%, 20%)
k = 1.0 for TIGHT; 2.5 for WIDE; horizonDays = 1
step = smallest s in {0.10%, 0.25%, 0.50%, 1.00%, 2.00%}
       with ceil(halfWidth / s) <= 8
levels = ceil(halfWidth / step), clamped to 2..8 per side
quotePerLevel = budgetQuote / (2 * levels)
```

Buy prices round down to ticks; their flip prices round up and are strictly higher.
Sell prices round up; their flip prices round down and are strictly lower.
Buy size is quotePerLevel / buy price, rounded down to size precision.
Sell size is quotePerLevel / mid, rounded down, funded by the zap.
If a size is below minimum, drop the outermost pair and recompute.
If fewer than two levels survive, show AMOUNT TOO SMALL FOR THIS RANGE.
If width shrinks, report the clamped result rather than hiding it.

The output includes step, levels, low, high, orders, baseNeeded, quoteNeeded, and clamped.
Encoding uses integer price * pricePrecision and base size * sizePrecision.
[V, S2] Tick-compatible batch encodings and `provisionOrRevert` succeeded on our deployed testnet book; the observed-order regression pins their units. See [SMART-CONTRACTS](technical/SMART-CONTRACTS.md) for receipts and parameters.
A planned batch is one whole ladder. Single-order fallback remains unnecessary for the verified batch path.

### What the entry costs

The deposit split is visible before confirm.
A single AUSD amount needs some MON inventory for sell levels, so the zap is necessary, not cosmetic.
S6 shows quoted base and quote, slippage, taker fee, and transaction cost.
[V, S2] Our deployed market has taker 30 bps and maker 0, independently read back from `getMarketParams`.
Minimum size is 1.5 MON; its AUSD equivalent varies with price. Deployment parameters and receipt-backed gas measurements live in [SMART-CONTRACTS](technical/SMART-CONTRACTS.md).

The approved sequence is allowance / approval, quote deposit, margin zap, ladder provision, then sealed save.
Each stage has its own loading progress and transaction link.
[V, S2] `isMargin=true` debits and credits MarginAccount, so quote must be deposited before the zap. Bought MON remains in margin for sell-level provisioning; approval alone is insufficient.
All transaction calls pass explicit gas because Monad charges the declared limit [V: gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).
For an undelegated low-balance account, the emptying exception requires no other sender transaction in the prior three blocks [V: reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance).
Sequence by blocks, not a guessed time delay.

A failed stage leaves an honest view of funds in the disk or MarginAccount.
WITHDRAW remains available; sealing must not block play.
No successful-looking animation may substitute for a receipt.

## 7. Live accounting and exit

### SCORE, DAMAGE, NET

`scoreCard` owns the inspectable shared accounting.
SCORE is realized flip spread, never negative.
Count maker fills only for orders whose IDs came from FlippedOrderCreated.
Initial-order fills change inventory only.
[V, S2] `Trade.isBuy` describes the taker; maker accounting inverts it. Partial fills can leave both linked flip members active. Only flipped-origin fills realize SCORE; initial fills change inventory.

```text
SCORE = sum(|flipPrice - price| * filledSize) over eligible flipped-order maker fills
V_hodl = base0 * currentMid + quote0
V_now = (marginBase + base in resting sells) * currentMid
        + marginQuote + quote in resting buys
DAMAGE = max(0, SCORE - (V_now - V_hodl))
NET = V_now - V_hodl
```

The exact identity is `NET = SCORE - DAMAGE = V_now - V_hodl` whenever NET <= SCORE.
NET = V_now - V_hodl always; NET = SCORE - DAMAGE holds exactly whenever NET <= SCORE (the expected case for a two-sided ladder [I]).
If NET > SCORE, DAMAGE is 0 and NET exceeds SCORE; how to display that surplus is an open product decision (see `docs/technical/BUILD-PLAN.md`).
Do not erase the surplus or change the approved DAMAGE clamp to make the display look consistent.

SCORE and DAMAGE have identical visual weight wherever either score presentation appears.
NET is the comparison with holding the starting inventory at the same current mid, not total portfolio value.
Show formula inputs, unit conversions, valuation timestamp, fill transactions, and inventory source.
Inventory must not be counted both in margin balances and resting orders.
Each eligible SCORE increment triggers a coin sound and pixel pop, not a synthetic time-based accrual.

### Range state and re-centering

`rangeState` uses inclusive low <= mid <= high.
TIME IN RANGE counts seconds inside that interval.
The client clock supports live play; worker samples support the leaderboard.
NAD-SENSE fires within one step of either edge.
Outside the ladder the character sits and the visible counter freezes.
Delayed indexing can reveal earlier fills; attribution retains their actual chain time.

RE-CENTER is manual: cancel, withdraw, replan, and provision.
It shows estimated taker fee on the zap plus transaction cost before confirmation.
Changing inventory can crystallize a loss; another ladder is not a free reset.
The game must not incentivize churn by disguising that cost.

### Exit and results

Exit cancels all flip-order IDs, then withdraws maximum native MON and AUSD from MarginAccount.
The planned methods are `batchCancelFlipOrders` and `batchWithdrawMaxTokens`; live success is [U], spike S2.
Results show SCORE, DAMAGE, NET, fill count, and time in range with source / transaction links.
Append the run to the sealed disk, confirm the save, then display SAVED TO CARD.
A save failure does not undo a withdrawal or pretend the results disappeared.

## 8. Screen requirements

Every reachable control has a visible selection state.
Cursor location and the applied value are different states.
The shell owns the key legend; context-sensitive labels rewrite themselves for the current action.
The console shell never knows about money.
One flex region absorbs remaining height. On short portrait phones, dense settings scroll within the screen while action footers stay visible.
Every balance surface carries TESTNET, including modal and proof variants.

### Presentation and production data

Preserve the existing laptop clamshell, pixel UI primitives, palette, sprites, fonts, motion, and key legend in look and feel.
Connecting real data changes sources and copy, not the chosen visual language.
The user-approved phone adaptation uses native portrait dimensions, readable type and compact physical controls rather than scaling the laptop shell.
Each screen reflows its content: character selection, pool map, range settings, price field and results.
The night-city backdrop is decorative, not a source of market activity or player accounting.
The web app is a portrait, standalone PWA with a web manifest and icons from the existing logo assets.
Native app-store publication is outside scope; mobile-web bounty eligibility remains an organizer decision.

Production screens use real worker snapshots, chain state, and indexed fills, never substitute fixtures.
Fixture fallback is restricted to tests and an explicit dev-only flag.
Any fixture displayed on screen carries a visible FIXTURE marker, including failure and preview surfaces.
The data adapter does not turn a live-source failure into an unmarked plausible number.

| Screen                | Purpose                         | Required content and actions                                                                                                                         |
| --------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 Boot               | Establish the console           | Logo, skippable boot after first view, sound respecting mute                                                                                         |
| S1 Insert Memory Card | Create or restore identity      | INSERT CARD, NEW CARD, passkey reader errors, eject; no account jargon                                                                               |
| S2 Save Disk select   | Choose isolated progress        | Three slots, name, character, last play, results with equal SCORE/DAMAGE, empty state, create, OPEN proof, SAVED TO CARD                             |
| S3 Cartridge select   | Choose activity                 | STAY IN RANGE, locked COMING SOON slot, Gallery and Leaderboard access                                                                               |
| S4 Difficulty         | Choose the teaching profile     | Bound animated mascots, plain-language tier, count of survivors, HARD GOD MODE gate                                                                  |
| S5 Pool Tracker       | Inspect and choose a market     | SAFETY x HEAT, pin shape and selection, source timestamp, gate boundary, raw inputs, PLAYABLE (TESTNET) / MAINNET ONLY                               |
| S6 Set Range          | Understand inventory and cost   | AUSD amount, WIDE/TIGHT, advanced manual override, stepped chart, pixel level tiles, base/quote preview, slippage and cost, staged transaction links |
| S7 In Range           | Watch real position state       | Monanimal, mid and ladder, fill feed, equal SCORE/DAMAGE, NET, NAD-SENSE, sit, RE-CENTER, WITHDRAW, health / indexer markers                         |
| S8 Results            | Understand the outcome          | Equal SCORE/DAMAGE, NET, fills, time in range, evidence links, confirmed save, return path                                                           |
| Gallery               | Inspect the cast and expression | Monanimal sprite presentation, names, palettes; expression does not change difficulty                                                                |
| Leaderboard           | Compare measured runs           | Disk tag, character, equal SCORE/DAMAGE, NET, fills, time in range, last-fill link, TESTNET and computation timestamp                                |

### Screen-specific honesty

S4 survivor counts use the same snapshot as S5, not a separate optimistic count.
S5 mainnet-only pins can be inspected but cannot progress into entry.
S6 draws the same range and levels that the transaction planner encodes.
S7 marks a paused price feed instead of advancing a fabricated midpoint.
S8 derives outcome from fills and holdings, never an editable onchain score.
Leaderboard rankings are derived from Kuru fills, not self-reported disk metadata.
Windows are 24h, 7d, and all; extra windows may be cut, not replaced with invented rows.

### Sources the player can open

| Visible number   | Input-to-pixel chain                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| SAFETY / HEAT    | mainnet book + Trade observations -> worker snapshot -> gates and weighted axes -> pin / breakdown      |
| Range low / high | source mid + volatility + budget + market params -> planLadder -> S6 tiles                              |
| SCORE            | Kuru maker Trade + flipped-order lineage -> FillSource -> scoreCard -> coin / total                     |
| DAMAGE / NET     | starting inventory + current mid + margin / resting inventory + SCORE -> scoreCard -> equal-weight card |
| TIME IN RANGE    | low/high + timestamped mids -> rangeState -> client timer or worker sample aggregation                  |
| Save proof       | sealed blob -> registry receipt -> ciphertext hash / explorer link                                      |

These chains are implementation requirements, not claims that live integrations are complete.
`FillSource` abstracts Envio and direct logs without changing the SCORE rule.
`decideMirrorAction` keeps mirror decisions explicit and inspectable.
No cache becomes the authority just because it is faster to read.

## 9. Success, scope, and roadmap

A first-time player should understand the ground-and-running mechanic within ten seconds without narration.
The demo must include a real testnet flip fill, a legible sit moment, a formula view, and passkey-only disk restore.
A builder asking where a number comes from must be able to follow the full source chain.
A phone review checks density, spacing, selection states, and legibility at a 412px viewport.
Runtime proof belongs beside implementation; a documentation promise is not a passed scenario.

The submission includes a public MIT repository, a technical demo no longer than three minutes, a separate team/problem pitch no longer than two minutes, a logo/graphic no larger than 3 MB, live product access and chain evidence [V: authenticated track deliverables, 2026-10-08](https://hackathon.monad.xyz/tracks/onchain-finance). [SUBMISSIONS](SUBMISSIONS.md) owns packaging, verified bounty requirements and organizer questions; Agora is skipped because it requires Perpl.
Metropolis submission deadline: 13 October 2026, 11:59 PM ET, equivalent to 14 October 03:59 UTC / 10:59 WIB [V: Rules v3.0 §4.2, opened from the authenticated dashboard](https://hackathon.monad.xyz/dashboard).

### Build priorities

Docs and the design system precede screens and live integration.
Prove supply, flip semantics, MON budget, real-device passkeys, and indexing before dependent behavior relies on them.
S1 through S5 and deployment evidence are tracked in `docs/technical/BUILD-PLAN.md`.
A real on-camera flip fill and the stateless memory-card restore are never cut.

### Explicitly outside this build

No mainnet spending, native app-store release, custody backend, or second-cartridge gameplay.
No AI in prices, ranking, range advice, or valuation.
No new narrator voice system; existing character copy is sufficient.
Nansen is a stretch, not a dependency.
No predicted-return ranking or custom distribution sheet for the default player.

### Roadmap

- Deliver testnet STAY IN RANGE with real flips, transparent accounting, and sealed card restore.
- Harden phone readability, reduced motion, glyph coverage, and source inspection.
- Re-measure thresholds against actual tracker snapshots and audit inventory / fill accounting.
- Keep mainnet read-only; any real-money scope requires a separate approved product and safety decision.
- Keep a locked COMING SOON slot without promising an unapproved game.
  CARTRIDGE_02: open, brainstorm pending
