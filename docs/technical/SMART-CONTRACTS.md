# MONADBOY smart contracts

Labels: **[V]** verified with the linked source or exact command; **[I]** inference or intended integration; **[U]** unresolved, with its settling spike. DiskRegistry v2 is deployed on Monad testnet with a confirmed receipt and exact runtime-artifact match. Market execution evidence is recorded separately.

## 0. Never trust a published address

Before committing any contract address, run the exact command on its intended chain:

```sh
cast code <addr> --rpc-url <rpc>
```

Require a successful exit and non-empty bytecode: `0x` alone fails. Use a full 0x-prefixed 40-hex address, not a shortened display address. Check the chain before selecting the RPC. [V] Testnet chain 10143 uses `https://testnet-rpc.monad.xyz`; mainnet chain 143 uses `https://rpc.monad.xyz` ([network facts](https://docs.monad.xyz/ai/current-facts.md)). Native MON is represented in contract arguments by `address(0)`, a sentinel, not a contract deployment to code-check.

[V] Non-empty code proves a contract exists at that chain/address at the check time; it does **not** prove ABI compatibility, correct proxy implementation or executable liquidity. Read params and exercise required calls in S2 before treating a market as playable [U, S2]. Mainnet is read-only; all deployment and trading below target testnet.

### Checked testnet contracts

[V] Checks on 2026-10-05, all exit 0. The byte lengths are runtime code returned by `cast code`, not source or implementation byte lengths.

| Role | Full address | Code bytes | Exact verification command |
|---|---|---:|---|
| Kuru Router | `0x7EFbE105Ca7415dE98F96622173458ac1c054630` | 141 | `cast code 0x7EFbE105Ca7415dE98F96622173458ac1c054630 --rpc-url https://testnet-rpc.monad.xyz` |
| Kuru MarginAccount | `0xd029C2D98ff85D8F64799017fE00a59B1159CE02` | 141 | `cast code 0xd029C2D98ff85D8F64799017fE00a59B1159CE02 --rpc-url https://testnet-rpc.monad.xyz` |
| Testnet USDC | `0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570` | 1,737 | `cast code 0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570 --rpc-url https://testnet-rpc.monad.xyz` |
| Official Kuru MON-USDC | `0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9` | 141 | `cast code 0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9 --rpc-url https://testnet-rpc.monad.xyz` |
| AUSD token | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` | 5,937 | `cast code 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC --rpc-url https://testnet-rpc.monad.xyz` |
| AUSD faucet | `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` | 1,200 | `cast code 0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C --rpc-url https://testnet-rpc.monad.xyz` |

[V] Published role sources: [Kuru contract addresses](https://docs.kuru.io/contracts/Contract-addresses), [Agora contract deployments](https://docs.agora.finance/developer/contract-deployments.md). S1 established10,000AUSD grants and a global60second cooldown. [U, S1] Usable testnet USDC supply remains unresolved; token code alone does not establish supply.

## 1. DiskRegistry v2 specification

Implementation: `contracts/src/DiskRegistry.sol`, Solidity 0.8.28, Cancun EVM, optimizer enabled with 200 runs. Each disk record is keyed by `msg.sender`, the independently derived disk EOA. There is no owner, admin, funds custody or application loop. No payable API, receive/fallback funding path, score submission or privileged erase is part of this contract.

```solidity
struct Disk {
    uint64 createdAt;
    uint64 updatedAt;
    uint8 difficulty;
    bool godMode;
    bytes12 tag;
    bytes sealedData;
}

error SealedTooLarge();
error BadDifficulty();

function save(bytes calldata sealedData, uint8 difficulty, bool godMode, bytes12 tag) external;
function erase() external;
function diskOf(address disk) external view returns (Disk memory);

event DiskSaved(
    address indexed disk,
    uint64 updatedAt,
    bytes32 sealedHash,
    uint8 difficulty,
    bool godMode,
    bytes12 tag
);
event DiskErased(address indexed disk);
```

`save` rejects `sealedData.length > 2048` with `SealedTooLarge()` and difficulty outside 0..2 with `BadDifficulty()`. Exactly 2,048 bytes is accepted. First save sets `createdAt`; overwrites retain it and update `updatedAt`, difficulty, godMode, tag and sealed bytes. `DiskSaved.sealedHash` is the hash of the sealed bytes. `erase` deletes only the sender's disk and emits `DiskErased`. `diskOf` returns the struct; an absent/erased record has default zero fields and empty bytes.

The Solidity field and save parameter are named `sealedData`: `sealed` is a reserved keyword in Solidity 0.8.28 (compiler error 2314). This naming does not change function selectors, tuple field order/types or the event contract; generated SDK tuple objects expose `sealedData`.

Public metadata is deliberately not encrypted: disk address, timestamps, difficulty, godMode and tag. Private disk JSON is sealed in the browser. SCORE is **not self-reported onchain**; leaderboard SCORE comes from Kuru `Trade` events.

### Storage layout reasoning

The first five fields consume `8 + 8 + 1 + 1 + 12 = 30` bytes, so both uint64 timestamps, uint8 difficulty, bool godMode and bytes12 tag pack into one 32-byte slot, leaving two bytes unused. In declared order their offsets are 0, 8, 16, 17 and 18. The dynamic `bytes sealedData` field gets a separate slot.

For a mapping keyed by disk address, each record's first slot is the mapping-derived storage location, with the bytes header in the following slot. Solidity's short-bytes encoding may hold up to 31 bytes in that header; longer sealed blobs store their length there and payload starting at the header's keccak-derived location. Thus "one packed metadata slot" does not mean the encrypted payload occupies one slot. Keep layout commentary alongside the contract and measure save gas with a 1 KiB payload.

### Required Foundry proof

[V] `cd contracts && forge test`: 17 passed, 0 failed, including accepted 2,048-byte and rejected 2,049-byte boundaries, difficulty validation, sender isolation, event fields/hashes, creation/update timestamps, erase, overwrite, rejected-save state preservation, ETH rejection and 256 sealed-length fuzz runs over 0..4,096 bytes. Tests were written before the implementation; the initial missing-source run exited 1 before any tests executed. `forge fmt --check` exits 0.

[V] `forge snapshot` records the full 17-test suite in `contracts/.gas-snapshot`, including **805,858 gas** for a first save of 1,024 nonzero bytes. Payload construction is excluded from gas metering. The `[fuzz]` configuration pins seed `0x1` and sets `dictionary_weight = 0`; the seed alone did not stabilize storage-derived dictionary sampling across processes. Two successive, unfiltered `forge snapshot --check` runs exit 0, with the 256-run fuzz case reporting mean **414,479** and median **203,598** gas in both. This is a local standard-EVM measurement, **not a safe Monad transaction gas limit**. Reproduce with Foundry 1.8.3 and the pinned compiler/fuzz settings; forge-std is a submodule pinned to release `v1.9.7`, commit `77041d2ce690e692d6e03cc812b57d1ddaa4d505`. Plain `forge build` exits 0 with warnings-as-errors; the timestamp narrowing has a local lint annotation because uint64 seconds overflow only after roughly 584 billion years.

Regenerate the SDK ABI after contract changes:

```sh
cd contracts
forge build
cd ..
bun packages/sdk/scripts/generate-disk-registry-abi.ts
```

The generator reads `contracts/out/DiskRegistry.sol/DiskRegistry.json` and writes `packages/sdk/src/abi/disk-registry.ts`. [V] Generated and artifact ABI arrays match exactly (7 entries). The verified deployment is recorded in `packages/sdk/src/deployments.testnet.json`.

### Deployment command

The root command uses the existing compiled artifact and reads DEPLOYER credentials only in memory from the approved external operations file or environment. It verifies chain 10143, estimates the exact creation call, adds 20% headroom and sends only with `--broadcast`. Existing deployment config is checked against its receipt, creation input and runtime before reuse, preventing a duplicate deployment.

```sh
bun scripts/deploy-registry.ts             # Read/estimate only; no signing
bun scripts/deploy-registry.ts --broadcast # Explicit opt-in; reuses a valid deployment
```

[V, 2026-10-07 UTC] Actual deployment used estimate **465,470**, explicit limit **558,564**, receipt gasUsed **558,564** and effective gas price **102,000,000,000 wei**, costing **0.056973528 MON**. The receipt gasUsed equals the billed limit here; do not interpret it as a standard-EVM execution-cost measurement. Native runtime is **1,885 bytes**, byte-for-byte identical to the artifact. The post-deployment default command returned `existing-deployment`, `broadcast:false`.

[V] Source verification API returned MonadVision perfect match. Independent Sourcify address check returned chain 10143 status `perfect`. Monadscan's verification result failed with an unrelated-address message; its source verification is not claimed. Public responses are in the external handoff `registry-verification.testnet.json` and `registry-sourcify.testnet.json`.

## 2. Kuru surface we call

[V] Signature source is the ABI in `@kuru-labs/kuru-sdk@0.0.95`, not the prose OrderBook page. Exact extraction command: `npm pack @kuru-labs/kuru-sdk@0.0.95`; inspect `package/abi/*.json`. [Kuru research](../research/kuru.md) records verification. Vendor `as const` ABIs; the SDK package is not a runtime dependency [I].

| Contract | Call | MONADBOY use |
|---|---|---|
| Router | `deployProxy(uint8,address,address,uint96,uint32,uint32,uint96,uint96,uint256,uint256,uint96) returns (address)` | Deploy MON-AUSD; optional AUSD-USDC |
| OrderBook | `batchProvisionLiquidity(uint32[],uint32[],uint96[],bool[],bool)` | Whole ladder in one transaction |
| OrderBook | `addFlipBuyOrder(uint32,uint32,uint96,bool)` | S2 fallback: individual buy level |
| OrderBook | `addFlipSellOrder(uint32,uint32,uint96,bool)` | S2 fallback: individual sell level |
| OrderBook | `batchCancelFlipOrders(uint40[])` | Cancel the ladder before withdrawal / re-centering |
| OrderBook | `placeAndExecuteMarketBuy(uint96,uint256,bool,bool)` payable | Initial base zap and bot buy |
| OrderBook | `placeAndExecuteMarketSell(uint96,uint256,bool,bool)` payable | Bot sell toward source price |
| OrderBook | `bestBidAsk() returns (uint256,uint256)` | Mainnet source and testnet midpoint reads |
| OrderBook | `getMarketParams() returns (uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)` | Read deployment params and encode ladder orders |
| OrderBook | `getL2Book() returns (bytes)` | Mainnet tracker depth within +/-2% of mid |
| OrderBook | `batchUpdate(uint32[],uint96[],uint32[],uint96[],uint40[],bool)` | Refresh bot's plain resting quotes |
| MarginAccount | `deposit(address,address,uint256)` payable | Prefund player/bot margin; native deposit carries value |
| MarginAccount | `batchWithdrawMaxTokens(address[])` | Withdraw all free MON/AUSD after cancellation |
| MarginAccount | `getBalance(address,address) returns (uint256)` | Read user/token margin for valuation and recovery |

[V] `batchUpdate` arguments are buyPrices, buySizes, sellPrices, sellSizes, orderIdsToCancel, postOnly. `deployProxy` arguments are type, base, quote, sizePrecision, pricePrecision, tickSize, minSize, maxSize, takerFeeBps, makerFeeBps, kuruAmmSpread (SDK extraction above). [V] ERC-20 deposits transfer from the caller; native token deposits use `address(0)` plus `msg.value` ([MarginAccount](https://docs.kuru.io/contracts/MarginAccount)). Orders require prefunded margin.

[V, S2] Placement uses `price * pricePrecision`, tick-aligned, and `base * sizePrecision`, floored. Market-buy quote input also uses **pricePrecision**, not quote-token decimals. `isMargin=true` both debits and credits MarginAccount: deposit the total quote before the zap; approval alone is insufficient. `minAmountOut` is raw output-token units. Passive true-mode bulk provisioning succeeded; crossing true-mode simulation reverted ProvisionError while false-mode skipped it. Single-level fallback was not needed or measured.

[V] The approved live ABI observation uses 1e18-scaled `bestBidAsk`, unlike encoded uint32 order prices; the empty-book sentinel is `(2^256-1, 0)` (commands and ABI evidence in [Kuru research](../research/kuru.md)). Never use the sentinel as a midpoint. [V] Live `Trade` is `Trade(uint40,address,bool,uint256,uint96,address,address,uint96)`; the OrderBook documentation's uint32 price and indexed fields disagree with that observation. Envio subscribes using SDK/live signatures, not the prose example.

### Explicit gas-limit table

[V] The successful S2 calls below used `ceil(estimate * 1.2)`. Receipt `gasUsed` equaled the billed declared limit, so it is not a separate execution-gas measure. These are **shape-specific samples**, not universal worst cases; larger traversals and quote replacement need a fresh bounded estimate. Full hashes/blocks are in `packages/sdk/src/gas-limits.ts` and external `market-funded-public.json`.

| Transaction shape | Estimate | Declared limit | Receipt proof / scope |
|---|---:|---:|---|
| AUSD faucet | 130600 | 156720 | S1 successful 10,000 AUSD grant |
| AUSD cold-recipient transfer | 72918 | 87502 | Role funding and actual fresh-player drip |
| AUSD approval to MarginAccount | 71087 | 85305 | S2 approval receipt |
| AUSD approval to market | 71099 | 85319 | Wallet-mode buy allowance, not margin allowance |
| Router deployProxy | 1128859 | 1354631 | Our MON-AUSD deployment |
| Margin deposit AUSD, first slot | 136602 | 163923 | Maker quote funding |
| Margin deposit native, first slot | 79645 | 95574 | Maker base funding |
| Margin deposit native, existing slot | 62578 | 75094 | Extra max-ladder base funding |
| Flip provision 2+2 | 783232 | 939879 | Four resting flip orders |
| Flip provision 8+8 | 2223979 | 2668775 | Sixteen resting flip orders |
| Cancel four inputs / five linked active orders | 382011 | 458414 | One input per linked pair |
| Cancel sixteen flip orders | 869091 | 1042910 | Maximum observed ladder |
| Wallet buy, partial 0.01 AUSD, bounded estimate | 258383 | 310060 | Successful native payout |
| Margin buy, partial 0.01 AUSD | 237627 | 285153 | Output credited to margin |
| Wallet sell, initial full flip | 398362 | 478035 | Native input, value attached |
| Margin sell, partial 0.1 MON | 226860 | 272232 | Margin input/output, value zero |
| Plain batchUpdate, one bid + one ask, no cancellation | 547290 | 656748 | Quote replacement has a different shape |
| Cancel two plain orders | 254240 | 305088 | Ordinary-order cancellation |
| Full maker withdrawal, bounded estimate | 130672 | 156807 | 15.487279 MON + 1.016990 AUSD |

[V] Native transfer is the 21,000 protocol constant. Individual addFlip fallback gas remains unmeasured because bulk passed; no guessed limit is published. Default unbounded native-payout estimation produced one real wallet-buy declared limit of 21,491,618, costing 2.192145036 MON. Implementation trace reported 490,160 instruction gas; bounded unsigned estimates and a later successful receipt establish the safer path. The RPC estimator's internal cause remains unresolved; do not treat that anomalous billed receipt as an execution constant.

`bestBidAsk`, `getMarketParams`, `getL2Book` and `MarginAccount.getBalance` are read-only `eth_call` paths, not transactions with a player-paid gas limit.

DiskRegistry's local 1 KiB snapshot and actual testnet deployment limit are recorded above; browser saves estimate their exact sealed payload. [V] For low-balance undelegated EOAs, observe the k=3-block emptying rule or retain at least 10 MON ([reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)); count approvals and all other sender transactions, not just value transfers.

## 3. Market parameters

[V, 2026-10-07 UTC] `cast call <our-market> "getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)" --rpc-url https://testnet-rpc.monad.xyz` independently read the following deployment state; `cast code` returned 141 bytes. Factory receipt additionally records type and AMM spread. Native MON is the address(0) sentinel.

| Parameter | Observed final value | Evidence |
|---|---|---|
| type | `1`, NATIVE_IN_BASE | deployProxy args / MarketRegistered |
| base | Native MON, `address(0)` | getMarketParams |
| quote | AUSD testnet | getMarketParams, six decimals |
| pricePrecision | `100000000` | getMarketParams / real order log |
| sizePrecision | `10000000000` | getMarketParams / real fill size |
| tickSize | `1` | getMarketParams |
| minSize | `15000000000`, 1.5 MON | About 0.0495 AUSD at the explicit spike input 0.033; not a timeless minimum quote value |
| maxSize | `79228162514264337593543950335` | getMarketParams, uint96 maximum |
| takerFeeBps | `30` | getMarketParams |
| makerFeeBps | `0` | getMarketParams |
| kuruAmmSpread | `30` | deployProxy args / MarketRegistered |

[U, S1] Deploy the type-0 AUSD-USDC EASY market only with a usable testnet USDC source. Otherwise EASY plays MON-AUSD with WIDE as default. [I] Fallback venue is the checked official testnet MON-USDC market if AUSD supply cannot be secured; do not mistake code existence for a live two-sided book. Show fees and TESTNET in the player confirmation.

## 4. Deploy log

Empty address, hash and block cells mean no deployment evidence yet, not a truncated address. Fill these cells only after successful broadcast, receipt, param readback and `cast code`. Commit playable addresses to `packages/sdk/src/markets.testnet.json`; registry deployment belongs in `packages/sdk/src/deployments.testnet.json`.

| Deployment | Chain | Address | Tx hash | Block | Code bytes | Status |
|---|---|---|---|---|---|---|
| Our MON-AUSD market | Testnet [V] | `0xD9F66B3bdBb1741f33e01fA3Acb514623e0a60Bc` | `0xa7877c745f7d3f3011bd589e78095c3175c845d14f7b1689d41af8d9ca3a52bc` | 68940637 | 141 | live params, initial and flipped-origin fills confirmed |
| Optional AUSD-USDC market | Testnet [I] | | | | | conditional on spike S1 supply |
| DiskRegistry v2 | Testnet [V] | `0xbfc885C572Cb1121FC4e4e82434279c4B4302714` | `0xaf7a396b8f73814ba6fac77829c73e632f4ec1c2e0dfa83cfa1e9f50354229af` | 68939801 | 1885 | confirmed, runtime match, MonadVision/Sourcify perfect source verification |

[V, S3] Actual DEPLOYER/BOT/DRIP funding50/80/20MON and measured receipts support the approved block-spaced twenty-player drip branch. B2/B3 hosting/access are resolved; remaining physical-device proof is B8 and continuous mirror operation is B10. See [BUILD-PLAN](BUILD-PLAN.md) and [BLOCKERS](../BLOCKERS.md).

## 5. Bounded mirror and passive demo evidence

[V,2026-10-09 UTC] Existing BOT
`0x2FBF1B1063EF5e5d0422D8c4c4357640f99F7c1F` was reused with a
distinct private key from DRIP. All writes were on10143 with explicit
gas and block-spaced nonce management; no player key was used.

The first bounded run deposited14MON into BOT margin and recorded36successful
transactions,11external-maker fills and no self-trades. It stopped at its gas
budget before ten minutes:538200ms,1.711103142MON. The trace exposed free-only
inventory causing undersized replacement quotes; it is failed acceptance evidence.
Real quote161/162 at block69588055 proved free1.003822731225MON versus
reclaimable3.432019928325MON after the fix.

The corrected run completed609262ms with26successful receipts and
1.247819856MON gas. It had no taker fills or self-trades; all89usable price
samples were within0.05%, with one unpriced RPC refusal retained. Cancellation
and replacement are separate transactions, so sampled continuity is not a claim
of an atomic quote refresh. Both test runs cleaned their quotes before exit.
Full public receipts/events and samples are retained externally as
`mirror-acceptance-result.json` and `mirror-acceptance-corrected-result.json`.

After cleanup, one funded passive pair was seeded without a recurring signer:

| Operation | Receipt | Block | Declared gas | Cost |
| --- | --- | --- | --- | --- |
| BOT passive quote,0.06AUSD cap per side | [0x529e0f…27495](https://testnet.monadvision.com/tx/0x529e0f6585556e30489c01d303c2ee360dd01d147bdcf7263265f86540727495) | 69596276 | 636239 | 0.064896378MON |

Orders189/190 back bid0.02455242 and ask0.02460158; the observed midpoint
0.024577 matched that operation's fresh mainnet source. Ownership IDs are kept
in production SQLite for safe future cancellation. They are real passive orders,
not a continuously refreshed book or a promise of fills/depth.
`mirror-passive-seed.json` records the exact hash, source and receipt.
Unattended signing remains disabled pending B10 budget/cadence approval.
