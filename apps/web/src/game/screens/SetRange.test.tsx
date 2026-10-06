// @vitest-environment jsdom

import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { press, renderScreen } from '../../test/harness'
import { mainnetMarkets, planLadder } from '@monadboy/sdk'
import { ladderPlanner } from '../../lib/range/ladder-planner'
import { FIXTURE_MARKETS } from '../fixtures'
import { planForOffsets, planForWidth } from '../../lib/range/plan'
import { pct, price, usd } from '../../lib/format'
import { SetRange } from './SetRange'
import type { SetRangeProps } from './SetRange'
import type { ManualRange, RangeWidth } from '../../state/session'
import type { Pool } from '../../types/domain'

const POOL: Pool = FIXTURE_MARKETS[0].pool
const STABLE_POOL: Pool = FIXTURE_MARKETS[2].pool
const MID = (FIXTURE_MARKETS[0].book.bid! + FIXTURE_MARKETS[0].book.ask!) / 2
const PARAMS = mainnetMarkets.find((market) => market.symbol === 'MON_USDC')!.params
const INPUTS = { budgetQuote: 100, sigmaDaily: POOL.realizedVol24h!, params: PARAMS }
const RAW_CODES = /[A-Z]+_[A-Z_]+/

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

describe('the funding preview and clamp disclosure', () => {
  it('shows SDK quote funding, base value and the estimated zap cost', () => {
    const budgetQuote = 100.01
    const { container, getByText } = renderSetRange({ amount: budgetQuote })
    const funding = planLadder({ ...INPUTS, budgetQuote, mid: MID, mode: 'WIDE' })
    const figures = () => [...container.querySelectorAll('[class*="shadow-hard"] [class*="text-value"]')]
      .map((el) => el.textContent)
    expect(figures()).toEqual([
      usd(funding.quoteNeeded),
      usd(funding.baseNeeded * MID),
    ])
    expect(getByText(`we swap part of your USDC first. swap cost ~${usd(funding.zapQuote * 0.003)} est.`))
      .toBeInTheDocument()
    press('LEFT')
    const adjusted = planLadder({ ...INPUTS, budgetQuote: budgetQuote - 5, mid: MID, mode: 'WIDE' })
    expect(figures()).toEqual([usd(adjusted.quoteNeeded), usd(adjusted.baseNeeded * MID)])
  })

  it('discloses a clamped ladder on both the setup picture and manual preview', () => {
    const { getAllByText } = renderSetRange()
    const notice = 'wider than one transaction fits, so this is narrower.'
    expect(getAllByText(notice)).toHaveLength(1)
    press('SELECT')
    expect(getAllByText(notice)).toHaveLength(2)
  })

  it('does not show a clamp notice for a ladder that fits', () => {
    const { queryByText } = renderSetRange({ pool: STABLE_POOL, amount: 250 })
    expect(queryByText('wider than one transaction fits, so this is narrower.'))
      .not.toBeInTheDocument()
  })
})

