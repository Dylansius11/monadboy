import type { Database } from 'bun:sqlite'
import type { Hex } from 'viem'
import { SOURCE_FRESH_MS, SOURCE_STALE_MS, isSourcePaused, sourceAgeMs, testnetObservation } from './mid-sampler'
import type { MidState } from './mid-sampler'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'
import type { HealthSection } from '../app'

export type MirrorKind = 'paused' | 'hold' | 'quote' | 'buy' | 'sell'
// notional: quote units (USD) the bot takes this tick; quoteNotional: quote units per resting side.
export type MirrorAction = {
  kind: MirrorKind
  notional: number
  quoteNotional: number
  reason: string
}
export type MirrorInput = {
  targetMid: number | null
  sourceAgeMs: number | null
  sourcePaused: boolean
  // Null when the testnet book was read and has no usable bid and ask.
  testnetMid: number | null
  // False when no fresh testnet read exists: an unread book is not an empty book, so never seed quotes.
  testnetObserved: boolean
  deviationThreshold: number
  maxStepNotional: number
  // Whole-unit margin inventory, including owned resting funds released before execution.
  inventory: { base: number; quote: number }
}

const idle = (kind: MirrorKind, reason: string): MirrorAction => ({
  kind,
  notional: 0,
  quoteNotional: 0,
  reason,
})

// SPEC 5.2. Pure: never reads the chain or the clock, and never trades on a
// price that is missing, stale or from a paused source.
export function decideMirrorAction(input: MirrorInput): MirrorAction {
  const { targetMid, testnetMid, inventory } = input
  if (
    input.sourcePaused ||
    targetMid === null ||
    targetMid <= 0 ||
    input.sourceAgeMs === null ||
    input.sourceAgeMs > SOURCE_STALE_MS
  ) {
    return idle('paused', 'source-unavailable')
  }
  if (!input.testnetObserved) return idle('hold', 'testnet-unavailable')
  const quoteNotional = Math.max(
    0,
    Math.min(
      input.maxStepNotional,
      inventory.quote,
      inventory.base * targetMid,
    ),
  )
  if (testnetMid === null)
    return quoteNotional > 0
      ? { kind: 'quote', notional: 0, quoteNotional, reason: 'book-empty' }
      : idle('hold', 'no-inventory')
  if (Math.abs(testnetMid / targetMid - 1) <= input.deviationThreshold)
    return idle('hold', 'within-threshold')
  const buy = testnetMid < targetMid
  const notional = Math.max(
    0,
    Math.min(
      input.maxStepNotional,
      buy ? inventory.quote : inventory.base * targetMid,
    ),
  )
  if (notional === 0) return idle('hold', 'no-inventory')
  return {
    kind: buy ? 'buy' : 'sell',
    notional,
    quoteNotional,
    reason: buy ? 'below-target' : 'above-target',
  }
}

export type MirrorExecutor = {
  inventory: () => Promise<{ base: number; quote: number }>
  // Cancel owned quotes, take only remaining external liquidity, then refresh.
  execute: (action: MirrorAction, targetMid: number, assertSource: () => void | Promise<void>) => Promise<Hex[]>
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
  maxStepNotional,
  deviationThreshold,
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
  maxStepNotional: number
  deviationThreshold: number
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
    let action = idle('paused', 'not-evaluated')
    let hashes: Hex[] = []
    let error: string | null = null
    let sourceMid = target()
    let testnetMid = mid.testnet.mid
    try {
      const inventory = await executor.inventory()
      const evaluatedAt = now()
      const testnet = testnetObservation(mid, evaluatedAt)
      sourceMid = target()
      testnetMid = testnet.mid
      action = decideMirrorAction({
        targetMid: sourceMid,
        sourceAgeMs: sourceAgeMs(mid, evaluatedAt),
        sourcePaused: isSourcePaused(mid, evaluatedAt),
        testnetMid: testnet.mid,
        testnetObserved: testnet.status === 'live' || testnet.status === 'empty',
        deviationThreshold,
        maxStepNotional,
        inventory,
      })
      if (action.kind !== 'paused' && action.kind !== 'hold') {
        lastActionAt = now()
        hashes = await executor.execute(action, sourceMid ?? 0, () => {
          const checkedAt = now()
          const age = sourceAgeMs(mid, checkedAt)
          if (active() === 0)
            throw new Error('Gameplay demand expired before mirror signing')
          if (isSourcePaused(mid, checkedAt) || age === null || age > SOURCE_FRESH_MS)
            throw new Error('Source unavailable before mirror signing')
        })
      }
    } catch (cause) {
      error = describeError(cause)
      if (cause instanceof Error && 'hashes' in cause && Array.isArray(cause.hashes))
        hashes = cause.hashes as Hex[]
    }
    insert.run(
      at,
      sourceMid,
      testnetMid,
      action.kind,
      action.notional,
      hashes.join(',') || null,
      error,
    )
    if (at - prunedAt > 3_600_000) {
      db.query('DELETE FROM mirror_ticks WHERE at < ?').run(at - 7 * 86_400_000)
      prunedAt = at
    }
    Object.assign(state, {
      lastAt: at,
      lastAction: action.kind,
      lastError: error,
    })
    state.attempted++
    logger('mirror.tick', {
      action: action.kind,
      reason: action.reason,
      notional: action.notional,
      txs: hashes,
      error,
    })
  }
}

export function mirrorSection(
  state: MirrorState,
  execution: { enabled: boolean; reason: string | null },
  now: () => number,
): () => HealthSection {
  return () => ({
    value: {
      execution: execution.enabled ? 'enabled' : 'disabled',
      reason: execution.reason,
      ticks: state.attempted,
      lastTickAgeMs: state.lastAt === null ? null : now() - state.lastAt,
      lastAction: state.lastAction,
      lastError: state.lastError,
    },
    amber: !execution.enabled
      ? `mirror-disabled:${execution.reason ?? 'unknown'}`
      : state.lastError !== null
        ? 'mirror-error'
        : undefined,
  })
}
