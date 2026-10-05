// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { press, renderScreen } from '../../test/harness'
import { FIXTURE_CARD_ADDRESS } from '../fixtures'
import { MemoryCard } from './MemoryCard'
import type { MemoryCardProps } from './MemoryCard'

function renderMemoryCard(overrides: Partial<MemoryCardProps> = {}) {
  const onInsert = vi.fn()
  const onBack = vi.fn()

  const utils = renderScreen(
    <MemoryCard
      cardAddress={
        'cardAddress' in overrides ? (overrides.cardAddress ?? null) : null
      }
      onInsert={overrides.onInsert ?? onInsert}
      onBack={overrides.onBack ?? onBack}
    />,
  )

  return { ...utils, onInsert, onBack }
}

describe('the screen', () => {
  it('offers both ways in, and states the three reassurances', () => {
    const { getByText } = renderMemoryCard()

    expect(getByText(/insert card/i)).toBeInTheDocument()
    expect(getByText(/new card/i)).toBeInTheDocument()

    expect(getByText(/^passkey$/i)).toBeInTheDocument()
    expect(getByText(/no extension/i)).toBeInTheDocument()
    expect(getByText(/^free$/i)).toBeInTheDocument()
  })

  it('says FIXTURE, because card actions use development data', () => {
    const { getByText } = renderMemoryCard()

    expect(getByText(/fixture/i)).toBeInTheDocument()
  })
})

describe('the forbidden vocabulary', () => {
  const FORBIDDEN = ['wallet', 'connect', 'seed phrase', 'gas'] as const

  for (const word of FORBIDDEN) {
    it(`never says "${word}"`, () => {
      const { container } = renderMemoryCard()
      expect(container.textContent.toLowerCase()).not.toContain(word)
    })
  }


  it('keeps the vocabulary rule once a card is already in the slot', () => {

    const { container } = renderMemoryCard({
      cardAddress: FIXTURE_CARD_ADDRESS,
    })
    const text = container.textContent.toLowerCase()

    for (const word of FORBIDDEN) expect(text).not.toContain(word)
  })
})

describe('the cursor', () => {
  it('DOWN moves it and does not wrap past the last method', () => {
    const { container } = renderMemoryCard()

    press('DOWN', 'DOWN', 'DOWN')

    const current = container.querySelectorAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toMatch(/new card/i)
  })

  it('UP does not wrap past the first method', () => {
    const { container } = renderMemoryCard()

    press('UP', 'UP')

    const current = container.querySelectorAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toMatch(/insert card/i)
  })
})

describe('inserting and going back', () => {
  it('A inserts the card', () => {
    const { onInsert } = renderMemoryCard()

    press('A')

    expect(onInsert).toHaveBeenCalledTimes(1)
  })

  it('a mouse click inserts too, because a phone has no A button', () => {
    const { getByText, onInsert } = renderMemoryCard()

    const button = getByText(/new card/i).closest('button')
    if (!button) throw new Error('a method row is not inside a button')
    fireEvent.click(button)

    expect(onInsert).toHaveBeenCalledTimes(1)
  })

  it('NEW CARD keeps continuation reachable when the inserted card appears', () => {
    function CardSession() {
      const [cardAddress, setCardAddress] = useState<string | null>(null)
      return (
        <MemoryCard
          cardAddress={cardAddress}
          onInsert={() => setCardAddress(FIXTURE_CARD_ADDRESS)}
          onBack={vi.fn()}
        />
      )
    }
    const { getByRole, getByText, queryByRole } = renderScreen(<CardSession />)
    press('DOWN', 'A', 'DOWN')
    expect(getByText(/0x00\.\.ca/i)).toBeInTheDocument()
    expect(queryByRole('button', { name: /^new card$/i })).not.toBeInTheDocument()
    expect(getByRole('button', { name: /^continue$/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('B goes back', () => {
    const { onBack } = renderMemoryCard()

    press('B')

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('the returning player', () => {
  it('shows the card as already in the slot, with its address truncated', () => {
    const { getByText } = renderMemoryCard({
      cardAddress: FIXTURE_CARD_ADDRESS,
    })

    expect(getByText(/memory card in/i)).toBeInTheDocument()
    expect(getByText(/0x00\.\.ca/i)).toBeInTheDocument()

    expect(getByText(/^continue$/i)).toBeInTheDocument()
  })

  it('shows no address at all before a card exists', () => {
    const { container } = renderMemoryCard()

    expect(container.textContent).not.toMatch(/0x/)
  })

  it('A still continues, so the route stays the only thing that knows where', () => {
    const { onInsert } = renderMemoryCard({
      cardAddress: FIXTURE_CARD_ADDRESS,
    })

    press('A')

    expect(onInsert).toHaveBeenCalledTimes(1)
  })

  it('keeps the visible continue action selected when DOWN is pressed', () => {
    const { getByRole, onInsert } = renderMemoryCard({
      cardAddress: FIXTURE_CARD_ADDRESS,
    })

    press('DOWN', 'DOWN')
    expect(getByRole('button', { name: /^continue$/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
    press('A')
    expect(onInsert).toHaveBeenCalledOnce()
  })
})
