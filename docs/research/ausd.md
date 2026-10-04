# AUSD research

Evidence checked 2026-10-05. **[V]** is direct documentation or command evidence; **[V secondary]** verifies what the named secondary report says, not independent reserve auditing; **[I]** is inference; **[U]** remains spike-dependent.

## Asset, backing and standards

| Claim | Evidence |
|---|---|
| AUSD is Agora Dollar, an ERC-20 stablecoin | [V] [Agora general information](https://docs.agora.finance/developer.md) |
| USD-backed; reserve assets described as cash and US Treasury bills | [V secondary] Crypto Briefing via [Pluang, 2026-07-15](https://pluang.com/en/news-feed/monad-tambah-insentif-agora-ausd-75ribu-per-minggu) |
| Reserves managed by VanEck | [V secondary] Same [2026-07-15 report](https://pluang.com/en/news-feed/monad-tambah-insentif-agora-ausd-75ribu-per-minggu) |
| Monthly reserve attestations by Grant Thornton LLP | [V] [Agora transparency](https://docs.agora.finance/developer/transparency.md), reports prepared to AICPA attestation standards |
| EIP-712 typed-data signing | [V] [Advanced ERC features](https://docs.agora.finance/developer/advanced-erc-features.md) |
| ERC-2612 permit | [V] [Advanced ERC features](https://docs.agora.finance/developer/advanced-erc-features.md) |
| ERC-3009 authorized transfers | [V] [Advanced ERC features](https://docs.agora.finance/developer/advanced-erc-features.md) |

[I] **AUSD itself pays no holder APY.** Treat it as a stable quote unit, not a savings-rate promise. DeFi lending, liquidity provision and incentive eligibility are separate activities with separate risks.

[V secondary] The July 2026 report says Monad increased AUSD liquidity incentives to **$75,000/week**. It does not establish a guaranteed October rate, every-holder reward or testnet payout. Source: [Crypto Briefing via Pluang, 2026-07-15](https://pluang.com/en/news-feed/monad-tambah-insentif-agora-ausd-75ribu-per-minggu), linking its [source article](https://cryptobriefing.com/monad-ausd-incentives-75k-weekly/).

[I] Yield attributed to AUSD use on Monad comes from the chosen DeFi activity or incentives, not merely holding the token. MONADBOY SCORE measures realized flipped-order spread, never the incentive headline or an invented APY.

## Verified Monad testnet contracts

[V] Both contracts have non-empty code on testnet. Commands executed 2026-10-05:

```sh
cast code 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC --rpc-url https://testnet-rpc.monad.xyz
cast code 0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C --rpc-url https://testnet-rpc.monad.xyz
```

| Contract | Full address | Result |
|---|---|---|
| AUSD | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` | [V] 5,937 code bytes |
| Faucet | `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` | [V] 1,200 code bytes |

[V] Decimal and token-identity reads:

```sh
cast call 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC "decimals()(uint8)" --rpc-url https://testnet-rpc.monad.xyz
# 6
cast call 0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C "token()(address)" --rpc-url https://testnet-rpc.monad.xyz
# 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC
```

[V] Agora's [test-token guide](https://docs.agora.finance/instant-settlement/guides/getting-testnet-tokens.md) documents `requestFunds(address)` and a 10,000 AUSD example **on Sepolia**. Its example is not a Monad cadence guarantee. The Monad deployment and `token()` relationship above are independently checked on the Monad testnet RPC.

## MaxFrequencyExceeded finding and current observation

[V] `cast sig "MaxFrequencyExceeded()"` returns `0x20e5bc67`, the error selector to recognize when decoding a faucet refusal.

[U] **S1** owns the approved specification's `MaxFrequencyExceeded()` finding and the unknown request window. The required random-recipient simulation did **not** reproduce that revert on 2026-10-05: `cast call FAUCET "requestFunds(address)" "$RECIPIENT" --rpc-url https://testnet-rpc.monad.xyz` returned `0x`, exit 0. A distinct random-sender plus random-recipient scenario using `--from "$SENDER"` also returned `0x`, exit 0. FAUCET is the full checked faucet address above; recipients/sender were fresh random 20-byte values, not deployed contracts.

[V] These are observed successful **eth_call simulations only**: no transaction was broadcast and no token transfer persisted. No revert output can truthfully be recorded for those runs.

[U] **S1 pending funding:** broadcast from the funded operations wallet with explicit gas, record receipt and actual token balance delta, then measure cadence. Simulation success does not settle usable supply. On `MaxFrequencyExceeded()`, the worker top-up job backs off rather than claiming a faucet payout.

## Why MONADBOY quotes in AUSD

[I] A stable quote unit makes SCORE and DAMAGE readable: realized spread and inventory mark-to-market share one AUSD denomination. Players choose one budget number instead of interpreting changing MON units.

[I] The playable venue is our testnet MON-AUSD Kuru market; the mirror reads mainnet MON_USDC because mainnet MON_AUSD has an empty book. The mirror treats USDC and AUSD as one USD each, an explicit simplifying assumption, not a proven peg.

[I] Agora Mobile Trading is a bonus for a mobile-first AUSD experience. Cross-Border Payments is not targeted: STAY IN RANGE is trading, not a remittance flow.

[U] **Agora eligibility spike:** the exact Mobile Trading requirement and whether responsive web/PWA qualifies await an organizer answer. See [bounties](bounties.md). No mainnet incentive or bounty payout is represented as a player reward.
