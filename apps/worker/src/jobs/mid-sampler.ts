import type { Database } from 'bun:sqlite'
import type { Address } from 'viem'
import { bestBidAsk1e18, kuruOrderbookAbi, mainnetMarkets } from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'
import type { HealthSection } from '../app'

export const SOURCE_MARKET = 'MON_USDC'
export const SOURCE_NAME = `kuru-mainnet:${SOURCE_MARKET}`
// Fresh: within three 5 s sample intervals. Stale: no usable price at all; the
// mirror and health treat the feed as paused even before three failures count.
export const SOURCE_FRESH_MS = 15_000
export const SOURCE_STALE_MS = 30_000
export const PAUSE_AFTER_FAILURES = 3
// [I] User-approved wide-book pause policy. 2% is an operator limit, not a market measurement.
export const MAX_SOURCE_SPREAD = 0.02
const RETENTION_MS = 14 * 86_400_000

export type TestnetMidState = {
  status: 'no-market-configured' | 'unavailable' | 'live' | 'empty'
  mid: number | null
  at: number | null
  market: string | null
}
export type MidState = {
  attempted: number
  succeeded: number
  consecutiveFailures: number
  status: 'running' | 'paused'
  targetMid: number | null
  at: number | null
  lastAttemptAt: number | null
  testnet: TestnetMidState
}

// Starts paused: until a real mainnet observation exists there is no price.
export function createMidState(): MidState {
  return {
    attempted: 0,
    succeeded: 0,
    consecutiveFailures: 0,
    status: 'paused',
    targetMid: null,
    at: null,
    lastAttemptAt: null,
    testnet: {
      status: 'no-market-configured',
      mid: null,
      at: null,
      market: null,
    },
  }
}

export type BookClient = {
  readContract: (request: {
    address: Address
    abi: typeof kuruOrderbookAbi
    functionName: 'bestBidAsk'
  }) => Promise<readonly [bigint, bigint]>
}

async function readMid(
  client: BookClient,
  address: Address,
  maxSpread = Number.POSITIVE_INFINITY,
): Promise<number | null> {
  const { bid, ask } = bestBidAsk1e18(
    await client.readContract({
      address,
      abi: kuruOrderbookAbi,
      functionName: 'bestBidAsk',
    }),
  )
  if (bid === null || ask === null || bid <= 0 || ask < bid) return null
  const mid = (bid + ask) / 2
  return (ask - bid) / mid > maxSpread ? null : mid
}

export function sourceAgeMs(state: MidState, now: number): number | null {
  return state.at === null ? null : now - state.at
}

export function createMidSampler({
  db,
  state,
  mainnet,
  testnet,
  testnetMarkets,
  now = Date.now,
  logger = log,
}: {
  db: Database
  state: MidState
  mainnet: BookClient
  testnet?: BookClient
  testnetMarkets: readonly Market[]
  now?: () => number
  logger?: Logger
}) {
  const source = mainnetMarkets.find(
    (market) => market.symbol === SOURCE_MARKET,
  )
  if (!source) throw new Error('Mainnet source market is not configured')
  const market = testnetMarkets.find((entry) => entry.baseSymbol === 'MON')
  if (market)
    state.testnet = {
      status: 'unavailable',
      mid: null,
      at: null,
      market: market.symbol,
    }
  const insert = db.query(
    'INSERT OR REPLACE INTO mid_samples (at, market, mid) VALUES (?, ?, ?)',
  )
  let prunedAt = 0

  return async () => {
    state.attempted++
    state.lastAttemptAt = now()
    try {
      const mid = await readMid(mainnet, source.address, MAX_SOURCE_SPREAD)
      // Invalid or too-wide quotes invalidate the source immediately; RPC failures retain the three-read rule.
      if (mid === null) {
        state.status = 'paused'
        throw new Error('Empty, crossed or too-wide source book')
      }
      const at = now()
      insert.run(at, `mainnet:${SOURCE_MARKET}`, mid)
      Object.assign(state, {
        targetMid: mid,
        at,
        consecutiveFailures: 0,
        status: 'running',
      })
      state.succeeded++
      logger('mid.sampled', {
        market: `mainnet:${SOURCE_MARKET}`,
        mid,
        sampledAt: at,
      })
    } catch (cause) {
      state.consecutiveFailures++
      if (state.consecutiveFailures >= PAUSE_AFTER_FAILURES)
        state.status = 'paused'
      logger('mid.source-failed', {
        failures: state.consecutiveFailures,
        state: state.status,
        error: describeError(cause),
      })
    }
    if (market && testnet) {
      try {
        const mid = await readMid(testnet, market.address)
        state.testnet = {
          status: mid === null ? 'empty' : 'live',
          mid,
          at: now(),
          market: market.symbol,
        }
        if (mid !== null)
          insert.run(state.testnet.at, `testnet:${market.symbol}`, mid)
      } catch (cause) {
        state.testnet = { ...state.testnet, status: 'unavailable', mid: null }
        logger('mid.testnet-failed', { market: market.symbol, error: describeError(cause) })
      }
    }
    if (now() - prunedAt > 3_600_000) {
      db.query('DELETE FROM mid_samples WHERE at < ?').run(now() - RETENTION_MS)
      prunedAt = now()
    }
  }
}

// Paused by three consecutive failures, or by silence: a sampler stuck on a
// hung RPC stops advancing `at`, and a stale price must never drive the mirror.
export function isSourcePaused(state: MidState, now: number): boolean {
  const age = sourceAgeMs(state, now)
  return state.status === 'paused' || age === null || age > SOURCE_STALE_MS
}

export function sourceSection(
  state: MidState,
  now: () => number,
): () => HealthSection {
  return () => {
    const paused = isSourcePaused(state, now())
    return {
      value: {
        name: SOURCE_NAME,
        state: paused ? 'paused' : 'running',
        mid: state.targetMid,
        ageMs: sourceAgeMs(state, now()),
        samples: {
          attempted: state.attempted,
          succeeded: state.succeeded,
          consecutiveFailures: state.consecutiveFailures,
          lastAttemptAgeMs:
            state.lastAttemptAt === null ? null : now() - state.lastAttemptAt,
        },
      },
      red: paused ? 'price-feed-paused' : undefined,
    }
  }
}

// A stalled sampler cannot keep reporting a live or empty book indefinitely.
export function testnetObservation(state: MidState, at: number): TestnetMidState {
  const book = state.testnet
  if (
    (book.status === 'live' || book.status === 'empty') &&
    (book.at === null || at - book.at > SOURCE_STALE_MS)
  )
    return { ...book, status: 'unavailable', mid: null }
  return book
}

export function testnetSection(
  state: MidState,
  now: () => number,
): () => HealthSection {
  return () => {
    const at = now()
    const book = testnetObservation(state, at)
    return {
      value: {
        ...book,
        ageMs: book.at === null ? null : at - book.at,
      },
    }
  }
}
