import { describe, expect, it } from 'vitest'
import { WorkerReadError } from './client'
import { parseLeaderboard, parseTracker } from './schemas'

const ADDRESS = '0x065c9d28e428a0db40191a54d33d5b7c71a9c394'
const TX = `0x${'ab'.repeat(32)}`

const market = (overrides: Record<string, unknown> = {}) => ({
  market: 'MON_USDC',
  status: 'live',
  takenAt: 1_760_000_000_000,
  mid: 0.033,
  bookState: 'available',
  playable: true,
  inputs: {
    pairAddress: ADDRESS,
    tokenX: { address: '0x0000000000000000000000000000000000000000', symbol: 'MON', decimals: 18 },
    tokenY: { address: ADDRESS, symbol: 'USDC', decimals: 6 },
    tvlUsd: 12_000,
    volume24hUsd: null,
    createdAt: 1_759_000_000,
    createdAtIsExact: false,
    lpConcentration: null,
    realizedVol24h: null,
  },
  score: {
    pairAddress: ADDRESS,
    safety: 61,
    heat: 48,
    liquidityDepth: 70,
    poolAge: 40,
    quoteQuality: 100,
    lpConcentrationScore: 50,
    realizedVol: 50,
    turnover: 50,
    momentum: 50,
    honeypotClean: true,
    momentumDegraded: true,
  },
  ...overrides,
})

const trackerBody = (markets: Array<unknown>) => ({
  status: 'partial',
  source: 'kuru-mainnet',
  takenAt: 1_760_000_000_000,
  ageMs: 4_000,
  coverage: { complete: false, source: 'rpc', ageMs: null },
  markets,
})

describe('the tracker boundary', () => {
  it('keeps the readable markets and reports each one it could not read', () => {
    const readout = parseTracker(
      trackerBody([
        market(),
        // The worker's own shape for a market it has never read.
        { market: 'WBTC_AUSD', status: 'unavailable', takenAt: null, playable: false, score: null, inputs: null },
        // A score term that is not an integer 0 to 100 is not a score.
        market({ market: 'XAUT_USDC', score: { ...market().score, safety: 140 } }),
        'not even an object',
      ]),
    )

    expect(readout.markets.map((m) => m.market)).toEqual(['MON_USDC'])
    expect(readout.unreadable).toEqual([
      { market: 'WBTC_AUSD', reason: 'unavailable' },
      { market: 'XAUT_USDC', reason: 'invalid' },
      { market: null, reason: 'invalid' },
    ])
  })

  it('fails the whole read when the envelope itself is wrong', () => {
    expect(() => parseTracker({ status: 'available', markets: [] })).toThrow(WorkerReadError)
    expect(() => parseTracker(trackerBody([]).markets)).toThrow(WorkerReadError)
  })
})

const row = (overrides: Record<string, unknown> = {}) => ({
  disk: ADDRESS,
  tag: null,
  characterId: null,
  score: 1.25,
  observedScore: 1.25,
  damage: 0.5,
  net: 0.75,
  valuationWindow: 'position-lifetime',
  fills: 3,
  secondsInRange: 90,
  timeCoverage: 'sampled-only',
  lastFillTx: TX,
  ...overrides,
})

const leaderboardBody = (rows: Array<unknown>, overrides: Record<string, unknown> = {}) => ({
  source: 'chain-fills-and-mid-samples',
  status: 'complete',
  window: '24h',
  rows,
  at: 1_760_000_000_000,
  computedAt: 1_760_000_001_000,
  ageMs: 2_000,
  ...overrides,
})

describe('the leaderboard boundary', () => {
  it('accepts the worker answer for a window that has not been computed', () => {
    const readout = parseLeaderboard(
      leaderboardBody([], { status: 'unavailable', at: null, computedAt: null, ageMs: null }),
      '24h',
    )
    expect(readout.rows).toEqual([])
    expect(readout.status).toBe('unavailable')
  })

  it('keeps unread DAMAGE and NET as null rather than zero', () => {
    const readout = parseLeaderboard(
      leaderboardBody([row({ score: null, damage: null, net: null })], { status: 'partial' }),
      '24h',
    )
    expect(readout.rows[0]).toMatchObject({ score: null, damage: null, net: null, observedScore: 1.25 })
  })

  it('refuses another window than the one asked for', () => {
    expect(() => parseLeaderboard(leaderboardBody([row()], { window: '7d' }), '24h')).toThrow(
      /7d window for a 24h request/,
    )
  })

  it('fails the whole read for one bad row, which would change every rank', () => {
    expect(() =>
      parseLeaderboard(leaderboardBody([row(), row({ lastFillTx: '0x1234' })]), '24h'),
    ).toThrow(WorkerReadError)
  })
})
