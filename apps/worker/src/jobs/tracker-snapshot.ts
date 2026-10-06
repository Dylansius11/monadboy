import type { Database } from 'bun:sqlite'
import type { Address, Hex } from 'viem'
import { bestBidAsk1e18, mainnetMarkets } from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'
import { decodeL2Book, depthWithinBand } from '../chain/l2-book'
import type { CachedTrade, TradeCoverage } from '../chain/trade-source'
import { checkTransfers } from '../chain/transfer-check'
import type { TransferCheck, TransferProbe } from '../chain/transfer-check'
import type { Birth } from '../chain/market-births'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'
import type { HealthSection } from '../app'

// Structurally the SDK's ScoreInput: index.ts passes `scorePool` as the scorer.
export type PoolInputs = {
  pairAddress: Address
  tokenX: { address: Address; symbol: string; decimals: number }
  tokenY: { address: Address; symbol: string; decimals: number }
  tvlUsd: number
  volume24hUsd: number | null
  createdAt: number
  createdAtIsExact: boolean
  lpConcentration: number | null
  realizedVol24h: number | null
}
export type ScorerInput = {
  pool: PoolInputs
  momentum?: { score: number }
  momentumAgeSeconds: number
  honeypotClean: boolean
  nowSeconds: number
}
export type TrackerScorer = (input: ScorerInput) => unknown
export type BookReader = (
  market: Market,
) => Promise<{ raw: Hex; best: readonly [bigint, bigint] }>
export type TrackerSource = {
  coverage: () => TradeCoverage
  trades: (market: Address) => CachedTrade[]
}

// The public mainnet RPC drops requests intermittently; one retry keeps a single blip from
// marking a market stale or failing its sellability gate closed.
async function retried<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch {
    return read()
  }
}

const YEAR_SECONDS = 365 * 86_400
const STRONG_BAND = 0.02
export const TRACKER_STALE_MS = 45 * 60_000

// [I] Realized volatility: sqrt of summed squared log returns between consecutive trades,
// scaled from the observed span to a year. Bid/ask bounce inflates it slightly on thin books.
export function realizedVolatility(
  trades: readonly CachedTrade[],
): number | null {
  let squares = 0
  let returns = 0
  for (let i = 1; i < trades.length; i++) {
    const [a, b] = [trades[i - 1].price, trades[i].price]
    if (a > 0 && b > 0) {
      squares += Math.log(b / a) ** 2
      returns++
    }
  }
  const span = trades.length > 1 ? (trades.at(-1)!.at - trades[0].at) / 1000 : 0
  return returns > 1 && span > 0
    ? Math.sqrt((squares / span) * YEAR_SECONDS)
    : null
}

// Share of 24h quote volume made by the three largest makers (SPEC 6).
export function makerConcentration(
  trades: readonly CachedTrade[],
): number | null {
  const byMaker = new Map<string, number>()
  let total = 0
  for (const trade of trades) {
    byMaker.set(
      trade.maker,
      (byMaker.get(trade.maker) ?? 0) + trade.price * trade.size,
    )
    total += trade.price * trade.size
  }
  if (total <= 0) return null
  // Grouped and sequential sums can round differently; shares cannot exceed the whole.
  return Math.min(
    1,
    [...byMaker.values()]
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((sum, value) => sum + value, 0) / total,
  )
}

// [I] Trade-count acceleration: last 12h versus the 12h before, mapped to 0..100 (50 = unchanged).
export function tradeMomentum(
  trades: readonly CachedTrade[],
  now: number,
): number {
  const recent = trades.filter(
    (trade) => trade.at >= now - 12 * 3_600_000,
  ).length
  const earlier = trades.length - recent
  return recent + earlier === 0
    ? 50
    : Math.min(
        100,
        Math.max(0, 50 + (50 * (recent - earlier)) / (recent + earlier)),
      )
}

// A mainnet market is PLAYABLE (TESTNET) when a testnet market mirrors it: the same pair, or
// the testnet MON market that mirrors the mainnet MON_USDC price source.
export function isPlayable(
  market: Market,
  testnetMarkets: readonly Market[],
  sourceSymbol: string,
): boolean {
  return testnetMarkets.some(
    (mirror) =>
      mirror.symbol === market.symbol ||
      (market.symbol === sourceSymbol && mirror.baseSymbol === 'MON'),
  )
}

