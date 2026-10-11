import type { Database } from 'bun:sqlite'
import type { Hex } from 'viem'
import { SOURCE_FRESH_MS, SOURCE_STALE_MS, isSourcePaused, sourceAgeMs, testnetObservation } from './mid-sampler'
import type { MidState } from './mid-sampler'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'
import type { HealthSection } from '../app'

export type MirrorKind = 'paused' | 'hold' | 'quote' | 'buy' | 'sell'
export type MirrorDecision = { kind: 'paused' | 'hold' | 'reconcile'; reason: string }
export type MirrorInput = {
  targetMid: number | null
  sourceAgeMs: number | null
  sourcePaused: boolean
  // False when no fresh testnet read exists: an unread book is not an empty book, so never quote.
  testnetObserved: boolean
}

// SPEC 5.2. Pure: never reads the chain or the clock, and never signs on a
// price that is missing, stale or from a paused source.
export function decideMirrorAction(input: MirrorInput): MirrorDecision {
  if (
    input.sourcePaused ||
    input.targetMid === null ||
    input.targetMid <= 0 ||
    input.sourceAgeMs === null ||
    input.sourceAgeMs > SOURCE_STALE_MS
  )
    return { kind: 'paused', reason: 'source-unavailable' }
  if (!input.testnetObserved) return { kind: 'hold', reason: 'testnet-unavailable' }
  return { kind: 'reconcile', reason: 'source-fresh' }
}

// notional: quote units (AUSD) taken from other makers this tick.
export type MirrorOutcome = {
  kind: 'hold' | 'quote' | 'buy' | 'sell'
  reason: string
  notional: number
  hashes: Hex[]
}
export type MirrorExecutor = {
  // Reads the book and, only if the ladder no longer fits the target, signs one atomic
  // batchUpdate (plus a take when another maker's order sits on the wrong side of it).
  // A hold sends nothing. Failures carry already-broadcast `hashes`.
  execute: (targetMid: number, assertSource: () => void | Promise<void>) => Promise<MirrorOutcome>
}
export type MirrorState = {
  attempted: number
  lastAt: number | null
  lastAction: MirrorKind | null
  lastError: string | null
}

export function createMirrorState(): MirrorState {
  return { attempted: 0, lastAt: null, lastAction: null, lastError: null }
}

export function createMirrorJob({
  db,
  mid,
  state,
  executor,
  active = () => 1,
  intervalMs = 0,
  target = () => mid.targetMid,
  now = Date.now,
  logger = log,
}: {
  db: Database
  mid: MidState
  state: MirrorState
  executor: MirrorExecutor
  active?: () => number
  intervalMs?: number
  target?: () => number | null
  now?: () => number
  logger?: Logger
}) {
  const insert = db.query(
    'INSERT INTO mirror_ticks (at, source_mid, testnet_mid_before, action, notional, tx_hash, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  let prunedAt = 0
  let lastActionAt = Number.NEGATIVE_INFINITY
  return async () => {
    const at = now()
    if (active() === 0 || at - lastActionAt < intervalMs) {
      Object.assign(state, { lastAt: at, lastAction: 'hold', lastError: null })
      return
    }
    let kind: MirrorKind = 'paused'
    let reason = 'not-evaluated'
    let notional = 0
    let hashes: Hex[] = []
    let error: string | null = null
    const sourceMid = target()
    const testnet = testnetObservation(mid, at)
    // Evaluated context: the sampler may advance while the executor signs.
    const testnetMid = testnet.mid
    try {
      const decision = decideMirrorAction({
        targetMid: sourceMid,
        sourceAgeMs: sourceAgeMs(mid, at),
        sourcePaused: isSourcePaused(mid, at),
        testnetObserved: testnet.status === 'live' || testnet.status === 'empty',
      })
      kind = decision.kind === 'reconcile' ? 'hold' : decision.kind
      reason = decision.reason
      if (decision.kind === 'reconcile') {
        lastActionAt = at
        const outcome = await executor.execute(sourceMid!, () => {
          const checkedAt = now()
          const age = sourceAgeMs(mid, checkedAt)
          if (active() === 0)
            throw new Error('Gameplay demand expired before mirror signing')
          if (isSourcePaused(mid, checkedAt) || age === null || age > SOURCE_FRESH_MS)
            throw new Error('Source unavailable before mirror signing')
          // The ladder is built around the target read at the start of the tick.
          if (target() === null) throw new Error('Demo target unavailable before mirror signing')
        })
        ;({ kind, reason, notional, hashes } = outcome)
      }
    } catch (cause) {
      error = describeError(cause)
      if (cause instanceof Error && 'hashes' in cause && Array.isArray(cause.hashes))
        hashes = cause.hashes as Hex[]
    }
    insert.run(at, sourceMid, testnetMid, kind, notional, hashes.join(',') || null, error)
    if (at - prunedAt > 3_600_000) {
      db.query('DELETE FROM mirror_ticks WHERE at < ?').run(at - 7 * 86_400_000)
      prunedAt = at
    }
    Object.assign(state, { lastAt: at, lastAction: kind, lastError: error })
    state.attempted++
    logger('mirror.tick', { action: kind, reason, notional, txs: hashes, error })
  }
}

export type MirrorGasStatus = { capWei: string; reservedWei: string; exhausted: boolean; dayUTC: string }

export function mirrorSection(
  state: MirrorState,
  execution: { enabled: boolean; reason: string | null },
  now: () => number,
  gas: () => MirrorGasStatus | null = () => null,
): () => HealthSection {
  return () => {
    const budget = gas()
    return {
      value: {
        execution: execution.enabled ? 'enabled' : 'disabled',
        reason: execution.reason,
        ticks: state.attempted,
        lastTickAgeMs: state.lastAt === null ? null : now() - state.lastAt,
        lastAction: state.lastAction,
        lastError: state.lastError,
        gas: budget,
      },
      // An exhausted budget leaves the last ladder resting; it is degraded, not broken.
      amber: !execution.enabled
        ? `mirror-disabled:${execution.reason ?? 'unknown'}`
        : budget?.exhausted || state.lastError?.includes('daily gas budget exhausted')
          ? 'mirror-gas-exhausted'
          : state.lastError !== null
            ? 'mirror-error'
            : undefined,
    }
  }
}
