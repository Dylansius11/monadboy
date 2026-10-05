// @vitest-environment jsdom

import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { press, renderScreen } from '../../test/harness'
import { FIXTURE_MARKETS } from '../fixtures'
import { SetRange } from './SetRange'
import type { SetRangeProps } from './SetRange'
import type { ManualRange, RangeWidth } from '../../state/session'
import type { Pool } from '../../types/domain'

const POOL: Pool = FIXTURE_MARKETS[0].pool
const STABLE_POOL: Pool = FIXTURE_MARKETS[2].pool

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
