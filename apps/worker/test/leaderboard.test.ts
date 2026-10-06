import { expect, test } from 'bun:test'
import type { Fill } from '@monadboy/sdk'
import { createApp } from '../src/app'
import { createLeaderboardJob } from '../src/jobs/leaderboard'
import type { DiskFills, FillSnapshot } from '../src/jobs/leaderboard'
import { leaderboardRoute } from '../src/routes/leaderboard'
import { address, memoryDb, quiet, tx } from './helpers'

const DAY = 86_400_000
const NOW = 10 * DAY
const fill = (overrides: Partial<Fill> & { at: number }): Fill => ({
  orderId: 1n,
  price: 10,
  flipPrice: 11,
  size: 2,
  isBuy: true,
  isFlippedOrder: true,
  tx: tx('1'),
  ...overrides,
})
const disk = (overrides: Partial<DiskFills> = {}): DiskFills => ({
  disk: address('1'),
  market: 'MON_AUSD',
  tag: 'NAD',
  characterId: null,
  openedAt: NOW - 3 * DAY,
  low: 9,
  high: 11,
  fills: [fill({ at: NOW - 1000 })],
  holdings: { marginBase: 0, marginQuote: 19, restingBase: 0, restingQuote: 0 },
  deposit: { base0: 2, quote0: 0 },
  ...overrides,
})
function run(
  snapshot: Partial<FillSnapshot> & { disks: DiskFills[] },
  samples: [number, number][] = [
    [NOW - 11_000, 10],
    [NOW - 6000, 10],
    [NOW - 1000, 10],
  ],
) {
  const db = memoryDb()
  for (const [at, mid] of samples)
    db.query('INSERT INTO mid_samples (at, market, mid) VALUES (?, ?, ?)').run(
      at,
      'testnet:MON_AUSD',
      mid,
    )
  const job = createLeaderboardJob({
    db,
    source: {
      read: async () => ({ status: 'complete', at: NOW, ...snapshot }),
    },
    now: () => NOW,
    logger: quiet,
  })
  const rows = async (window = '24h') => {
    await job()
    return JSON.parse(
      db
        .query<{ json: string }, [string]>(
          'SELECT json FROM leaderboard_cache WHERE window = ?',
        )
        .get(window)!.json,
    ) as { status: string; rows: Record<string, unknown>[] }
  }
  return { db, rows }
}

test('a known flipped maker fill values SCORE, DAMAGE and NET and counts sampled time in range', async () => {
  const { rows } = run({ disks: [disk()] })
  const result = await rows()
  expect(result.status).toBe('complete')
  expect(result.rows[0]).toMatchObject({
    disk: address('1'),
    tag: 'NAD',
    score: 2,
    observedScore: 2,
    damage: 3,
    net: -1,
    fills: 1,
    secondsInRange: 10,
    lastFillTx: tx('1'),
    timeCoverage: 'sampled-only',
    valuationWindow: 'position-lifetime',
  })
})

test('a fill on an initial (non-flipped) order changes inventory but earns no SCORE', async () => {
  const { rows } = run({
    disks: [disk({ fills: [fill({ at: NOW - 1000, isFlippedOrder: false })] })],
  })
  expect((await rows()).rows[0]).toMatchObject({ score: 0, fills: 1 })
})

test('windows filter fills by time while the all-time window keeps them', async () => {
  const old = fill({ at: NOW - 3 * DAY, orderId: 2n, tx: tx('2') })
  const { rows } = run({
    disks: [disk({ fills: [old, fill({ at: NOW - 1000 })] })],
  })
  expect((await rows('24h')).rows[0]).toMatchObject({ score: 2, fills: 1 })
  expect((await rows('7d')).rows[0]).toMatchObject({ score: 4, fills: 2 })
  expect((await rows('all')).rows[0]).toMatchObject({ score: 4, fills: 2 })
})

test('incomplete history never supplies a final total, damage or net', async () => {
  const { rows } = run({ status: 'partial', disks: [disk()] })
  const result = await rows()
  expect(result.status).toBe('partial')
  expect(result.rows[0]).toMatchObject({
    score: null,
    observedScore: 2,
    damage: null,
    net: null,
  })
})

test('DAMAGE and NET stay unavailable without holdings, deposits or a current testnet mid', async () => {
  expect(
    (await run({ disks: [disk({ holdings: null })] }).rows()).rows[0],
  ).toMatchObject({ score: 2, damage: null, net: null })
  expect(
    (await run({ disks: [disk({ deposit: null })] }).rows()).rows[0],
  ).toMatchObject({ damage: null, net: null })
  const stale = run({ disks: [disk()] }, [[NOW - 120_000, 10]])
  expect((await stale.rows()).rows[0]).toMatchObject({
    score: 2,
    damage: null,
    net: null,
  })
})

test('time in range ignores out-of-range samples and gaps longer than the sampling cadence', async () => {
  const samples: [number, number][] = [
    [NOW - 60_000, 10],
    [NOW - 55_000, 10],
    [NOW - 30_000, 10],
    [NOW - 25_000, 12],
    [NOW - 20_000, 10],
    [NOW - 15_000, 10],
  ]
  const { rows } = run({ disks: [disk()] }, samples)
  // 5 s (in range) + 0 s (gap of 25 s) + 0 s (next sample out of range pair) + 5 s + 5 s
  expect((await rows()).rows[0].secondsInRange).toBe(5 + 5 + 5)
})

test('rows are ranked by SCORE with unscored disks last', async () => {
  const low = disk({
    disk: address('2'),
    fills: [fill({ at: NOW - 1000, flipPrice: 10.5 })],
  })
  const high = disk({
    disk: address('3'),
    fills: [fill({ at: NOW - 1000, flipPrice: 14 })],
  })
  const none = disk({ disk: address('4'), fills: [] })
  expect(
    (await run({ disks: [none, low, high] }).rows()).rows.map(
      (row) => row.disk,
    ),
  ).toEqual([address('3'), address('2'), address('4')])
})

test('with no market configured there are no rows to rank; the route says unavailable until anything is computed', async () => {
  const { db, rows } = run({ status: 'no-market-configured', disks: [] })
  const app = createApp({
    origin: 'http://x',
    version: '1',
    sections: {},
    jobs: () => ({}),
    routes: [leaderboardRoute(db, () => NOW + 500)],
  })
  expect(
    await (await app.request('/v1/leaderboard?window=7d')).json(),
  ).toMatchObject({ status: 'unavailable', rows: [], computedAt: null })
  expect(await rows('24h')).toMatchObject({
    status: 'no-market-configured',
    rows: [],
  })
  expect(await (await app.request('/v1/leaderboard')).json()).toMatchObject({
    status: 'no-market-configured',
    rows: [],
    window: '24h',
    ageMs: 500,
  })
  expect((await app.request('/v1/leaderboard?window=1y')).status).toBe(400)
  expect((await app.request('/v1/leaderboard?score=9')).status).toBe(400)
})
