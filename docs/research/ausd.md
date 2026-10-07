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

[V, S1 on 2026-10-07 UTC] BOT's explicit-gas `requestFunds` transaction [0x80d2b84ddbe529a6f3692cf26f034054957b0c881a43a9278926512d4932737b](https://testnet.monadscan.com/tx/0x80d2b84ddbe529a6f3692cf26f034054957b0c881a43a9278926512d4932737b), block 68939636, emitted Transfer of raw `10000000000`: **10,000 AUSD**, independently establishing Monad supply rather than importing the Sepolia example.

[V] Immediate unsigned repeats using another sender and a new recipient both returned `MaxFrequencyExceeded()`. Readback was `faucetDripAmount=10000000000`, `maxAmountToOwn=100000000000`, `maxDripFrequency=60`, with one global `lastDripTimestamp`. A repeat simulation after the window succeeded. This is a global60second cooldown, not per-role allowance; a simulation is not another grant. Public timestamped evidence is in external `s1-immediate-refusals.json` / `s1-faucet-configuration.json`.

[V] BOT transferred 1,000 AUSD each to DRIP and DEPLOYER from its held faucet supply. These role transfers are not faucet payouts. The worker later delivered an actual fresh-player 0.5 MON / 10 AUSD drip and refused the repeat with HTTP 409; both transfer receipts and ledger state are recorded externally. Top-up code simulates before signing and applies hourly exponential backoff on the observed refusal.

[V] The worker's actual DRIP top-up [0xc3849d522ea973d2a17638059b2000273f04ea38285a679d129f9e8789fa68a4](https://testnet.monadscan.com/tx/0xc3849d522ea973d2a17638059b2000273f04ea38285a679d129f9e8789fa68a4), block68945959, transferred10,000AUSD from the faucet, not the zero address. `worker-faucet-topup-proof.json` records the successful200,000gas receipt. `funded-drip-proof.json` records frequency-limited health and retryInMs3548614 without another broadcast.

## Why MONADBOY quotes in AUSD

[I] A stable quote unit makes SCORE and DAMAGE readable: realized spread and inventory mark-to-market share one AUSD denomination. Players choose one budget number instead of interpreting changing MON units.

[I] The playable venue is our testnet MON-AUSD Kuru market; the mirror reads mainnet MON_USDC because mainnet MON_AUSD has an empty book. The mirror treats USDC and AUSD as one USD each, an explicit simplifying assumption, not a proven peg.

[I] Agora Mobile Trading is a bonus for a mobile-first AUSD experience. Cross-Border Payments is not targeted: STAY IN RANGE is trading, not a remittance flow.

[U] **Agora eligibility spike:** the exact Mobile Trading requirement and whether responsive web/PWA qualifies await an organizer answer. See [bounties](bounties.md). No mainnet incentive or bounty payout is represented as a player reward.
