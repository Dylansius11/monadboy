// @vitest-environment jsdom

import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { press, renderScreen } from '../../test/harness'
import { mainnetMarkets } from '@monadboy/sdk'
import { ladderPlanner } from '../../lib/range/ladder-planner'
import { FIXTURE_MARKETS } from '../fixtures'
import { planForOffsets, planForWidth } from '../../lib/range/plan'
import { price } from '../../lib/format'
import { SetRange } from './SetRange'
import type { SetRangeProps } from './SetRange'
import type { ManualRange, RangeWidth } from '../../state/session'
import type { Pool } from '../../types/domain'

const POOL: Pool = FIXTURE_MARKETS[0].pool
const STABLE_POOL: Pool = FIXTURE_MARKETS[2].pool
const MID = (FIXTURE_MARKETS[0].book.bid! + FIXTURE_MARKETS[0].book.ask!) / 2
const PARAMS = mainnetMarkets.find((market) => market.symbol === 'MON_USDC')!.params
const INPUTS = { budgetQuote: 100, sigmaDaily: POOL.realizedVol24h!, params: PARAMS }

function renderSetRange(
  overrides: Partial<Omit<SetRangeProps, 'onConfirm' | 'onBack'>> & {
    onConfirm?: () => void
    onBack?: () => void
  } = {},
) {
  const onConfirm = vi.fn()
  const onBack = vi.fn()
  const onChangeAmount = vi.fn()
  const onChangeWidth = vi.fn()
  const onChangeManualRange = vi.fn()
  const onToggleAutopilot = vi.fn()

  const pool = 'pool' in overrides ? overrides.pool : POOL
  const balance = overrides.balance ?? 250
  const initialAmount = overrides.amount ?? 100
  const initialWidth = overrides.width ?? 'wide'
  const initialManualRange = overrides.manualRange ?? null
  const initialAutopilot = overrides.autopilot ?? true

  function Wrapper() {
    const [amount, setAmount] = useState(initialAmount)
    const [width, setWidth] = useState<RangeWidth>(initialWidth)
    const [manualRange, setManualRangeState] = useState<ManualRange | null>(
      initialManualRange,
    )
    const [autopilot, setAutopilot] = useState(initialAutopilot)

    return (
      <SetRange
        pool={pool}
        balance={balance}
        amount={amount}
        width={width}
        manualRange={manualRange}
        autopilot={autopilot}
        onChangeAmount={(next) => {
          onChangeAmount(next)
          setAmount(next)
        }}
        onChangeWidth={(next) => {
          onChangeWidth(next)

          setManualRangeState(null)
          setWidth(next)
        }}
        onChangeManualRange={(next) => {
          onChangeManualRange(next)
          setManualRangeState(next)
        }}
        onToggleAutopilot={(next) => {
          onToggleAutopilot(next)
          setAutopilot(next)
        }}
        onConfirm={overrides.onConfirm ?? onConfirm}
        onBack={overrides.onBack ?? onBack}
      />
    )
  }

  const utils = renderScreen(<Wrapper />)
  return {
    ...utils,
    onConfirm,
    onBack,
    onChangeAmount,
    onChangeWidth,
    onChangeManualRange,
    onToggleAutopilot,
  }
}

function valueTexts(container: HTMLElement): Array<string> {
  return [...container.querySelectorAll('[class*="text-value"]')].map(
    (el) => el.textContent,
  )
}

describe('the pair, the amount, the balance', () => {
  it('renders all three', () => {
    const { getByText, container } = renderSetRange()

    expect(getByText(/MON \/ USDC/i)).toBeInTheDocument()
    expect(valueTexts(container)).toContain('100.00')
    expect(getByText(/TESTNET balance \$250\.00/i)).toBeInTheDocument()
  })
})

