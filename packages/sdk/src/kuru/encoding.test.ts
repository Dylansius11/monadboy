import { describe, expect, it } from 'vitest'
import { decodeEventLog } from 'viem'
import type { PublicClient } from 'viem'
import { bestBidAsk1e18, priceToUnits, quoteToUnits, readMarketParams, sizeToUnits, unitsToPrice, unitsToSize } from './encoding'
import type { MarketParams } from './encoding'
import { monUsdcParamsResult } from './fixtures/mon-usdc'
import { monAusdCreatedLog } from './fixtures/mon-ausd-provision'
import { kuruOrderbookAbi } from '../abi/kuru-orderbook'

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

  it('encodes the observed 0.0603 AUSD taker buy in book quote precision, not token decimals', () => {
    expect(quoteToUnits(0.0603, params)).toBe(6_030_000n)
    expect(quoteToUnits(0.010000009, params)).toBe(1_000_000n)
    expect(quoteToUnits(50, params)).toBe(5_000_000_000n)
  })

  it.each([-1, NaN, Infinity, 2 ** 96])('rejects invalid or overflowing uint96 quote %s', (quote) => {
    expect(() => quoteToUnits(quote, { ...params, pricePrecision: 1n })).toThrow(RangeError)
  })

  it('rejects zero quote precision rather than sending a zero-sized market order', () => {
    expect(() => quoteToUnits(1, { ...params, pricePrecision: 0n })).toThrow(RangeError)
  })

  it('interprets the captured testnet flip-order price and size in the observed book units', () => {
    const event = decodeEventLog({
      abi: kuruOrderbookAbi,
      eventName: 'FlipOrderCreated',
      data: monAusdCreatedLog.data,
      topics: [...monAusdCreatedLog.topics],
    })
    if (!event.args) throw new Error('Captured FlipOrderCreated log could not be decoded')
    const observed = { ...params, tickSize: 1n, minSize: 15_000_000_000n, maxSize: (1n << 96n) - 1n, takerFeeBps: 30 }
    expect(unitsToPrice(event.args.price, observed)).toBe(0.032967)
    expect(unitsToSize(event.args.size, observed)).toBe(1.82000182)
    expect(priceToUnits(0.032967, observed, 'down')).toBe(event.args.price)
    expect(sizeToUnits(1.82000182, observed)).toBe(event.args.size)
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
