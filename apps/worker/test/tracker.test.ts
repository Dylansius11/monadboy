import { expect, test } from 'bun:test'
import { maxUint256 } from 'viem'
import type { Hex } from 'viem'
import { mainnetMarkets } from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'
import { createApp } from '../src/app'
import type { CachedTrade } from '../src/chain/trade-source'
import {
  createTrackerSnapshot,
  isPlayable,
  makerConcentration,
  realizedVolatility,
  tradeMomentum,
} from '../src/jobs/tracker-snapshot'
import type { ScorerInput } from '../src/jobs/tracker-snapshot'
import { trackerRoute } from '../src/routes/tracker'
import fixture from './fixtures/mon-usdc-l2.json'
import emptyFixture from './fixtures/mon-ausd-l2-empty.json'
import { address, memoryDb, quiet } from './helpers'

const NOW = 200_000_000
const HOUR = 3_600_000
const trade = (
  at: number,
  price: number,
  maker = 'm1',
  size = 1,
): CachedTrade => ({
  market: address('1'),
  block: at,
  at,
  maker,
  price,
  size,
  tx_hash: '0x',
})
const emptyBook = {
  raw: emptyFixture.raw as Hex,
  best: [maxUint256, 0n] as const,
}
const monUsdcBook = {
  raw: fixture.raw as Hex,
  best: [32_444_000_000_000_000n, 32_485_000_000_000_000n] as const,
}
const testnetMon: Market = {
  ...mainnetMarkets.find((m) => m.symbol === 'MON_USDC')!,
  chain: 'testnet',
  symbol: 'MON_AUSD',
  quoteSymbol: 'AUSD',
}
const completeCoverage = {
  source: 'test',
  complete: true,
  fromBlock: 1,
  throughBlock: 2,
  targetBlock: 1,
  syncedAt: NOW,
  updatedAt: NOW,
}

test('realized volatility annualises consecutive log returns over the observed span', () => {
  const prices = [1, 1.01, 1, 1.01, 1]
  const trades = prices.map((price, i) => trade(i * 60_000, price))
  const expected = Math.sqrt(((4 * Math.log(1.01) ** 2) / 240) * 365 * 86_400)
  expect(realizedVolatility(trades)).toBeCloseTo(expected, 6)
  expect(realizedVolatility([trade(0, 1), trade(1000, 2)])).toBeNull()
  expect(realizedVolatility([trade(0, 1), trade(0, 1), trade(0, 1)])).toBeNull()
})

test('maker concentration is the top-three volume share and unknown when nothing traded', () => {
  const trades = [
    trade(1, 1, 'a', 4),
    trade(2, 1, 'b', 3),
    trade(3, 1, 'c', 2),
    trade(4, 1, 'd', 1),
  ]
  expect(makerConcentration(trades)).toBeCloseTo(0.9, 12)
  expect(makerConcentration([trade(1, 1, 'a', 5), trade(2, 1, 'a', 5)])).toBe(1)
  expect(makerConcentration([])).toBeNull()
})

test('concentration stays bounded when decimal fills accumulate differently by maker', () => {
  const fills = Array.from({ length: 10 }, (_, index) => trade(index, 0.1))
  expect(makerConcentration(fills)).toBe(1)
  const mixed = fills.map((fill, index) => ({
    ...fill,
    maker: index % 2 === 0 ? 'a' : 'b',
  }))
  // Grouping 0.1 fills gives 0.5 + 0.5, while the sequential total is just below 1.
  // Two makers own all volume, so the public ratio must be exactly 1, never >1.
  expect(makerConcentration(mixed)).toBe(1)
})

test('momentum compares the last 12 hours with the 12 before: 50 is unchanged, 100 is all recent, 0 is all earlier', () => {
  expect(tradeMomentum([], NOW)).toBe(50)
  expect(
    tradeMomentum([trade(NOW - HOUR, 1), trade(NOW - 13 * HOUR, 1)], NOW),
  ).toBe(50)
  expect(
    tradeMomentum([trade(NOW - HOUR, 1), trade(NOW - 2 * HOUR, 1)], NOW),
  ).toBe(100)
  expect(tradeMomentum([trade(NOW - 20 * HOUR, 1)], NOW)).toBe(0)
  expect(
    tradeMomentum(
      [
        trade(NOW - HOUR, 1),
        trade(NOW - 2 * HOUR, 1),
        trade(NOW - 3 * HOUR, 1),
        trade(NOW - 20 * HOUR, 1),
      ],
      NOW,
    ),
  ).toBe(75)
})

test('playable needs a testnet mirror: the same pair, or the MON market that mirrors MON_USDC', () => {
  const by = (symbol: string) =>
    mainnetMarkets.find((m) => m.symbol === symbol)!
  expect(isPlayable(by('MON_USDC'), [], 'MON_USDC')).toBe(false)
  expect(isPlayable(by('MON_USDC'), [testnetMon], 'MON_USDC')).toBe(true)
  expect(isPlayable(by('MON_AUSD'), [testnetMon], 'MON_USDC')).toBe(true)
  expect(isPlayable(by('WETH_USDC'), [testnetMon], 'MON_USDC')).toBe(false)
})

