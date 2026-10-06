import type { Database } from 'bun:sqlite'
import type { Address } from 'viem'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'
import type { TradeFetcher } from './trade-fetchers'

export type CachedTrade = {
  market: string
  block: number
  at: number
  maker: string
  price: number
  size: number
  tx_hash: string
}
export type TradeCoverage = {
  source: string
  complete: boolean
  fromBlock: number | null
  throughBlock: number | null
  targetBlock: number | null
  syncedAt: number | null
  updatedAt: number | null
}
export type TradeSource = {
  refresh: () => Promise<void>
  coverage: () => TradeCoverage
  trades: (market: Address) => CachedTrade[]
}
export type ChainReader = {
  getBlockNumber: () => Promise<bigint>
  getBlock: (request: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>
}
type Window = {
  oldest_block: number
  latest_block: number
  target_block: number
  synced_at: number | null
  updated_at: number
}

const DAY_MS = 86_400_000
// Covered means: the 24h window is filled AND the head was reached recently.
const SYNC_FRESH_MS = 5 * 60_000

// Seven markets, one getLogs call: a single shared window [oldest, latest] over
// the last 24h is enough. The first run backfills from the head toward the 24h
// boundary in bounded chunks; later runs only scan blocks after `latest`. A group
// of chunks commits atomically or not at all, so coverage never overstates.
export function createTradeSource({
  db,
  client,
  fetcher,
  chunkBlocks = 100n,
  concurrency = 4,
  groupsPerRun = 8,
  now = Date.now,
  logger = log,
}: {
  db: Database
  client: ChainReader
  fetcher: TradeFetcher
  chunkBlocks?: bigint
  concurrency?: number
  groupsPerRun?: number
  now?: () => number
  logger?: Logger
}): TradeSource {
  const window = () =>
    db.query<Window, []>('SELECT * FROM tracker_window WHERE id = 1').get()
  let busy = false

  // ~30 reads against a flaky public RPC: retry each read so one blip does not restart the search.
  async function stamp(blockNumber: bigint): Promise<bigint> {
    for (let attempt = 0; ; attempt++) {
      try {
        return (await client.getBlock({ blockNumber })).timestamp
      } catch (error) {
        if (attempt >= 2) throw error
      }
    }
  }

  async function blockAt(timestampMs: number, head: bigint): Promise<bigint> {
    const cutoff = BigInt(Math.floor(timestampMs / 1000))
    let low = 0n
    let high = head
    while (low < high) {
      const middle = (low + high) / 2n
      if ((await stamp(middle)) < cutoff) low = middle + 1n
      else high = middle
    }
    return low
  }

  async function ensureWindow(head: bigint): Promise<Window> {
    const existing = window()
    if (existing && now() - existing.updated_at <= DAY_MS) return existing
    const target = await blockAt(now() - DAY_MS, head)
    db.transaction(() => {
      db.query('DELETE FROM tracker_trades').run()
      db.query(
        'INSERT OR REPLACE INTO tracker_window (id, oldest_block, latest_block, target_block, synced_at, updated_at) VALUES (1, ?, ?, ?, NULL, ?)',
      ).run(Number(head) + 1, Number(head), Number(target), now())
    })()
    return window()!
  }

  function chunks(
    from: bigint,
    to: bigint,
    direction: 'forward' | 'backward',
  ): [bigint, bigint][] {
    const ranges: [bigint, bigint][] = []
    if (direction === 'forward')
      for (
        let start = from;
        start <= to && ranges.length < concurrency;
        start += chunkBlocks
      )
        ranges.push([
          start,
          start + chunkBlocks - 1n < to ? start + chunkBlocks - 1n : to,
        ])
    else
      for (
        let end = to;
        end >= from && ranges.length < concurrency;
        end -= chunkBlocks
      )
        ranges.push([
          end - chunkBlocks + 1n > from ? end - chunkBlocks + 1n : from,
          end,
        ])
    return ranges
  }

  async function refresh() {
    if (busy) return
    busy = true
    try {
      const head = await client.getBlockNumber()
      let current = await ensureWindow(head)
      for (let group = 0; group < groupsPerRun; group++) {
        const forward = current.latest_block < Number(head)
        if (!forward && current.oldest_block <= current.target_block) break
        const ranges = forward
          ? chunks(BigInt(current.latest_block) + 1n, head, 'forward')
          : chunks(
              BigInt(current.target_block),
              BigInt(current.oldest_block) - 1n,
              'backward',
            )
        const fetched = await Promise.all(
          ranges.map(([from, to]) => fetcher.fetch(from, to)),
        )
        db.transaction(() => {
          const insert = db.query(
            'INSERT OR IGNORE INTO tracker_trades (market, block, log_index, at, maker, price, size, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          for (const row of fetched.flat())
            insert.run(
              row.market,
              row.block,
              row.logIndex,
              row.at,
              row.maker,
              row.price,
              row.size,
              row.tx,
            )
          if (forward)
            db.query(
              'UPDATE tracker_window SET latest_block = ?, updated_at = ? WHERE id = 1',
            ).run(Number(ranges.at(-1)![1]), now())
          else
            db.query(
              'UPDATE tracker_window SET oldest_block = ?, updated_at = ? WHERE id = 1',
            ).run(Number(ranges.at(-1)![0]), now())
        })()
        current = window()!
      }
      if (
        current.latest_block >= Number(head) &&
        current.oldest_block <= current.target_block
      )
        db.query('UPDATE tracker_window SET synced_at = ? WHERE id = 1').run(
          now(),
        )
      db.query('DELETE FROM tracker_trades WHERE at < ?').run(now() - DAY_MS)
      logger('tracker.trade-coverage', { ...coverage(), head: Number(head) })
    } catch (error) {
      logger('tracker.trade-source-failed', {
        error: describeError(error),
        ...coverage(),
      })
    } finally {
      busy = false
    }
  }

  function coverage(): TradeCoverage {
    const row = window()
    return {
      source: fetcher.name,
      complete:
        !!row &&
        row.oldest_block <= row.target_block &&
        row.synced_at !== null &&
        now() - row.synced_at <= SYNC_FRESH_MS,
      fromBlock: row?.oldest_block ?? null,
      throughBlock: row?.latest_block ?? null,
      targetBlock: row?.target_block ?? null,
      syncedAt: row?.synced_at ?? null,
      updatedAt: row?.updated_at ?? null,
    }
  }

  return {
    refresh,
    coverage,
    trades: (market) =>
      db
        .query<CachedTrade, [string, number]>(
          'SELECT market, block, at, maker, price, size, tx_hash FROM tracker_trades WHERE market = ? AND at >= ? ORDER BY block, log_index',
        )
        .all(market, now() - DAY_MS),
  }
}
