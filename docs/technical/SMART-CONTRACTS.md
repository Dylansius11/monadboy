# MONADBOY smart contracts

Labels: **[V]** verified with the linked source or exact command; **[I]** inference or intended integration; **[U]** unresolved, with its settling spike. DiskRegistry v2 is implemented and locally verified, but not deployed. Deployment rows remain empty until evidence exists.

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

[V] Published role sources: [Kuru contract addresses](https://docs.kuru.io/contracts/Contract-addresses), [Agora contract deployments](https://docs.agora.finance/developer/contract-deployments.md). [U, S1] Faucet cadence and usable testnet USDC supply remain unresolved; deployed token code does not imply a usable supply source. Do not infer Monad faucet output from a different chain's observed mint amount.

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

[V] `forge snapshot --match-test testGasSave1KiB` records **805,858 gas** in `contracts/.gas-snapshot` for a first save of 1,024 nonzero bytes. Payload construction is excluded from gas metering. This is a local standard-EVM measurement, **not a safe Monad transaction gas limit**. Reproduce with Foundry 1.8.3 and the pinned compiler settings; forge-std is a submodule pinned to release `v1.9.7`, commit `77041d2ce690e692d6e03cc812b57d1ddaa4d505`.

Regenerate the SDK ABI after contract changes:

```sh
cd contracts
forge build
cd ..
bun packages/sdk/scripts/generate-disk-registry-abi.ts
```

The generator reads `contracts/out/DiskRegistry.sol/DiskRegistry.json` and writes `packages/sdk/src/abi/disk-registry.ts`. [V] Generated and artifact ABI arrays match exactly (7 entries). No deployed registry address is asserted here.

### Deployment command

The deployment script reads `DEPLOYER_PRIVATE_KEY`; `contracts/.env.example` intentionally has no value. Only after funding is available, set that key, a measured testnet `DEPLOY_GAS_LIMIT` and current `DEPLOY_GAS_PRICE` in the environment and run from `contracts/`:

```sh
forge script script/Deploy.s.sol:Deploy --rpc-url monad_testnet \
  --gas-limit "$DEPLOY_GAS_LIMIT" --with-gas-price "$DEPLOY_GAS_PRICE" --broadcast
```

[U] This command has not been run: the operations wallets are unfunded. Deployment must record the code check, transaction and SDK deployment address after a successful broadcast.

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

[I] Encoding: `priceUnits = price * pricePrecision`, integer and tickSize-aligned; `sizeUnits = base * sizePrecision`. `planLadder` emits 2..8 levels per side and `batchProvisionArgs` produces the arrays. [U, S2] Confirm these encodings, `provisionOrRevert`, `isMargin`, minimum-output units and zap funding behavior on testnet before depending on them. Single `addFlipBuyOrder` / `addFlipSellOrder` calls per level are the S2 fallback, not an alternate venue.

[V] The approved live ABI observation uses 1e18-scaled `bestBidAsk`, unlike encoded uint32 order prices; the empty-book sentinel is `(2^256-1, 0)` (commands and ABI evidence in [Kuru research](../research/kuru.md)). Never use the sentinel as a midpoint. [V] Live `Trade` is `Trade(uint40,address,bool,uint256,uint96,address,address,uint96)`; the OrderBook documentation's uint32 price and indexed fields disagree with that observation. Envio subscribes using SDK/live signatures, not the prose example.

### Explicit gas-limit table

[V] Monad charges the declared limit, not gas used ([gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing)). No guessed numeric limit below is safe to commit as production configuration. Measure and record an explicit limit for each transaction shape; view reads do not spend player gas.

| Transaction / view | Explicit gas value or handling | Status |
|---|---|---|
| `Router.deployProxy` | measured in spike S2 | [U, S2] |
| AUSD approval | measured in spike S2 | [U, S2] |
| `MarginAccount.deposit` ERC-20 | measured in spike S2 | [U, S2] |
| `MarginAccount.deposit` native | measured in spike S2 | [U, S2] |
| `batchProvisionLiquidity` 2+2 and maximum ladder | measured in spike S2 | [U, S2] |
| `addFlipBuyOrder` | measured in spike S2 | [U, S2] |
| `addFlipSellOrder` | measured in spike S2 | [U, S2] |
| `batchCancelFlipOrders` | measured in spike S2 | [U, S2] |
| `placeAndExecuteMarketBuy` | measured in spike S2 | [U, S2] |
| `placeAndExecuteMarketSell` | measured in spike S2 | [U, S2] |
| `batchUpdate` | measured in spike S2 | [U, S2] |
| `batchWithdrawMaxTokens` | measured in spike S2 | [U, S2] |
| `bestBidAsk` | Read-only `eth_call`; no transaction limit | [I] |
| `getMarketParams`, `getL2Book`, `MarginAccount.getBalance` | Read-only `eth_call`; no transaction limit | [I] |

DiskRegistry's local 1 KiB snapshot is recorded above; testnet save/deploy limits remain unmeasured until the funded deployment can run. [V] For low-balance undelegated EOAs, observe the k=3-block emptying rule or retain at least 10 MON ([reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)); count prior sender transactions, including approvals, rather than spacing only value transfers.

## 3. Market parameters

[I] These are MON-AUSD starting values, not claims of deployed state. [U, S2] Read back final `getMarketParams` values at deploy and record the deployment transaction. Native MON uses the `address(0)` sentinel; the AUSD token is the checked contract above.

| Parameter | Starting value | Final value |
|---|---|---|
| type | `1`, NATIVE_IN_BASE | recorded at deploy |
| base | Native MON, `address(0)` | recorded at deploy |
| quote | AUSD testnet | recorded at deploy |
| pricePrecision | `1e8` | recorded at deploy |
| sizePrecision | `1e10` | recorded at deploy |
| tickSize | `1` | recorded at deploy |
| minSize | Choose so one ladder level can be about 0.05 AUSD | recorded at deploy |
| maxSize | Selected and validated in S2; SPEC gives no starting number | recorded at deploy |
| takerFeeBps | `30` | recorded at deploy |
| makerFeeBps | `0` | recorded at deploy |
| kuruAmmSpread | Selected and validated in S2; SPEC gives no starting number | recorded at deploy |

[U, S1] Deploy the type-0 AUSD-USDC EASY market only with a usable testnet USDC source. Otherwise EASY plays MON-AUSD with WIDE as default. [I] Fallback venue is the checked official testnet MON-USDC market if AUSD supply cannot be secured; do not mistake code existence for a live two-sided book. Show fees and TESTNET in the player confirmation.

## 4. Deploy log

Empty address, hash and block cells mean no deployment evidence yet, not a truncated address. Fill these cells only after successful broadcast, receipt, param readback and `cast code`. Commit playable addresses to `packages/sdk/src/markets.testnet.json`; registry deployment belongs in `packages/sdk/src/deployments.testnet.json`.

| Deployment | Chain | Address | Tx hash | Block | Code bytes | Status |
|---|---|---|---|---|---|---|
| Our MON-AUSD market | Testnet [I] | | | | | awaiting funded spike S2 |
| Optional AUSD-USDC market | Testnet [I] | | | | | conditional on spike S1 supply |
| DiskRegistry v2 | Testnet [I] | | | | | locally verified; awaiting funded deployment |

[U, S3] Deployer, bot and drip funding must cover deployment, price-mirror inventory and 20 player drips. The current Phase 4 blocker is recorded in [BUILD-PLAN](BUILD-PLAN.md), not hidden by an empty deploy row.
