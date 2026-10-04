# @monadboy/sdk

Pure chain metadata, typed Kuru ABIs, unit encoding, and flip-ladder planning.
Mainnet is read-only; `markets.testnet.json` stays empty until funded spike S2.

## Runtime and verification

- Bun 1.3.14 installs; Node 24 runs Vitest 4.1.10 in the node environment.
- viem peer range: `^2.28.0`; latest compatible 2.x observed from `npm view viem version`: **2.57.2**, pinned for development.
- `bun run --cwd packages/sdk typecheck`
- `bun run --cwd packages/sdk test:coverage` (per-file `kuru/*.ts` line threshold: 95%).
- Root `typecheck` and `test` include this workspace; the lead runs `bun run verify` after parallel changes land.

## ABI artifact

[V] Generated ABI arrays come from `@kuru-labs/kuru-sdk@0.0.95` without a runtime dependency.
`scripts/vendor-kuru-abis.ts` documents the exact pack/extract/generate commands; extraction must be outside the repo.
The AUSD faucet ABI is hand-written. Seven topic assertions use the full hashes in `docs/research/kuru.md`.

## Live market capture

[V] On 2026-10-05 every command below exited 0 against `https://rpc.monad.xyz`.
`getMarketParams` order: pricePrecision, sizePrecision, baseToken, baseDecimals, quoteToken, quoteDecimals, tickSize, minSize, maxSize, takerFeeBps, makerFeeBps.
Captured values are stored as bigint-bearing metadata in `src/markets.mainnet.ts`.
API tickSize=1 is not trusted: **live MON_USDC tickSize=100**, and all seven live ticks differ from the API.

| Symbol | pricePrecision | sizePrecision | tickSize | minSize | maxSize | base/quote decimals | taker/maker bps | code bytes |
|---|---:|---:|---:|---:|---:|---|---|---:|
| AUSD_USDC | 100000000 | 1000000 | 100 | 10000000 | 10000000000000 | 6/6 | 0/0 | 141 |
| MON_AUSD | 100000000 | 10000000000 | 100 | 2000000000000 | 20000000000000000000 | 18/6 | 0/0 | 141 |
| MON_USDC | 100000000 | 10000000000 | 100 | 2000000000000 | 2000000000000000000 | 18/6 | 0/0 | 141 |
| WBTC_AUSD | 10000 | 100000000 | 10000 | 10000 | 10000000000 | 8/6 | 0/0 | 141 |
| XAUT_USDC | 10000 | 1000000 | 100 | 2000 | 100000000 | 6/6 | 0/0 | 141 |
| WETH_USDC | 10000 | 10000000000 | 100 | 20000000 | 1000000000000000000 | 18/6 | 0/0 | 141 |
| cbBTC_USDC | 10000 | 100000000 | 100 | 12500 | 10000000000 | 8/6 | 0/0 | 141 |

```sh
cast call 0x699abc15308156e9a3ab89ec7387e9cfe1c86a3b 'getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)' --rpc-url https://rpc.monad.xyz
cast code 0x699abc15308156e9a3ab89ec7387e9cfe1c86a3b --rpc-url https://rpc.monad.xyz
cast call 0x131a2e70a5b31a517a74b8c567149bc294470da9 'getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)' --rpc-url https://rpc.monad.xyz
cast code 0x131a2e70a5b31a517a74b8c567149bc294470da9 --rpc-url https://rpc.monad.xyz
cast call 0x065c9d28e428a0db40191a54d33d5b7c71a9c394 'getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)' --rpc-url https://rpc.monad.xyz
cast code 0x065c9d28e428a0db40191a54d33d5b7c71a9c394 --rpc-url https://rpc.monad.xyz
cast call 0xbdc776284bf593981b1f0237f053a7ad11eb596f 'getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)' --rpc-url https://rpc.monad.xyz
cast code 0xbdc776284bf593981b1f0237f053a7ad11eb596f --rpc-url https://rpc.monad.xyz
cast call 0x851145eaefdc37956b08da829fa31722199f3f07 'getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)' --rpc-url https://rpc.monad.xyz
cast code 0x851145eaefdc37956b08da829fa31722199f3f07 --rpc-url https://rpc.monad.xyz
cast call 0xa6afd386135b7d41a6c40c525abc4a1019b0d132 'getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)' --rpc-url https://rpc.monad.xyz
cast code 0xa6afd386135b7d41a6c40c525abc4a1019b0d132 --rpc-url https://rpc.monad.xyz
cast call 0x40c49f171202f91ff5d2fae34c22dd2bfdd22af0 'getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)' --rpc-url https://rpc.monad.xyz
cast code 0x40c49f171202f91ff5d2fae34c22dd2bfdd22af0 --rpc-url https://rpc.monad.xyz
```

[V] Token addresses captured from those calls were separately checked with `cast code <token> --rpc-url https://rpc.monad.xyz`:
AUSD 5937 bytes; USDC 1798; WBTC 13680; XAUT 2227; WETH 177; cbBTC 1182.
Native MON is the zero-address sentinel, not a token contract.

## Formula readings

[I] Automatic ranges implement SPEC 5.4 literally: one-day horizon; k=1.0/2.5; half-width clamp 0.5%..20%;
smallest step in {0.10,0.25,0.50,1.00,2.00}%; ceil(width/step), capped 2..8 per side.
A requested width beyond eight 2% steps shrinks to 16% with `clamped=true`; the initial volatility clamp alone does not set this flag.
Bounds are outer resting prices after outward tick rounding, not flip prices.

