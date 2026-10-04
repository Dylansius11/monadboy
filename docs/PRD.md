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

| Token | Value | Meaning |
| --- | --- | --- |
| `CONSOLE_NAME` | MONADBOY | The handheld platform |
| `CARTRIDGE_01` | STAY IN RANGE | The playable range cartridge |
| `ALERT_NAME` | NAD-SENSE | Edge warning, not a prediction |
| `TAGLINE` | The handheld that plays your liquidity. | Product tagline |

### Vocabulary map

| DeFi | MONADBOY | Implementation intent |
| --- | --- | --- |
| Connect wallet | INSERT MEMORY CARD | Mera passkey ceremony |
| Account | Memory Card | 32-byte passkey PRF output [V: Mera guide](https://docs.monad.xyz/guides/mera) |
| Portfolio | SAVE DISK, three slots | BIP-44 account indexes 1 through 3, isolated EOAs [V: derivation mechanism](https://docs.monad.xyz/guides/mera) |
| Risk profile | DIFFICULTY | EASY Molandak, NORMAL Moyaki, HARD Mouch; GOD MODE modifier |
| Screening | done by difficulty | Hard gates, then SAFETY and HEAT |
| Pool discovery | POOL TRACKER | SAFETY x HEAT scatter of Kuru mainnet markets |
| Price range | the ground the character stands on | Ladder of flip-order pairs |
| In range | character runs, SCORE ticks on eligible fills | Mid inside the ladder |
| Out of range | character sits, counter freezes | Mid outside the ladder |
| Near the edge | NAD-SENSE | Mid within one step of an edge |
| Impermanent loss | DAMAGE | HODL-relative accounting in section 7 |
| Fees earned | SCORE | Realized flip spread, not projected yield |
| Auto rebalance | AUTOPILOT | Native flip re-arming; manual re-centering has a visible cost |
| Tick / bin step | never shown | Width and step are one coupled control |

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
10. Fixed 480x320 logical grid, 4px snap, 8px bitmap font, integer sprite scaling, DOM/CSS, no canvas.
11. Every number on screen has a source the player can open.
12. Label testnet on every balance screen. Never imply real money.

## 3. Difficulty is a teaching mechanism

### Mascot binding: Path A

The mascot is bound to difficulty.
Molandak is EASY, Moyaki is NORMAL, and Mouch is HARD.
GOD MODE modifies HARD; it does not introduce a fourth character.

| Difficulty | Monanimal | Teaching role |
| --- | --- | --- |
| EASY | Molandak, armoured purple hedgehog | Fewer things can hurt you |
| NORMAL | Moyaki, purple cat-fish with pink fins | Balanced exposure, riding the current |
| HARD | Mouch, purple fly | More volatile conditions, fewer comfort checks |
| GOD MODE | Mouch, red palette and skull | Explicit absence of comfort filters |

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

| Tier | Required gates | SAFETY | HEAT |
| --- | --- | --- | --- |
| EASY | depth >= $250k; age >= 14d; strong quote; unsellable gate clean | >= 70 | <= 60 |
| NORMAL | depth >= $75k; age >= 3d; strong or mid quote; gate clean | >= 50 | <= 80 |
| HARD | depth >= $20k; age >= 6h; strong or mid quote; gate clean | >= 30 | <= 100 |
| GOD MODE | unsellable gate clean, nothing else | raw, unranked | raw, unranked |

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
Three consecutive source failures pause the bot; it never invents a replacement price.
Health turns red and the screen says PRICE FEED PAUSED.
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

