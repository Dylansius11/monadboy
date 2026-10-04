---
name: monadboy-rules
description: Read before any MONADBOY product, copy, screen, account, transaction, or commit decision. Enforces the twelve product rules, testnet-only play, source-labelled facts, and small proof-bearing commits.
---

# MONADBOY rules

## Product identity and authority

Product: **MONADBOY**. Cartridge: **STAY IN RANGE**. Tagline: **The handheld that plays your liquidity.** Read `docs/PRD.md` before scope or copy decisions. The approved SPEC wins when a document disagrees; report the disagreement instead of silently choosing an alternative.

Playable positions use Kuru flip orders on our MON-AUSD testnet market. Mera passkeys own the memory card and three disk accounts. DiskRegistry v2 stores sealed disk ciphertext. The worker is Hono on Bun + SQLite; Envio HyperIndex provides the fill read model. Mainnet is read-only, and the worker never signs for a player. These are product constraints, not assertions of deployed status.

## Twelve non-negotiable product rules

1. Never claim a prediction. Range advice is arithmetic.
2. Never hide a loss: DAMAGE has the same visual weight as SCORE, everywhere SCORE appears.
3. Never let a model block a number. No AI in any number's critical path.
4. Width and step are one coupled control; raw tick/step is never exposed.
5. The honeypot/unsellable gate is never disabled, GOD MODE included.
6. No Marvel/Nintendo IP. NAD-SENSE borrows a feeling, not a mark.
7. No em-dashes in user-facing copy.
8. Names are tokens in `src/config/brand.ts`.
9. Every onchain address is verified with `eth_getCode` before it is committed.
10. Fixed 480x320 logical grid, 4px snap, 8px bitmap font, integer sprite scaling, DOM/CSS (no canvas).
11. Every number on screen has a source the player can open (the user asks "where does this come from?").
12. Testnet is labelled as testnet on every screen that shows a balance. Never imply real money.

## Facts, funds, and saves

Every network fact uses **[V]** with a link or exact verification command, **[I]** for inference, or **[U]** naming the spike that settles it. Do not promote an unverified fact merely because a document repeats it.

Before committing an address, run `cast code <full-address> --rpc-url <right-chain-rpc>` and require non-empty code. Record the command and byte length. A deployed proxy still needs ABI and implementation checks before use. Do not invent addresses, shorten them in technical references, or use mainnet addresses for testnet calls.

[V] Always pass explicit `gas` on every transaction: Monad charges the gas limit, not only usage. Source: [gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).

[V] Reserve balance is 10 MON. Undelegated EOAs below that budget must respect the emptying-transaction rule: first transaction from the sender in three blocks. Space value-spending transactions at least three blocks apart or retain at least 10 MON. Source: [reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance).

Load `kuru-flip-orders` for ABI, funds-before-orders, encoding, active IDs, and cancel-then-withdraw. Load `mera-passkeys` for fixed rpId, held session, disk account indices, PRF-derived seal, and stateless restore. No raw tick, custody backend, AI-generated price, or server plaintext is an acceptable shortcut.

## Commit contract

- Identity is **Dylan <dylansius.putra@gmail.com>**. Executors do not change git configuration, stage, or commit; the lead owns those actions.
- Each commit changes **50 to 250 lines**. One indivisible file may exceed that range if the body says why. Binary assets are separate commits grouped by folder.
- Use subject `feat|fix|refactor|test|docs|perf|chore(scope): outcome in plain words`.
- The body states **why** and **proof**, including the exact exercised command and observed result. No agent attribution or historical narrative. Describe the product and intended behavior, not another repository or event.
- **Never push. Never add a remote.** Never commit secrets, environment values, generated caches, dependencies, or machine-specific settings.
- Run `bun run guard` (implemented by `scripts/guard-forbidden.ts`) on the relevant files and pending message. The script is the term policy; do not reproduce its list in skills or product docs.
- Every commit passes `bun run verify` once the toolchain exists, and `forge test` once contracts exist. Executors use scoped checks; the lead performs project-wide validation once peers finish.
- Update `docs/technical/BUILD-PLAN.md` status in the same commit as the work. Record durable lessons in `docs/LESSONS.md` using its date/headline format.
- Use plain pending statuses naming the settling spike or milestone, never placeholder abbreviations. Do not claim a deployment, supported device, live indexer, or completed phase without evidence.

## Proof before completion

Run the changed surface and observe behavior. For UI, render the actual screen on a 412px phone viewport and say whether it was seen. For chain work, record the receipt, log topics, balance changes, and links needed to audit each number. A green compiler or mock response is not evidence of a live flip fill or stateless restore.

Final handoff lists changed files, exercised commands and results, assumptions, every unverified fact, address checks, and remaining risks. State blockers before optional improvements. Preserve unrelated work and keep the deliverable within its assigned file boundaries.
