import { afterEach, expect, test } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { maxUint256 } from 'viem'
import type { Market } from '@monadboy/sdk'
import { mainnetMarkets } from '@monadboy/sdk'
import { createApp } from '../src/app'
import {
  createMidSampler,
  createMidState,
  isSourcePaused,
  sourceSection,
  testnetSection,
} from '../src/jobs/mid-sampler'
import { midRoute } from '../src/routes/mid'
import { memoryDb, quiet } from './helpers'

const dbs: Database[] = []
afterEach(() => dbs.splice(0).forEach((db) => db.close()))
const setup = () => {
  const db = memoryDb()
  dbs.push(db)
  return { db, state: createMidState() }
}
const GOOD: readonly [bigint, bigint] = [
  32_900_000_000_000_000n,
  33_100_000_000_000_000n,
]
const testnetMarket: Market = {
  ...mainnetMarkets.find((m) => m.symbol === 'MON_USDC')!,
  chain: 'testnet',
  symbol: 'MON_AUSD',
}

test('stores the mid at 1e18 scale and serves it with freshness through /v1/mid', async () => {
  const { db, state } = setup()
  await createMidSampler({
    db,
    state,
    mainnet: { readContract: async () => GOOD },
    testnetMarkets: [],
    now: () => 1000,
    logger: quiet,
  })()
  expect(db.query('SELECT * FROM mid_samples').all()).toEqual([
    { at: 1000, market: 'mainnet:MON_USDC', mid: 0.033 },
  ])
  const app = createApp({
    origin: 'http://x',
    version: '1',
    sections: {},
    jobs: () => ({}),
    routes: [midRoute(state, () => 2000)],
    now: () => 2000,
  })
  expect(
    await (await app.request('/v1/mid?market=MON_AUSD')).json(),
  ).toMatchObject({
    targetMid: 0.033,
    source: 'kuru-mainnet:MON_USDC',
    at: 1000,
    ageMs: 1000,
    fresh: true,
    state: 'running',
    testnet: { status: 'no-market-configured' },
  })
  expect((await app.request('/v1/mid?market=WETH_USDC')).status).toBe(400)
})

test('three consecutive failures pause the feed; one valid read resumes it', async () => {
  const { db, state } = setup()
  let fail = false
  const sample = createMidSampler({
    db,
    state,
    mainnet: {
      readContract: async () => {
        if (fail) throw new Error('offline')
        return GOOD
      },
    },
    testnetMarkets: [],
    now: () => 1000,
    logger: quiet,
  })
  await sample()
  fail = true
  await sample()
  await sample()
  expect(state.status).toBe('running')
  await sample()
  expect(state).toMatchObject({
    status: 'paused',
    targetMid: 0.033,
    succeeded: 1,
    consecutiveFailures: 3,
    attempted: 4,
  })
  fail = false
  await sample()
  expect(state).toMatchObject({ status: 'running', consecutiveFailures: 0 })
})

test('a silent sampler counts as paused once the last price is stale, without any failure being counted', async () => {
  const { db, state } = setup()
  await createMidSampler({
    db,
    state,
    mainnet: { readContract: async () => GOOD },
    testnetMarkets: [],
    now: () => 1000,
    logger: quiet,
  })()
  expect(isSourcePaused(state, 1000 + 29_000)).toBe(false)
  expect(isSourcePaused(state, 1000 + 31_000)).toBe(true)
  expect(sourceSection(state, () => 40_000)()).toMatchObject({
    red: 'price-feed-paused',
    value: { state: 'paused', ageMs: 39_000 },
  })
  const fresh = createMidState()
  expect(isSourcePaused(fresh, 0)).toBe(true)
})

test('an empty or crossed source book is a failed read, never a price', async () => {
  const { db, state } = setup()
  for (const book of [
    [maxUint256, 0n],
    [34n * 10n ** 15n, 32n * 10n ** 15n],
  ] as const) {
    await createMidSampler({
      db,
      state,
      mainnet: { readContract: async () => book },
      testnetMarkets: [],
      logger: quiet,
    })()
  }
  expect(state).toMatchObject({
    targetMid: null,
    succeeded: 0,
    consecutiveFailures: 2,
  })
  expect(db.query('SELECT * FROM mid_samples').all()).toEqual([])
})

test('testnet book states are tracked independently of the source and only live mids are stored', async () => {
  const { db, state } = setup()
  let book: readonly [bigint, bigint] | 'down' = [maxUint256, 0n]
  const sample = createMidSampler({
    db,
    state,
    testnetMarkets: [testnetMarket],
    now: () => 1000,
    logger: quiet,
    mainnet: { readContract: async () => GOOD },
    testnet: {
      readContract: async () => {
        if (book === 'down') throw new Error('rpc')
        return book
      },
    },
  })
  await sample()
  expect(state.testnet).toMatchObject({
    status: 'empty',
    mid: null,
    market: 'MON_AUSD',
  })
  book = [33_000_000_000_000_000n, 33_200_000_000_000_000n]
  await sample()
  expect(state.testnet).toMatchObject({ status: 'live' })
  expect(state.testnet.mid).toBeCloseTo(0.0331, 12)
  book = 'down'
  await sample()
  expect(state.testnet).toMatchObject({ status: 'unavailable', mid: null })
  expect(state.status).toBe('running')
  expect(
    db
      .query("SELECT market FROM mid_samples WHERE market LIKE 'testnet:%'")
      .all(),
  ).toEqual([{ market: 'testnet:MON_AUSD' }])
})

test('a wide source book pauses immediately without storing its midpoint and a tight book resumes', async () => {
  const { db, state } = setup()
  let book: readonly [bigint, bigint] = GOOD
  const sample = createMidSampler({
    db, state, mainnet: { readContract: async () => book },
    testnetMarkets: [], logger: quiet, now: () => 1000,
  })
  await sample()
  book = [28_800_000_000_000_000n, 33_700_000_000_000_000n]
  await sample()
  expect(state.status).toBe('paused')
  expect(state.targetMid).toBe(0.033)
  expect(db.query('SELECT mid FROM mid_samples').all()).toEqual([{ mid: 0.033 }])
  book = GOOD
  await sample()
  expect(state.status).toBe('running')
  expect(state.consecutiveFailures).toBe(0)
})

test('testnet observations expire at the same boundary in health and the mid route', async () => {
  for (const status of ['live', 'empty'] as const) {
    const state = createMidState()
    state.testnet = {
      status,
      mid: status === 'live' ? 0.033 : null,
      at: 1000,
      market: 'MON_AUSD',
    }
    let at = 31_000
    const app = createApp({
      origin: 'http://x',
      version: '1',
      sections: {},
      jobs: () => ({}),
      routes: [midRoute(state, () => at)],
    })
    expect(testnetSection(state, () => at)().value).toMatchObject({ status })
    expect(await (await app.request('/v1/mid')).json()).toMatchObject({
      testnet: { status, ageMs: 30_000 },
      testnetMid: state.testnet.mid,
    })
    at++
    expect(testnetSection(state, () => at)().value).toMatchObject({
      status: 'unavailable',
      mid: null,
      ageMs: 30_001,
    })
    expect(await (await app.request('/v1/mid')).json()).toMatchObject({
      testnet: { status: 'unavailable', ageMs: 30_001 },
      testnetMid: null,
    })
  }
})
