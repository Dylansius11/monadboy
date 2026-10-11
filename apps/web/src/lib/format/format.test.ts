import { describe, expect, it } from 'vitest'
import { ageInDays, compactUsd, duration, pct, price, usd, usdDecimals, usdFine } from './index'

describe('money', () => {
  it('always shows cents on an amount a user holds', () => {
    expect(usd(100)).toBe('$100.00')
    expect(usd(48.2)).toBe('$48.20')
  })

  it('drops the cents on pool-sized numbers', () => {
    expect(compactUsd(412_000)).toBe('$412K')
    expect(compactUsd(5_000_000)).toBe('$5M')
  })

  it('keeps sub-cent accruals readable without printing a float tail', () => {
    expect(usdFine(0.020547945205479447)).toBe('$0.0205')
    expect(usdFine(1.42)).toBe('$1.42')
    expect(usdFine(0)).toBe('$0.00')
    expect(usdFine(-0.38)).toBe('-$0.38')
  })

  it('gives a group of tiny run figures one shared precision', () => {
    // SCORE 0 beside DAMAGE 0.000291 reads $0.00000 and $0.00029, not $0.000000 and $0.000291.
    expect(usdDecimals(0, 0.000291)).toBe(5)
    expect(usdDecimals(0.00189, 0, 0.00189)).toBe(4)
    expect(usdDecimals(0.0123)).toBe(3)
    expect(usdDecimals(0.35)).toBe(2)
  })

  it('stays at cents for zero, whole dollars and dust, and caps the width', () => {
    expect(usdDecimals(0, 0)).toBe(2)
    expect(usdDecimals(12.34, 1.5)).toBe(2)
    expect(usdDecimals(0.000001)).toBe(2)
    expect(usdDecimals(0.000009)).toBe(5)
    expect(usdDecimals(Number.NaN)).toBe(2)
  })
})

describe('price', () => {
  it('keeps four significant figures at either end of the scale', () => {
    // A pair price can be 0.00004123 or 4123. A fixed decimal count is
    // unreadable at one end and wrong at the other.
    expect(price(0.041234)).toBe('0.04123')
    expect(price(4123.4)).toBe('4123')
    expect(price(0.0000412345)).toBe('0.00004123')
  })

  it('never renders NaN on screen', () => {
    expect(price(Number.NaN)).toBe('0')
    expect(price(Number.POSITIVE_INFINITY)).toBe('0')
  })
})

describe('duration', () => {
  it('shows two units, never three', () => {
    expect(duration(3 * 3600 + 12 * 60)).toBe('3h 12m')
    expect(duration(12 * 60 + 4)).toBe('12m 04s')
    expect(duration(41 * 86_400)).toBe('41d')
    expect(duration(2 * 86_400 + 5 * 3600)).toBe('2d 5h')
  })

  it('pads seconds and minutes so a ticking label does not jitter', () => {
    // Every number on the live screen is changing. An unpadded 9s becoming
    // 10s shifts the layout under it once a minute, forever.
    expect(duration(65)).toBe('1m 05s')
    expect(duration(3 * 3600 + 5 * 60)).toBe('3h 05m')
  })

  it('clamps a negative clock to zero rather than rendering a minus', () => {
    expect(duration(-40)).toBe('0m 00s')
  })
})

describe('labels', () => {
  it('says percentages without inventing precision', () => {
    expect(pct(18.24)).toBe('18.2%')
    expect(pct(100, 0)).toBe('100%')
  })

  it('singularises one day', () => {
    expect(ageInDays(86_400)).toBe('1 day')
    expect(ageInDays(41 * 86_400)).toBe('41 days')
  })
})