function snapshotJob(
  overrides: Partial<Parameters<typeof createTrackerSnapshot>[0]> & {
    fills?: CachedTrade[]
    coverage?: typeof completeCoverage
  } = {},
) {
  const db = memoryDb()
  const scored: ScorerInput[] = []
  const job = createTrackerSnapshot({
    db,
    readBook: async (market) =>
      market.symbol === 'MON_USDC' ? monUsdcBook : emptyBook,
    probe: async () => 'ok',
    trades: {
      coverage: () =>
        overrides.coverage ?? {
          ...completeCoverage,
          complete: false,
          syncedAt: null,
        },
      trades: (market) =>
        market === mainnetMarkets.find((m) => m.symbol === 'MON_USDC')!.address
          ? (overrides.fills ?? [])
          : [],
    },
    births: () => new Map(),
    scorer: (input) => {
      scored.push(input)
      return { honeypotClean: input.honeypotClean }
    },
    testnetMarkets: [],
    sourceSymbol: 'MON_USDC',
    now: () => NOW,
    logger: quiet,
    ...overrides,
  })
  const read = (symbol: string) =>
    JSON.parse(
      db
        .query<{ json: string }, [string]>(
          'SELECT json FROM market_snapshots WHERE market = ? ORDER BY taken_at DESC',
        )
        .get(symbol)!.json,
    ) as Record<string, any>
  return { db, job, scored, read }
}

test('snapshots all seven mainnet markets; the empty MON_AUSD book is thin and scores without throwing', async () => {
  const { db, job, read, scored } = snapshotJob()
  await job()
  expect(
    db
      .query('SELECT market FROM market_snapshots ORDER BY market')
      .all()
      .map((row) => (row as { market: string }).market),
  ).toEqual(mainnetMarkets.map((m) => m.symbol).sort())
  const thin = read('MON_AUSD')
  expect(thin).toMatchObject({
    status: 'live',
    bookState: 'thin',
    mid: null,
    playable: false,
    inputs: {
      tvlUsd: 0,
      volume24hUsd: null,
      lpConcentration: null,
      realizedVol24h: null,
    },
  })
  const live = read('MON_USDC')
  expect(live).toMatchObject({
    bookState: 'available',
    block: '110654890',
    mid: (0.032444 + 0.032485) / 2,
  })
  expect(live.inputs.tvlUsd).toBeCloseTo(30342.7, 0)
  expect(scored).toHaveLength(7)
})

test('without full 24h coverage volume, concentration, volatility and momentum stay unknown, not zero', async () => {
  const { read, job, scored } = snapshotJob({
    fills: [trade(NOW - HOUR, 0.0325)],
  })
  await job()
  expect(read('MON_USDC')).toMatchObject({
    trades24h: null,
    inputs: { volume24hUsd: null, lpConcentration: null, realizedVol24h: null },
    momentum: null,
  })
  expect(
    scored.find(
      (input) =>
        input.pool.pairAddress ===
        mainnetMarkets.find((m) => m.symbol === 'MON_USDC')!.address,
    )!.momentum,
  ).toBeUndefined()
})

test('with full coverage the trade-derived inputs are filled and age falls back to the first observed trade', async () => {
  const fills = [
    trade(NOW - 5 * HOUR, 0.0325, 'a', 100),
    trade(NOW - 4 * HOUR, 0.0326, 'b', 100),
    trade(NOW - 1 * HOUR, 0.0324, 'a', 100),
  ]
  const { read, job } = snapshotJob({ fills, coverage: completeCoverage })
  await job()
  const snapshot = read('MON_USDC')
  expect(snapshot.trades24h).toBe(3)
  expect(snapshot.inputs.volume24hUsd).toBeCloseTo(3 * 100 * 0.0325, 1)
  expect(snapshot.inputs.lpConcentration).toBe(1)
  expect(snapshot.inputs.realizedVol24h).toBeGreaterThan(0)
  expect(snapshot).toMatchObject({
    ageBasis: 'first-observed-trade',
    inputs: {
      createdAt: Math.floor((NOW - 5 * HOUR) / 1000),
      createdAtIsExact: false,
    },
  })
})

test('a resolved deployment block supplies the exact age', async () => {
  const { read, job } = snapshotJob({
    births: () =>
      new Map([
        [
          'MON_USDC',
          { market: 'MON_USDC', block: 5, at: 1_000_000, exact: true },
        ],
      ]),
  })
  await job()
  expect(read('MON_USDC')).toMatchObject({
    ageBasis: 'deployment-block',
    inputs: { createdAt: 1000, createdAtIsExact: true },
  })
})

