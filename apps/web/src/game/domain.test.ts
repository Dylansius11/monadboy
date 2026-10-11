import { describe, expect, it } from 'vitest'
import { yDomain } from './domain'

const LOW = 100
const HIGH = 110

function contains(domain: { low: number; high: number }, value: number) {
  return domain.low < value && value < domain.high
}

describe('the visible slice of price', () => {
  it('shows both edges and the whole series while price is inside', () => {
    const domain = yDomain([102, 105, 107], LOW, HIGH)

    expect(domain.low).toBeLessThan(LOW)
    expect(domain.high).toBeGreaterThan(HIGH)
  })

  it('keeps both range edges and the price in view however far price runs', () => {
    // The regression: a window capped at a multiple of the range width let a
    // price that had run away push an edge off the field, so the player lost
    // the one thing the screen exists to show. Both edges and every sample
    // stay strictly inside, with padding, in every direction.
    for (const series of [
      [102, 105, 107],
      [90, 95, 99],
      [111, 130, 180],
      [180, 190, 200],
      [40, 200],
      [60, 55, 50],
    ]) {
      const domain = yDomain(series, LOW, HIGH)
      for (const value of [LOW, HIGH, ...series])
        expect(contains(domain, value), `${value} in ${series}`).toBe(true)
    }
  })

  it('accepts edges in either order', () => {
    const domain = yDomain([105], HIGH, LOW)
    expect(contains(domain, LOW)).toBe(true)
    expect(contains(domain, HIGH)).toBe(true)
  })

  it('never returns a zero or inverted span, even for a flat series', () => {
    // A flat series divides by zero downstream, and a fixture can absolutely
    // open with two identical samples.
    const { low, high } = yDomain([105, 105], LOW, HIGH)
    expect(high).toBeGreaterThan(low)

    const degenerate = yDomain([7, 7], 7, 7)
    expect(degenerate.high).toBeGreaterThan(degenerate.low)
  })
})
