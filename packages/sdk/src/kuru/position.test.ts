import { describe, expect, it } from 'vitest'
import { rangeState, scoreCard, scoreFromFills, valueHodl, valueNow } from './position'
import type { Fill } from './position'

const fill: Fill = {
  orderId: 1n, price: 100, size: 2, isBuy: true, isFlippedOrder: false,
  flipPrice: 110, tx: '0x01', at: 1,
}

function randomSource(seed: number): () => number {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

describe('position accounting', () => {
  it('counts inventory-changing initial fills as zero SCORE', () => {
    expect(scoreFromFills([fill, { ...fill, isBuy: false }])).toBe(0)
    expect(scoreFromFills([])).toBe(0)
  })

  it('sums realized absolute spread times filled size on both flipped sides', () => {
    expect(scoreFromFills([
      fill,
      { ...fill, isFlippedOrder: true, size: 0.5 },
      { ...fill, isFlippedOrder: true, isBuy: false, price: 120, flipPrice: 100, size: 1.25 },
    ])).toBe(30)
  })

  it('values free margin and resting inventory at the same current mid as HODL', () => {
    expect(valueNow({ marginBase: 2, restingBase: 3, marginQuote: 7, restingQuote: 11 }, 4)).toBe(38)
    expect(valueHodl({ base0: 5, quote0: 13 }, 4)).toBe(33)
  })

  it.each([
    [90, 10, 20, -10], [105, 10, 5, 5], [110, 10, 0, 10], [125, 10, 0, 25],
  ])('preserves actual NET for current quote value %s', (quote, score, damage, net) => {
    expect(scoreCard([{ ...fill, isFlippedOrder: true, size: 1 }],
      { marginBase: 0, restingBase: 0, marginQuote: quote, restingQuote: 0 },
      { base0: 0, quote0: 100 }, 100)).toEqual({ score, damage, net })
  })

  it('preserves the clamped D-SCORE identities across 500 seeded inventories', () => {
    const random = randomSource(0x4d4f4e)
    let losses = 0
    let surpluses = 0
    for (let i = 0; i < 500; i++) {
      const fills = Array.from({ length: 4 }, () => ({
        ...fill, price: random() * 100, flipPrice: random() * 100,
        size: random() * 10, isFlippedOrder: random() > 0.5,
      }))
      const holdings = {
        marginBase: random() * 10, restingBase: random() * 10,
        marginQuote: random() * 1000, restingQuote: random() * 1000,
      }
      const deposit = { base0: random() * 20, quote0: random() * 2000 }
      const mid = random() * 100
      const card = scoreCard(fills, holdings, deposit, mid)
      expect(card.net).toBe(valueNow(holdings, mid) - valueHodl(deposit, mid))
      expect(card.damage).toBeGreaterThanOrEqual(0)
      if (card.net <= card.score) {
        losses++
        expect(card.net).toBeCloseTo(card.score - card.damage, 10)
      } else {
        surpluses++
        expect(card.damage).toBe(0)
        expect(card.net).toBeGreaterThan(card.score)
      }
    }
    expect(losses).toBeGreaterThan(0)
    expect(surpluses).toBeGreaterThan(0)
  })
})

describe('range state', () => {
  it.each([
    [89.999, 'OUT_OF_RANGE'], [90, 'NAD_SENSE'], [92, 'NAD_SENSE'],
    [92.001, 'IN_RANGE'], [100, 'IN_RANGE'], [107.999, 'IN_RANGE'],
    [108, 'NAD_SENSE'], [110, 'NAD_SENSE'], [110.001, 'OUT_OF_RANGE'],
  ] as const)('classifies mid %s as %s with inclusive edge warnings', (mid, state) => {
    expect(rangeState(mid, 90, 110, 2)).toBe(state)
  })
})
