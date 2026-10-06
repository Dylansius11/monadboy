import type { GateResult } from '@monadboy/sdk'
import type { Pool, PoolScore } from '../../types/domain'

/**
 * One pool as S5 and the play routes see it, whether it came from the worker
 * or from the development fixtures. `ScoredPool` (fixtures.ts) is a
 * `TrackerPool` whose `FIXTURE` flag is set, so the same screen draws both.
 */
export interface TrackerPool {
  /** Present only on development fixtures. A production entry never has it. */
  FIXTURE?: true
  /** `testnet` only when a verified mirror deployment exists. Everything else is mainnet and read only. */
  network: 'mainnet' | 'testnet'
  pool: Pool
  score: PoolScore
  gates: GateResult
  passes: boolean
  /** Fixtures carry the two sides; the worker reports whether the book can host a ladder. */
  book: { bid: number | null; ask: number | null } | { state: 'available' | 'thin' }
  /** The worker kept an older snapshot because the latest read of this market failed. */
  stale?: boolean
}

/**
 * Where a set of pools came from and how old it is, carried WITH the pools so
 * a screen cannot show them as live by omitting it.
 */
export interface TrackerProvenance {
  kind: 'fixture' | 'worker'
  /** The worker's own name for the source, or the fixture set's. */
  source: string
  /** When the worker took the snapshot. Null for fixtures. */
  takenAtMs: number | null
  /** Age right now, null when there is no real read. */
  ageMs: number | null
  /** The clock pool age and gates are measured against, in seconds. */
  referenceSeconds: number
  stale: boolean
  partial: boolean
  /** Plain sentences about what is missing or degraded. */
  notes: ReadonlyArray<string>
}
