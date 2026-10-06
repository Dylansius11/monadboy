import { expect, test } from 'bun:test'
import { createTradeSource } from '../src/chain/trade-source'
import type { TradeFetcher, TradeRow } from '../src/chain/trade-fetchers'
import { address, memoryDb, quiet, tx } from './helpers'

// Block n is stamped n*10 s. With now = 100000 s the 24h boundary (13600 s) is block 1360.
const NOW = 100_000_000
const reader = (head: () => bigint) => ({
  getBlockNumber: async () => head(),
  getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({
    timestamp: blockNumber * 10n,
  }),
})
const row = (block: number, logIndex = 0): TradeRow => ({
  market: address('1'),
  block,
  logIndex,
  at: block * 10_000,
  maker: address('a'),
  price: 1,
  size: 1,
  tx: tx('f'),
})

function setup({
  fail = () => false,
  now = () => NOW,
}: { fail?: (from: bigint) => boolean; now?: () => number } = {}) {
  const db = memoryDb()
  let head = 1500n
  const ranges: [bigint, bigint][] = []
  const fetcher: TradeFetcher = {
    name: 'test',
    fetch: async (from, to) => {
      if (fail(from)) throw new Error('rpc down')
      ranges.push([from, to])
      return [row(Number(to))]
    },
  }
  const source = createTradeSource({
    db,
    client: reader(() => head),
    fetcher,
    chunkBlocks: 50n,
    concurrency: 2,
    groupsPerRun: 1,
    now,
    logger: quiet,
  })
  return {
    db,
    source,
    ranges,
    setHead: (value: bigint) => {
      head = value
    },
  }
}

test('first run backfills from the head toward the 24h boundary, then only scans new blocks', async () => {
  const { source, ranges, setHead } = setup()
  await source.refresh()
  expect(ranges).toEqual([
    [1451n, 1500n],
    [1401n, 1450n],
  ])
  expect(source.coverage()).toMatchObject({
    complete: false,
    fromBlock: 1401,
    throughBlock: 1500,
    targetBlock: 1360,
  })
  await source.refresh()
  expect(ranges.at(-1)).toEqual([1360n, 1400n])
  expect(source.coverage()).toMatchObject({ complete: true, fromBlock: 1360 })
  setHead(1510n)
  await source.refresh()
  expect(ranges.at(-1)).toEqual([1501n, 1510n])
  expect(source.coverage()).toMatchObject({
    complete: true,
    throughBlock: 1510,
  })
})

test('a failed chunk commits nothing from its group, so coverage never advances past missing data', async () => {
  let down = true
  const { source, db } = setup({ fail: (from) => down && from === 1401n })
  await source.refresh()
  expect(source.coverage()).toMatchObject({
    complete: false,
    fromBlock: 1501,
    throughBlock: 1500,
  })
  expect(db.query('SELECT COUNT(*) AS n FROM tracker_trades').get()).toEqual({
    n: 0,
  })
  down = false
  await source.refresh()
  expect(source.coverage().fromBlock).toBe(1401)
})

test('coverage lapses when the head has not been reached recently, even with the window filled', async () => {
  let now = NOW
  const { source } = setup({ now: () => now })
  await source.refresh()
  await source.refresh()
  expect(source.coverage().complete).toBe(true)
  now += 6 * 60_000
  expect(source.coverage().complete).toBe(false)
})

test('trades come back ordered, only from the last 24h, and re-scanning a block never duplicates a row', async () => {
  let now = NOW
  const { source, db } = setup({ now: () => now })
  await source.refresh()
  await source.refresh()
  const market = address('1')
  expect(source.trades(market).map((trade) => trade.block)).toEqual([
    1400, 1450, 1500,
  ])
  db.query(
    'INSERT OR IGNORE INTO tracker_trades (market, block, log_index, at, maker, price, size, tx_hash) VALUES (?, 1450, 0, 14500000, ?, 9, 9, ?)',
  ).run(market, address('a'), tx('f'))
  expect(source.trades(market)).toHaveLength(3)
  // 600 s later the oldest trade (block 1400) has aged out of the 24h window
  now += 600_000
  expect(source.trades(market).map((trade) => trade.block)).toEqual([
    1450, 1500,
  ])
})

test('after a day without progress the window is re-seeded and the old trades are dropped', async () => {
  let now = NOW
  const { source, db, setHead, ranges } = setup({ now: () => now })
  await source.refresh()
  await source.refresh()
  expect(db.query('SELECT COUNT(*) AS n FROM tracker_trades').get()).toEqual({
    n: 3,
  })
  now += 86_400_000 + 1000
  setHead(40_000n)
  await source.refresh()
  expect(ranges.some(([, to]) => to === 40_000n)).toBe(true)
  expect(source.coverage().fromBlock).toBeGreaterThan(1500)
  expect(
    (
      db.query('SELECT MIN(block) AS b FROM tracker_trades').get() as {
        b: number
      }
    ).b,
  ).toBeGreaterThan(1500)
})

test('seeding survives a flaky block read, but gives up (and records no window) when reads keep failing', async () => {
  let failures = 2
  const flaky = {
    getBlockNumber: async () => 1500n,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
      if (failures-- > 0) throw new Error('timeout')
      return { timestamp: blockNumber * 10n }
    },
  }
  const db = memoryDb()
  const fetcher: TradeFetcher = { name: 'test', fetch: async () => [] }
  await createTradeSource({
    db,
    client: flaky,
    fetcher,
    chunkBlocks: 50n,
    concurrency: 2,
    groupsPerRun: 1,
    now: () => NOW,
    logger: quiet,
  }).refresh()
  expect(db.query('SELECT target_block FROM tracker_window').get()).toEqual({
    target_block: 1360,
  })
  const dead = memoryDb()
  await createTradeSource({
    db: dead,
    client: {
      ...flaky,
      getBlock: async () => {
        throw new Error('down')
      },
    },
    fetcher,
    now: () => NOW,
    logger: quiet,
  }).refresh()
  expect(dead.query('SELECT COUNT(*) AS n FROM tracker_window').get()).toEqual({
    n: 0,
  })
})
