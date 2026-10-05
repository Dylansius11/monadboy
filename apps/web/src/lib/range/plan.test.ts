import { describe, expect, it } from 'vitest'
import { planForOffsets, planForSession, planForWidth } from './plan'
import type { RangePlanner } from './plan'

const planner: RangePlanner<{ halfWidth: number }> = {
  plan: ({ mid, mode, manual, halfWidth }) => {
    const width = halfWidth * (mode === 'WIDE' ? 2.5 : 1)
    return {
      low: manual?.low ?? mid * (1 - width),
      high: manual?.high ?? mid * (1 + width),
      step: 0.01,
      levels: 4,
    }
  },
}

const inputs = { halfWidth: 0.02 }

describe('session range precedence', () => {
  it('uses WIDE or TIGHT when no manual edit exists', () => {
    const wide = planForSession(100, 'wide', null, planner, inputs)
    const tight = planForSession(100, 'tight', null, planner, inputs)
    expect(wide.plan.low).toBe(95)
    expect(wide.plan.high).toBe(105)
    expect(tight.plan.low).toBe(98)
    expect(tight.plan.high).toBe(102)
    expect(wide.requestedWidthPct).toBe(5)
    expect(tight.requestedWidthPct).toBe(2)
  })

  it.each(['wide', 'tight'] as const)(
    'manual edges override %s, including asymmetric edits',
    (mode) => {
      const range = planForSession(
        200,
        mode,
        { lowerPct: -3, upperPct: 8 },
        planner,
        inputs,
      )
      expect(range.plan.low).toBe(194)
      expect(range.plan.high).toBe(216)
      expect(range.requestedWidthPct).toBe(5.5)
    },
  )

  it('clearing a manual edit restores the selected width', () => {
    const manual = planForSession(
      100,
      'tight',
      { lowerPct: -1, upperPct: 7 },
      planner,
      inputs,
    )
    const reset = planForSession(100, 'tight', null, planner, inputs)
    expect(manual.plan.high).toBe(107)
    expect(reset.plan.high).toBe(102)
  })

  it('can plan the width and manual previews from the same current mid', () => {
    const suggested = planForWidth(50, 'wide', planner, inputs)
    const edited = planForOffsets(
      50,
      { lowerPct: -4, upperPct: 6 },
      planner,
      inputs,
    )
    expect(suggested.plan.low).toBe(47.5)
    expect(edited.plan.low).toBe(48)
    expect(edited.plan.high).toBe(53)
  })
})
