# MONADBOY working guide

## 1. What this is

MONADBOY is a browser handheld for testnet liquidity play.
STAY IN RANGE uses Kuru flip orders; Mera passkeys own sealed save disks.
Read `docs/PRD.md` before product, copy, or scope decisions.

## 2. Deadline

Metropolis submission Tue 13 Oct 2026 11:59 PM ET (Wed 14 Oct 10:59 WIB); internal target Tue 13 Oct 18:00 WIB; judging 14 to 27 Oct means the deployed app and worker must stay up.
Deadline [V: rules transcription, secondary](https://github.com/precious-akpan/monad-metropolis-merchant-rails); judging dates [V: event page](https://monad.xyz/developers/hackathons/metropolis).

## 3. Testnet first

No real money moves through the app. Every playable position is testnet; mainnet is read-only tracker / price data.
Label TESTNET on every screen, dialog, or result that shows a balance.
Monad testnet 10143 and mainnet 143 [V: current facts](https://docs.monad.xyz/ai/current-facts.md).

## 4. Non-negotiable rules

1. Never claim a prediction; range advice is arithmetic.
2. DAMAGE has the same visual weight as SCORE everywhere SCORE appears.
3. No AI in any number's critical path; a model never blocks a number.
4. Width and step are coupled; never expose raw tick / step.
5. Never disable the honeypot / unsellable gate, GOD MODE included.
6. No Marvel or Nintendo IP; NAD-SENSE borrows a feeling, not a mark.
7. No em-dashes in player-visible copy.
8. Names are tokens in `apps/web/src/config/brand.ts`, not scattered literals.
9. Verify every onchain address with eth_getCode before committing it.
10. Landscape 480x320 grid; native portrait phone layout; 4px snap, integer sprites, DOM/CSS and stepped SVG. Canvas is decorative scenery outside the game screen only.
11. Every visible number has a source the player can open.
12. Label testnet wherever balances appear; never imply real money.

Update `docs/technical/BUILD-PLAN.md` status in the same commit as the work.
Never trust a published address: run `cast code <address> --rpc-url <right-chain-rpc>` and require non-empty code.
Every transaction passes explicit `gas`: Monad charges the limit [V: gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).
For low-balance undelegated senders, the emptying exception requires no other sender transaction in the prior three blocks and no recent delegation change [V: reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance).
Wait by block number, not a fixed delay; otherwise retain sufficient reserve.
The worker never signs for a user. Chain is truth; Envio / SQLite are read models.
Network facts carry [V] with evidence, [I] for inference, or [U] with the settling spike / gate.
Keep secrets, PRF output, and plaintext disk data out of server storage and tracked files.
The SCORE / DAMAGE identity boundary is explained in PRD section 7; do not hide surplus NET.

## 5. Screen grid

Landscape and held consoles retain the 480x320 logical grid. Portrait phones use native viewport dimensions and reflowed screens, with 11px body/micro, 16px title, 22px value and 33px hero Departure Mono type. Keep 4px snap and integer, pixelated sprites. Use DOM/CSS and stepped SVG for the game; canvas is allowed only for scenery outside the screen. One flex region absorbs remaining height; dense settings scroll inside the screen with a pinned footer on short phones. The owning contracts are `docs/DESIGN-SYSTEM.md`, `styles/tokens.css`, `console/portrait.css` and `game/portrait.css`.

## 6. Repo map

| Path | Owns |
| --- | --- |
| `apps/web` | Screens, shell, Mera sessions, signing, transaction sequencing |
| `apps/web/src/console` | Shell, input, fit scale; never money |
| `apps/worker` | Hono on Bun + SQLite: mirror, tracker, drip, leaderboard, health |
| `packages/sdk` | viem I/O, typed ABIs, ladder, valuation, seals, gas limits; no React / DOM |
| `contracts` | DiskRegistry v2 via Foundry; no funds or admin |
| `indexer` | Envio HyperIndex schema and handlers |
| `scripts` | Address checks, deployment, seed operations, term guard |
| `docs/*` | Product, visual, technical, research, lessons |

## 7. Commands

The guard exists in Phase 1. Other commands become available with their owning implementation phases; do not report them run until they exist.

| Command | Purpose |
| --- | --- |
| `bun install` | Install workspaces in Task 2.1 |
| `bun run verify` | Typecheck, lint, tests after Task 2.1 |
| `bun run dev` | Web development after Task 2.1 |
| `bun run --cwd apps/worker dev` | Worker development in Phase 6 |
| `forge test` from `contracts` | Contract checks in Phase 4 |
| `bun run guard` | Guard staged files; explicit paths use `bun scripts/guard-forbidden.ts <files...>` |
| `bun run --cwd indexer codegen` | Indexer generation after Phase 6 scripts land |
| `bun run --cwd indexer dev` | Indexer development after Phase 6 scripts land |

Bun installs / runs scripts; Node 24 runs Vite and Vitest. Keep the Node 22+ Vitest guard.

## 8. Docs table

Each document owns one subject. Cross-reference; do not duplicate competing facts.

| Document | Owns |
| --- | --- |
| `docs/PRD.md` | Product, screens, rules, mechanics, scope, roadmap |
| `docs/DESIGN-SYSTEM.md` | Grid, tokens, type, sprites, motion, glyphs |
| `docs/technical/ARCHITECTURE.md` | Component boundaries, pinned stack, runtime, flows, hosting |
| `docs/technical/INTEGRATIONS.md` | External interfaces and failure ladders |
| `docs/technical/SMART-CONTRACTS.md` | Registry, Kuru surface, verified addresses and deployment log |
| `docs/technical/ERD.md` | Chain, indexer, cache, and sealed-data schemas |
| `docs/technical/BUILD-PLAN.md` | Phase status, spike gates, cuts, blockers |
| `docs/research/*.md` | Sourced chain / integration / bounty / rule facts |
| `docs/LESSONS.md` | Durable causes and rules |
| `README.md` | Judge-first demo, requirement proof, addresses, setup, disclosure |
| `AGENTS.md` | TanStack Intent guidance generation |

## 9. How to work here

Act as an auditor: blockers first, evidence next, cost of each proposal explicit. Preserve unrelated work.
Read matching tracked skills before acting: `brainstorming`, `writing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`.
Load monskills `gas` before contract calls, `addresses` before addresses, and `concepts` for asynchronous execution.
Load `kuru-flip-orders`, `mera-passkeys`, and `monadboy-rules` for their boundaries.
For design, use `emil-design-eng` and `impeccable`; for motion, `review-animations`, `improve-animations`, and `animation-vocabulary`.
TanStack Intent setup and package-specific guidance belong in `AGENTS.md`, generated after Task 2.1 installs dependencies.
Keep pure modules deterministic and cover consumer-visible boundaries. Prove a changed path at runtime, not just with a green check.
Verify UI at a 412px phone viewport with the real font. Say explicitly whether it was seen rendered.
Pending work is a plain status with its gate, never an implementation promise disguised as evidence.

## 10. Commits

Use 50 to 250 changed lines per commit; explain a single indivisible larger file in the body. Binary assets are separate commits grouped by folder.
Subjects: `feat|fix|refactor|test|docs|perf|chore(scope): outcome in plain words`. Body: why plus the exact proof command and result.
Commit identity is `Dylan <dylansius.putra@gmail.com>`. Never push, add a remote, or change identity without the lead's ownership.
No agent attribution in commits. Describe the product directly, with no history narrative or other event names.
Forbidden-term policy is enforced by `scripts/guard-forbidden.ts`; run `bun run guard` and let the script own the list.
Every commit passes `bun run verify` once available and `forge test` once contracts exist.
Never commit .env values, keys, machine settings, generated temporary tooling output, or dependency directories.
Executors edit only assigned files, never stage or commit; the lead owns integration and commits.

## 11. Lessons

Lessons live in `docs/LESSONS.md`. Add one entry per durable lesson, newest on top within its section: root cause first, durable rule second.
