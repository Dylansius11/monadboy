/**
 * FIXTURE seeded price walk for S7. No clock, network, or platform randomness.
 * Kuru fills and worker mids are wired in Phase 7 (see BUILD-PLAN).
 * The illustrative earnings and damage are not a yield quote or fill model.
 */
import type { RangePlan } from '../lib/range/plan'
import type { Pool } from '../types/domain'

export interface SimState {
  seed: number
  /** Quote per base, in the same units as the ladder's low/high prices. */
  mid: number
  elapsedSeconds: number
  feesEarnedUsd: number
  /** Stored positive; the screen renders the minus. */
  damageUsd: number
  history: Array<number>
  ticksInRange: number
  totalTicks: number
  rebalances: number
  bestStreakSeconds: number
  streakSeconds: number
}

const LCG_A = 1_664_525
const LCG_C = 1_013_904_223
const LCG_M = 2 ** 32

function lcgNext(seed: number): number {
  return (LCG_A * seed + LCG_C) % LCG_M
}

/** Fixture estimate: half the deposit changes hands at a 0.3% swap cost. */
export const REBALANCE_COST_FRACTION = 0.0015

/** The display clock advances one hour per 500ms screen tick. */
export const STEP_SECONDS = 3_600
const SECONDS_PER_YEAR = 365 * 86_400
export const FALLBACK_REALIZED_VOL = 0.6
/** Noise pacing is separate from the display clock to keep terrain legible. */
const NOISE_HORIZON_SECONDS = 900
export const FEE_APR = 0.18
export const DAMAGE_APR = 0.35
const HISTORY_CAP = 30

function seedFromAddress(address: string): number {
  let hash = 0
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Two opening samples let the chart draw immediately. */
export function createSim(pool: Pool, mid: number): SimState {
  return {
    seed: seedFromAddress(pool.pairAddress),
    mid,
    elapsedSeconds: 0,
    feesEarnedUsd: 0,
    damageUsd: 0,
    history: [mid, mid],
    ticksInRange: 0,
    totalTicks: 0,
    rebalances: 0,
    bestStreakSeconds: 0,
    streakSeconds: 0,
  }
}

/** One uniform log-return draw, quantized to the caller's ladder step. */
export function step(
  state: SimState,
  pool: Pool,
  range: RangePlan,
  amount: number,
): SimState {
  const seed = lcgNext(state.seed)
  const draw = (seed / LCG_M) * 2 - 1
  const vol = pool.realizedVol24h ?? FALLBACK_REALIZED_VOL
  const stepVol = vol * Math.sqrt(NOISE_HORIZON_SECONDS / SECONDS_PER_YEAR)
  const logReturn = draw * stepVol
  const levelLogWidth = Math.log1p(range.step)
  const mid = state.mid * (1 + range.step) ** Math.round(logReturn / levelLogWidth)
  const inRange = mid >= range.low && mid <= range.high
  const stepFraction = STEP_SECONDS / SECONDS_PER_YEAR

  const feesEarnedUsd =
    state.feesEarnedUsd + (inRange ? amount * FEE_APR * stepFraction : 0)
  const damageUsd =
    state.damageUsd + (inRange ? 0 : amount * DAMAGE_APR * stepFraction)
  const history = [...state.history, mid].slice(-HISTORY_CAP)
  const streakSeconds = inRange ? state.streakSeconds + STEP_SECONDS : 0

  return {
    seed,
    mid,
    elapsedSeconds: state.elapsedSeconds + STEP_SECONDS,
    feesEarnedUsd,
    damageUsd,
    history,
    ticksInRange: state.ticksInRange + (inRange ? 1 : 0),
    totalTicks: state.totalTicks + 1,
    rebalances: state.rebalances,
    bestStreakSeconds: Math.max(state.bestStreakSeconds, streakSeconds),
    streakSeconds,
  }
}

/** The screen owns the new range; the simulation counts and charges the move. */
export function recordRebalance(state: SimState, amountUsd: number): SimState {
  return {
    ...state,
    rebalances: state.rebalances + 1,
    damageUsd: state.damageUsd + amountUsd * REBALANCE_COST_FRACTION,
  }
}

export interface RunSummary {
  feesEarnedUsd: number
  damageUsd: number
  netUsd: number
  timeInRangePct: number
  rebalances: number
  bestStreakSeconds: number
  elapsedSeconds: number
}

export function summarize(state: SimState): RunSummary {
  return {
    feesEarnedUsd: state.feesEarnedUsd,
    damageUsd: state.damageUsd,
    netUsd: state.feesEarnedUsd - state.damageUsd,
    timeInRangePct:
      state.totalTicks === 0 ? 0 : (state.ticksInRange / state.totalTicks) * 100,
    rebalances: state.rebalances,
    bestStreakSeconds: state.bestStreakSeconds,
    elapsedSeconds: state.elapsedSeconds,
  }
}

/** Demo override by ladder levels; the next tick records the new price. */
export function nudge(
  state: SimState,
  direction: 1 | -1,
  levels: number,
  stepFraction: number,
): SimState {
  return { ...state, mid: state.mid * (1 + stepFraction) ** (direction * levels) }
}
