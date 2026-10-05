// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { press, renderScreen, tick } from '../../test/harness'
import { InRange } from './InRange'
import { FIXTURE_MARKETS } from '../fixtures'

const POOL = FIXTURE_MARKETS[0].pool

function renderInRange(overrides: Partial<Parameters<typeof InRange>[0]> = {}) {
  const onWithdraw = vi.fn()
  const onRebalance = vi.fn()
  const onBack = vi.fn()

  const utils = renderScreen(
    <InRange
      pool={POOL}
      amount={100}
      width="wide"
      manualRange={null}
      autopilot
      characterId="molandak"
      onWithdraw={onWithdraw}
      onRebalance={onRebalance}
      onBack={onBack}
      {...overrides}
    />,
  )

  return { ...utils, onWithdraw, onRebalance, onBack }
}

describe('SCORE and DAMAGE, CLAUDE.md rule 2', () => {
  it('render on the same row at the same type role, and DAMAGE renders at zero', () => {
    const { getByText } = renderInRange()
    const score = getByText('+$0.00')
    const damage = getByText('-$0.00')
    expect(score.className).toContain('text-value')
    expect(damage.className).toContain('text-value')
    expect(score.closest('.grid')).toBe(damage.closest('.grid'))
  })

  it('renders DAMAGE in the loss tone even at zero', () => {
    const { container } = renderInRange()
    const damage = [
      ...container.querySelectorAll('[class*="text-value"]'),
    ].find((el) => el.textContent.startsWith('-$'))
    expect(damage?.className).toContain('text-loss')
  })
})

describe('the range is stated, not implied', () => {
  it('shows the low edge, the high edge, and the current price', () => {
    const { getByText } = renderInRange()
    const edges = getByText(/^Range$/i).parentElement!.querySelectorAll('.tabular-nums')
    expect(Number(edges[0].textContent)).toBeCloseTo(0.0285, 5)
    expect(Number(edges[1].textContent)).toBeCloseTo(0.03778, 5)
    expect(getByText(/^Now$/i).nextElementSibling?.textContent).toBe('0.03314')
  })
})

describe('the face says what the numbers say', () => {
  it('is happy only in the safe middle', () => {
    const { getByRole } = renderInRange()
    expect(getByRole('img', { name: /happy/ })).toBeInTheDocument()
  })

  it('stops being happy well before the warning fires', () => {
    const { queryByRole } = renderInRange()

    press('SELECT')

    expect(queryByRole('img', { name: /happy/ })).not.toBeInTheDocument()
  })

  it('is alert once price is near an edge, and still in range', () => {
    const { getByRole, queryByText } = renderInRange({
      amount: 200,
      manualRange: { lowerPct: -8, upperPct: 16 },
    })

    press('SELECT')

    expect(getByRole('img', { name: /alert/ })).toBeInTheDocument()
    expect(queryByText(/OUT OF RANGE/)).not.toBeInTheDocument()
  })
})

describe('the out-of-range moment', () => {
  it('SELECT drives the screen out of range, and the sprite sits', () => {
    const { getByText, getByRole } = renderInRange()

    press(
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
    )

    expect(getByText(/^Out of range$/i)).toBeInTheDocument()
    expect(getByRole('img', { name: /sit/ })).toBeInTheDocument()
  })

  it('leaves SCORE unchanged while the clock keeps advancing', async () => {
    vi.useFakeTimers()
    try {
      const { getByText, container } = renderInRange()

      press(
        'SELECT',
        'SELECT',
        'SELECT',
        'SELECT',
        'SELECT',
        'SELECT',
        'SELECT',
        'SELECT',
      )
      expect(getByText(/^Out of range$/i)).toBeInTheDocument()

      const scoreBefore = container.querySelector(
        '[class*="text-value"]',
      )?.textContent

      await tick(5000, vi)

      const scoreAfter = container.querySelector(
        '[class*="text-value"]',
      )?.textContent
      expect(scoreAfter).toBe(scoreBefore)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the instruments on screen while the alarm is up', () => {
    const { getByText } = renderInRange()

    press(
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
    )

    expect(getByText(/OUT OF RANGE/)).toBeInTheDocument()
    expect(getByText(/AUTOPILOT ON/i)).toBeInTheDocument()
    expect(getByText(/^B Withdraw$/i)).toBeInTheDocument()
    expect(getByText(/^A Recentre, costs a swap$/i)).toBeInTheDocument()
  })

  it('A calls onRebalance when out of range, and does not when in range', () => {
    const { onRebalance } = renderInRange()

    press('A')
    expect(onRebalance).not.toHaveBeenCalled()

    press(
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
      'SELECT',
    )
    press('A')
    expect(onRebalance).toHaveBeenCalledTimes(1)
  })
})

describe('withdraw', () => {
  it('withdraws the observed fixture earnings and time, without replaying the walk', async () => {
    vi.useFakeTimers()
    try {
      const { onWithdraw } = renderInRange()
      await tick(5000, vi)
      press('B')
      expect(onWithdraw).toHaveBeenCalledTimes(1)
      const summary = onWithdraw.mock.calls[0][0]
      expect(summary.timeInRangePct).toBe(100)
      expect(summary.elapsedSeconds).toBe(36000)
      expect(summary.feesEarnedUsd).toBeCloseTo(100 * 0.18 * 36000 / (365 * 86400))
      expect(summary.damageUsd).toBe(0)
      expect(summary.netUsd).toBe(summary.feesEarnedUsd)
    } finally {
      vi.useRealTimers()
    }
  })

})

