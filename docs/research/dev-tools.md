# Developer tools research

Evidence checked 2026-10-05. **[V]** is official published capability; **[I]** is our selection; **[U]** needs a named spike. A listed participant entitlement is not proof an account is provisioned.

## Participant resources

[V] The [official Metropolis page](https://monad.xyz/developers/hackathons/metropolis) lists QuickNode Build for three months, Tenderly Pro access, Zerion Builder for one month, Dwellir Developer for three months, Spectrum Business for two months and BlockVision Lite for two months. These are tooling resources, not cash bounty payouts.

| Tool | What it gives | Which we use and for what | Official source |
|---|---|---|---|
| QuickNode | [V] Managed Monad mainnet/testnet HTTP and WSS RPC, archive support | [I] **Optional** replacement RPC when public `getLogs` limits bite; do not make a paid provider mandatory for local play | [Monad RPC docs](https://www.quicknode.com/docs/monad) |
| Tenderly | [V] Simulation/debugging tools; virtual environments fork live state, expose JSON-RPC and inspectable transactions | [I] Fork dry runs of flip ladders, approvals/deposits/zap/cancel/withdrawal; no real mainnet orders | [Virtual environments](https://docs.tenderly.co/virtual-environments/overview), [supported networks](https://docs.tenderly.co/platform/supported-networks) |
| Zerion | [V] Wallet tokens, transactions, DeFi and NFT coverage; `monad` and testnet `monad-test-v2` | [I] Not a core dependency; optional manual portfolio cross-check, never SCORE truth | [Supported blockchains](https://developers.zerion.io/supported-blockchains) |
| BlockVision | [V] Monad portfolios, account activity, holder distribution, token trades/pools and contract information | [I] MonadVision explorer proof links; indexing API not required because Envio owns the fill model | [Monad indexing API](https://docs.blockvision.org/reference/monad-indexing-api), [Monad explorers](https://docs.monad.xyz/tooling-and-infra/block-explorers.md) |
| Dwellir | [V] Managed Monad mainnet JSON-RPC with authenticated endpoints and usage plans | [I] Not selected; alternative RPC only if current providers fail workload requirements | [Monad docs](https://www.dwellir.com/docs/monad) |
| Spectrum | [V] Monad mainnet/testnet HTTPS and WebSocket RPC endpoints | [I] Not selected; alternative RPC, not another mandatory backend | [Monad RPC page](https://spectrumnodes.com/networks/monad-rpc) |

[V] Zerion testnet queries need `X-Env: testnet`; network identifier `monad-test-v2` is an API filter, not the numeric chain ID. Source: [Zerion chain support](https://developers.zerion.io/supported-blockchains).

[V] BlockVision uses the same indexing request URL for mainnet/testnet, with network selected by the API key. Its Lite/Basic/Pro API availability is a provider-specific entitlement, not an unrestricted public endpoint. Source: [Monad indexing API](https://docs.blockvision.org/reference/monad-indexing-api).

## Actual RPC limit observation

[V] On 2026-10-05, public mainnet `cast logs` over a 500-block interval returned HTTP 413 / -32614, `eth_getLogs is limited to a 100 range`. Five bounded 100-block requests succeeded. Exact market/ranges are recorded in [Kuru research](kuru.md).

[I] Implement chunked logs on public RPC first. QuickNode is optional through `MAINNET_RPC_URL`, `TESTNET_RPC_URL` and optional web RPC configuration when workload limits require it. An RPC change does not change chain identity, event ABI or source attribution.

[I] Tracker snapshots may use Envio HyperSync or chunked RPC for 24-hour fills. They never use a generic portfolio API as authoritative position accounting. Mainnet is read-only throughout.

## Tenderly ladder dry runs

[I] Run the exact ordered ladder path on a fork: allowance → zap → margin deposit → provisioning → taker fill → flip event → cancellation → maximum withdrawals. Inspect revert traces and asset movements, not just a green simulation badge.

[I] Exercise insufficient allowance, insufficient margin, price/tick rounding, too-small sizes, native value spend, partial fills and exit. A fork is a dry-run aid, not a replacement for spike S2's testnet receipts or Monad reserve-balance behavior.

[V] Virtual environments use a Public RPC for ordinary clients and an Admin RPC for balance/storage/time controls. Never expose the Admin RPC to players. Source: [Tenderly virtual environments](https://docs.tenderly.co/virtual-environments/overview).

[U] **S2 tooling check:** verify our Tenderly account's Monad fork availability and claimed Pro access, then record actual simulations. The fetched supported-networks page renders its per-network table dynamically; this research does not independently establish every Monad product checkbox. The published Monad announcement fetch was rate-limited, so no unchecked feature is labelled verified.

## Local command tools

[V] This research executed Foundry `cast` 1.8.3 for bytecode, view calls, logs, signature hashing and payload decoding; Bun 1.3.14 runs the forbidden-content guard. These command versions are observed locally, not network capabilities.

[I] MONADBOY's chain runtime is viem. Foundry owns contracts and one-shot chain verification; Bun installs/runs scripts and the Hono worker; Node runs Vite/Vitest. Secrets stay in ignored environment files, never documentation examples or logs.

[U] **Resource-access spike:** redeem participant plans through the organizer platform and confirm per-account quotas before depending on them. Published free-resource durations above are verified offers, not an assertion that any credential exists.

[I] We choose the fewest load-bearing integrations: Kuru execution, Mera accounts, Envio read models, public RPC by default, Tenderly for fork diagnosis, optional QuickNode for RPC limits. Zerion, BlockVision's indexing API, Dwellir and Spectrum do not add parallel sources of SCORE truth.
