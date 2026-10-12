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
// A wide top of book does not say where the price is, but the last trade does. It is used
// only while the book is not broken (up to 10% wide), only when the trade is recent, and
// it is clamped inside the quoted bid and ask. Measured 2026-10-12: MON_USDC traded in
// 6,762 transactions in 24 hours (median gap 1 s, p99 175 s) while its book sat 3.5% wide.
export const MAX_FALLBACK_SPREAD = 0.1
export const TRADE_REFERENCE_MS = 600_000

export type SourceBasis = 'book-mid' | 'last-trade'
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
  basis: SourceBasis | null
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
    basis: null,
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

async function readBook(client: BookClient, address: Address) {
  return bestBidAsk1e18(
    await client.readContract({
      address,
      abi: kuruOrderbookAbi,
      functionName: 'bestBidAsk',
    }),
  )
}

async function readMid(client: BookClient, address: Address): Promise<number | null> {
  const { bid, ask } = await readBook(client, address)
  if (bid === null || ask === null || bid <= 0 || ask < bid) return null
  return (bid + ask) / 2
}

async function readSource(
  client: BookClient,
  address: Address,
  lastTrade: () => number | null,
): Promise<{ price: number; basis: SourceBasis } | null> {
  const { bid, ask } = await readBook(client, address)
  if (bid === null || ask === null || bid <= 0 || ask < bid) return null
  const mid = (bid + ask) / 2
  const spread = (ask - bid) / mid
  if (spread <= MAX_SOURCE_SPREAD) return { price: mid, basis: 'book-mid' }
  if (spread > MAX_FALLBACK_SPREAD) return null
  const trade = lastTrade()
  if (trade === null) return null
  return { price: Math.min(Math.max(trade, bid), ask), basis: 'last-trade' }
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
  const lastTradeRow = db.query(
    'SELECT price FROM tracker_trades WHERE market = ?1 AND at >= ?2 ORDER BY at DESC, block DESC, log_index DESC LIMIT 1',
  )
  const sourceAddress = source.address.toLowerCase()
  const lastTrade = () =>
    (lastTradeRow.get(sourceAddress, now() - TRADE_REFERENCE_MS) as { price: number } | null)
      ?.price ?? null
  let prunedAt = 0

  return async () => {
    state.attempted++
    state.lastAttemptAt = now()
    try {
      const reading = await readSource(mainnet, source.address, lastTrade)
      // Empty, crossed or broken quotes invalidate the source immediately; RPC failures retain the three-read rule.
      if (reading === null) {
        state.status = 'paused'
        throw new Error('Empty, crossed or too-wide source book')
      }
      const { price: mid, basis } = reading
      const at = now()
      insert.run(at, `mainnet:${SOURCE_MARKET}`, mid)
      Object.assign(state, {
        targetMid: mid,
        at,
        basis,
        consecutiveFailures: 0,
        status: 'running',
      })
      state.succeeded++
      logger('mid.sampled', {
        market: `mainnet:${SOURCE_MARKET}`,
        mid,
        basis,
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
        basis: state.basis,
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