describe('autopilot', () => {
  it('toggles, and its line says orders re-arm while re-centering stays manual and costs a swap', () => {
    const { getByText, getByRole, onToggleAutopilot } = renderSetRange({
      autopilot: true,
    })

    expect(getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    const line = getByText(/re-arm/i).textContent
    expect(line).toMatch(/after (every|each) fill/i)
    expect(line).toMatch(/re-centering is manual/i)
    expect(line).toMatch(/costs a swap/i)
    expect(line).not.toMatch(/\d|%|fee|keeps you in range|flip/i)

    press('DOWN', 'DOWN', 'RIGHT')

    expect(onToggleAutopilot).toHaveBeenCalledWith(false)
  })
})

describe('the inputs view, START', () => {
  it('opens the sources behind vol, width, funding and swap cost, formatted, and closes without confirming', () => {
    const { getByText, queryByText, container, onConfirm, onBack } = renderSetRange()
    const funding = planLadder({ ...INPUTS, mid: MID, mode: 'WIDE' })
    const planned = planForWidth(MID, 'wide', ladderPlanner, INPUTS)

    expect(queryByText(/FIXTURE inputs/i)).not.toBeInTheDocument()
    press('START')
    expect(getByText(/FIXTURE inputs/i)).toBeInTheDocument()
    expect(getByText(`24h vol ${pct(POOL.realizedVol24h! * 100, 0)}; width +/-${pct(planned.requestedWidthPct, 1)} around mid ${price(MID)}`))
      .toBeInTheDocument()
    expect(getByText(`Holdings ${usd(funding.quoteNeeded)} USDC + ${usd(funding.baseNeeded * MID)} MON at mid ${price(MID)}`))
      .toBeInTheDocument()
    expect(getByText(`Swap ${usd(funding.zapQuote)} USDC; swap cost ~${usd(funding.zapQuote * 0.003)} est. at a 0.3% testnet taker fee, before slippage and gas.`))
      .toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d\.\d{8,}/)

    press('A')
    expect(onConfirm).not.toHaveBeenCalled()
    press('B')
    expect(queryByText(/FIXTURE inputs/i)).not.toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
    press('START', 'START')
    expect(queryByText(/FIXTURE inputs/i)).not.toBeInTheDocument()
  })

  it('says why there is nothing to size when the range cannot be built', () => {
    const { getByText } = renderSetRange({ amount: 10 })
    press('START')
    expect(getByText('AMOUNT TOO SMALL FOR THIS RANGE')).toBeInTheDocument()
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

  it.each([
    { manualRange: { lowerPct: -90, upperPct: 10 }, upper: false, direction: 'LEFT' as const },
    { manualRange: { lowerPct: -1, upperPct: 10 }, upper: false, direction: 'RIGHT' as const },
    { manualRange: { lowerPct: -10, upperPct: 1 }, upper: true, direction: 'LEFT' as const },
    { manualRange: { lowerPct: -10, upperPct: 400 }, upper: true, direction: 'RIGHT' as const },
  ])('clamps $direction at the chosen edge boundary $manualRange', ({ manualRange, upper, direction }) => {
    const { onChangeManualRange } = renderSetRange({ manualRange })
    press('SELECT')
    if (upper) press('DOWN')
    press(direction, direction, direction, 'A')
    expect(onChangeManualRange).toHaveBeenLastCalledWith(manualRange)
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

  it('says AMOUNT TOO SMALL FOR THIS RANGE and blocks confirm until amount funds a ladder', () => {
    const { getByText, queryByText, getByRole, onConfirm, container } = renderSetRange({ amount: 10 })
    expect(getByText('AMOUNT TOO SMALL FOR THIS RANGE')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(RAW_CODES)
    press('A')
    expect(onConfirm).not.toHaveBeenCalled()
    press('RIGHT', 'RIGHT')
    expect(queryByText('AMOUNT TOO SMALL FOR THIS RANGE')).not.toBeInTheDocument()
    expect(getByRole('img')).toBeInTheDocument()
    press('A')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a fixture without a book', { pool: FIXTURE_MARKETS[1].pool }, 'NO PRICE FOR THIS POOL YET'],
    ['an edit that does not straddle the price', { manualRange: { lowerPct: 5, upperPct: 9 } }, 'YOUR RANGE MUST SIT AROUND THE CURRENT PRICE'],
    ['a pair with no market rules', { pool: { ...POOL, tokenX: { ...POOL.tokenX, symbol: 'XYZ' } } }, 'NO MARKET RULES FOR THIS POOL YET'],
  ])('shows player copy, never a raw code, for %s, and blocks confirm', (_name, overrides, copy) => {
    const { getByText, container, onConfirm, onBack } = renderSetRange(overrides)
    expect(getByText(copy)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(RAW_CODES)
    press('A', 'B')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
