import type { Market } from './markets'

// [V] Live getMarketParams and cast code, 2026-10-05; commands/results in README.md.
// These markets are read-only. API tickSize=1 is not used.
export const mainnetMarkets = [
  {
    chain: 'mainnet',
    symbol: 'AUSD_USDC', address: '0x699abc15308156e9a3ab89ec7387e9cfe1c86a3b',
    baseSymbol: 'AUSD', quoteSymbol: 'USDC',
    baseToken: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a', quoteToken: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    params: {
      pricePrecision: 100000000n, sizePrecision: 1000000n, tickSize: 100n,
      minSize: 10000000n, maxSize: 10000000000000n,
      baseDecimals: 6, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
    },
  },
  {
    chain: 'mainnet',
    symbol: 'MON_AUSD', address: '0x131a2e70a5b31a517a74b8c567149bc294470da9',
    baseSymbol: 'MON', quoteSymbol: 'AUSD',
    baseToken: '0x0000000000000000000000000000000000000000', quoteToken: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
    params: {
      pricePrecision: 100000000n, sizePrecision: 10000000000n, tickSize: 100n,
      minSize: 2000000000000n, maxSize: 20000000000000000000n,
      baseDecimals: 18, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
    },
  },
  {
    chain: 'mainnet',
    symbol: 'MON_USDC', address: '0x065c9d28e428a0db40191a54d33d5b7c71a9c394',
    baseSymbol: 'MON', quoteSymbol: 'USDC',
    baseToken: '0x0000000000000000000000000000000000000000', quoteToken: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    params: {
      pricePrecision: 100000000n, sizePrecision: 10000000000n, tickSize: 100n,
      minSize: 2000000000000n, maxSize: 2000000000000000000n,
      baseDecimals: 18, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
    },
  },
  {
    chain: 'mainnet',
    symbol: 'WBTC_AUSD', address: '0xbdc776284bf593981b1f0237f053a7ad11eb596f',
    baseSymbol: 'WBTC', quoteSymbol: 'AUSD',
    baseToken: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', quoteToken: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
    params: {
      pricePrecision: 10000n, sizePrecision: 100000000n, tickSize: 10000n,
      minSize: 10000n, maxSize: 10000000000n,
      baseDecimals: 8, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
    },
  },
  {
    chain: 'mainnet',
    symbol: 'XAUT_USDC', address: '0x851145eaefdc37956b08da829fa31722199f3f07',
    baseSymbol: 'XAUT', quoteSymbol: 'USDC',
    baseToken: '0x01bFF41798a0BcF287b996046Ca68b395DbC1071', quoteToken: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    params: {
      pricePrecision: 10000n, sizePrecision: 1000000n, tickSize: 100n,
      minSize: 2000n, maxSize: 100000000n,
      baseDecimals: 6, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
    },
  },
  {
    chain: 'mainnet',
    symbol: 'WETH_USDC', address: '0xa6afd386135b7d41a6c40c525abc4a1019b0d132',
    baseSymbol: 'WETH', quoteSymbol: 'USDC',
    baseToken: '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242', quoteToken: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    params: {
      pricePrecision: 10000n, sizePrecision: 10000000000n, tickSize: 100n,
      minSize: 20000000n, maxSize: 1000000000000000000n,
      baseDecimals: 18, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
    },
  },
  {
    chain: 'mainnet',
    symbol: 'cbBTC_USDC', address: '0x40c49f171202f91ff5d2fae34c22dd2bfdd22af0',
    baseSymbol: 'cbBTC', quoteSymbol: 'USDC',
    baseToken: '0xd18B7EC58Cdf4876f6AFebd3Ed1730e4Ce10414b', quoteToken: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    params: {
      pricePrecision: 10000n, sizePrecision: 100000000n, tickSize: 100n,
      minSize: 12500n, maxSize: 10000000000n,
      baseDecimals: 8, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
    },
  },
] as const satisfies readonly Market[]
