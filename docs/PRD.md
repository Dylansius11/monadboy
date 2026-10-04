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

