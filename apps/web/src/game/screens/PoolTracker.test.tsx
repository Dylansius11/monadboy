// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { press, renderScreen } from '../../test/harness'
import { PoolTracker } from './PoolTracker'

import { fixtureGates } from '../fixtures'
import { useSession } from '../../state/session'
import type { ScoredPool } from '../fixtures'
import type { GateFailure } from '../../lib/scoring/gates'
import type { Pool, PoolScore } from '../../types/domain'

beforeEach(() => useSession.setState(useSession.getInitialState()))

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
}): ScoredPool {
  const failures = overrides.failures ?? []
  return {
    FIXTURE: true,
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

  it('B returns to the map, not to onBack', () => {
    const { getByText, queryByText, onBack } = renderTracker()
    press('A')
    expect(getByText(/AAA \/ USDC/)).toBeInTheDocument()
    press('B')
    expect(queryByText(/AAA \/ USDC/)).not.toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
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
})
