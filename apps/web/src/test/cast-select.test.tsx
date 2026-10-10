// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { gatesFor, mainnetProfile } from '@monadboy/sdk'
import { Cast } from '../landing/sections/Cast'
import { characters } from '../config/brand'
import { ageInDays, compactUsd } from '../lib/format'

// jsdom has no matchMedia, which motion reads for reduced motion.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}))

const pick = (id: keyof typeof characters) =>
  screen.getByRole('button', { name: `${characters[id].label}, ${characters[id].tier}` })

describe('the landing character select', () => {
  it('starts on MOLANDAK and cycles with the arrows, wrapping both ways', () => {
    render(<Cast />)
    expect(pick('molandak')).toHaveAttribute('aria-pressed', 'true')

    pick('molandak').focus()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(pick('moyaki')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(pick('mouch')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(pick('molandak')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(pick('mouch')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('cast-panel')).toHaveTextContent(characters.mouch.label)
  })

  it('leaves the arrows alone when the player is elsewhere on the page', () => {
    render(<Cast />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(pick('molandak')).toHaveAttribute('aria-pressed', 'true')
  })

  it('selects on click and marks only that one pressed', () => {
    render(<Cast />)
    fireEvent.click(pick('moyaki'))
    expect(pick('moyaki')).toHaveAttribute('aria-pressed', 'true')
    expect(pick('molandak')).toHaveAttribute('aria-pressed', 'false')
    expect(pick('mouch')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('cast-panel')).toHaveTextContent(characters.moyaki.label)
  })

  it('reads the selected tier filters from the SDK gates', () => {
    render(<Cast />)
    fireEvent.click(pick('mouch'))
    const hard = gatesFor('hard', mainnetProfile)
    const panel = within(screen.getByTestId('cast-panel'))
    expect(panel.getByText(compactUsd(hard.minTvlUsd))).toBeInTheDocument()
    expect(panel.getByText(ageInDays(hard.minAgeSeconds))).toBeInTheDocument()
    expect(panel.getByText(hard.allowedQuoteSymbols.join(', '))).toBeInTheDocument()
    expect(panel.getByText(`${hard.minSafety}`)).toBeInTheDocument()
    expect(panel.getByText(`${hard.maxHeat} heat`)).toBeInTheDocument()

    fireEvent.click(pick('molandak'))
    const easy = gatesFor('easy', mainnetProfile)
    expect(panel.getByText(compactUsd(easy.minTvlUsd))).toBeInTheDocument()
    expect(panel.queryByText(compactUsd(hard.minTvlUsd))).not.toBeInTheDocument()
  })
})
