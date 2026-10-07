# Kuru research

Evidence checked 2026-10-05. **[V]** is fetched documentation, SDK artifact or observed command evidence; **[I]** is inference/design; **[U]** names the pending spike. Mainnet is read-only; playable MONADBOY positions use testnet.

## Flip-order concept

[V] Verbatim from [Kuru flip orders](https://docs.kuru.io/concepts/flip-orders):

> Flip orders are a new type of limit order that automatically ‘flips’ liquidity on the opposite side of the book after each fill. Think of it like setting a post-fill action for your order.

> Each fill is treated independently and flipped as soon as it is matched. Orders stay passive and follow price-time priority like any other limit order.

> This provides fine-grained control like CLMMs (ex: Uniswap v3) directly on the order book.

[I] STAY IN RANGE expresses a range as a ladder of paired prices. AUTOPILOT means native flip re-arming, not an external keeper re-centering the range. Re-centering is manual and its gas/zap cost is shown. Initial fills change inventory; only fills of orders identified through `FlippedOrderCreated` contribute realized spread to SCORE.

## ABI authority and extraction

[V] `npm pack @kuru-labs/kuru-sdk@0.0.95 --pack-destination "$TEMP_DIR"` downloaded the package outside this repository; `tar -xzf "$TEMP_DIR/kuru-labs-kuru-sdk-0.0.95.tgz" -C "$TEMP_DIR"` exposed `package/abi/OrderBook.json`, `Router.json` and `MarginAccount.json`. These artifact objects contain the ABI in their `abi` property. Package provenance: [npm 0.0.95](https://www.npmjs.com/package/@kuru-labs/kuru-sdk/v/0.0.95).

[V] Its `package/package.json` declares `ethers: "5.7.1"`. [I] The SDK is **not a runtime dependency**: vendor its ABI arrays as typed `as const` data, consult its maths as reference, and use viem for all chain I/O. Do not import an ethers-backed signing/client stack.

## Contract surface we call

[V] Exact signatures below are from the packed 0.0.95 ABI, not hand-transcribed contract docs. All OrderBook writes below are nonpayable except the two market-order calls, which are payable.

```solidity
// OrderBook: provisioning, individual-order fallback, exit
batchProvisionLiquidity(uint32[] prices,uint32[] flipPrices,uint96[] sizes,bool[] isBuy,bool provisionOrRevert)
addFlipBuyOrder(uint32 price,uint32 flippedPrice,uint96 size,bool provisionOrRevert)
addFlipSellOrder(uint32 price,uint32 flippedPrice,uint96 size,bool provisionOrRevert)
batchCancelFlipOrders(uint40[] orderIds)
// Mirror bot: ordinary resting orders and capped taker trades
batchUpdate(uint32[] buyPrices,uint96[] buySizes,uint32[] sellPrices,uint96[] sellSizes,uint40[] orderIdsToCancel,bool postOnly)
placeAndExecuteMarketBuy(uint96 quoteSize,uint256 minAmountOut,bool isMargin,bool isFillOrKill) payable returns(uint256)
placeAndExecuteMarketSell(uint96 size,uint256 minAmountOut,bool isMargin,bool isFillOrKill) payable returns(uint256)
// Reads
bestBidAsk() view returns(uint256,uint256)
getL2Book() view returns(bytes)
getMarketParams() view returns(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)
// MarginAccount
 deposit(address user,address token,uint256 amount) payable
 getBalance(address user,address token) view returns(uint256)
 batchWithdrawMaxTokens(address[] tokens)
// Router factory
 deployProxy(uint8 marketType,address base,address quote,uint96 sizePrecision,uint32 pricePrecision,uint32 tickSize,uint96 minSize,uint96 maxSize,uint256 takerFeeBps,uint256 makerFeeBps,uint96 kuruAmmSpread) returns(address proxy)
```

[V] `getMarketParams` order is price precision, size precision, base asset, base decimals, quote asset, quote decimals, tick size, min size, max size, taker fee bps, maker fee bps. Source: packed SDK `package/src/market/marketParams.ts`, `ParamFetcher.getMarketParams`, indices 0..10. `getBalance` reads the user's token balance in MarginAccount; its signature is from the SDK ABI.

[I] AUSD approval precedes its margin deposit; native MON is represented by Solidity `address(0)` and attached `msg.value`. The sentinel is not a deployed token contract. Exit cancels all flip IDs before `batchWithdrawMaxTokens([address(0), AUSD])`.

[V] The [OrderBook SDK guide](https://docs.kuru.io/sdk/orderbook-sdk) explicitly requires funds already deposited into MarginAccount and sufficient token allowance before placing limit orders. Its receipt decoder also uses the SDK's non-indexed `Trade` payload.

[V, S2 2026-10-07] Actual testnet 2+2 and 8+8 bulk provision succeeded, with initial and flipped-origin maker fills. Placement uses pricePrecision/sizePrecision as proposed. Market-buy quote uses **pricePrecision**, not ERC-20 quote decimals; minOut uses raw output-token decimals. Margin mode requires quote deposit before the buy and credits output to margin. Receipt-backed findings and gas shapes are in [SMART-CONTRACTS](../technical/SMART-CONTRACTS.md).

[V] Permissionless factory simulation: `cast call 0x7EFbE105Ca7415dE98F96622173458ac1c054630 "deployProxy(uint8,address,address,uint96,uint32,uint32,uint96,uint96,uint256,uint256,uint96)(address)" 1 "$NATIVE_SENTINEL" 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC 10000000000 100000000 1 100000000 79228162514264337593543950335 30 0 30 --from "$RANDOM_SENDER" --rpc-url https://testnet-rpc.monad.xyz` returned a market address, exit 0. NATIVE_SENTINEL is Solidity `address(0)`; the sender was a fresh random EOA. This is eth_call only, not a deployed market or a funded transaction; final parameters remain S2-owned.

## Docs versus live events

[V] [OrderBook contract docs](https://docs.kuru.io/contracts/OrderBook) show `Trade.price` as uint32 and indexed addresses. The SDK uses **uint256 price and no indexed inputs** for all seven events below. Indexing annotations do not change the topic hash, but do change data decoding. Do not use docs-derived indexed filters.

[V] Other concrete ABI differences on that docs page: market-order `minOut` is shown as uint96 instead of SDK uint256; `bestBidAsk` is shown returning uint32 instead of uint256; the docs' three-array `batchProvisionLiquidity` is not the SDK's flip-price/five-argument call. S2 settles runtime semantics, not those documentation descriptions.

[V] Each topic below was computed with `cast keccak "<exact signature>"`. All prefixes match the approved specification's seven event prefixes.

| Exact signature | Full topic hash |
|---|---|
| `Trade(uint40,address,bool,uint256,uint96,address,address,uint96)` | [V] `0xf16924fba1c18c108912fcacaac7450c98eb3f2d8c0a3cdf3df7066c08f21581` |
| `OrderCreated(uint40,address,uint96,uint32,bool)` | [V] `0xb81bbaf150467ef3096ed6220cb963abc169bffd2eb88f26c47359ef344cf94c` |
| `OrdersCanceled(uint40[],address)` | [V] `0x386974f41b61738b510019ccd5a3524a43eccf0d136929e09d524e87aeeca2c4` |
| `FlipOrderCreated(uint40,uint40,address,uint96,uint32,uint32,bool)` | [V] `0xf81d3fdea8a7ee9c5c09179882e1bce1c513a741146e453167d9e8912c8eb3aa` |
| `FlippedOrderCreated(uint40,uint40,address,uint96,uint32,uint32,bool)` | [V] `0x49496a41b922bdba3ff7f57bb0992ab1a1a3ee95b5ae5bd7271c67861f018352` |
| `FlipOrderUpdated(uint40,uint96)` | [V] `0xb74e966bc873b8c144fab39c9981210f50130885e89caf4556c0840cec741dcd` |
| `FlipOrdersCanceled(uint40[],address)` | [V] `0x5f815e5292cf3b123df58ad6d4531c085d94d5717a3b02740369a04273fde96c` |

[V] The incorrect docs signature `Trade(uint40,address,bool,uint32,uint96,address,address,uint96)` hashes to `0xf701de798e9614f3caea30399a51e3355d32e7a96bf4656d8045a6792bffa40f`, a different event filter.

[V] Live corroboration: `cast logs --from-block 110527910 --to-block 110528009 --address 0x065c9d28e428a0db40191a54d33d5b7c71a9c394 0xf16924fba1c18c108912fcacaac7450c98eb3f2d8c0a3cdf3df7066c08f21581 --rpc-url https://rpc.monad.xyz --json` returned one Trade. Transaction `0x5f9b46d4eca1d67bfcbb0148462e9d560a33edff32b971c41aa7318bc1905001`, block 110527924, has **one topic** and **256 data bytes**. `cast abi-decode "f()(uint40,address,bool,uint256,uint96,address,address,uint96)" "$DATA"` decoded price 33364000000000000, beyond uint32. No participant addresses are needed in configuration.

[V, S2] Our provision receipt `0x2adc195bf81514bbb045bfc72196a65b24bc15a5e8802ca5b752d79efa0a6b59` created four flip orders. Initial sell `0x2cd0db5af73081ec5d124530ccdb3affa243894429bef9fee9b608a5668f270b` filled ID1 and created ID5; buy `0x67da3e57a50aa7b40b7726a66f11be18a64b9fd6bf8bf5244c87b8a799be1d24` filled flipped-origin ID5 and created ID6. Trade.isBuy is the **taker** side: invert it for maker inventory views. Flip sizes compound price ratio; a partial fill can leave both linked members active.

## Deployment checks

[V] Each row was checked using `cast code <full-address> --rpc-url <chain-rpc>` on 2026-10-05. Testnet RPC is `https://testnet-rpc.monad.xyz`; mainnet RPC is `https://rpc.monad.xyz`. Non-empty proxy code proves presence, not implementation safety or market liquidity. Sources: [Kuru deployments](https://docs.kuru.io/contracts/Contract-addresses), [exchangeInfo](https://exchange.kuru.io/api/v3/exchangeInfo).

| Chain | Contract | Full address | Code bytes |
|---|---|---|---|
| Testnet | Router | `0x7EFbE105Ca7415dE98F96622173458ac1c054630` | [V] 141 |
| Testnet | MarginAccount | `0xd029C2D98ff85D8F64799017fE00a59B1159CE02` | [V] 141 |
| Testnet | Official MON_USDC | `0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9` | [V] 141 |
| Testnet | USDC | `0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570` | [V] 1,737 |
| Mainnet | Router | `0xd651346d7c789536ebf06dc72aE3C8502cd695CC` | [V] 141 |
| Mainnet | MarginAccount | `0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5` | [V] 141 |

[V] `cast call 0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570 "decimals()(uint8)" --rpc-url https://testnet-rpc.monad.xyz` returned 6. AUSD token/faucet checks are in [AUSD research](ausd.md); they are not interchangeable with USDC.

## Seven mainnet exchangeInfo markets

[V] [exchangeInfo](https://exchange.kuru.io/api/v3/exchangeInfo) supplies these seven full market addresses and precision fields. All were independently code-checked on mainnet. These are read-only sources, not playable mainnet positions.

| Symbol | Full market address | Code bytes | pricePrecision | sizePrecision |
|---|---|---|---|---|
| AUSD_USDC | `0x699abc15308156e9a3ab89ec7387e9cfe1c86a3b` | [V] 141 | 100000000 | 1000000 |
| MON_AUSD | `0x131a2e70a5b31a517a74b8c567149bc294470da9` | [V] 141 | 100000000 | 10000000000 |
| MON_USDC | `0x065c9d28e428a0db40191a54d33d5b7c71a9c394` | [V] 141 | 100000000 | 10000000000 |
| WBTC_AUSD | `0xbdc776284bf593981b1f0237f053a7ad11eb596f` | [V] 141 | 10000 | 100000000 |
| XAUT_USDC | `0x851145eaefdc37956b08da829fa31722199f3f07` | [V] 141 | 10000 | 1000000 |
| WETH_USDC | `0xa6afd386135b7d41a6c40c525abc4a1019b0d132` | [V] 141 | 10000 | 10000000000 |
| cbBTC_USDC | `0x40c49f171202f91ff5d2fae34c22dd2bfdd22af0` | [V] 141 | 10000 | 100000000 |

[V] The same response reports tickSize 1 for all seven. [I] API trading status is not evidence that the order book has usable two-sided depth.

## Live price and empty-book findings

[V] Commands run 2026-10-05:

```sh
cast call 0x065c9d28e428a0db40191a54d33d5b7c71a9c394 "bestBidAsk()(uint256,uint256)" --rpc-url https://rpc.monad.xyz
# bid 33240000000000000; ask 33288000000000000
cast call 0x131a2e70a5b31a517a74b8c567149bc294470da9 "bestBidAsk()(uint256,uint256)" --rpc-url https://rpc.monad.xyz
# bid 115792089237316195423570985008687907853269984665640564039457584007913129639935; ask 0
cast call 0x699abc15308156e9a3ab89ec7387e9cfe1c86a3b "bestBidAsk()(uint256,uint256)" --rpc-url https://rpc.monad.xyz
# bid 1000067000000000000; ask 1000836000000000000
```

[V] `bestBidAsk` uses **1e18** scaling: MON_USDC bid 0.03324, ask 0.033288, mid 0.033264; AUSD_USDC bid 1.000067, ask 1.000836. These view prices are not the integer `pricePrecision` units used to place a limit order. The packed SDK's `package/examples/v2/calculatePriceRange.ts` converts `bestAsk * pricePrecision / 1e18` and displays `bestAsk / 1e18`; its `package/src/market/orderBook.ts` also formats Trade price at 18 decimals. The observed stablecoin read independently corroborates the scale.

[V] MON_AUSD returns `(2^256 - 1, 0)`, the empty-book sentinel. Five `cast logs` calls for its address with inclusive ranges 110527510–110527609, 110527610–110527709, 110527710–110527809, 110527810–110527909 and 110527910–110528009 each returned `[]`: zero events over those 500 blocks. Command form: `cast logs --from-block <start> --to-block <end> --address 0x131a2e70a5b31a517a74b8c567149bc294470da9 --rpc-url https://rpc.monad.xyz --json`.

[V] The public RPC rejected a 500-block range with HTTP 413, error -32614, `eth_getLogs is limited to a 100 range`. Bounded 100-block calls succeeded. [I] Chunk reads even before considering an optional paid RPC.

[I] The mirror therefore reads mainnet **MON_USDC**, not empty MON_AUSD, and drives our testnet MON-AUSD book. Treating AUSD and USDC as one USD is an explicit quote assumption. Empty books score as thin in Pool Tracker and never manufacture a price.

## Findings

[V] **S1 PASS:** successful explicit-gas receipt delivered10,000AUSD; global60second faucet cooldown and immediate refusal observed. Role transfers are distinct from faucet grants; successful faucet Transfer comes from the faucet, not the zero address. See [AUSD](ausd.md).

[V] **S2 PASS:** deployed our native MON-AUSD at `0xD9F66B3bdBb1741f33e01fA3Acb514623e0a60Bc`, block68940637, code141bytes. Independent getMarketParams readback agrees with the manifest. Passive provisioning, both trading modes, raw-token minOut, linked-pair cancel, withdrawals and maximum ladder have public receipts. Cancel one ID per linked pair: supplying both reverted OrderAlreadyFilledOrCancelled in simulation, while deduplicated cancellation succeeded.

[V, S3] Actual deployed-book reads at block68947216 found 2.2409591305 MON of bid depth and approximately 0.06 AUSD of ask depth within ±3%; available inventory exceeds this observed depth. Sparse price levels do not guarantee an exact ±3% landing. One real player drip pays 0.5 MON +10 AUSD and costs 108,502 declared gas across two receipts; twenty payouts require 10 MON +200 AUSD plus 0.221344080 MON gas at the observed 102 gwei. Reserve-preserving and block-spaced emptying budgets are distinct; see the live blocker register.

[V, S5 PASS] Self-hosted HyperIndex indexed the real market/registry from block68939801. Initial HyperSync-only fresh-fill latency16.620s failed and remains recorded. Pinned alpha live-RPC ingestion then exposed three sells and native-card flipped buy `0x10883c2ff43adb087f22c17fd798e1b5024219f18ccb17aa72fb4b6f418022aa` within564–570ms after observed receipts, sampled300ms. Client/indexer/worker SCORE all equal0.000002997833732854715AUSD for disk0x0179524E6CaCD825Dc1Ea6E9B538550159a7C824. Public `native-counter-*.json`, `indexer-native-observations.json` and `native-score-parity.json` contain real timestamps/rows; local proof is not public-host uptime.
