---
name: kuru-flip-orders
description: Use before planning, encoding, submitting, indexing, or exiting STAY IN RANGE positions on Kuru. Covers the ABI surface, live event topics, MarginAccount funding, explicit gas, and spike S2 gates.
---

# Kuru flip orders for MONADBOY

## Scope and evidence

MONADBOY plays STAY IN RANGE on our MON-AUSD testnet market. Mainnet markets are read-only. The worker mirrors the mainnet MON_USDC mid; label the surface "testnet book, mainnet price (Kuru MON/USDC)". [I] Product policy: approved SPEC 2 and 5.

[V] ABI evidence: `@kuru-labs/kuru-sdk@0.0.95`, `package/abi/{OrderBook,MarginAccount,Router,IERC20}.json`, from the [published package](https://registry.npmjs.org/@kuru-labs/kuru-sdk/0.0.95). Its dependency metadata says `ethers: 5.7.1`. Do not install it at runtime. Vendor typed `as const` ABIs; use viem for every chain read, write, receipt, and log.

[V] Chain IDs and public RPCs: testnet 10143 / `https://testnet-rpc.monad.xyz`; mainnet 143 / `https://rpc.monad.xyz`. Source: [Monad Mera guide network table](https://docs.monad.xyz/guides/mera).

## Testnet contracts

[V] Each check below ran on 2026-10-05: `cast code <address> --rpc-url https://testnet-rpc.monad.xyz`. These byte lengths prove code exists, not that a proxy implementation or ABI is safe.

| Contract | Address | Code bytes |
|---|---|---:|
| Router | `0x7EFbE105Ca7415dE98F96622173458ac1c054630` | 141 |
| MarginAccount | `0xd029C2D98ff85D8F64799017fE00a59B1159CE02` | 141 |
| AUSD | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` | 5937 |

[V] AUSD has 6 decimals: `cast call 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC 'decimals()(uint8)' --rpc-url https://testnet-rpc.monad.xyz` returns 6. Do not confuse token decimals with OrderBook size/price precision.

The playable OrderBook address and final market parameters are recorded after S2 in `packages/sdk/src/markets.testnet.json` and `docs/technical/SMART-CONTRACTS.md`; check its bytecode before committing it.

## Full callable ABI surface

[V] Exact inputs, outputs, and mutability from the published SDK ABI cited above. Names below explain the arguments; canonical signatures depend on types, not names.

```solidity
// Router: deploy our market; returns the OrderBook proxy.
function deployProxy(uint8 type_, address base, address quote,
  uint96 sizePrecision, uint32 pricePrecision, uint32 tickSize,
  uint96 minSize, uint96 maxSize, uint256 takerFeeBps,
  uint256 makerFeeBps, uint96 kuruAmmSpread) external returns (address proxy);

// OrderBook: reads used by mirror/tracker and parameter adapters.
function bestBidAsk() external view returns (uint256 bid, uint256 ask);
function getL2Book() external view returns (bytes);

// OrderBook: one transaction provisions the whole ladder.
function batchProvisionLiquidity(uint32[] prices, uint32[] flipPrices,
  uint96[] sizes, bool[] isBuy, bool provisionOrRevert) external;
function addFlipBuyOrder(uint32 price, uint32 flipPrice,
  uint96 size, bool provisionOrRevert) external;
function addFlipSellOrder(uint32 price, uint32 flipPrice,
  uint96 size, bool provisionOrRevert) external;
function batchCancelFlipOrders(uint40[] orderIds) external;
function placeAndExecuteMarketBuy(uint96 quoteSize, uint256 minAmountOut,
  bool isMargin, bool isFillOrKill) external payable returns (uint256);
function placeAndExecuteMarketSell(uint96 size, uint256 minAmountOut,
  bool isMargin, bool isFillOrKill) external payable returns (uint256);
function batchUpdate(uint32[] buyPrices, uint96[] buySizes,
  uint32[] sellPrices, uint96[] sellSizes,
  uint40[] orderIdsToCancel, bool postOnly) external;

// MarginAccount: funds must be deposited before resting orders.
function deposit(address user, address token, uint256 amount) external payable;
function batchWithdrawMaxTokens(address[] tokens) external;

// AUSD ERC-20 allowance boundary.
function allowance(address owner, address spender) external view returns (uint256);
function approve(address spender, uint256 amount) external returns (bool);
```

[U, S2] `provisionOrRevert`, market-buy `isMargin`, market quote-size encoding, and all executable funding/order semantics must be exercised on testnet before callers depend on them. If batched provisioning fails the spike, use the two single-level flip functions only after confirming their semantics.

## Encoding and ladder planning

[U, S2] SPEC 5.4 proposes `priceUnits = price * pricePrecision`, an integer multiple of `tickSize`; `sizeUnits = baseAmount * sizePrecision`. S2 must confirm both encodings. Price and flipPrice must fit `uint32`; sizes must fit `uint96` and respect `minSize`/`maxSize`. Do not silently round overflowing values or confuse ERC-20 raw units with book units.

[U, S2] Starting deployment parameters are `pricePrecision = 1e8`, `sizePrecision = 1e10`, `tickSize = 1`. Final values, fee choices, and minimum size come from the deployed market and spike evidence, not hardcoded assumptions.

Use `planLadder` and `batchProvisionArgs` in `packages/sdk`. Width and step are coupled; never expose the raw tick. For each buy, round price down to tick and flipPrice up so `flipPrice > price`; for each sell, round price up and flipPrice down so `flipPrice < price`. Floor sizes. Drop the outermost level pair and recompute when below minSize; fewer than two levels means "AMOUNT TOO SMALL FOR THIS RANGE". [I] Product arithmetic: SPEC 5.4.

[V] `bestBidAsk` uses 1e18 price scaling, independent of placement `pricePrecision`; an empty book reports `(2^256 - 1, 0)`. Source: approved SPEC 2's chain observation (`bestBidAsk` calls). Reject this sentinel before averaging or converting to Number. Do not invent a mid when either side is absent.

## Live events, not the documentation example

[V] These canonical event types are from SDK 0.0.95 and match the live-topic prefixes recorded in SPEC 2. Reproduce each topic with `cast keccak '<signature>'`. All arguments are **non-indexed** in this ABI; only the signature is topic 0.

| Event signature | Topic hash prefix |
|---|---|
| `Trade(uint40,address,bool,uint256,uint96,address,address,uint96)` | `0xf16924fb` |
| `OrderCreated(uint40,address,uint96,uint32,bool)` | `0xb81bbaf1` |
| `OrdersCanceled(uint40[],address)` | `0x386974f4` |
| `FlipOrderCreated(uint40,uint40,address,uint96,uint32,uint32,bool)` | `0xf81d3fde` |
| `FlippedOrderCreated(uint40,uint40,address,uint96,uint32,uint32,bool)` | `0x49496a41` |
| `FlipOrderUpdated(uint40,uint96)` | `0xb74e966b` |
| `FlipOrdersCanceled(uint40[],address)` | `0x5f815e52` |

[V] SPEC 2 records that the docs page gives `Trade.price` as `uint32` and indexed arguments. That example is wrong for the live contracts. Decode `Trade.price` as `uint256`, and do not filter by indexed owner/maker. Verify against receipt logs during S2, rather than adapting a docs-shaped ABI to fit.

For both creation events the field order is `orderId, flippedId, owner, size, price, flippedPrice, isBuy`. For `Trade` it is `orderId, makerAddress, isBuy, price, updatedSize, takerAddress, txOrigin, filledSize`. [V] Published SDK ABI.

Track active order IDs through flip events, not just the initial receipt. `scoreCard` counts spread only on maker fills of IDs originating in `FlippedOrderCreated`; an initial-order fill changes inventory but is not SCORE. Show DAMAGE with the same weight, and use `rangeState` for sit/NAD-SENSE. [I] Product accounting: SPEC 5.6.

## Funding and confirm sequence

[V] Orders require funds already in MarginAccount. For MON, `deposit(user, address(0), amount)` is payable with matching `msg.value`; for AUSD, approve MarginAccount and deposit its raw token amount. Source: [Kuru SDK](https://github.com/Kuru-Labs/kuru-sdk) and SPEC 2.

Follow SPEC 5.5, rendering every transaction link and its own loading step:

1. Read allowance; if insufficient, approve `quoteNeeded + zapQuote` to MarginAccount.
2. Zap with `placeAndExecuteMarketBuy(zapQuote, minOut, true, false)`.
3. Deposit the resting-buy AUSD budget into MarginAccount.
4. Provision encoded arrays in one `batchProvisionLiquidity` transaction and parse IDs.
5. Save the sealed run to DiskRegistry v2. A save failure never blocks play.

[U, S2] If `isMargin=true` does not place purchased MON in MarginAccount, S2 determines the alternative: market-buy to the disk account then native deposit with value. The spike must also confirm the zap's quote funding/allowance path before this sequence is enabled.

On any partial failure, preserve the observable wallet/margin balances and offer WITHDRAW on S7/S8. Never report the whole sequence as atomic. [I] Product recovery rule: SPEC 5.5.

## Gas, reserve balance, and exit

[V] Every state-changing call, including approvals, deposits, zaps, orders, cancellations, withdrawals, and disk saves, passes explicit viem `gas`. Monad charges the declared limit, not only gas used. Derive tight limits from measured calls; gas values are recorded after S2. Source: [gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).

[V] Reserve balance is 10 MON. An undelegated EOA may dip below it through an emptying transaction only when it is the first transaction from that sender in `k=3` blocks. Space value-spending transactions at least three blocks apart, or retain at least 10 MON; receipt confirmation alone does not prove that spacing. Source: [reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance).

Exit in this order: cancel every active flip ID with `batchCancelFlipOrders`, wait for confirmation, then `batchWithdrawMaxTokens([address(0), AUSD])`, confirm, show SCORE/DAMAGE/NET/fills/time with source links, and append the run to the sealed disk. [V] Cancellation and withdrawal ABI; [I] results/save policy: SPEC 5.7. Re-center is exit + replan + provision, with zap fee and gas shown before confirmation.
