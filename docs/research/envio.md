# Envio research

Evidence checked 2026-10-05. **[V]** cites fetched official documentation or explicitly secondary bounty text; **[I]** is the approved integration design; **[U]** is spike-dependent behavior.

## Three data products

| Product | What it provides | MONADBOY use |
|---|---|---|
| HyperIndex | [V] Event indexing, typed handlers/entities and a GraphQL read API | [I] S7 fill feed, S8 history, leaderboard |
| HyperSync | [V] Bulk historical and live blockchain data access, alternative to RPC fetching | [I] HyperIndex data source; optional tracker history fetch |
| HyperRPC | [V] Read-only JSON-RPC backed by HyperSync | [I] Research/analytics option, not a transaction broadcaster |

[V] Sources: [Envio documentation index](https://docs.envio.dev/llms.txt), [HyperIndex overview](https://docs.envio.dev/docs/HyperIndex/overview.md), [HyperSync overview](https://docs.envio.dev/docs/HyperSync/overview.md), [HyperRPC overview](https://docs.envio.dev/docs/HyperRPC/overview-hyperrpc.md). Their names describe different boundaries; an indexer is not a signing backend.

## Monad support and endpoints

[V] Envio advertises first-class Monad mainnet and testnet support for HyperIndex, HyperSync and HyperRPC. Sources: [mainnet](https://envio.dev/chains/monad), [testnet](https://envio.dev/chains/monad-testnet).

| Network | Chain ID | HyperSync | HyperRPC | Evidence |
|---|---|---|---|---|
| Mainnet | 143 | `https://monad.hypersync.xyz` | `https://monad.rpc.hypersync.xyz` | [V] [Monad page](https://envio.dev/chains/monad) |
| Testnet | 10143 | `https://monad-testnet.hypersync.xyz` | `https://monad-testnet.rpc.hypersync.xyz` | [V] [Testnet page](https://envio.dev/chains/monad-testnet) |

[V] [API-token documentation](https://docs.envio.dev/docs/HyperSync/api-tokens.md) is the setup reference. Endpoint publication is not an authenticated request or proof of our deployment's event latency.

[I] The indexer targets our testnet OrderBook market(s) and DiskRegistry v2. Mainnet markets remain tracker/mirror read inputs. Event signatures come from [Kuru's checked SDK ABI](kuru.md), not the contract-doc event table.

## Core feature powered by Envio

[I] Index OrderBook `FlipOrderCreated`, `FlippedOrderCreated`, `FlipOrderUpdated`, `FlipOrdersCanceled`, `Trade`, `OrdersCanceled`, plus DiskRegistry `DiskSaved` and `DiskErased`.

[I] Entities follow the approved product boundary:

- `Market`: market identity, last price and 24-hour volume.
- `Order`: owner, price, flip price, size, side, flipped-order identity and active state.
- `Fill`: order, maker/taker, price, size, side, block, transaction and realized spread.
- `Disk`: disk identity, derived score, fill count, last fill and save count.

[I] The Trade handler computes `realizedSpread` and disk SCORE only for flipped-order fills. Initial-order fills affect inventory, not SCORE. No player submits their own trusted score. Chain events remain truth; GraphQL and SQLite are read models.

[I] S7 uses the fill feed for a coin sound and visible SCORE increment; S8 reads actual fill history; the worker aggregates leaderboard rows through `FillSource`. A bounty logo without a data-dependent feature would not meet the intended integration.

[I] Time-in-range uses worker mid samples; DAMAGE also needs marked holdings. Neither number is fabricated from a count of indexed events alone.

## Bounty requirement

[V secondary] Playbook section 4.1 records this verbatim requirement:

> Meaningfully use Envio's HyperIndex, HyperSync, or HyperRPC to power real on-chain data driving a core feature in your app.

[V secondary] The same wording appears in this [rules/dashboard transcription](https://github.com/precious-akpan/monad-metropolis-merchant-rails). [V] The [official Metropolis page](https://monad.xyz/developers/hackathons/metropolis) lists Best Use of Envio at $1,000; it does not expose the full requirement text. [U] **Rules-confirmation spike:** verify binding wording in the signed-in organizer dashboard before submission.

## Failure boundary and spike

[I] When Envio is unreachable, the web may read the last 200 blocks of Trade logs through viem `getLogs`, chunked to provider limits, and show INDEXER OFFLINE. This keeps S7 visible, not an invented healthy indexer. The leaderboard exposes lag instead of silently accepting stale totals.

[U] **S5 pending funding:** deploy the actual testnet market, configure event handlers and verify sync within ten seconds of a real receipt. Record GraphQL entity values and transaction links, not merely service startup.

[U] **S5:** confirm whether Envio Cloud's available tier covers our testnet workload. The approved alternative is self-hosting on the VPS with Docker and Postgres; direct logs are the final feed fallback. Source for hosting mechanics: [official self-hosting guide](https://docs.envio.dev/docs/HyperIndex/self-hosting.md).

[I] Bounty proof is one real onchain flip fill traced through receipt → indexed Fill → S7/S8 → leaderboard. Code-path and video evidence are filled as implementation lands and before submission, respectively; see [bounties](bounties.md).
