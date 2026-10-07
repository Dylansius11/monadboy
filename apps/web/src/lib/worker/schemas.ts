/**
 * What the worker's /v1/tracker and /v1/leaderboard are allowed to say.
 *
 * These mirror the worker's response shapes by reading its routes, not by
 * importing its code: the web app and the worker share only the SDK. A shape
 * that does not match is a failed read, reported as such.
 */

import { z } from 'zod'
import { WorkerReadError } from './client'

export const LEADERBOARD_WINDOWS = ['24h', '7d', 'all'] as const
export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number]

const finite = z.number().refine(Number.isFinite)
const nonNegative = finite.refine((n) => n >= 0)
const percent = z.number().int().min(0).max(100)
const txHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)

const token = z.object({
  address: z.string().min(1),
  symbol: z.string().min(1).max(32),
  decimals: z.number().int().min(0).max(255),
})

/** The SDK's `Pool`, as the worker serialises it. */
const poolInputs = z.object({
  pairAddress: address,
  tokenX: token,
  tokenY: token,
  tvlUsd: nonNegative,
  volume24hUsd: nonNegative.nullable(),
  createdAt: nonNegative,
  createdAtIsExact: z.boolean(),
  lpConcentration: z.number().min(0).max(1).nullable(),
  realizedVol24h: nonNegative.nullable(),
})

/** The SDK's `PoolScore`. Every term is an integer 0 to 100. */
const poolScore = z.object({
  pairAddress: address,
  safety: percent,
  heat: percent,
  liquidityDepth: percent,
  poolAge: percent,
  quoteQuality: percent,
  lpConcentrationScore: percent,
  realizedVol: percent,
  turnover: percent,
  momentum: percent,
  honeypotClean: z.boolean(),
  momentumDegraded: z.boolean(),
})

const coverage = z.object({
  complete: z.boolean(),
  source: z.string().max(40),
  ageMs: finite.nullable(),
})

const symbol = z.string().min(1).max(40)

const scoredMarket = z.object({
  market: symbol,
  status: z.enum(['live', 'stale']),
  takenAt: nonNegative,
  mid: nonNegative.nullable(),
  bookState: z.enum(['available', 'thin']),
  playable: z.boolean(),
  inputs: poolInputs,
  score: poolScore,
})

/** A market the worker could not read and has no earlier snapshot for. */
const unavailableMarket = z.object({
  market: symbol,
  status: z.literal('unavailable'),
  takenAt: z.null(),
  playable: z.boolean(),
  inputs: z.null(),
  score: z.null(),
})

export type ScoredMarket = z.infer<typeof scoredMarket>

const trackerEnvelope = z.object({
  status: z.enum(['offline', 'partial', 'available']),
  source: z.string().min(1).max(60),
  takenAt: nonNegative.nullable(),
  ageMs: finite.nullable(),
  coverage: coverage.nullable(),
  markets: z.array(z.unknown()),
})

export interface TrackerReadout {
  status: z.infer<typeof trackerEnvelope>['status']
  source: string
  takenAt: number | null
  ageMs: number | null
  coverage: z.infer<typeof coverage> | null
  /** Markets with a score, live or stale. */
  markets: Array<ScoredMarket>
  /** Markets the worker listed but could not score, plus any this app could not read. */
  unreadable: Array<{ market: string | null; reason: 'unavailable' | 'invalid' }>
}

function invalid(what: string, error: z.ZodError): WorkerReadError {
  const issue = error.issues[0]
  const where = issue.path.length ? ` at ${issue.path.join('.')}` : ''
  return new WorkerReadError(
    'invalid-response',
    `The worker's ${what} answer did not match the expected shape${where}.`,
  )
}

/**
 * Validates /v1/tracker.
 *
 * The envelope must be valid. Each market is validated on its own: one market
 * that does not parse is reported as unreadable and left off the map, it never
 * takes the others down and is never filled in.
 */
export function parseTracker(json: unknown): TrackerReadout {
  const envelope = trackerEnvelope.safeParse(json)
  if (!envelope.success) throw invalid('tracker', envelope.error)

  const markets: Array<ScoredMarket> = []
  const unreadable: TrackerReadout['unreadable'] = []
  for (const raw of envelope.data.markets) {
    const scored = scoredMarket.safeParse(raw)
    if (scored.success) {
      markets.push(scored.data)
      continue
    }
    const none = unavailableMarket.safeParse(raw)
    if (none.success) {
      unreadable.push({ market: none.data.market, reason: 'unavailable' })
      continue
    }
    const named = z.object({ market: symbol }).safeParse(raw)
    unreadable.push({
      market: named.success ? named.data.market : null,
      reason: 'invalid',
    })
  }
  return { ...envelope.data, markets, unreadable }
}

const leaderboardRow = z.object({
  disk: address,
  tag: z.string().nullable(),
  characterId: z.string().nullable(),
  /** Null until the fill history is complete: a partial history has no final total. */
  score: finite.nullable(),
  observedScore: finite,
  damage: nonNegative.nullable(),
  net: finite.nullable(),
  valuationWindow: z.literal('disk-lifetime-cash-flows'),
  fills: z.number().int().min(0),
  secondsInRange: nonNegative,
  timeCoverage: z.literal('sampled-only'),
  lastFillTx: txHash.nullable(),
})

export type LeaderboardRow = z.infer<typeof leaderboardRow>

const leaderboardEnvelope = z.object({
  source: z.string().min(1).max(60),
  status: z.enum(['complete', 'partial', 'no-market-configured', 'unavailable']),
  window: z.enum(LEADERBOARD_WINDOWS),
  rows: z.array(z.unknown()),
  /** When the chain data was read. */
  at: nonNegative.nullable(),
  /** When the worker last computed this window. */
  computedAt: nonNegative.nullable(),
  ageMs: finite.nullable(),
})

export type LeaderboardReadout = Omit<
  z.infer<typeof leaderboardEnvelope>,
  'rows'
> & { rows: Array<LeaderboardRow> }

/**
 * Validates /v1/leaderboard.
 *
 * Unlike the tracker, one bad row fails the whole read: dropping it would
 * quietly change everyone's rank. The answered window must also be the window
 * asked for, so one window's rows can never be shown under another's name.
 */
export function parseLeaderboard(
  json: unknown,
  requested: LeaderboardWindow,
): LeaderboardReadout {
  const envelope = leaderboardEnvelope.safeParse(json)
  if (!envelope.success) throw invalid('leaderboard', envelope.error)
  if (envelope.data.window !== requested) {
    throw new WorkerReadError(
      'invalid-response',
      `The worker answered the ${envelope.data.window} window for a ${requested} request.`,
    )
  }
  const rows = z.array(leaderboardRow).safeParse(envelope.data.rows)
  if (!rows.success) throw invalid('leaderboard', rows.error)
  return { ...envelope.data, rows: rows.data }
}
