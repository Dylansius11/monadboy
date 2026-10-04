import { describe, expect, it } from 'vitest'
import type { PublicClient } from 'viem'
import { bestBidAsk1e18, priceToUnits, readMarketParams, sizeToUnits, unitsToPrice, unitsToSize } from './encoding'
import type { MarketParams } from './encoding'
import { monUsdcParamsResult } from './fixtures/mon-usdc'

const params: MarketParams = {
  pricePrecision: 100000000n, sizePrecision: 10000000000n, tickSize: 100n,
  minSize: 2000000000000n, maxSize: 2000000000000000000n,
  baseDecimals: 18, quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
}

describe('Kuru unit encoding', () => {
  it('maps all fields of a captured real getMarketParams result', async () => {
    const client = { readContract: async () => monUsdcParamsResult } as unknown as PublicClient
    expect(await readMarketParams(client, '0x065c9d28e428a0db40191a54d33d5b7c71a9c394')).toEqual(params)
  })

  it.each([
    [0.0332649, 'down', 3326400], [0.0332649, 'up', 3326500],
    [0.033264, 'down', 3326400], [0.033264, 'up', 3326400],
    [0.29, 'down', 29000000], [0.29, 'up', 29000000],
  ] as const)('rounds %s %s to tick-aligned %s', (price, round, units) => {
    expect(priceToUnits(price, params, round)).toBe(units)
    expect(units % 100).toBe(0)
  })

  it('converts integer and bigint book prices back to quote per base', () => {
    expect(unitsToPrice(3326400, params)).toBe(0.033264)
    expect(unitsToPrice(3326400n, params)).toBe(0.033264)
  })

  it.each([43, -1, NaN, Infinity])('rejects invalid or overflowing uint32 price %s', (price) => {
    expect(() => priceToUnits(price, params, 'up')).toThrow(RangeError)
  })

  it('checks overflow after upward tick rounding', () => {
    expect(() => priceToUnits(4294967295, { ...params, pricePrecision: 1n }, 'up')).toThrow(RangeError)
  })

  it('floors fractional sizes without treating them as ERC20 raw units', () => {
    expect(sizeToUnits(1.00000000019, params)).toBe(10000000001n)
    expect(sizeToUnits(0.29, { ...params, sizePrecision: 100n })).toBe(29n)
    expect(unitsToSize(10000000001n, params)).toBe(1.0000000001)
  })

  it.each([-1, NaN, Infinity, 2 ** 96])('rejects invalid or overflowing uint96 size %s', (size) => {
    expect(() => sizeToUnits(size, { ...params, sizePrecision: 1n })).toThrow(RangeError)
  })

  it('rejects invalid precision and tick parameters', () => {
    expect(() => priceToUnits(1, { ...params, tickSize: 0n }, 'down')).toThrow(RangeError)
    expect(() => priceToUnits(1, { ...params, pricePrecision: 0n }, 'up')).toThrow(RangeError)
    expect(() => sizeToUnits(1, { ...params, sizePrecision: 0n })).toThrow(RangeError)
  })

  it('removes empty-book sentinels before numeric conversion', () => {
    expect(bestBidAsk1e18([(1n << 256n) - 1n, 0n])).toEqual({ bid: null, ask: null })
    expect(bestBidAsk1e18([1000000000000000000n, 0n])).toEqual({ bid: 1, ask: null })
  })

  it('decodes the live AUSD_USDC 1e18 sample independently of book precision', () => {
    expect(bestBidAsk1e18([1000067000000000000n, 1000836000000000000n]))
      .toEqual({ bid: 1.000067, ask: 1.000836 })
  })
})
