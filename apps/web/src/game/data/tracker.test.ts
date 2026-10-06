import { describe, expect, it } from 'vitest'
import type { Market } from '@monadboy/sdk'
import { isExecutable } from '../eligibility'
import { hasVerifiedMirror, toTrackerSnapshot } from './tracker'
import { parseTracker } from '../../lib/worker/schemas'
import type { SnapshotOptions } from './tracker'

const TAKEN_AT = Date.parse('2026-10-06T12:00:00Z')
const ADDRESS = '0x065c9d28e428a0db40191a54d33d5b7c71a9c394'

function market(symbol: string, overrides: Record<string, unknown> = {}, tvlUsd = 90_000) {
  return {
    market: symbol,
    status: 'live',
    takenAt: TAKEN_AT,
    mid: 0.033,
    bookState: 'available',
    playable: true,
    inputs: {
      pairAddress: ADDRESS,
      tokenX: { address: ADDRESS, symbol: symbol.split('_')[0], decimals: 18 },
      tokenY: { address: ADDRESS, symbol: symbol.split('_')[1], decimals: 6 },
      tvlUsd,
      volume24hUsd: 30_000,
      createdAt: Math.floor(TAKEN_AT / 1000) - 90 * 86_400,
      createdAtIsExact: true,
      lpConcentration: 0.2,
      realizedVol24h: 0.5,
    },
    score: {
      pairAddress: ADDRESS,
      safety: 80,
      heat: 40,
      liquidityDepth: 80,
      poolAge: 100,
      quoteQuality: 100,
      lpConcentrationScore: 80,
      realizedVol: 40,
      turnover: 100,
      momentum: 50,
      honeypotClean: true,
      momentumDegraded: false,
    },
    ...overrides,
  }
}

function readout(markets: Array<unknown>, coverageComplete = true) {
  return parseTracker({
    status: 'available',
    source: 'kuru-mainnet',
    takenAt: TAKEN_AT,
    ageMs: 1_000,
    coverage: { complete: coverageComplete, source: 'hypersync', ageMs: 1_000 },
    markets,
  })
}

const options = (overrides: Partial<SnapshotOptions> = {}): SnapshotOptions => ({
  difficulty: 'easy',
  godMode: false,
  ageMs: 1_000,
  ...overrides,
})

/** A verified deployment, shaped like the SDK manifest entry the worker mirrors against. */
const MIRROR = { symbol: 'MON_AUSD', baseSymbol: 'MON' } as Market

describe('what a worker pool may be played as', () => {
  it('is never PLAYABLE (TESTNET) without a verified mirror, whatever the worker says', () => {
    const { pools } = toTrackerSnapshot(readout([market('MON_USDC')]), options({ mirrors: [] }))
    expect(pools[0].network).toBe('mainnet')
    expect(pools.some(isExecutable)).toBe(false)
  })

  it('needs a verified mirror AND a clean live book the worker calls playable', () => {
    const mirrors = [MIRROR]
    const snapshot = (m: unknown) => toTrackerSnapshot(readout([m]), options({ mirrors })).pools[0]

    expect(isExecutable(snapshot(market('MON_USDC')))).toBe(true)
    // No mirror for this pair: mainnet only, however deep the book.
    expect(snapshot(market('WBTC_AUSD')).network).toBe('mainnet')
    // The worker refused it (honeypot, thin book, no mirror on its side).
    expect(snapshot(market('MON_USDC', { playable: false })).network).toBe('mainnet')
    // A thin book cannot host a ladder even on a mirrored pair.
    expect(isExecutable(snapshot(market('MON_USDC', { bookState: 'thin' })))).toBe(false)
    // An older snapshot is shown but never started from.
    const stale = snapshot(market('MON_USDC', { status: 'stale' }))
    expect(stale.stale).toBe(true)
    expect(isExecutable(stale)).toBe(false)
  })

  it('matches the worker rule: the same pair, or any MON market mirrors MON_USDC', () => {
    expect(hasVerifiedMirror('MON_USDC', [MIRROR])).toBe(true)
    expect(hasVerifiedMirror('MON_AUSD', [MIRROR])).toBe(true)
    expect(hasVerifiedMirror('AUSD_USDC', [MIRROR])).toBe(false)
    expect(hasVerifiedMirror('MON_USDC', [])).toBe(false)
  })
})

describe('the gates a worker pool is judged by', () => {
  it('apply the chosen tier to the worker score, using the snapshot time as now', () => {
    const pools = (difficulty: SnapshotOptions['difficulty']) =>
      toTrackerSnapshot(readout([market('MON_USDC', {}, 10_000)]), options({ difficulty })).pools[0]

    // $10k clears NORMAL ($4k) but not EASY ($40k).
    expect(pools('normal').passes).toBe(true)
    expect(pools('easy').passes).toBe(false)
    expect(pools('easy').gates.failures).toContain('tvl-too-low')
  })

  it('keeps the honeypot check in GOD MODE', () => {
    const risky = market('MON_USDC', {}, 600)
    risky.score.honeypotClean = false
    const hard = toTrackerSnapshot(readout([risky]), options({ difficulty: 'hard', godMode: true }))
    expect(hard.pools[0].passes).toBe(false)
    expect(hard.pools[0].gates.failures).toContain('honeypot')
  })
})

describe('provenance', () => {
  it('names the source, the snapshot time and incomplete trade coverage', () => {
    const { provenance } = toTrackerSnapshot(
      readout([market('MON_USDC'), { market: 'MON_AUSD', status: 'unavailable', takenAt: null, playable: false, score: null, inputs: null }], false),
      options({ ageMs: 10 * 60_000 }),
    )
    expect(provenance).toMatchObject({ kind: 'worker', source: 'kuru-mainnet', takenAtMs: TAKEN_AT, stale: false })
    expect(provenance.notes.join(' ')).toMatch(/24h trade history is incomplete \(hypersync\)/)
    expect(provenance.notes.join(' ')).toMatch(/Not scored, so not on the map: MON_AUSD/)
  })

  it('goes stale once the snapshot is older than three refreshes', () => {
    const stale = toTrackerSnapshot(readout([market('MON_USDC')]), options({ ageMs: 46 * 60_000 }))
    expect(stale.provenance.stale).toBe(true)
    expect(toTrackerSnapshot(readout([market('MON_USDC')]), options({ ageMs: 44 * 60_000 })).provenance.stale).toBe(false)
  })
})
