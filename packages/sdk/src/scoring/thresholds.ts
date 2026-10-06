/**
 * Every tunable constant in the scoring model, in one file.
 *
 * Scoring functions receive a profile rather than importing one. Mainnet
 * depth and self-seeded testnet depth use different scales, but the same
 * model and weights.
 */

import type { Difficulty, GateSet } from './types'

export interface ScoringProfile {
  /** Which deployment this profile describes. */
  id: 'mainnet' | 'self-testnet'

  /**
   * Liquidity depth is log-scaled between these two. At or below `floor` the
   * term is 0; at or above `ceiling` it is 100.
   */
  depthFloorUsd: number
  depthCeilingUsd: number

  /** Pool age saturates at this many seconds. */
  ageSaturationSeconds: number

  /** Quote tokens we consider high quality, by symbol. */
  strongQuotes: Array<string>
  midQuotes: Array<string>

  /**
   * Turnover is BANDED, not monotonic. Too little volume means no fees; too
   * much means the price is running and the range will break. The peak is a
   * band, not a point.
   */
  turnoverIdealLow: number
  turnoverIdealHigh: number
  turnoverDeadAbove: number

  /** Realized volatility, annualised, mapped 0 to 100 across this span. */
  volFloor: number
  volCeiling: number

  /** SAFETY weights. Must sum to 1. */
  safetyWeights: {
    liquidityDepth: number
    poolAge: number
    quoteQuality: number
    lpConcentration: number
  }

  /** HEAT weights. Must sum to 1. */
  heatWeights: {
    realizedVol: number
    turnover: number
    momentum: number
  }

  /** Used when trade-count acceleration is missing or stale. Neutral, never zero. */
  momentumNeutral: number

  /** Older than this and every momentum score degrades to neutral. */
  momentumStaleAfterSeconds: number
}

/** Read-only mainnet market scoring. */
export const mainnetProfile: ScoringProfile = {
  id: 'mainnet',
  // Measured numbers are to be re-measured against the Kuru snapshot in Phase 6.
  depthFloorUsd: 500,
  depthCeilingUsd: 100_000,
  ageSaturationSeconds: 60 * 60 * 24 * 30,
  strongQuotes: ['USDC', 'AUSD', 'MON'],
  midQuotes: ['WETH', 'WBTC', 'cbBTC', 'XAUT'],
  turnoverIdealLow: 0.5,
  turnoverIdealHigh: 3,
  turnoverDeadAbove: 6,
  volFloor: 0.1,
  volCeiling: 2.5,
  safetyWeights: {
    liquidityDepth: 0.35,
    poolAge: 0.25,
    quoteQuality: 0.2,
    lpConcentration: 0.2,
  },
  heatWeights: { realizedVol: 0.45, turnover: 0.3, momentum: 0.25 },
  momentumNeutral: 50,
  momentumStaleAfterSeconds: 60 * 60 * 72,
}

/** Self-seeded testnet scales, with the same scoring weights as mainnet. */
export const selfTestnetProfile: ScoringProfile = {
  ...mainnetProfile,
  id: 'self-testnet',
  depthFloorUsd: 50,
  depthCeilingUsd: 20_000,
  ageSaturationSeconds: 60 * 60 * 6,
}

export const profiles = {
  mainnet: mainnetProfile,
  'self-testnet': selfTestnetProfile,
} as const

/**
 * Gates run BEFORE scores and are absolute. PRD.md section 7.
 *
 * These scale with the profile for the same reason the scores do, except
 * `honeypotCheck`, which is `true` at every tier including GOD MODE.
 */
export function gatesFor(
  difficulty: Difficulty,
  profile: ScoringProfile,
): GateSet {
  const scale = profile.id === 'mainnet' ? 1 : 0.002

  const base = {
    easy: {
      minTvlUsd: 40_000,
      minAgeSeconds: 60 * 60 * 24 * 14,
      minSafety: 70,
      minHeat: 0,
      maxHeat: 60,
    },
    normal: {
      minTvlUsd: 4_000,
      minAgeSeconds: 60 * 60 * 24 * 3,
      minSafety: 50,
      minHeat: 0,
      maxHeat: 80,
    },
    hard: {
      minTvlUsd: 500,
      minAgeSeconds: 60 * 60 * 6,
      minSafety: 30,
      minHeat: 0,
      maxHeat: 100,
    },
  }[difficulty]

  return {
    minTvlUsd: base.minTvlUsd * scale,
    minAgeSeconds:
      profile.id === 'mainnet'
        ? base.minAgeSeconds
        : Math.round(base.minAgeSeconds * 0.02),
    allowedQuoteSymbols:
      difficulty === 'easy'
        ? profile.strongQuotes
        : [...profile.strongQuotes, ...profile.midQuotes],
    honeypotCheck: true,
    minSafety: base.minSafety,
    minHeat: base.minHeat,
    maxHeat: base.maxHeat,
  }
}
