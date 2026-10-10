// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { fireEvent } from '@testing-library/react'
import { press, renderScreen } from '../../test/harness'
import { PoolTracker } from './PoolTracker'

import { FIXTURE_NOW, fixtureGates, scoredPools } from '../fixtures'
import { FIXTURE_PROVENANCE } from '../data/provenance'
import {
  evaluateGates,
  GATE_COPY,
  mainnetProfile,
  scorePool,
} from '@monadboy/sdk'
import type { ScoredPool } from '../fixtures'
import type { TrackerPool, TrackerProvenance } from '../data/types'
import type { GateFailure } from '@monadboy/sdk'
import type { Pool, PoolScore } from '../../types/domain'

function pool(overrides: Partial<Pool> = {}): Pool {
  return {
    pairAddress: '0x1111111111111111111111111111111111111111',
    tokenX: {
      address: '0x1111111111111111111111111111111111111111',
      symbol: 'AAA',
      decimals: 18,
    },
    tokenY: {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'USDC',
      decimals: 6,
    },
    tvlUsd: 400_000,
    volume24hUsd: 90_000,
    createdAt: 1_753_000_000,
    createdAtIsExact: true,
    lpConcentration: 0.3,
    realizedVol24h: 0.5,
    ...overrides,
  }
}

function score(overrides: Partial<PoolScore> = {}): PoolScore {
  return {
    pairAddress: '0x1111111111111111111111111111111111111111',
    safety: 80,
    heat: 30,
    liquidityDepth: 70,
    poolAge: 90,
    quoteQuality: 100,
    lpConcentrationScore: 60,
    realizedVol: 20,
    turnover: 40,
    momentum: 50,
    honeypotClean: true,
    momentumDegraded: false,
    ...overrides,
  }
}

function scoredPool(overrides: {
  pool?: Partial<Pool>
  score?: Partial<PoolScore>
  failures?: Array<GateFailure>
  passes?: boolean
  network?: ScoredPool['network']
}): ScoredPool {
  const failures = overrides.failures ?? []
  return {
    FIXTURE: true,
    network: overrides.network ?? 'mainnet',
    book: { bid: 1, ask: 1.001 },
    pool: pool(overrides.pool),
    score: score(overrides.score),
    gates: { passed: failures.length === 0, failures, unverified: [] },
    passes: overrides.passes ?? failures.length === 0,
  }
}

const PASSING_LOW = scoredPool({
  pool: {
    pairAddress: '0xaaaa',
    tokenX: { address: '0xaaaa', symbol: 'AAA', decimals: 18 },
    tokenY: {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'USDC',
      decimals: 6,
    },
  },
  score: { safety: 30, heat: 40, momentumDegraded: false },
  passes: true,
})

const FILTERED_DEGRADED = scoredPool({
  pool: {
    pairAddress: '0xbbbb',
    tokenX: { address: '0xbbbb', symbol: 'BBB', decimals: 18 },
    tokenY: {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'USDC',
      decimals: 6,
    },
  },
  score: { safety: 80, heat: 85, momentumDegraded: true },
  failures: ['tvl-too-low', 'safety-too-low'],
})

const PASSING_FILLER = scoredPool({
  pool: {
    pairAddress: '0xcccc',
    tokenX: { address: '0xcccc', symbol: 'CCC', decimals: 18 },
    tokenY: {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'USDC',
      decimals: 6,
    },
  },
  score: { safety: 10, heat: 10 },
  passes: true,
})

const THREE_POOLS = [PASSING_LOW, FILTERED_DEGRADED, PASSING_FILLER]

function renderTracker(
  overrides: Partial<Parameters<typeof PoolTracker>[0]> = {},
) {
  const onPlayPool = vi.fn()
  const onBack = vi.fn()
  const utils = renderScreen(
    <PoolTracker
      pools={THREE_POOLS}
      characterId="molandak"
      gates={fixtureGates('easy')}
      provenance={FIXTURE_PROVENANCE}
      onPlayPool={onPlayPool}
      onBack={onBack}
      {...overrides}
    />,
  )
  return { ...utils, onPlayPool, onBack }
}