export function createTrackerSnapshot({
  db,
  readBook,
  probe,
  trades,
  births,
  scorer,
  testnetMarkets,
  sourceSymbol,
  now = Date.now,
  logger = log,
}: {
  db: Database
  readBook: BookReader
  probe: TransferProbe
  trades: TrackerSource
  births: () => Map<string, Birth>
  scorer: TrackerScorer
  testnetMarkets: readonly Market[]
  sourceSymbol: string
  now?: () => number
  logger?: Logger
}) {
  return async () => {
    const takenAt = now()
    const coverage = trades.coverage()
    const known = births()
    const gates = new Map<string, Promise<TransferCheck>>()
    const gateFor = (market: Market) => {
      const tokens = [market.baseToken, market.quoteToken]
      const key = tokens.join()
      if (!gates.has(key))
        gates.set(
          key,
          checkTransfers((token) => retried(() => probe(token)), tokens),
        )
      return gates.get(key)!
    }
    const rows: { market: string; json: string }[] = []
    for (const market of mainnetMarkets) {
      try {
        const { raw, best } = await retried(() => readBook(market))
        const { bid, ask } = bestBidAsk1e18(best)
        const mid =
          bid === null || ask === null || bid <= 0 || ask < bid
            ? null
            : (bid + ask) / 2
        const book = decodeL2Book(raw, market.params)
        const depth = depthWithinBand(book, mid, STRONG_BAND)
        const fills = trades.trades(market.address)
        const gate = await gateFor(market)
        const birth = known.get(market.symbol)
        const firstSeen = fills[0]?.at ?? takenAt
        const complete = coverage.complete
        const volume = fills.reduce(
          (sum, fill) => sum + fill.price * fill.size,
          0,
        )
        const pool: PoolInputs = {
          pairAddress: market.address,
          tokenX: {
            address: market.baseToken,
            symbol: market.baseSymbol,
            decimals: market.params.baseDecimals,
          },
          tokenY: {
            address: market.quoteToken,
            symbol: market.quoteSymbol,
            decimals: market.params.quoteDecimals,
          },
          tvlUsd: depth,
          volume24hUsd: complete ? volume : null,
          // Without a resolved deployment block the oldest proof of life is the first trade seen.
          createdAt: Math.floor((birth?.at ?? firstSeen) / 1000),
          createdAtIsExact: birth?.exact ?? false,
          lpConcentration: complete ? makerConcentration(fills) : null,
          realizedVol24h: complete ? realizedVolatility(fills) : null,
        }
        const input: ScorerInput = {
          pool,
          momentum: complete
            ? { score: tradeMomentum(fills, takenAt) }
            : undefined,
          momentumAgeSeconds: 0,
          honeypotClean: gate.clean,
          nowSeconds: Math.floor(takenAt / 1000),
        }
        rows.push({
          market: market.symbol,
          json: JSON.stringify({
            market: market.symbol,
            source: 'kuru-mainnet',
            status: 'live',
            takenAt,
            block: book.block.toString(),
            mid,
            bookState: depth > 0 ? 'available' : 'thin',
            depthScope:
              'getL2Book resting orders within 2% of mid, quote units',
            playable:
              gate.clean &&
              depth > 0 &&
              isPlayable(market, testnetMarkets, sourceSymbol),
            gate,
            coverage: {
              ...coverage,
              ageMs:
                coverage.syncedAt === null ? null : takenAt - coverage.syncedAt,
            },
            ageBasis: birth
              ? birth.exact
                ? 'deployment-block'
                : 'oldest-served-state'
              : 'first-observed-trade',
            trades24h: complete ? fills.length : null,
            inputs: pool,
            momentum: input.momentum ?? null,
            score: scorer(input),
          }),
        })
      } catch (error) {
        logger('tracker.market-failed', {
          market: market.symbol,
          error: describeError(error),
        })
        const prior = db
          .query<{ json: string }, [string]>(
            'SELECT json FROM market_snapshots WHERE market = ? ORDER BY taken_at DESC LIMIT 1',
          )
          .get(market.symbol)
        rows.push({
          market: market.symbol,
          json: JSON.stringify(
            prior
              ? { ...JSON.parse(prior.json), status: 'stale' }
              : {
                  market: market.symbol,
                  source: 'kuru-mainnet',
                  status: 'unavailable',
                  takenAt: null,
                  playable: false,
                  score: null,
                  inputs: null,
                },
          ),
        })
      }
    }
    db.transaction(() => {
      for (const row of rows)
        db.query(
          'INSERT OR REPLACE INTO market_snapshots (taken_at, market, json) VALUES (?, ?, ?)',
        ).run(takenAt, row.market, row.json)
      db.query('DELETE FROM market_snapshots WHERE taken_at < ?').run(
        takenAt - 7 * 86_400_000,
      )
    })()
    logger('tracker.snapshot', {
      takenAt,
      markets: rows.length,
      coverageComplete: coverage.complete,
      source: coverage.source,
    })
  }
}

// Amber when no snapshot exists or the newest is older than three 15-minute periods.
export function trackerSection(
  db: Database,
  trades: Pick<TrackerSource, 'coverage'>,
  now: () => number,
): () => HealthSection {
  return () => {
    const row = db
      .query<{ at: number | null }, []>(
        'SELECT MAX(taken_at) AS at FROM market_snapshots',
      )
      .get()
    const at = row?.at ?? null
    const ageMs = at === null ? null : now() - at
    return {
      value: { takenAt: at, ageMs, trades: trades.coverage() },
      amber:
        ageMs === null
          ? 'tracker-no-snapshot'
          : ageMs > TRACKER_STALE_MS
            ? 'tracker-stale'
            : undefined,
    }
  }
}
