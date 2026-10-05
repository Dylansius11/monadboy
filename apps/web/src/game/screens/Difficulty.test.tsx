// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { within } from '@testing-library/react'
import { press, renderScreen } from '../../test/harness'
import { Difficulty } from './Difficulty'

import { fixtureGates, passingCount, scoredPools } from '../fixtures'
import { ageInDays, compactUsd } from '../../lib/format'
import { useSession } from '../../state/session'
import type { DifficultyProps } from './Difficulty'
import type { Difficulty as DifficultyTier } from '../../types/domain'

const TIERS: ReadonlyArray<DifficultyTier> = ['easy', 'normal', 'hard']
const TOTAL_POOLS = scoredPools('easy').length

beforeEach(() => useSession.setState(useSession.getInitialState()))

function renderDifficulty(overrides: Partial<DifficultyProps> = {}) {
  const onChange = vi.fn()
  const onConfirm = vi.fn()
  const onBack = vi.fn()
  const utils = renderScreen(
    <Difficulty
      difficulty="easy"
      godMode={false}
      onChange={onChange}
      onConfirm={onConfirm}
      onBack={onBack}
      {...overrides}
    />,
  )
  return { ...utils, onChange, onConfirm, onBack }
}

const WORD_LETTERS = ['I', 'K', 'N', 'O', 'W']

function overlayOf(container: HTMLElement): HTMLElement {
  const overlay = container.querySelector('.bg-alarm')
  if (!overlay) throw new Error('GOD MODE overlay is not open')
  return overlay as HTMLElement
}

function chooseCandidate(container: HTMLElement, letter: string) {
  const buttons = Array.from(overlayOf(container).querySelectorAll('button'))
  const index = buttons.findIndex((button) => button.textContent === letter)
  if (index < 0) throw new Error(`no candidate button reads "${letter}"`)
  for (let i = 0; i < index; i += 1) press('RIGHT')
  press('A')
}

function openGodModeOverlay() {
  press('UP')
  press('A')
}

describe('the three characters', () => {
  it('renders all three, the selected one at 64px and the others at 32px', () => {
    const { container } = renderDifficulty({ difficulty: 'normal' })
    const sprites = Array.from(container.querySelectorAll('[role="img"]'))

    const molandak = sprites.find(
      (s) => s.getAttribute('aria-label') === 'molandak idle',
    )
    const moyaki = sprites.find(
      (s) => s.getAttribute('aria-label') === 'moyaki idle',
    )
    const mouch = sprites.find(
      (s) => s.getAttribute('aria-label') === 'mouch idle',
    )

    expect(molandak).toHaveStyle({ width: '32px', height: '32px' })
    expect(moyaki).toHaveStyle({ width: '64px', height: '64px' })
    expect(mouch).toHaveStyle({ width: '32px', height: '32px' })
  })
})

describe('moving between tiers', () => {
  it('RIGHT moves to the next tier and fires onChange', () => {
    const { onChange } = renderDifficulty({ difficulty: 'easy' })
    press('RIGHT')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('normal')
  })

  it('RIGHT at the last tier does not wrap', () => {
    const { onChange } = renderDifficulty({ difficulty: 'hard' })
    press('RIGHT')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('LEFT at the first tier does not wrap', () => {
    const { onChange } = renderDifficulty({ difficulty: 'easy' })
    press('LEFT')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('the live gate readout', () => {
  for (const tier of TIERS) {
    it(`reads ${tier}'s numbers from fixtureGates, not a literal`, () => {
      const gates = fixtureGates(tier)
      const { getByText } = renderDifficulty({ difficulty: tier })

      expect(getByText(compactUsd(gates.minTvlUsd))).toBeInTheDocument()
      expect(
        getByText(ageInDays(gates.minAgeSeconds), { exact: false }),
      ).toBeInTheDocument()
      expect(
        getByText(gates.allowedQuoteSymbols.join(', '), { exact: false }),
      ).toBeInTheDocument()

      expect(getByText(`${gates.maxHeat} heat`)).toBeInTheDocument()
    })
  }

  it('moves the readout when the tier does', () => {
    const easy = fixtureGates('easy')
    const hard = fixtureGates('hard')

    expect(easy.minTvlUsd).not.toBe(hard.minTvlUsd)

    const { queryByText } = renderDifficulty({ difficulty: 'hard' })
    expect(queryByText(compactUsd(easy.minTvlUsd))).not.toBeInTheDocument()
    expect(queryByText(compactUsd(hard.minTvlUsd))).toBeInTheDocument()
  })
})

describe('the three-tier count strip', () => {
  it('shows a count per tier with a visible denominator', () => {
    const { getAllByRole } = renderDifficulty({ difficulty: 'easy' })
    for (const [index, tier] of TIERS.entries()) {
      const passing = passingCount(tier, false)
      const row = getAllByRole('meter')[index].parentElement?.parentElement
      if (!row) throw new Error('missing count row')
      expect(within(row).getByText(`${passing} of ${TOTAL_POOLS}`)).toBeInTheDocument()
    }
  })
})

describe('GOD MODE, a modifier on HARD only', () => {
  it('is disabled on EASY and NORMAL, and enabled on HARD', () => {
    const easy = renderDifficulty({ difficulty: 'easy' })
    expect(easy.container.querySelector('[role="option"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    const normal = renderDifficulty({ difficulty: 'normal' })
    expect(normal.container.querySelector('[role="option"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    const hard = renderDifficulty({ difficulty: 'hard' })
    expect(hard.container.querySelector('[role="option"]')).not.toHaveAttribute(
      'aria-disabled',
    )
  })
})

describe('confirming a tier', () => {
  it('A fires onConfirm with the selected tier and godMode false', () => {
    const { onConfirm } = renderDifficulty({ difficulty: 'normal' })
    press('A')
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('normal', false)
  })
})

describe('the GOD MODE gate', () => {
  it('never confirms the screen on a single A press, or on repeated blind presses', () => {
    const { onConfirm, container } = renderDifficulty({ difficulty: 'hard' })
    openGodModeOverlay()
    expect(overlayOf(container)).toBeInTheDocument()

    for (let i = 0; i < 10; i += 1) press('A')

    expect(overlayOf(container)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('spelling I KNOW correctly closes the overlay and turns GOD MODE on', () => {
    const { container } = renderDifficulty({ difficulty: 'hard' })
    openGodModeOverlay()

    for (const letter of WORD_LETTERS) {
      chooseCandidate(container, letter)
    }

    expect(container.querySelector('.bg-alarm')).not.toBeInTheDocument()
    expect(container.querySelector('[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('a wrong letter does not advance the word', () => {
    const { getByText } = renderDifficulty({ difficulty: 'hard' })
    openGodModeOverlay()

    press('A')

    expect(getByText('> _ _ _ _ _')).toBeInTheDocument()
    expect(getByText(/not that one/i)).toBeInTheDocument()
  })
})
