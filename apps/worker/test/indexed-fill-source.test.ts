import { expect, test } from 'bun:test'
import type { PublicClient } from 'viem'
import { scoreFromFills, testnetMarkets } from '@monadboy/sdk'
import { createIndexedFillSource } from '../src/chain/indexed-fill-source'
import type { FillSnapshot } from '../src/jobs/leaderboard'

const market = testnetMarkets[0]
const owner = '0x6b42b5b925d346cc1dea61ba1d846886c24bf210'
const base: FillSnapshot = {
  status: 'complete',
  at: 10_000,
  disks: [
    {
      disk: owner,
      market: market.symbol,
      tag: null,
      characterId: null,
      openedAt: 0,
      low: 0.032,
      high: 0.034,
      fills: [],
      holdings: {
        marginBase: 1,
        marginQuote: 1,
        restingBase: 0,
        restingQuote: 0,
      },
      deposit: { base0: 1, quote0: 1 },
    },
  ],
}
const row = (id: string, orderId: number, flipped = true) => ({
  id,
  market: market.address.toLowerCase(),
  maker: owner,
  taker: '0x2fbf1b1063ef5e5d0422d8c4c4357640f99f7c1f',
  order_id: `${market.address.toLowerCase()}_${orderId}`,
  price: '0.03299997',
  size: '1.82000182',
  isBuy: false,
  originKnown: true,
  isFlippedOrder: flipped,
  flipPrice: '0.032967',
  block: '68941248',
  tx: `0x${'a'.repeat(64)}`,
  at: '1791367309',
})
const setup = (
  respond: (query: string, variables: Record<string, unknown>) => unknown,
  directStatus: FillSnapshot['status'] = 'complete',
) => {
  let directAt: bigint | undefined
  const indexed = createIndexedFillSource({
    url: 'http://indexer.invalid/v1/graphql',
    markets: [market],
    startBlock: 68940637n,
    client: {
      getBlockNumber: async () => 68941300n,
    } as unknown as PublicClient,
    direct: {
      read: async (at?: bigint) => {
        directAt = at
        return { ...base, status: directStatus }
      },
    },
    pageSize: 1,
    now: () => 10_000,
    fetcher: (async (_url: unknown, init: RequestInit) => {
      const { query, variables } = JSON.parse(String(init.body))
      return new Response(
        JSON.stringify({ data: respond(query, variables ?? {}) }),
      )
    }) as typeof fetch,
  })
  return { indexed, directAt: () => directAt }
}
const meta = {
  _meta: [
    {
      chainId: 10143,
      startBlock: 68939801,
      progressBlock: 68941250,
      isReady: true,
    },
  ],
}

test('primary normalizes stringified fields, paginates at one cursor and preserves chain valuation', async () => {
  const rows = [
    row('10143_68941248_6', 5),
    { ...row('10143_68941248_8', 3, false), flipPrice: '0' },
  ]
  const requested: Record<string, unknown>[] = []
  const { indexed, directAt } = setup((query, variables) => {
    if (query.includes('_meta')) return meta
    if (query.includes('desc')) return { Fill: [rows[1]] }
    requested.push(variables)
    return {
      Fill: rows
        .filter((entry) => entry.id > String(variables.after ?? ''))
        .slice(0, 1),
    }
  })
  const snapshot = await indexed.read()
  expect(snapshot.status).toBe('complete')
  expect(snapshot.source).toBe('envio')
  expect(snapshot.disks[0].holdings).toEqual(base.disks[0].holdings)
  expect(snapshot.disks[0].fills.map((fill) => fill.orderId)).toEqual([5n, 3n])
  expect(snapshot.disks[0].fills[0].at).toBe(1791367309000)
  expect(snapshot.disks[0].fills[0].isBuy).toBe(false)
  expect(scoreFromFills(snapshot.disks[0].fills)).toBeCloseTo(0.00006000546, 10)
  expect(directAt()).toBe(68941250n)
  expect(requested.every((variables) => variables.through === '68941250')).toBe(
    true,
  )
  expect(indexed.state.status).toBe('live')
})

test('a plausible empty lost page before the frozen terminal falls back instead of finalizing a shortened total', async () => {
  const first = row('10143_68941248_6', 5)
  const last = row('10143_68941248_8', 3)
  const { indexed } = setup((query, variables) => {
    if (query.includes('_meta')) return meta
    if (query.includes('desc')) return { Fill: [last] }
    return { Fill: variables.after ? [] : [first] }
  })
  const snapshot = await indexed.read()
  expect(snapshot.source).toBe('direct-logs')
  expect(snapshot.indexer?.status).toBe('offline')
  expect(indexed.state.lastError).toContain('terminal')
  expect(snapshot.disks[0].fills).toEqual([])
})

test('unknown order origin refuses indexed totals and partial direct fallback cannot supply SCORE', async () => {
  const unknown = {
    ...row('10143_68941248_6', 5),
    originKnown: false,
    flipPrice: null,
  }
  const { indexed } = setup((query) => {
    if (query.includes('_meta')) return meta
    return { Fill: [unknown] }
  }, 'partial')
  const snapshot = await indexed.read()
  expect(snapshot.status).toBe('partial')
  expect(snapshot.source).toBe('direct-logs')
  expect(snapshot.indexer?.status).toBe('offline')
  expect(indexed.state.lastError).toContain('origin')
})

test('GraphQL failure is visible and uses the genuine direct fallback rather than cached primary success', async () => {
  const { indexed } = setup(() => {
    throw new Error('provider disconnected')
  }, 'partial')
  const snapshot = await indexed.read()
  expect(snapshot.status).toBe('partial')
  expect(snapshot.source).toBe('direct-logs')
  expect(indexed.state.status).toBe('offline')
  expect(indexed.state.lastError).toContain('provider disconnected')
})

test('healthy-but-lagging ready metadata within200blocks is accepted, uncovered start is not', async () => {
  const { indexed } = setup((query) =>
    query.includes('_meta')
      ? { _meta: [{ ...meta._meta[0], startBlock: 68941000 }] }
      : { Fill: [] },
  )
  const snapshot = await indexed.read()
  expect(snapshot.source).toBe('direct-logs')
  expect(indexed.state.lastError).toContain('coverage')
})
