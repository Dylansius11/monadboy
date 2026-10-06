import type { Database } from 'bun:sqlite'
import { scoreCard, scoreFromFills } from '@monadboy/sdk'
import type { Deposit, Fill, Holdings } from '@monadboy/sdk'
import { log } from '../logger'
import type { Logger } from '../logger'
import type { HealthSection } from '../app'

export type DiskFills = {
  disk: string
  market: string
  tag: string | null
  // Sealed inside the disk ciphertext, so not derivable from chain data.
  characterId: string | null
  openedAt: number
  low: number | null
  high: number | null
  fills: Fill[]
  // Null when the source cannot read them; DAMAGE and NET then stay unavailable.
  holdings: Holdings | null
  deposit: Deposit | null
}
export type FillSnapshot = {
  status: 'complete' | 'partial' | 'no-market-configured' | 'unavailable'
  at: number
  disks: DiskFills[]
}
// Phase 6 reads Trade logs directly; Phase 8 swaps in Envio behind this same interface.
export type FillSource = { read: () => Promise<FillSnapshot> }

export const WINDOWS = ['24h', '7d', 'all'] as const
export type LeaderboardWindow = (typeof WINDOWS)[number]
const WINDOW_MS: Record<LeaderboardWindow, number> = {
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  all: Number.POSITIVE_INFINITY,
}
// Consecutive mid samples further apart than this are unknown time, not time in range.
const MAX_SAMPLE_GAP_MS = 15_000
const MID_FRESH_MS = 60_000

export type LeaderboardRow = {
  disk: string
  tag: string | null
  characterId: string | null
  score: number | null
  observedScore: number
  damage: number | null
  net: number | null
  valuationWindow: 'position-lifetime'
  fills: number
  secondsInRange: number
  timeCoverage: 'sampled-only'
  lastFillTx: string | null
}

export function createLeaderboardJob({
  db,
  source,
  now = Date.now,
  logger = log,
}: {
  db: Database
  source: FillSource
  now?: () => number
  logger?: Logger
}) {
  const samplesQuery = db.query<{ at: number; mid: number }, [string, number]>(
    'SELECT at, mid FROM mid_samples WHERE market = ? AND at >= ? ORDER BY at',
  )
  return async () => {
    const data = await source.read()
    const computedAt = now()
    for (const window of WINDOWS) {
      const since = computedAt - WINDOW_MS[window]
      const rows: LeaderboardRow[] = data.disks.map((disk) => {
        const fills = disk.fills.filter((fill) => fill.at >= since)
        const samples = samplesQuery.all(
          `testnet:${disk.market}`,
          Math.max(since, disk.openedAt, 0),
        )
        const last = samples.at(-1)
        const fresh = last !== undefined && computedAt - last.at <= MID_FRESH_MS
        const valuation =
          data.status === 'complete' && fresh && disk.holdings && disk.deposit
            ? scoreCard(disk.fills, disk.holdings, disk.deposit, last.mid)
            : null
        let secondsInRange = 0
        for (let i = 0; i + 1 < samples.length; i++) {
          const [sample, next] = [samples[i], samples[i + 1]]
          if (
            disk.low !== null &&
            disk.high !== null &&
            sample.mid >= disk.low &&
            sample.mid <= disk.high &&
            next.at - sample.at <= MAX_SAMPLE_GAP_MS
          )
            secondsInRange += (next.at - sample.at) / 1000
        }
        const observedScore = scoreFromFills(fills)
        return {
          disk: disk.disk,
          tag: disk.tag,
          characterId: disk.characterId,
          // Incomplete history never supplies a final total.
          score: data.status === 'complete' ? observedScore : null,
          observedScore,
          damage: valuation?.damage ?? null,
          net: valuation?.net ?? null,
          valuationWindow: 'position-lifetime',
          fills: fills.length,
          secondsInRange,
          timeCoverage: 'sampled-only',
          lastFillTx: fills.at(-1)?.tx ?? null,
        }
      })
      rows.sort(
        (a, b) =>
          (b.score ?? -1) - (a.score ?? -1) ||
          b.observedScore - a.observedScore,
      )
      db.query(
        'INSERT OR REPLACE INTO leaderboard_cache (window, json, computed_at) VALUES (?, ?, ?)',
      ).run(
        window,
        JSON.stringify({
          source: 'chain-fills-and-mid-samples',
          status: data.status,
          at: data.at,
          window,
          rows,
        }),
        computedAt,
      )
    }
    logger('leaderboard.computed', {
      status: data.status,
      disks: data.disks.length,
    })
  }
}

export function leaderboardSection(
  db: Database,
  source: 'direct-logs' | 'not-configured',
  now: () => number,
): () => HealthSection {
  return () => {
    const row = db
      .query<{ computed_at: number }, []>(
        'SELECT MAX(computed_at) AS computed_at FROM leaderboard_cache',
      )
      .get()
    return {
      value: {
        source,
        computedAt: row?.computed_at ?? null,
        ageMs: row?.computed_at == null ? null : now() - row.computed_at,
      },
    }
  }
}
