import { describe, expect, it } from 'vitest'
import { batchProvisionArgs, planLadder } from './ladder'
import type { LadderInput } from './ladder'

const input: LadderInput = {
  mid: 10, mode: 'TIGHT', budgetQuote: 100, sigmaDaily: 0.02,
  params: {
    pricePrecision: 100000000n, sizePrecision: 10000000000n, tickSize: 100n,
    minSize: 1n, maxSize: (1n << 96n) - 1n, baseDecimals: 18,
    quoteDecimals: 6, takerFeeBps: 0, makerFeeBps: 0,
  },
}

describe('flip ladder planning', () => {
  it('makes TIGHT narrower than WIDE for the same volatility', () => {
    const tight = planLadder(input)
    const wide = planLadder({ ...input, mode: 'WIDE' })
    expect(tight.high - tight.low).toBeLessThan(wide.high - wide.low)
    expect(tight.step).toBe(0.0025)
    expect(tight.levels).toBe(8)
  })

  it.each([0, 0.001, 0.005, 0.01, 0.03, 0.08, 0.16, 0.2, 0.5])
  ('keeps 2..8 paired levels with tick-aligned passive prices at sigma %s', (sigmaDaily) => {
    const ladder = planLadder({ ...input, sigmaDaily })
    expect(ladder.levels).toBeGreaterThanOrEqual(2)
    expect(ladder.levels).toBeLessThanOrEqual(8)
    expect(ladder.orders.filter((order) => order.isBuy)).toHaveLength(ladder.levels)
    expect(ladder.orders.filter((order) => !order.isBuy)).toHaveLength(ladder.levels)
    for (const order of ladder.orders) {
      expect(order.priceUnits % 100).toBe(0)
      expect(order.flipUnits % 100).toBe(0)
      if (order.isBuy) {
        expect(order.price).toBeLessThan(input.mid)
        expect(order.flipPrice).toBeGreaterThan(order.price)
      } else {
        expect(order.price).toBeGreaterThan(input.mid)
        expect(order.flipPrice).toBeLessThan(order.price)
      }
    }
  })

  it('uses SPEC rounded prices, outward buys and inward sell flips', () => {
    const ladder = planLadder({ ...input, sigmaDaily: 0.005 })
    expect(ladder.step).toBe(0.001)
    expect(ladder.orders[0]).toMatchObject({ price: 9.99, flipPrice: 9.99999, priceUnits: 999000000, flipUnits: 999999000 })
    const sell = ladder.orders.find((order) => !order.isBuy)!
    expect(sell).toMatchObject({ price: 10.01, flipPrice: 10, priceUnits: 1001000000, flipUnits: 1000000000 })
    expect(ladder.low).toBe(9.95)
    expect(ladder.high).toBe(10.05)
  })

  it('funds sells by a mid-price zap and conserves budget within size dust', () => {
    const ladder = planLadder(input)
    const buys = ladder.orders.filter((order) => order.isBuy)
    const sells = ladder.orders.filter((order) => !order.isBuy)
    const quote = buys.reduce((total, order) => total + order.price * order.size, 0)
    const base = sells.reduce((total, order) => total + order.size, 0)
    expect(ladder.quoteNeeded).toBeCloseTo(quote, 12)
    expect(ladder.baseNeeded).toBeCloseTo(base, 12)
    expect(ladder.zapQuote).toBeCloseTo(base * 10, 12)
    expect(quote + ladder.zapQuote).toBeLessThanOrEqual(input.budgetQuote + 1e-12)
    expect(input.budgetQuote - quote - ladder.zapQuote).toBeLessThan(2 * ladder.levels * 10 / 1e10)
    expect(ladder.zapQuote).toBe(50)
  })

  it('drops outer pairs and recomputes size before declaring a budget too small', () => {
    const small = { ...input, params: { ...input.params, minSize: 10000000000n } }
    const ladder = planLadder({ ...small, budgetQuote: 80 })
    expect(ladder.levels).toBe(4)
    expect(ladder.clamped).toBe(true)
    expect(ladder.low).toBe(9.9)
    expect(ladder.high).toBe(10.1)
    expect(ladder.orders.every((order) => order.sizeUnits >= 10000000000n)).toBe(true)
    expect(() => planLadder({ ...small, budgetQuote: 39 })).toThrowError(expect.objectContaining({ code: 'AMOUNT_TOO_SMALL' }))
  })

  it('marks width shrinkage at the largest step and the eight-level cap', () => {
    const ladder = planLadder({ ...input, sigmaDaily: 0.2 })
    expect(ladder).toMatchObject({ clamped: true, step: 0.02, levels: 8, low: 8.4, high: 11.6 })
    expect(planLadder({ ...input, sigmaDaily: 0.16 }).clamped).toBe(false)
  })

  it('honours asymmetric manual endpoints regardless of mode or volatility', () => {
    const manual = { low: 9.8, high: 10.3 }
    const tight = planLadder({ ...input, manual })
    const wide = planLadder({ ...input, mode: 'WIDE', sigmaDaily: 0.8, manual })
    expect(tight).toEqual(wide)
    expect(tight.low).toBeCloseTo(9.8, 6)
    expect(tight.high).toBeCloseTo(10.3, 6)
    expect(tight.clamped).toBe(false)
  })

  it.each([{ low: 0, high: 11 }, { low: 11, high: 9 }, { low: 10, high: 11 },
    { low: 9, high: 10 }, { low: NaN, high: 11 }, { low: 9, high: Infinity }])
  ('rejects a manual range without finite positive endpoints surrounding mid: %s', (manual) => {
    expect(() => planLadder({ ...input, manual })).toThrowError(expect.objectContaining({ code: 'BAD_MANUAL_RANGE' }))
  })

  it('caps oversized manual widths consistently with automatic widths', () => {
    expect(planLadder({ ...input, manual: { low: 5, high: 15 } })).toMatchObject({ clamped: true, low: 8.4, high: 11.6 })
  })

  it.each([NaN, 0, -1, Infinity])('rejects unavailable mid %s', (mid) => {
    expect(() => planLadder({ ...input, mid })).toThrowError(expect.objectContaining({ code: 'NO_PRICE' }))
  })

  it.each([0, -1, NaN, Infinity])('rejects unusable budget %s', (budgetQuote) => {
    expect(() => planLadder({ ...input, budgetQuote })).toThrowError(expect.objectContaining({ code: 'AMOUNT_TOO_SMALL' }))
  })

  it('rejects sizes exceeding maxSize rather than planning an invalid order', () => {
    expect(() => planLadder({ ...input, params: { ...input.params, maxSize: 1n } })).toThrow(RangeError)
  })

  it('rejects a tick so coarse that the buy rounds to zero', () => {
    expect(() => planLadder({ ...input, params: { ...input.params, tickSize: 1000000000n } }))
      .toThrowError(expect.objectContaining({ code: 'NO_PRICE' }))
  })

  it('rejects unavailable automatic volatility but lets manual override it', () => {
    expect(() => planLadder({ ...input, sigmaDaily: NaN })).toThrow(RangeError)
    expect(() => planLadder({ ...input, sigmaDaily: -1 })).toThrow(RangeError)
    expect(planLadder({ ...input, sigmaDaily: NaN, manual: { low: 9.8, high: 10.2 } }).levels).toBe(8)
  })

  it('is deterministic and emits ABI-ready aligned batch arrays', () => {
    const ladder = planLadder(input)
    expect(planLadder(input)).toEqual(ladder)
    const [prices, flips, sizes, buys, provisionOrRevert] = batchProvisionArgs(ladder)
    expect(prices[0]).toBe(997500000)
    expect(flips[0]).toBe(999993800)
    expect(sizes[0]).toBe(6265664160n)
    expect(buys[0]).toBe(true)
    expect(prices.at(-1)).toBe(1020000000)
    expect(buys.at(-1)).toBe(false)
    expect(provisionOrRevert).toBe(true)
    expect(prices).toHaveLength(ladder.orders.length)
  })
})
