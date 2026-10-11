import { describe, expect, it } from 'vitest'
import { planLadder, testnetMarkets } from '@monadboy/sdk'
import { suggestLadder } from './range-suggestion'

const params = testnetMarkets[0].params
const input = { mid: 0.02625, mode: 'WIDE' as const, budgetQuote: 1, sigmaDaily: 0.01, params }

describe('suggested range with a lagging TESTNET book', () => {
  it.each(['WIDE', 'TIGHT'] as const)('%s covers both the book mid and a DEMO target above it', (mode) => {
    const { ladder, note } = suggestLadder({ ...input, mode, target: 0.02915 })
    expect(note).toBe('COVERS_TARGET')
    expect(ladder.low).toBeLessThan(input.mid)
    expect(ladder.high).toBeGreaterThan(input.mid)
    expect(ladder.high).toBeGreaterThanOrEqual(0.02915)
    // Every buy rests below and every sell above the book, so the post-only ladder stays valid.
    for (const order of ladder.orders) expect(order.isBuy ? order.price < input.mid : order.price > input.mid).toBe(true)
  })

  it('covers a DEMO target below the book too', () => {
    const { ladder, note } = suggestLadder({ ...input, mid: 0.02915, target: 0.02625 })
    expect(note).toBe('COVERS_TARGET')
    expect(ladder.low).toBeLessThanOrEqual(0.02625)
    expect(ladder.high).toBeGreaterThan(0.02915)
  })

  it('leaves the range unchanged when book and target are close', () => {
    const base = planLadder(input)
    const { ladder, note } = suggestLadder({ ...input, target: input.mid * 1.01 })
    expect(note).toBeNull()
    expect(ladder).toEqual(base)
  })

  it('never changes a manual range or runs without a target', () => {
    const manual = { low: 0.025, high: 0.027 }
    expect(suggestLadder({ ...input, manual, target: 0.04 }).ladder).toEqual(planLadder({ ...input, manual }))
    expect(suggestLadder({ ...input, target: null })).toEqual({ ladder: planLadder(input), note: null })
  })

  it('says so when the ladder cannot reach a target that far away', () => {
    const { ladder, note } = suggestLadder({ ...input, target: input.mid * 3 })
    expect(note).toBe('PARTIAL_TARGET')
    expect(ladder.clamped).toBe(true)
    expect(ladder.low).toBeLessThan(input.mid)
  })
})
