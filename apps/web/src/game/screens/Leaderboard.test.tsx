// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { press, renderScreen } from '../../test/harness'
import { Leaderboard } from './Leaderboard'
import { WorkerReadError } from '../../lib/worker/client'
import type { ReadView } from '../../lib/worker/queries'
import type { LeaderboardReadout, LeaderboardRow } from '../../lib/worker/schemas'
import type { LeaderboardProps } from './Leaderboard'

const DISK_A = '0x1111111111111111111111111111111111111111'
const DISK_B = '0x2222222222222222222222222222222222222222'
const TX = `0x${'cd'.repeat(32)}`

const row = (overrides: Partial<LeaderboardRow> = {}): LeaderboardRow => ({
  disk: DISK_A,
  tag: null,
  characterId: null,
  score: 1.5,
  observedScore: 1.5,
  damage: 0.25,
  net: 1.25,
  valuationWindow: 'position-lifetime',
  fills: 4,
  secondsInRange: 125,
  timeCoverage: 'sampled-only',
  lastFillTx: TX,
  ...overrides,
})

const readout = (overrides: Partial<LeaderboardReadout> = {}): LeaderboardReadout => ({
  source: 'chain-fills-and-mid-samples',
  status: 'complete',
  window: '24h',
  rows: [row()],
  at: Date.parse('2026-10-06T12:00:00Z'),
  computedAt: Date.parse('2026-10-06T12:00:01Z'),
  ageMs: 3_000,
  ...overrides,
})

const ready = (data: LeaderboardReadout): ReadView<LeaderboardReadout> => ({
  kind: 'ready',
  data,
  receivedAt: 1_000,
  refreshError: null,
  offline: false,
  retry: vi.fn(),
})

function renderBoard(overrides: Partial<LeaderboardProps> = {}) {
  const onWindowChange = vi.fn()
  const onBack = vi.fn()
  const utils = renderScreen(
    <Leaderboard
      window="24h"
      onWindowChange={onWindowChange}
      view={ready(readout())}
      now={1_000}
      onBack={onBack}
      {...overrides}
    />,
  )
  return { ...utils, onWindowChange, onBack }
}

describe('rows from the worker', () => {
  it('shows SCORE, DAMAGE and NET at one size, with the source, the window and an explorer link', () => {
    const { container, getByText, getByRole } = renderBoard()

    const figures = Array.from(container.querySelectorAll('.lb-figure'))
    expect(figures.map((el) => el.textContent)).toEqual(['+1.50', '-0.2500', '+1.25'])
    expect(figures.every((el) => el.classList.contains('text-value'))).toBe(true)
    expect(getByText(/chain-fills-and-mid-samples/)).toBeInTheDocument()
    expect(getByText(/24h window/)).toBeInTheDocument()
    expect(getByRole('link')).toHaveAttribute('href', `https://testnet.monadexplorer.com/tx/${TX}`)
  })

  it('never turns an unread DAMAGE or NET into zero', () => {
    const { container } = renderBoard({
      view: ready(readout({ rows: [row({ damage: null, net: null })] })),
    })
    const figures = Array.from(container.querySelectorAll('.lb-figure')).map((el) => el.textContent)
    expect(figures).toEqual(['+1.50', 'n/a', 'n/a'])
  })

  it('labels a partial history as so far, not as a final SCORE', () => {
    const { getByText, container } = renderBoard({
      view: ready(
        readout({ status: 'partial', rows: [row({ score: null, observedScore: 0.75, damage: null, net: null })] }),
      ),
    })
    expect(getByText(/Fill history is partial/)).toBeInTheDocument()
    expect(getByText('so far')).toBeInTheDocument()
    expect(container.querySelector('.lb-figure')?.textContent).toBe('+0.7500')
  })

  it('uses a disk tag only when the worker read one, and draws no link without a fill', () => {
    const { getByText, queryByRole } = renderBoard({
      view: ready(readout({ rows: [row({ tag: 'ada' }), row({ disk: DISK_B, lastFillTx: null, fills: 0 })] })),
    })
    expect(getByText('ada')).toBeInTheDocument()
    expect(getByText('0x2222…2222')).toBeInTheDocument()
    expect(queryByRole('link', { name: /0x2222/ })).not.toBeInTheDocument()
  })
})

describe('when there is nothing to rank', () => {
  it('says the worker has not computed the window and invents no rows', () => {
    const { getByText, container } = renderBoard({
      view: ready(readout({ status: 'unavailable', rows: [], at: null, computedAt: null, ageMs: null })),
    })
    expect(getByText(/No leaderboard yet/i)).toBeInTheDocument()
    expect(container.querySelector('.lb-row')).toBeNull()
  })

  it('reports a failed read with its reason, and A retries it', () => {
    const retry = vi.fn()
    const error = new WorkerReadError('network', 'The worker could not be reached. Check the connection.')
    const { getByText, container } = renderBoard({ view: { kind: 'failed', error, retry } })
    expect(getByText(/Could not read leaderboard/i)).toBeInTheDocument()
    expect(getByText(/could not be reached/i)).toBeInTheDocument()
    expect(container.querySelector('.lb-row')).toBeNull()
    press('A')
    expect(retry).toHaveBeenCalledOnce()
  })

  it('keeps the last good rows, flagged, when only the refresh failed', () => {
    const view: ReadView<LeaderboardReadout> = {
      ...(ready(readout()) as Extract<ReadView<LeaderboardReadout>, { kind: 'ready' }>),
      refreshError: new WorkerReadError('timeout', 'The worker did not answer within 10 seconds.'),
    }
    const { getByText, container } = renderBoard({ view })
    expect(getByText(/Showing the last good read/)).toBeInTheDocument()
    expect(container.querySelectorAll('.lb-figure')).toHaveLength(3)
  })

  it('marks a result stale once the worker has not recomputed for five minutes', () => {
    const { getByText } = renderBoard({ now: 1_000 + 6 * 60_000 })
    expect(getByText(/STALE/)).toBeInTheDocument()
  })
})

describe('moving between windows', () => {
  it('steps one window per press and does not wrap at either end', () => {
    const first = renderBoard({ window: '24h' })
    press('LEFT')
    expect(first.onWindowChange).not.toHaveBeenCalled()
    press('RIGHT')
    expect(first.onWindowChange).toHaveBeenCalledExactlyOnceWith('7d')
    first.unmount()

    const last = renderBoard({ window: 'all' })
    press('RIGHT')
    expect(last.onWindowChange).not.toHaveBeenCalled()
    press('LEFT')
    expect(last.onWindowChange).toHaveBeenCalledExactlyOnceWith('7d')
  })

})
