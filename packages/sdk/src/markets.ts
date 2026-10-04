import type { Address } from 'viem'
import type { CHAIN } from './chains'
import type { MarketParams } from './kuru/encoding'
import { mainnetMarkets } from './markets.mainnet'
import testnetManifest from './markets.testnet.json'

export type Market = {
  chain: CHAIN
  address: Address
  symbol: string
  baseSymbol: string
  quoteSymbol: string
  baseToken: Address
  quoteToken: Address
  params: MarketParams
}

// S2 adds deployed markets; bigint fields in JSON use decimal strings.
type MarketJson = Omit<Market, 'params'> & {
  params: Omit<MarketParams, 'pricePrecision' | 'sizePrecision' | 'tickSize' | 'minSize' | 'maxSize'> & {
    pricePrecision: string; sizePrecision: string; tickSize: string; minSize: string; maxSize: string
  }
}
export const testnetMarkets: readonly Market[] = (testnetManifest as MarketJson[]).map((market) => ({
  ...market,
  params: {
    ...market.params,
    pricePrecision: BigInt(market.params.pricePrecision), sizePrecision: BigInt(market.params.sizePrecision),
    tickSize: BigInt(market.params.tickSize), minSize: BigInt(market.params.minSize), maxSize: BigInt(market.params.maxSize),
  },
}))

export function marketsForChain(chain: CHAIN): readonly Market[] {
  return chain === 'testnet' ? testnetMarkets : mainnetMarkets
}
