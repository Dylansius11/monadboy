// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { press, renderScreen, tick } from '../../test/harness'
import { InRange } from './InRange'
import { FIXTURE_MARKETS } from '../fixtures'
import { cached, live } from '../../lib/envelope'
import { ConsoleInputProvider } from '../../console/useConsoleInput'

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

function rangeRowText(getByText: (matcher: RegExp) => HTMLElement) {
  return getByText(/^Range$/i).parentElement?.textContent ?? ''
}

function driveOutOfRange() {
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
}

describe('a manual rebalance actually moves the range', () => {
  it('A while out of range changes the rendered low and high price', () => {
    const { getByText } = renderInRange()

    driveOutOfRange()
    const rangeBefore = rangeRowText(getByText)

    press('A')
    const rangeAfter = rangeRowText(getByText)

    expect(rangeAfter).not.toBe(rangeBefore)
  })

  it('returns the screen to calm on the very next render', () => {
    const { getByText, queryByText } = renderInRange()

    driveOutOfRange()
    expect(getByText(/OUT OF RANGE/)).toBeInTheDocument()

    press('A')

    expect(queryByText(/OUT OF RANGE/)).not.toBeInTheDocument()
    expect(getByText(/^In range$/i)).toBeInTheDocument()
  })

  it('charges the fixture cost and counts exactly one manual re-center', () => {
    const { onWithdraw } = renderInRange()

    driveOutOfRange()
    press('A')
    press('B')

    expect(onWithdraw.mock.calls[0][0].rebalances).toBe(1)
    expect(onWithdraw.mock.calls[0][0].damageUsd).toBe(0.15)
    expect(onWithdraw.mock.calls[0][0].netUsd).toBe(-0.15)
  })

  it('A while in range changes neither the range nor the counter', () => {
    const { getByText, onWithdraw } = renderInRange()

    const rangeBefore = rangeRowText(getByText)
    press('A')
    const rangeAfter = rangeRowText(getByText)
    expect(rangeAfter).toBe(rangeBefore)

    press('B')
    expect(onWithdraw.mock.calls[0][0].rebalances).toBe(0)
  })

  it('keeps the same plan shape (width) across a rebalance', () => {
    const { getByText } = renderInRange()

    const spreadOf = (text: string) => {
      const match = text.match(/Range([\d.]+)to([\d.]+)/)
      if (!match) throw new Error('range row did not match')
      return Number(match[2]) / Number(match[1])
    }

    const spreadBefore = spreadOf(rangeRowText(getByText))
    driveOutOfRange()
    press('A')
    const spreadAfter = spreadOf(rangeRowText(getByText))

    expect(spreadAfter).toBeCloseTo(spreadBefore, 2)
  })
})

describe('a manual range from S6 reaches this screen', () => {
  it('funds the asymmetric edges the player drew, not the symmetric WIDE/TIGHT suggestion', () => {
    const { getByText } = renderInRange({
      manualRange: { lowerPct: -2, upperPct: 20 },
    })

    const match = rangeRowText(getByText).match(/Range([\d.]+)to([\d.]+)/)
    expect(match).toBeTruthy()
    const [, lowStr, highStr] = match!
    const low = Number(lowStr)
    const high = Number(highStr)

    const mid = (FIXTURE_MARKETS[0].book.bid! + FIXTURE_MARKETS[0].book.ask!) / 2
    expect(high - mid).toBeGreaterThan(5 * (mid - low))
  })
})

describe('missing data, Gate 2.4', () => {
  it('renders the defined panel, not a spinner, and B goes back', () => {
    const { getByText, onBack, queryByRole } = renderInRange({
      pool: undefined,
    })

    expect(getByText(/Position not found/i)).toBeInTheDocument()
    expect(queryByRole('progressbar')).not.toBeInTheDocument()

    press('B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('fixture freshness and inputs', () => {
  it('pauses the chart, SCORE and clock on a stale envelope, then resumes', async () => {
    vi.useFakeTimers()
    try {
      const { getByText, getByRole, rerender, onWithdraw, onRebalance, onBack } = renderInRange({
        priceFeed: cached(0.03314, 0, 'Source unavailable'),
      })
      const line = getByRole('img', { name: 'Price against your range' }).querySelector('polyline')!
      const before = line.getAttribute('points')
      expect(getByText('PRICE FEED PAUSED')).toBeInTheDocument()
      press('SELECT', 'A')
      await tick(5000, vi)
      expect(line.getAttribute('points')).toBe(before)
      press('B')
      expect(onWithdraw.mock.calls[0][0]).toMatchObject({
        elapsedSeconds: 0, feesEarnedUsd: 0, damageUsd: 0, rebalances: 0,
      })
      rerender(<ConsoleInputProvider><InRange pool={POOL} amount={100} width="wide" manualRange={null}
        autopilot characterId="molandak" priceFeed={live(0.03314)}
        onWithdraw={onWithdraw} onRebalance={onRebalance} onBack={onBack} /></ConsoleInputProvider>)
      expect(getByText(/^A Jump$/i)).toBeInTheDocument()
      await tick(500, vi)
      press('B')
      expect(onWithdraw.mock.calls[1][0]).toMatchObject({ elapsedSeconds: 3600, timeInRangePct: 100 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens numeric sources with START and closes without withdrawing', () => {
    const { getByText, queryByText, onWithdraw } = renderInRange()
    press('START')
    expect(getByText(/FIXTURE inputs/i)).toBeInTheDocument()
    expect(getByText(/DAMAGE = max\(0, SCORE - NET\)/)).toBeInTheDocument()
    expect(getByText(/Book bid 0.03312; ask 0.03316/)).toBeInTheDocument()
    press('B')
    expect(queryByText(/FIXTURE inputs/i)).not.toBeInTheDocument()
    expect(onWithdraw).not.toHaveBeenCalled()
  })

  it.each([
    { pool: FIXTURE_MARKETS[1].pool, error: 'NO_PRICE' },
    { pool: POOL, amount: 0.01, error: 'AMOUNT_TOO_SMALL' },
  ])('shows $error without inventing a funded range', ({ error, ...overrides }) => {
    const { getByText, onBack } = renderInRange(overrides)
    expect(getByText(error)).toBeInTheDocument()
    press('B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
