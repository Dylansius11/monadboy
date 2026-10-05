/**
 * FIXTURE data only, not a chain snapshot. Kuru/worker markets and Mera cards
 * are wired in Phase 7 (see BUILD-PLAN). All numbers here are illustrative.
 * Pool is the venue-neutral domain shape until the tracker interfaces land.
 */
import { brand } from '../config/brand'
import { gatesFor, mainnetProfile } from '../config/thresholds'
import { evaluateGates } from '../lib/scoring/gates'
import { scorePool } from '../lib/scoring/score'
import type { GateResult } from '../lib/scoring/gates'
import type { Difficulty, GateSet, Pool, PoolScore, SaveDisk } from '../types/domain'

/** Frozen clock prevents fixture ages and scores drifting between renders. */
export const FIXTURE_NOW = Date.parse('2026-10-05T00:00:00Z') / 1000
const PROFILE = mainnetProfile

/** Synthetic identity only, never a deployed address or transaction target. */
const fixtureAddress = (id: number): string => `0x${id.toString(16).padStart(40, '0')}`
const MON = { address: fixtureAddress(1), symbol: 'MON', decimals: 18 }
const USDC = { address: fixtureAddress(2), symbol: 'USDC', decimals: 6 }
const AUSD = { address: fixtureAddress(3), symbol: 'AUSD', decimals: 6 }

export interface FixtureMarket {
  FIXTURE: true
  pool: Pool
  book: { bid: number | null; ask: number | null }
  honeypotClean: boolean
}

/** Symbol shapes mirror the tracker; prices and depth are not live readings. */
export const FIXTURE_MARKETS: Array<FixtureMarket> = [
  {
    FIXTURE: true,
    pool: {
      pairAddress: fixtureAddress(0xab),
      tokenX: MON,
      tokenY: USDC,
      tvlUsd: 12_000,
      volume24hUsd: 9_000,
      createdAt: FIXTURE_NOW - 10 * 86_400,
      createdAtIsExact: true,
      lpConcentration: 0.2,
      realizedVol24h: 0.6,
    },
    book: { bid: 0.03312, ask: 0.03316 },
    honeypotClean: true,
  },
  {
    FIXTURE: true,
    pool: {
      pairAddress: fixtureAddress(0xac),
      tokenX: MON,
      tokenY: AUSD,
      tvlUsd: 0,
      volume24hUsd: 0,
      createdAt: FIXTURE_NOW - 10 * 86_400,
      createdAtIsExact: true,
      lpConcentration: null,
      realizedVol24h: null,
    },
    book: { bid: null, ask: null },
    // No executable bid in this fixture; even GOD MODE cannot clear a sell.
    honeypotClean: false,
  },
  {
    FIXTURE: true,
    pool: {
      pairAddress: fixtureAddress(0xad),
      tokenX: AUSD,
      tokenY: USDC,
      tvlUsd: 100_000,
      volume24hUsd: 15_000,
      createdAt: FIXTURE_NOW - 60 * 86_400,
      createdAtIsExact: true,
      lpConcentration: 0.1,
      realizedVol24h: 0.01,
    },
    book: { bid: 1.00006, ask: 1.000074 },
    honeypotClean: true,
  },
]

export interface ScoredPool {
  FIXTURE: true
  pool: Pool
  book: FixtureMarket['book']
  score: PoolScore
  gates: GateResult
  passes: boolean
}

/** Same thresholds feed the map territory and its pin acceptance. */
export function fixtureGates(difficulty: Difficulty): GateSet {
  return gatesFor(difficulty, PROFILE)
}

/** Failed markets stay visible as dim pins; missing momentum stays neutral. */
export function scoredPools(difficulty: Difficulty, godMode = false): Array<ScoredPool> {
  const gates = fixtureGates(difficulty)
  return FIXTURE_MARKETS.map(({ pool, book, honeypotClean }) => {
    const score = scorePool(
      { pool, momentumAgeSeconds: 0, honeypotClean, nowSeconds: FIXTURE_NOW },
      PROFILE,
    )
    const result = evaluateGates(pool, score, gates, FIXTURE_NOW)
    const passes = godMode ? score.honeypotClean : result.passed
    return { FIXTURE: true, pool, book, score, gates: result, passes }
  })
}

export function findPool(
  pairAddress: string | null,
  difficulty: Difficulty = 'easy',
  godMode = false,
): ScoredPool | undefined {
  if (!pairAddress) return undefined
  return scoredPools(difficulty, godMode).find(
    ({ pool }) => pool.pairAddress.toLowerCase() === pairAddress.toLowerCase(),
  )
}

export function passingCount(difficulty: Difficulty, godMode = false): number {
  return scoredPools(difficulty, godMode).filter(({ passes }) => passes).length
}

/** Mera account index zero is wired in Phase 7 (see BUILD-PLAN). */
export const FIXTURE_CARD_ADDRESS = fixtureAddress(0xca)
export const MAX_DISKS = 3

/** Three isolated FIXTURE disks, including a normal-tier unplayed slot. */
const DISKS: Array<SaveDisk & { FIXTURE: true }> = [
  {
    FIXTURE: true,
    diskId: 1,
    owner: FIXTURE_CARD_ADDRESS,
    name: 'safe money',
    difficulty: 'easy',
    godMode: false,
    createdAt: FIXTURE_NOW - 6 * 86_400,
    runs: 7,
    bestScore: 12.4,
    bestDamage: 0,
    attested: false,
  },
  {
    FIXTURE: true,
    diskId: 2,
    owner: FIXTURE_CARD_ADDRESS,
    name: 'degen box',
    difficulty: 'hard',
    godMode: true,
    createdAt: FIXTURE_NOW - 86_400,
    runs: 2,
    bestScore: 4.8,
    bestDamage: 7.9,
    attested: false,
  },
  {
    FIXTURE: true,
    diskId: 3,
    owner: FIXTURE_CARD_ADDRESS,
    name: 'new game',
    difficulty: 'normal',
    godMode: false,
    createdAt: FIXTURE_NOW,
    runs: 0,
    bestScore: 0,
    bestDamage: 0,
    attested: false,
  },
]

export function saveDisks(): Array<SaveDisk & { FIXTURE: true }> {
  return DISKS.map((disk) => ({ ...disk }))
}

export function findDisk(diskId: number | null): (SaveDisk & { FIXTURE: true }) | undefined {
  if (diskId === null) return undefined
  return saveDisks().find((disk) => disk.diskId === diskId)
}

/** Score minus damage, including negative results. */
export function diskNetUsd(disk: SaveDisk): number {
  return disk.bestScore - disk.bestDamage
}

export interface Cartridge {
  FIXTURE: true
  id: string
  title: string | null
  tagline: string | null
  locked: boolean
}

export function cartridges(): Array<Cartridge> {
  return [
    {
      FIXTURE: true,
      id: 'cart-01',
      title: brand.CARTRIDGE_01,
      tagline:
        'provide liquidity without knowing what that means. pick a character, pick a pool, stay in range.',
      locked: false,
    },
    { FIXTURE: true, id: 'cart-02', title: null, tagline: null, locked: true },
    { FIXTURE: true, id: 'cart-03', title: null, tagline: null, locked: true },
  ]
}