test('the sellability gate blocks play and flows into the scorer; the gate is never skipped', async () => {
  const quote = mainnetMarkets.find((m) => m.symbol === 'MON_USDC')!.quoteToken
  const { read, job, scored } = snapshotJob({
    testnetMarkets: [testnetMon],
    probe: async (token) => (token === quote ? 'refused' : 'ok'),
  })
  await job()
  expect(read('MON_USDC')).toMatchObject({
    playable: false,
    gate: { clean: false, status: 'failed' },
  })
  expect(
    scored.every(
      (input) =>
        input.honeypotClean === false || input.pool.tokenY.address !== quote,
    ),
  ).toBe(true)
  const open = snapshotJob({ testnetMarkets: [testnetMon] })
  await open.job()
  expect(open.read('MON_USDC')).toMatchObject({
    playable: true,
    gate: { clean: true },
  })
  expect(open.read('MON_AUSD').playable).toBe(false)
  expect(open.read('WETH_USDC').playable).toBe(false)
})

test('a market whose read fails keeps its previous snapshot marked stale; with no history it is unavailable', async () => {
  let broken = false
  let t = NOW
  const { db, job, read } = snapshotJob({
    now: () => t,
    readBook: async (market) => {
      if (broken && market.symbol === 'MON_USDC') throw new Error('rpc down')
      return market.symbol === 'MON_USDC' ? monUsdcBook : emptyBook
    },
  })
  await job()
  broken = true
  t = NOW + 900_000
  await job()
  expect(read('MON_USDC')).toMatchObject({
    status: 'stale',
    takenAt: NOW,
    bookState: 'available',
  })
  expect(db.query('SELECT COUNT(*) AS n FROM market_snapshots').get()).toEqual({
    n: 14,
  })
  const fresh = snapshotJob({
    readBook: async () => {
      throw new Error('down')
    },
  })
  await fresh.job()
  expect(fresh.read('WETH_USDC')).toMatchObject({
    status: 'unavailable',
    takenAt: null,
    score: null,
    playable: false,
  })
})

test('/v1/tracker reports offline, partial while coverage is incomplete, and available once everything is live and covered', async () => {
  const { db, job } = snapshotJob()
  const app = createApp({
    origin: 'http://x',
    version: '1',
    sections: {},
    jobs: () => ({}),
    routes: [trackerRoute(db, () => NOW + 5000)],
    now: () => NOW,
  })
  expect(await (await app.request('/v1/tracker')).json()).toMatchObject({
    status: 'offline',
    markets: [],
    takenAt: null,
  })
  await job()
  const partial = (await (await app.request('/v1/tracker')).json()) as {
    status: string
    markets: unknown[]
    takenAt: number
    ageMs: number
  }
  expect(partial).toMatchObject({
    status: 'partial',
    takenAt: NOW,
    ageMs: 5000,
  })
  expect(partial.markets).toHaveLength(7)
  expect((await app.request('/v1/tracker?x=1')).status).toBe(400)
  const covered = snapshotJob({ coverage: completeCoverage })
  const full = createApp({
    origin: 'http://x',
    version: '1',
    sections: {},
    jobs: () => ({}),
    routes: [trackerRoute(covered.db, () => NOW)],
    now: () => NOW,
  })
  await covered.job()
  expect(await (await full.request('/v1/tracker')).json()).toMatchObject({
    status: 'available',
    coverage: { complete: true },
  })
})

test('one transient read failure per market is retried; the sellability gate also gets a second attempt', async () => {
  const seen = new Set<string>()
  let probes = 0
  const { read, job } = snapshotJob({
    readBook: async (market) => {
      if (!seen.has(market.symbol)) {
        seen.add(market.symbol)
        throw new Error('blip')
      }
      return market.symbol === 'MON_USDC' ? monUsdcBook : emptyBook
    },
    probe: async () => {
      if (probes++ === 0) throw new Error('blip')
      return 'ok'
    },
  })
  await job()
  expect(read('MON_USDC')).toMatchObject({
    status: 'live',
    gate: { clean: true, status: 'passed' },
  })
  expect(read('WETH_USDC').status).toBe('live')
})

test('expired tracker observations stop being live or playable at the health staleness boundary', async () => {
  const { db, job } = snapshotJob({
    coverage: completeCoverage,
    testnetMarkets: [testnetMon],
  })
  let at = NOW + 45 * 60_000
  const app = createApp({
    origin: 'http://x', version: '1', sections: {}, jobs: () => ({}),
    routes: [trackerRoute(db, () => at)],
  })
  try {
    await job()
    expect(await (await app.request('/v1/tracker')).json()).toMatchObject({
      status: 'available',
    })
    at++
    const body = await (await app.request('/v1/tracker')).json()
    expect(body.status).toBe('partial')
    expect(body.markets.find((market: { market: string }) => market.market === 'MON_USDC')).toMatchObject({
      status: 'stale',
      playable: false,
      takenAt: NOW,
    })
  } finally {
    db.close()
  }
})