describe('the map draws the filter working', () => {
  it('renders every pool, filtered-out included, not just the passing ones', () => {
    const { container } = renderTracker()

    expect(container.querySelectorAll('[role="img"]').length).toBe(
      THREE_POOLS.length + 4,
    )

  })

  it('the header PASSED count matches the pools actually marked passes, not the total', () => {
    const { getByText } = renderTracker()
    expect(getByText(/2 passed/i)).toBeInTheDocument()
  })
})

describe('inspecting a pool', () => {
  it('A opens the inspect panel for the selected pool', () => {
    const { getByText } = renderTracker()
    press('A')
    expect(getByText(/AAA \/ USDC/)).toBeInTheDocument()
  })

  it('shows all seven score terms, the whole claim of the screen', () => {
    const { getByText } = renderTracker()
    press('A')
    expect(getByText(/depth 70/)).toBeInTheDocument()
    expect(getByText(/age 90/)).toBeInTheDocument()
    expect(getByText(/pair 100/)).toBeInTheDocument()
    expect(getByText(/spread 60/)).toBeInTheDocument()
    expect(getByText(/swing 20/)).toBeInTheDocument()
    expect(getByText(/trade 40/)).toBeInTheDocument()
    expect(getByText(/buzz 50/)).toBeInTheDocument()
  })

  it('states fee income is an estimate, permanently, next to the number', () => {
    const { getByText } = renderTracker()
    press('A')
    expect(getByText(/% \/ yr/)).toBeInTheDocument()
    expect(getByText(/estimate, not a promise/)).toBeInTheDocument()
  })

  it('renders "offline" next to buzz for a pool with no momentum entry', () => {
    const { getByText } = renderTracker()
    press('RIGHT') // 0 (safety 30) -> 1 (safety 80, the only pool beyond it)
    press('A')
    expect(getByText(/BBB \/ USDC/)).toBeInTheDocument()
    expect(getByText(/buzz 50 \(offline\)/)).toBeInTheDocument()
  })

  it('lists every gate failure for a filtered pool, not just the first', () => {
    const { getByText } = renderTracker()
    press('RIGHT')
    press('A')
    expect(
      getByText(/Not enough liquidity for this difficulty/),
    ).toBeInTheDocument()
    expect(getByText(/Safety below this difficulty floor/)).toBeInTheDocument()
  })

  it('consumes the first B to leave inspection and the second B to leave the tracker', () => {
    const { onBack } = renderTracker()
    press('A', 'B')
    expect(onBack).not.toHaveBeenCalled()
    press('B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('leaving the map', () => {
  it('B calls onBack', () => {
    const { onBack } = renderTracker()
    press('B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('missing data, Gate 2.4', () => {
  it('zero passing pools renders the defined empty state, not a spinner', () => {
    const { getByText, onBack, queryByRole } = renderTracker({
      pools: [scoredPool({ failures: ['tvl-too-low'] })],
    })

    expect(getByText(/Nothing passed/i)).toBeInTheDocument()
    expect(queryByRole('progressbar')).not.toBeInTheDocument()

    press('B')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('points an empty EASY map at the looser tiers and names why the pool failed', () => {
    const { getByText, queryByText } = renderTracker({
      pools: [scoredPool({ failures: ['tvl-too-low'] })],
    })

    expect(getByText(/NORMAL and HARD let more pools through/)).toBeInTheDocument()
    expect(queryByText(/easier tier/i)).not.toBeInTheDocument()
    expect(getByText(GATE_COPY['tvl-too-low'])).toBeInTheDocument()
  })

  it('does not send a HARD player to a looser tier that does not exist', () => {
    const { getByText } = renderTracker({
      pools: [scoredPool({ failures: ['tvl-too-low'] })],
      characterId: 'mouch',
      gates: fixtureGates('hard'),
    })

    expect(getByText(/HARD is already the loosest filter/)).toBeInTheDocument()
  })
})

describe('the field states the rule it is judging pools by', () => {
  it('draws the passing region from the gate set, not from a hard-coded box', () => {
    const gates = fixtureGates('easy')
    const { container } = renderTracker({ gates })

    const region = container.querySelector(
      `rect[x="${gates.minSafety}"][height="${gates.maxHeat}"]`,
    )
    expect(region).not.toBeNull()
    expect(region?.getAttribute('y')).toBe(String(100 - gates.maxHeat))
    expect(region?.getAttribute('width')).toBe(String(100 - gates.minSafety))
  })

  it('colours each pin by its safety band, and never by the tier it is on', () => {

    const { container } = renderTracker()
    const labels = Array.from(container.querySelectorAll('[role="img"]')).map(
      (el) => el.getAttribute('aria-label'),
    )

    expect(labels).toContain('amber')
    expect(labels).toContain('green filtered')
    expect(labels).toContain('red')
  })

  it('moves the region when the tier does', () => {
    const easy = fixtureGates('easy')
    const hard = fixtureGates('hard')

    expect(easy.minSafety).not.toBe(hard.minSafety)

    const { container } = renderTracker({ gates: hard })
    expect(container.querySelector(`rect[x="${easy.minSafety}"]`)).toBeNull()
    expect(
      container.querySelector(`rect[x="${hard.minSafety}"]`),
    ).not.toBeNull()
  })
})

const selectedRings = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('circle')).filter(
    (c) => c.getAttribute('stroke-width') === '3',
  )

describe('the cursor is a state of the pin', () => {
  it('marks exactly one pin, and moving the cursor moves the mark', () => {
    const { container } = renderTracker()

    expect(selectedRings(container).length).toBe(1)
    const before = selectedRings(container)[0].closest('div')

    press('LEFT')
    expect(selectedRings(container).length).toBe(1)
    expect(selectedRings(container)[0].closest('div')).not.toBe(before)
  })

  it('names only the selected pool, because fourteen labels is a list', () => {
    const { getAllByText } = renderTracker()
    expect(getAllByText('AAA').length).toBe(1)
    press('LEFT')
    expect(getAllByText('CCC').length).toBe(1)
  })
})

describe('the radar has something in it', () => {
  it('plots every pool as a minimap dot, not an empty sweeping circle', () => {
    const { container } = renderTracker()
    const minimap = container.querySelector('.radar-sweep-hand')?.parentElement

    expect(minimap?.querySelectorAll('span').length).toBe(
      THREE_POOLS.length + 1,
    )
  })

  it('shows the viewport rectangle only once there is a viewport to show', () => {
    const { container } = renderTracker()
    const box = () =>
      container
        .querySelector('.radar-sweep-hand')
        ?.parentElement?.querySelector('.border-ink')

    expect(box()).toBeNull()
    press('SELECT')
    expect(box()).not.toBeNull()
  })
})

describe('zoom', () => {
  it('SELECT cycles the levels and wraps back to 1x', () => {
    const { getByText, queryByText } = renderTracker()

    expect(getByText('1x')).toBeInTheDocument()
    press('SELECT')
    expect(getByText('2x')).toBeInTheDocument()
    press('SELECT')
    expect(getByText('3x')).toBeInTheDocument()
    press('SELECT')
    expect(getByText('1x')).toBeInTheDocument()
    expect(queryByText('3x')).not.toBeInTheDocument()
  })

  it('cancels itself on the pins, so zooming separates them without fattening them', () => {
    const { container } = renderTracker()
    const pinBox = () => container.querySelector('[role="img"]')?.parentElement

    expect(pinBox()?.getAttribute('style')).toContain('scale(1)')
    press('SELECT')
    expect(pinBox()?.getAttribute('style')).toContain('scale(0.5)')
  })
})

describe('the worst pool still shows its controls', () => {
  it('keeps the footer on screen when a pool fails every gate', () => {

    const { getByText } = renderTracker({
      pools: [
        scoredPool({
          score: { safety: 7, heat: 95 },
          failures: [
            'tvl-too-low',
            'too-new',
            'quote-not-allowed',
            'safety-too-low',
            'heat-too-high',
          ],
        }),
        PASSING_LOW,
      ],
    })
    press('A')

    expect(getByText(/Too hot for this difficulty/)).toBeInTheDocument()
    expect(getByText(/Locked by the checks above/i)).toBeInTheDocument()
    expect(getByText(/B Back to map/i)).toBeInTheDocument()
  })

  it('absorbs the overflow in the failure list, not in the footer', () => {
    const { container } = renderTracker({
      pools: [
        scoredPool({ failures: ['tvl-too-low', 'too-new', 'honeypot'] }),
        PASSING_LOW,
      ],
    })
    press('A')

    const region = container.querySelector('.min-h-0.flex-1')
    expect(region).not.toBeNull()
    expect(region?.querySelector('.bg-sunk')).not.toBeNull()
  })
})

describe('zoom is reachable by tap as well as by button', () => {
  it('the on-screen controls step the same zoom SELECT cycles', () => {
    const { getByLabelText, getByText } = renderTracker()

    expect(getByText('1x')).toBeInTheDocument()
    fireEvent.click(getByLabelText('Zoom in'))
    expect(getByText('2x')).toBeInTheDocument()
    fireEvent.click(getByLabelText('Zoom out'))
    expect(getByText('1x')).toBeInTheDocument()
  })

  it('clamps at both ends rather than wrapping, unlike SELECT', () => {
    const { getByLabelText, getByText } = renderTracker()

    expect(getByLabelText('Zoom out')).toBeDisabled()
    fireEvent.click(getByLabelText('Zoom in'))
    fireEvent.click(getByLabelText('Zoom in'))
    expect(getByText('3x')).toBeInTheDocument()
    expect(getByLabelText('Zoom in')).toBeDisabled()
  })
})

describe('the inspect panel says who is talking', () => {
  it('puts the Monanimal next to its own line', () => {
    const { getByText, container } = renderTracker()
    press('A')

    expect(getByText(/deep, old, boring/)).toBeInTheDocument()

    expect(container.querySelector('.sprite-pair')).not.toBeNull()
  })
})

describe('fixture source and deployment boundaries', () => {
  const playable = (): ScoredPool => {
    const entry = scoredPools('easy').find(({ network }) => network === 'testnet')
    if (!entry) throw new Error('missing executable testnet fixture')
    return entry
  }

  it('starts a passing TESTNET pool only after inspecting it', () => {
    const entry = playable()
    const { getByText, onPlayPool } = renderTracker({ pools: [entry] })
    expect(getByText(/FIXTURE source.*fallback.*Not live/)).toBeInTheDocument()
    press('A')
    expect(onPlayPool).not.toHaveBeenCalled()
    expect(getByText(/PLAYABLE \(TESTNET\)/)).toBeInTheDocument()
    press('A')
    expect(onPlayPool).toHaveBeenCalledExactlyOnceWith(entry.pool.pairAddress)
  })

  it('keeps passing mainnet pools inspectable but never starts a run there', () => {
    const { getAllByText, onPlayPool } = renderTracker()
    press('A')
    expect(getAllByText(/MAINNET ONLY/)).toHaveLength(2)
    press('A')
    expect(onPlayPool).not.toHaveBeenCalled()
  })

  it('renders the MON/AUSD null book as thin and refuses play even in GOD MODE', () => {
    const pools = scoredPools('hard', true)
    const empty = pools.find((entry) => entry.network === 'mainnet' && entry.pool.tokenY.symbol === 'AUSD')
    if (!empty) throw new Error('missing MON/AUSD fixture')
    const { getByText, onPlayPool } = renderTracker({
      pools: [empty, ...pools.filter((entry) => entry !== empty)],
      characterId: 'mouch',
      gates: fixtureGates('hard'),
    })
    press('A')
    expect(getByText(/Thin book.*MAINNET ONLY/)).toBeInTheDocument()
    expect(getByText(GATE_COPY.honeypot)).toBeInTheDocument()
    press('A')
    expect(onPlayPool).not.toHaveBeenCalled()
  })

  it('does not treat a missing side of a passing book as executable liquidity', () => {
    const entry = { ...playable(), book: { bid: null, ask: 1 } }
    const { onPlayPool } = renderTracker({ pools: [entry] })
    press('A', 'A')
    expect(onPlayPool).not.toHaveBeenCalled()
  })

  it('blocks a two-sided passing mainnet MON/AUSD book rather than trusting its symbols', () => {
    const entry = { ...playable(), network: 'mainnet' as const }
    const { getAllByText, onPlayPool } = renderTracker({ pools: [entry] })
    press('A')
    expect(getAllByText(/MAINNET ONLY/)).toHaveLength(2)
    press('A')
    expect(onPlayPool).not.toHaveBeenCalled()
  })

  it('shows the scoring library SAFETY and HEAT failures and neutral offline momentum', () => {
    const market = pool({ tvlUsd: 0, realizedVol24h: 4 })
    const computed = scorePool({
      pool: market, momentumAgeSeconds: 86_400, honeypotClean: true,
      nowSeconds: FIXTURE_NOW,
    }, mainnetProfile)
    const gates = { ...fixtureGates('easy'), maxHeat: 1 }
    const result = evaluateGates(market, computed, gates, FIXTURE_NOW)
    const entry: ScoredPool = {
      FIXTURE: true, network: 'mainnet', pool: market, book: { bid: 1, ask: 1.001 },
      score: computed, gates: result, passes: result.passed,
    }
    const { getByText } = renderTracker({ pools: [entry, PASSING_LOW], gates })
    press('A')
    expect(getByText(GATE_COPY['safety-too-low'])).toBeInTheDocument()
    expect(getByText(GATE_COPY['heat-too-high'])).toBeInTheDocument()
    expect(getByText(/buzz 50 \(offline\)/)).toBeInTheDocument()
  })
})

describe('a worker read says it is one', () => {
  const REFERENCE = Date.parse('2026-10-06T12:00:00Z') / 1000
  const worker: TrackerProvenance = {
    kind: 'worker',
    source: 'kuru-mainnet',
    takenAtMs: REFERENCE * 1000,
    ageMs: 5 * 60_000,
    referenceSeconds: REFERENCE,
    stale: false,
    partial: true,
    notes: ['24h trade history is incomplete (rpc).'],
  }
  const workerPool = (): TrackerPool => ({
    network: 'mainnet',
    pool: pool({ createdAt: REFERENCE - 3 * 86_400, createdAtIsExact: true }),
    score: score(),
    gates: { passed: true, failures: [], unverified: [] },
    passes: true,
    book: { state: 'available' },
  })

  it('prints its source, snapshot time, age and gaps, and never the fixture label', () => {
    const { getByText, queryByText } = renderTracker({ pools: [workerPool()], provenance: worker })
    expect(getByText(/kuru-mainnet \(mainnet, read only\) · taken 2026-10-06 12:00 UTC · 5m 00s old · PARTIAL/)).toBeInTheDocument()
    expect(getByText(/24h trade history is incomplete/)).toBeInTheDocument()
    expect(queryByText(/fixture/i)).not.toBeInTheDocument()
  })

  it('measures pool age from the snapshot clock and invents no fee estimate', () => {
    const { getByText, queryByText } = renderTracker({ pools: [workerPool()], provenance: worker })
    press('A')
    expect(getByText('3 days')).toBeInTheDocument()
    expect(queryByText(/% \/ yr/)).not.toBeInTheDocument()
    expect(getByText(/no per-swap fee rate is read/)).toBeInTheDocument()
  })

  it('cannot play a read-only snapshot even if every gate passed', () => {
    const { onPlayPool } = renderTracker({
      pools: [{ ...workerPool(), network: 'testnet', stale: true }],
      provenance: worker,
    })
    press('A', 'A')
    expect(onPlayPool).not.toHaveBeenCalled()
  })
})
