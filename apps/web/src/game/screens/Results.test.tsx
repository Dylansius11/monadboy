// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { press, renderScreen } from '../../test/harness'
import { Results } from './Results'
import type { RunSummary } from '../sim'
import { FIXTURE_MARKETS } from '../fixtures'

const POOL = FIXTURE_MARKETS[0].pool

const RUN: RunSummary = {
  feesEarnedUsd: 1.42,
  damageUsd: 0.38,
  netUsd: 1.04,
  timeInRangePct: 84,
  rebalances: 2,
  bestStreakSeconds: 3_720,
  elapsedSeconds: 4_000,
}

function renderResults(overrides: Partial<Parameters<typeof Results>[0]> = {}) {
  const onBackToDisks = vi.fn()

  const utils = renderScreen(
    <Results
      pool={POOL}
      run={RUN}
      amount={100}
      characterId="molandak"
      autopilot
      onBackToDisks={onBackToDisks}
      {...overrides}
    />,
  )

  return { ...utils, onBackToDisks }
}

describe('the money block, CLAUDE.md rule 2', () => {
  it('renders fees, damage, and net, and net is fees minus damage', () => {
    const { getByText } = renderResults()

    expect(getByText('+$1.42')).toBeInTheDocument()
    expect(getByText('-$0.38')).toBeInTheDocument()
    expect(getByText('+$1.04')).toBeInTheDocument()
  })

  it('renders DAMAGE with a minus sign and the loss tone even though the stored value is positive', () => {
    const { container, getByText } = renderResults()

    const damage = getByText('-$0.38')
    expect(damage.className).toContain('text-loss')
    expect(container.textContent).toContain('-$0.38')
  })
})

describe('time in range, the real score', () => {
  it('renders as a percentage and a meter', () => {
    const { getByText, getByRole } = renderResults()

    expect(getByText('84%')).toBeInTheDocument()
    const meter = getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '84')
  })
})

describe('the rebalance line credits whoever actually pressed A', () => {
  it('says REBALANCED even when the autopilot setting is on', () => {
    const { getByText, queryByText } = renderResults({ autopilot: true })
    expect(getByText(/Rebalanced 2x/i)).toBeInTheDocument()
    expect(queryByText(/AUTOPILOT/i)).not.toBeInTheDocument()
  })

  it('says REBALANCED when the setting is off', () => {
    const { getByText, queryByText } = renderResults({ autopilot: false })
    expect(getByText(/Rebalanced 2x/i)).toBeInTheDocument()
    expect(queryByText(/AUTOPILOT/i)).not.toBeInTheDocument()
  })

})

describe('the face says what the numbers say', () => {
  it('a strong run picks happy and the strong line', () => {
    const { getByRole } = renderResults({
      run: { ...RUN, netUsd: 1.04, timeInRangePct: 84 },
    })
    expect(getByRole('img', { name: /happy/ })).toBeInTheDocument()
  })

  it('a net-negative run picks sit and the losing line', () => {
    const { getByRole } = renderResults({
      run: { ...RUN, netUsd: -0.5, damageUsd: 1.9, timeInRangePct: 20 },
    })
    expect(getByRole('img', { name: /sit/ })).toBeInTheDocument()
  })
})

describe('missing data, Gate 2.4', () => {
  it('run={null} renders the no-session panel, and A still gets the player out', () => {
    const { getByText, onBackToDisks } = renderResults({ run: null })

    expect(getByText(/No session to report/i)).toBeInTheDocument()

    press('A')
    expect(onBackToDisks).toHaveBeenCalledTimes(1)
  })
})

describe('input and evidence', () => {
  it('A and B both return to disks', () => {
    const { onBackToDisks } = renderResults()
    press('A', 'B')
    expect(onBackToDisks).toHaveBeenCalledTimes(2)
  })

  it('SELECT opens fixture inputs and B closes them before leaving', () => {
    const { getByText, queryByText, onBackToDisks } = renderResults()
    press('SELECT')
    expect(getByText(/FIXTURE inputs/i)).toBeInTheDocument()
    expect(getByText(/DAMAGE = max\(0, SCORE - NET\)/)).toBeInTheDocument()
    expect(getByText(/SCORE 1.42; NET 1.04; DAMAGE 0.38/)).toBeInTheDocument()
    press('B')
    expect(queryByText(/FIXTURE inputs/i)).not.toBeInTheDocument()
    expect(onBackToDisks).not.toHaveBeenCalled()
    press('B')
    expect(onBackToDisks).toHaveBeenCalledTimes(1)
  })

  it('shows NET surplus without forcing SCORE minus DAMAGE identity', () => {
    const { getByText } = renderResults({ run: { ...RUN, damageUsd: 0, netUsd: 2 } })
    expect(getByText('+$2.00')).toBeInTheDocument()
    expect(getByText('-$0.00')).toBeInTheDocument()
  })

  it('keeps the missing-pool exit reachable', () => {
    const { getByText, onBackToDisks } = renderResults({ pool: undefined })
    expect(getByText(/Pool not found/i)).toBeInTheDocument()
    press('B')
    expect(onBackToDisks).toHaveBeenCalledTimes(1)
  })
})
