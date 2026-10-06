/**
 * Plain shapes the scoring model reads and returns. They carry no runtime
 * validation: callers that receive these from outside (the web app's zod
 * schemas, the worker's tracker snapshot) validate at their own boundary and
 * pass structurally identical values in.
 */

export interface Token {
  address: string
  symbol: string
  /** Carried, never assumed: USDC is 6, a mock token we deploy may be 18. */
  decimals: number
}

export interface Pool {
  pairAddress: string
  tokenX: Token
  tokenY: Token
  tvlUsd: number
  /** Null when unavailable; unknown volume is not an invented zero. */
  volume24hUsd: number | null
  /**
   * When the pool was born, or PROVABLY BEFORE IT, in seconds. Always a real
   * timestamp so `now - createdAt` is a valid age that never flatters.
   */
  createdAt: number
  /** False means "at least this old, possibly much older". */
  createdAtIsExact: boolean
  /** Share of 24h volume made by the top three makers, 0 to 1; null when unreadable. */
  lpConcentration: number | null
  /** Annualised realized volatility; null when history is short. */
  realizedVol24h: number | null
}

/** Every score field is an integer 0 to 100. */
export interface PoolScore {
  pairAddress: string
  safety: number
  heat: number
  liquidityDepth: number
  poolAge: number
  quoteQuality: number
  lpConcentrationScore: number
  realizedVol: number
  turnover: number
  momentum: number
  /** False excludes the pool entirely. Fail closed. */
  honeypotClean: boolean
  /** True when momentum fell back to neutral. */
  momentumDegraded: boolean
}

export type Difficulty = 'easy' | 'normal' | 'hard'

/** Gates run before scores and are absolute. */
export interface GateSet {
  minTvlUsd: number
  minAgeSeconds: number
  allowedQuoteSymbols: string[]
  /** Never false, including in GOD MODE. */
  honeypotCheck: true
  minSafety: number
  minHeat: number
  maxHeat: number
}