[I] Explicit readings where SPEC leaves details open:

- **Zap:** `zapQuote = mid * baseNeeded = mid * sum(sell.size)`. This buys exactly the sell-side base at mid;
  fees, slippage and gas remain execution costs outside the ladder allocation. Resting buys spend `quoteNeeded`.
- **Manual asymmetry:** manual endpoints override mode/volatility, including the automatic 0.5% minimum.
  The wider relative distance chooses the common discrete flip step and level count; each side is linearly spaced
  from mid to its own endpoint. Widths beyond the 16% cap scale both sides proportionally and set `clamped=true`.
  Endpoints are honoured within outward tick dust. This is the manual override of automatic symmetric placement.
- **Small budget:** keep spacing/step fixed, remove the outer pair and recompute sizes. Manual endpoints therefore
  contract too when a budget cannot fund them, as required by the same minimum-size rule; this also sets `clamped=true`.
  Fewer than two pairs throws `AMOUNT_TOO_SMALL`.
- **maxSize:** exceeding it throws RangeError; dropping levels would make sizes even larger, and silently capping
  would break the stated equal allocation and budget invariant.
- **provisionOrRevert:** batch arguments select true, pending S2 verification; no submission is implemented here.
- **Invalid inputs:** non-finite/nonpositive mid gives `NO_PRICE`; invalid manual endpoints give `BAD_MANUAL_RANGE`;
  non-finite/nonpositive budgets give `AMOUNT_TOO_SMALL`; invalid automatic volatility, precision or integer overflow throws RangeError.

[U] Placement price/size encodings await an actual testnet `FlipOrderCreated` and S2 fill proof.
[U] `gas-limits.ts` is deliberately absent: only funded spike S2 gas measurements plus 20% headroom may define it.
No testnet deployment or usable gas limit is asserted.

## Position accounting

`scoreFromFills`, `valueNow`, `valueHodl`, `scoreCard`, and `rangeState` are pure.
Fill prices are quote per base and sizes are filled base amounts; all values use the same quote unit.
Initial-order fills affect inventory only; only `isFlippedOrder` fills earn SCORE.

```text
SCORE = sum(abs(flipPrice - price) * size) over flipped fills
V_now = (marginBase + restingBase) * mid + marginQuote + restingQuote
V_hodl = base0 * mid + quote0
NET = V_now - V_hodl
DAMAGE = max(0, SCORE - NET)
```

D-SCORE rule: NET always preserves the actual valuation difference.
When NET <= SCORE, NET = SCORE - DAMAGE (within floating-point precision).
When NET > SCORE, DAMAGE is zero and NET remains greater than SCORE; surplus is never erased.
Inventories must not double-count resting funds as free margin.
`rangeState` is OUT_OF_RANGE strictly outside `[low, high]`, NAD_SENSE inside and within
one inclusive `step` of either edge, otherwise IN_RANGE. This API takes step in absolute
price units; convert the planner's relative step using the relevant mid before calling it.

## Sealed saves

`deriveSealKey(prf, slot)` uses WebCrypto HKDF-SHA256 with salt `utf8("monadboy/v1")`,
info `utf8("disk:" + slot + ":seal")`, and PRF bytes as input material.
The AES-GCM-256 key is non-extractable and has encrypt/decrypt usages.
`sealDisk` and `openDisk` authenticate `encodePacked(['uint256', 'address', 'address'],
[BigInt(chainId), registry, disk])`: **chainId is exactly 256 bits**, fixed for blob version 1.
Blob layout is `0x01 || random IV(12 bytes) || ciphertext || GCM tag(16 bytes)`.
Changing slot, disk, registry, chain, IV, ciphertext or tag prevents successful restore.

`DiskPlaintext` contains version, name, characterId, palette, difficulty, godMode, notes,
createdAt and runs. Each `RunRecord` contains `{market, openedAt, closedAt, score, damage, fills}`.
Keep the newest ten runs, then drop oldest runs until JSON's UTF-8 encoding fits 1,536 bytes.
Never trim name, characterId, or other non-run fields; throw RangeError if they alone exceed
the limit. Sealing does not mutate the caller's disk. Recovery needs only PRF material,
the slot, onchain ciphertext, and its authenticated context, not a server or local cache.

## Mera-compatible accounts

[V] Derivation follows the [Mera guide](https://docs.monad.xyz/guides/mera):
`entropyToMnemonic(prf, englishWordlist)` -> `mnemonicToSeedSync(mnemonic)` ->
`HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/{index}")`.
`deriveDiskKey` returns that node's private-key bytes; `diskAddresses` returns addresses
for indices 0..3, deriving the master seed once. Index 0 identifies the card; 1..3 are disks.
Account indices must be integers in `[0, 2^31)`; the final path segment is non-hardened.
Keep PRF bytes, mnemonic, seed, and private keys in trusted client memory only.
No passkey ceremony/session package is installed in this SDK.

[V] Exact runtime pins: `@scure/bip32` **2.4.0** and `@scure/bip39` **2.4.0**,
reported by `npm view @scure/bip32 version` and `npm view @scure/bip39 version` on 2026-10-05.
The current English wordlist export is `@scure/bip39/wordlists/english.js`.
Coverage includes `kuru/*.ts`, `seal.ts`, and `mera.ts`, with a per-file line threshold of 95%.
