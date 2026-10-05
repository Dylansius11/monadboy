import { mainnetMarkets } from '@monadboy/sdk'
import { describe, expect, it } from 'vitest'
import { ladderPlanner } from './ladder-planner'
import { planForSession, planForWidth } from './plan'
import type { LadderError } from '@monadboy/sdk'

const market = mainnetMarkets.find((candidate) => candidate.symbol === 'MON_USDC')!
const mid = 0.03314
const inputs = { budgetQuote: 250, sigmaDaily: 0.02, params: market.params }

describe('SDK ladder range planning', () => {
  it('makes WIDE wider than TIGHT through the shared width planner', () => {
    const wide = planForWidth(mid, 'wide', ladderPlanner, inputs).plan
    const tight = planForWidth(mid, 'tight', ladderPlanner, inputs).plan

    expect(wide.low).toBeLessThan(tight.low)
    expect(wide.high).toBeGreaterThan(tight.high)
    expect(wide.high - wide.low).toBeGreaterThan(tight.high - tight.low)
  })

  it('honours asymmetric manual edges regardless of the selected width', () => {
    const manual = { lowerPct: -3, upperPct: 8 }
    const wide = planForSession(mid, 'wide', manual, ladderPlanner, inputs)
    const tight = planForSession(mid, 'tight', manual, ladderPlanner, inputs)
    const tick = Number(market.params.tickSize) / Number(market.params.pricePrecision)

    expect(wide).toEqual(tight)
    expect(Math.abs(wide.plan.low - mid * 0.97)).toBeLessThanOrEqual(tick)
    expect(Math.abs(wide.plan.high - mid * 1.08)).toBeLessThanOrEqual(tick)
    expect(wide.requestedWidthPct).toBe(5.5)
  })

  it('surfaces the SDK amount-too-small error without hiding its message', () => {
    expect(() =>
      planForSession(mid, 'wide', null, ladderPlanner, {
        ...inputs,
        budgetQuote: 1,
      }),
    ).toThrowError(
      expect.objectContaining<LadderError>({
        name: 'LadderError',
        code: 'AMOUNT_TOO_SMALL',
        message: 'AMOUNT_TOO_SMALL',
      }),
    )
  })
})