describe('the amount row', () => {
  it('RIGHT walks to the next preset, and does not confirm', () => {
    const { container, onConfirm } = renderSetRange({ amount: 10 })

    press('RIGHT')

    expect(valueTexts(container)).toContain('25.00')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('RIGHT past the last preset fine-adjusts, and never exceeds the balance', () => {
    const { container } = renderSetRange({ amount: 100, balance: 110 })

    press('RIGHT') 
    expect(valueTexts(container)).toContain('105.00')

    press('RIGHT') 
    expect(valueTexts(container)).toContain('110.00')

    press('RIGHT') 
    expect(valueTexts(container)).toContain('110.00')
    expect(valueTexts(container)).not.toContain('115.00')
  })

  it('LEFT past the first preset steps down, and never goes below 0', () => {
    const { container } = renderSetRange({ amount: 10 })

    press('LEFT') 
    expect(valueTexts(container)).toContain('5.00')

    press('LEFT') 
    expect(valueTexts(container)).toContain('0.00')

    press('LEFT') 
    expect(valueTexts(container)).toContain('0.00')
  })
})

describe('the focus model', () => {
  it('DOWN moves focus to WIDTH, and LEFT/RIGHT then changes width, not amount', () => {
    const { onChangeAmount, onChangeWidth } = renderSetRange({ amount: 100 })

    press('DOWN')
    press('RIGHT')

    expect(onChangeWidth).toHaveBeenCalledWith('tight')
    expect(onChangeAmount).not.toHaveBeenCalled()
  })

  it('does not wrap past either end', () => {
    const { onChangeAmount, onChangeWidth, onToggleAutopilot } =
      renderSetRange()

    press('UP')
    press('LEFT')
    expect(onChangeAmount).toHaveBeenCalledTimes(1)

    press('DOWN', 'DOWN', 'DOWN')
    press('RIGHT')
    expect(onToggleAutopilot).toHaveBeenCalledTimes(1)
    expect(onChangeWidth).not.toHaveBeenCalled()
  })
})

describe('width drives the plan, not just the label', () => {
  it('WIDE draws wider price edges than TIGHT', () => {
    const { getByRole } = renderSetRange({ pool: STABLE_POOL })
    const edges = () => {
      const label = getByRole('img').getAttribute('aria-label')!
      const match = label.match(/Range from ([\d.]+) to ([\d.]+)/)!
      return [Number(match[1]), Number(match[2])]
    }
    const [wideLow, wideHigh] = edges()
    press('DOWN', 'RIGHT')
    const [tightLow, tightHigh] = edges()
    expect(wideLow).toBeLessThan(tightLow)
    expect(wideHigh).toBeGreaterThan(tightHigh)
  })
})

describe('the split preview', () => {
  it('sums to the amount', () => {
    const { container } = renderSetRange({ amount: 100 })

    const panel = container.querySelector('[class*="shadow-hard"]')
    expect(panel).toBeTruthy()

    const figures = [
      ...(panel as HTMLElement).querySelectorAll('[class*="text-value"]'),
    ].map((el) => Number(el.textContent.replace('$', '')))

    expect(figures).toHaveLength(2)
    expect(figures[0] + figures[1]).toBeCloseTo(100, 2)
  })
})

describe('autopilot', () => {
  it('toggles, and its fee copy names a percentage of earnings', () => {
    const { getByText, getByRole, onToggleAutopilot } = renderSetRange({
      autopilot: true,
    })

    expect(getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(getByText(/10% of earnings/i)).toBeInTheDocument()

    press('DOWN', 'DOWN', 'RIGHT')

    expect(onToggleAutopilot).toHaveBeenCalledWith(false)
  })
})

describe('confirm and back', () => {
  it('A calls onConfirm, B calls onBack', () => {
    const { onConfirm, onBack } = renderSetRange()

    press('A')
    expect(onConfirm).toHaveBeenCalledTimes(1)

    press('B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('the width row is three positions, not two', () => {
  it('RIGHT walks WIDE to TIGHT to MANUAL, and MANUAL applies nothing', () => {
    const { onChangeWidth, onChangeManualRange } = renderSetRange({
      width: 'wide',
    })

    press('DOWN') 
    press('RIGHT')
    expect(onChangeWidth).toHaveBeenCalledWith('tight')

    press('RIGHT') 

    expect(onChangeWidth).toHaveBeenCalledTimes(1)
    expect(onChangeManualRange).not.toHaveBeenCalled()
  })

  it('does not wrap past MANUAL, and does not wrap past WIDE', () => {
    const { onChangeWidth } = renderSetRange({ width: 'wide' })

    press('DOWN')
    press('RIGHT', 'RIGHT', 'RIGHT', 'RIGHT') 
    expect(onChangeWidth).toHaveBeenCalledTimes(1)

    press('LEFT', 'LEFT') 
    expect(onChangeWidth).toHaveBeenLastCalledWith('wide')
    press('LEFT') 
    expect(onChangeWidth).toHaveBeenCalledTimes(3)
  })

  it('A on MANUAL opens the editor instead of confirming', () => {
    const { getByText, queryByText, onConfirm } = renderSetRange()

    press('DOWN', 'RIGHT', 'RIGHT') 
    expect(queryByText(/manual range/i)).not.toBeInTheDocument()

    press('A')

    expect(getByText(/manual range/i)).toBeInTheDocument()

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('A still confirms from every other position on the width row', () => {
    const { onConfirm } = renderSetRange()

    press('DOWN', 'RIGHT') 
    press('A')

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancelling out of the editor leaves MANUAL cursored but not applied', () => {
    const { getByText, queryByText, onChangeManualRange } = renderSetRange()

    press('DOWN', 'RIGHT', 'RIGHT', 'A') 
    press('B') 

    expect(onChangeManualRange).not.toHaveBeenCalled()
    expect(queryByText(/manual range/i)).not.toBeInTheDocument()

    expect(getByText(/A edit range/i)).toBeInTheDocument()
    
    expect(getByText(/vol 60% ->/)).toBeInTheDocument()
  })
})

describe('the manual range editor', () => {
  const basePlan = planForWidth(MID, 'wide', ladderPlanner, INPUTS)
  const seededLowerPct = Math.round((basePlan.plan.low / MID - 1) * 100)
  const seededUpperPct = Math.round((basePlan.plan.high / MID - 1) * 100)

  it('SELECT opens the editor', () => {
    const { getByText, queryByText } = renderSetRange()

    expect(queryByText(/manual range/i)).not.toBeInTheDocument()
    press('SELECT')
    expect(getByText(/manual range/i)).toBeInTheDocument()
  })

  it("opens seeded at the current WIDE plan's edges", () => {
    const { container } = renderSetRange()

    const beforeLow = price(basePlan.plan.low)
    const beforeHigh = price(basePlan.plan.high)
    expect(container.textContent).toContain(beforeLow)
    expect(container.textContent).toContain(beforeHigh)

    press('SELECT')

    const seededPlan = planForOffsets(MID, {
      lowerPct: seededLowerPct,
      upperPct: seededUpperPct,
    }, ladderPlanner, INPUTS)
    const afterLow = price(seededPlan.plan.low)
    const afterHigh = price(seededPlan.plan.high)
    expect(container.textContent).toContain(afterLow)
    expect(container.textContent).toContain(afterHigh)
  })

  it('LEFT on the seeded START row widens the low price and the strip', () => {
    const { container, getAllByRole } = renderSetRange()
    press('SELECT')

    const beforePlan = planForOffsets(MID, {
      lowerPct: seededLowerPct,
      upperPct: seededUpperPct,
    }, ladderPlanner, INPUTS)
    const beforeLow = price(beforePlan.plan.low)

    const beforePicture = getAllByRole('img').at(-1)!.getAttribute('aria-label')

    press('LEFT') 

    const afterPlan = planForOffsets(MID, {
      lowerPct: START_STEP_DOWN(seededLowerPct),
      upperPct: seededUpperPct,
    }, ladderPlanner, INPUTS)
    const afterLow = price(afterPlan.plan.low)
    const afterPicture = getAllByRole('img').at(-1)!.getAttribute('aria-label')

    expect(afterLow).not.toBe(beforeLow)
    expect(container.textContent).toContain(afterLow)
    expect(afterPlan.plan.low).toBeLessThan(beforePlan.plan.low)
    expect(afterPicture).not.toBe(beforePicture)
  })

  it('A applies the walked range and closes the overlay', () => {
    const { container, queryByText, onChangeManualRange } = renderSetRange()
    press('SELECT')
    press('LEFT') 

    press('A')

    expect(onChangeManualRange).toHaveBeenCalledTimes(1)
    const applied = onChangeManualRange.mock.calls[0][0] as ManualRange
    expect(applied.lowerPct).toBeLessThan(seededLowerPct)
    expect(applied.upperPct).toBe(seededUpperPct)
    expect(queryByText(/manual range/i)).not.toBeInTheDocument()

    expect(container.textContent).toContain(
      `manual  ${applied.lowerPct}% / +${applied.upperPct}%`,
    )
  })

  it('B cancels without calling onChangeManualRange', () => {
    const { queryByText, onChangeManualRange } = renderSetRange()
    press('SELECT')
    press('LEFT')

    press('B')

    expect(onChangeManualRange).not.toHaveBeenCalled()
    expect(queryByText(/manual range/i)).not.toBeInTheDocument()
  })

  it('SELECT inside the editor resets to the suggestion, with null', () => {
    const { onChangeManualRange } = renderSetRange({
      manualRange: { lowerPct: -12, upperPct: 9 },
    })
    press('SELECT')

    press('SELECT')

    expect(onChangeManualRange).toHaveBeenCalledWith(null)
  })

  it('A while the overlay is open does not reach onConfirm underneath it', () => {
    const { onConfirm } = renderSetRange()
    press('SELECT')

    press('A')

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('clamps both editable edges and applies their bounded values', () => {
    const { onChangeManualRange } = renderSetRange()
    press('SELECT')
    for (let i = 0; i < 100; i += 1) press('LEFT')
    press('A')
    expect(onChangeManualRange).toHaveBeenLastCalledWith({ lowerPct: -90, upperPct: seededUpperPct })
    press('SELECT')
    for (let i = 0; i < 200; i += 1) press('RIGHT')
    press('DOWN')
    for (let i = 0; i < 200; i += 1) press('LEFT')
    press('A')
    expect(onChangeManualRange).toHaveBeenLastCalledWith({ lowerPct: -1, upperPct: 1 })
    press('SELECT', 'DOWN')
    for (let i = 0; i < 500; i += 1) press('RIGHT')
    press('A')
    expect(onChangeManualRange).toHaveBeenLastCalledWith({ lowerPct: -1, upperPct: 400 })
  })

})


function START_STEP_DOWN(current: number): number {
  const presets = [-25, -15, -10, -5]
  const idx = presets.indexOf(current)
  if (idx > 0) return presets[idx - 1]
  return Math.max(current - 1, -90)
}

describe('missing data, Gate 2.4', () => {
  it('renders the not-found panel, not a throw, and B still goes back', () => {
    const { getByText, onBack, queryByRole } = renderSetRange({
      pool: undefined,
    })

    expect(getByText(/pool not found/i)).toBeInTheDocument()
    expect(queryByRole('progressbar')).not.toBeInTheDocument()

    press('B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('manual precedence and failed funding', () => {
  it('manual edges override either width until the suggestion is restored', () => {
    const manualRange = { lowerPct: -12, upperPct: 9 }
    const wide = renderSetRange({ width: 'wide', manualRange })
    const manualPicture = wide.getByRole('img').getAttribute('aria-label')
    wide.unmount()
    const tight = renderSetRange({ width: 'tight', manualRange })
    expect(tight.getByRole('img')).toHaveAttribute('aria-label', manualPicture)
    press('SELECT', 'SELECT')
    expect(tight.getByRole('img').getAttribute('aria-label')).not.toBe(manualPicture)
    expect(tight.getByRole('button', { name: 'tight' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the cursor separate from the applied TIGHT range until A applies an edit', () => {
    const { getByRole } = renderSetRange()
    press('DOWN', 'RIGHT')
    const tightPicture = getByRole('img').getAttribute('aria-label')
    press('RIGHT')
    expect(getByRole('button', { name: 'manual' })).toHaveAttribute('aria-pressed', 'false')
    expect(getByRole('button', { name: 'tight' })).toHaveAttribute('aria-pressed', 'true')
    expect(getByRole('img')).toHaveAttribute('aria-label', tightPicture)
    press('A', 'LEFT', 'A')
    expect(getByRole('button', { name: 'manual' })).toHaveAttribute('aria-pressed', 'true')
    expect(getByRole('button', { name: 'tight' })).toHaveAttribute('aria-pressed', 'false')
    expect(getByRole('img').getAttribute('aria-label')).not.toBe(tightPicture)
  })

  it('shows AMOUNT_TOO_SMALL and blocks confirm until amount funds a ladder', () => {
    const { getByText, queryByText, getByRole, onConfirm } = renderSetRange({ amount: 10 })
    expect(getByText('AMOUNT_TOO_SMALL')).toBeInTheDocument()
    press('A')
    expect(onConfirm).not.toHaveBeenCalled()
    press('RIGHT', 'RIGHT')
    expect(queryByText('AMOUNT_TOO_SMALL')).not.toBeInTheDocument()
    expect(getByRole('img')).toBeInTheDocument()
    press('A')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not invent a mid for the fixture without a book', () => {
    const { getByText, onConfirm, onBack } = renderSetRange({ pool: FIXTURE_MARKETS[1].pool })
    expect(getByText('NO_PRICE')).toBeInTheDocument()
    press('A', 'B')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
