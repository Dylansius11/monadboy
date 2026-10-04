# Monad research

Evidence checked 2026-10-05. **[V]** means a fetched source or an observed command; **[I]** means inference; **[U]** names the spike that must settle the claim.

## Networks and timing

| Fact | Value | Evidence |
|---|---|---|
| Mainnet chain ID | 143 | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md) |
| Mainnet public RPC | `https://rpc.monad.xyz` | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md) |
| Testnet chain ID | 10143 | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md) |
| Testnet public RPC | `https://testnet-rpc.monad.xyz` | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md) |
| Native currency | MON on both networks | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md) |
| Block time | 300 ms | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md), observed mainnet metric |
| Speculative finality | 300 ms, one slot | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md), protocol guarantee |
| Full finality | 600 ms, two slots | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md), protocol guarantee |
| Testnet MON faucet | `https://faucet.monad.xyz/` | [V] [Current facts](https://docs.monad.xyz/ai/current-facts.md) |

[I] The mainnet timing figures are not a measured browser-to-receipt latency promise. MONADBOY shows transaction progress and an explorer link rather than asserting every interaction takes 300 ms.

[I] Product policy: every playable STAY IN RANGE position uses testnet; mainnet Kuru markets are read-only Pool Tracker and mirror-price inputs. No real money is moved by the app.

## Gas-limit charging

[V] Monad charges the **declared gas limit**, not actual gas used: `gas_paid = gas_limit * price_per_gas`. This prevents an asynchronous-execution denial-of-service vector. Source: [Gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).

[V] EIP-1559 pricing is supported: `price_per_gas = min(base_price_per_gas + priority_price_per_gas, max_price_per_gas)`. Source: [Gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).

[I] Every MONADBOY transaction passes explicit `gas`. Gas limits are measured on the actual changed path, with deliberate headroom, not unlimited wallet estimates. A reverted transaction still costs gas; a large limit is not harmless.

[U] Kuru deposit, ladder, zap, cancel and withdrawal limits are filled after spike **S2**. No unmeasured production limit is asserted here.

## Reserve balance and emptying transactions

[V] `user_reserve_balance = 10 MON` and the execution-delay factor is `k = 3` blocks. Reserve checks distinguish gas spend from value spend; 10 MON is not a universal minimum account balance. Source: [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance).

[V] An **emptying transaction** is eligible for the undelegated-sender exception only when:

1. The sender is undelegated.
2. The sender has sent no other transaction in the past `k` blocks.
3. Nobody has sent a delegation or undelegation request for that sender in the past `k` blocks, including this transaction.

[V] These conditions allow an undelegated EOA to spend value below its reserve; gas and value still need sufficient funds. Delegated EOAs cannot use this exception. An already-low delegated balance can remain unchanged or increase. Source: [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance).

[I] Three 300 ms blocks are about **0.9 s**. Sequence value-spending transactions at least three blocks apart when relying on the emptying exception, or keep at least 10 MON plus gas headroom. An approval immediately before a native deposit counts as another sender transaction even though the approval spends no native value.

[V] Source inconsistency: the reserve page says three blocks are 1.2 seconds in its prose, while [current facts](https://docs.monad.xyz/ai/current-facts.md) says 300 ms blocks. The approved product rule uses the three-block condition and approximately 0.9 s, not the 1.2 s prose. Block observation, not a fixed sleep, is the safety condition.

## EVM capabilities

| Capability | Verified fact | Source |
|---|---|---|
| P256 | Precompile identifier `0x0100`, secp256r1 verification, EIP-7951, 6,900 gas | [V] [Precompiles](https://docs.monad.xyz/developer-essentials/precompiles) |
| P256 input/output | 160-byte input; 32-byte one for a valid signature, empty bytes for invalid input/signature | [V] [Precompiles](https://docs.monad.xyz/developer-essentials/precompiles) |
| EIP-7702 | Supported; type-4 authorization delegates EOA code | [V] [EIP-7702](https://docs.monad.xyz/developer-essentials/eip-7702) |
| Delegated execution | Delegated EOA code cannot invoke CREATE or CREATE2 | [V] [EIP-7702](https://docs.monad.xyz/developer-essentials/eip-7702) |
| Contract size | Maximum 128 KB | [V] [Monad for developers](https://docs.monad.xyz/introduction/monad-for-developers) |
| EVM compatibility | Fusaka-compatible bytecode and opcodes | [V] [Monad for developers](https://docs.monad.xyz/introduction/monad-for-developers) |

[V] Precompile identifiers refer to native protocol functions, not deployed EVM bytecode; precompiles are exempt from the non-empty `cast code` deployment check. Source: [Precompiles](https://docs.monad.xyz/developer-essentials/precompiles).

[I] Mera derives ordinary secp256k1 EOAs in the browser. MONADBOY does not need P256 verification contracts, a bundler, or EIP-7702 delegation for the memory card.

## Source discovery

[V] [Monad documentation index](https://docs.monad.xyz/llms.txt) lists the canonical network, gas, reserve, precompile and account guides. Fetch it before relying on remembered URLs. [Current facts](https://docs.monad.xyz/ai/current-facts.md) is the timing freshness check; provider marketing is not a timing authority.
