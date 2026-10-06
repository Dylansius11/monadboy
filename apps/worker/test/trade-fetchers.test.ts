import { expect, test } from 'bun:test'
import { encodeAbiParameters, encodeEventTopics, toEventSelector } from 'viem'
import type { Hex } from 'viem'
import { mainnetMarkets } from '@monadboy/sdk'
import {
  createHypersyncFetcher,
  createRpcFetcher,
  tradeEvent,
} from '../src/chain/trade-fetchers'
import type { RawLog } from '../src/chain/trade-fetchers'
import { address, tx } from './helpers'

const monUsdc = mainnetMarkets.find((market) => market.symbol === 'MON_USDC')!
const topics = encodeEventTopics({
  abi: [tradeEvent],
  eventName: 'Trade',
}) as readonly Hex[]
const trade = (
  block: bigint,
  logIndex: number,
  price: bigint,
  filled: bigint,
  maker = address('a'),
): RawLog => ({
  address: monUsdc.address,
  topics,
  blockNumber: block,
  logIndex,
  transactionHash: tx('c'),
  data: encodeAbiParameters(tradeEvent.inputs, [
    7,
    maker,
    true,
    price,
    0n,
    address('b'),
    address('d'),
    filled,
  ]),
})

test('rpc fetcher decodes price at 1e18 and size at the market precision, with one timestamp lookup per block', async () => {
  const stamped: bigint[] = []
  const fetcher = createRpcFetcher({
    getLogs: async () => [
      trade(500n, 0, 32_500_000_000_000_000n, 25_000_000_000n),
      trade(500n, 1, 32_600_000_000_000_000n, 10_000_000_000n),
      trade(501n, 0, 32_700_000_000_000_000n, 10_000_000_000n),
    ],
    getBlock: async ({ blockNumber }) => {
      stamped.push(blockNumber)
      return { timestamp: blockNumber * 2n }
    },
  })
  const rows = await fetcher.fetch(500n, 600n)
  expect(
    rows.map((row) => [
      row.block,
      row.logIndex,
      row.price,
      row.size,
      row.at,
      row.maker,
    ]),
  ).toEqual([
    [500, 0, 0.0325, 2.5, 1_000_000, address('a')],
    [500, 1, 0.0326, 1, 1_000_000, address('a')],
    [501, 0, 0.0327, 1, 1_002_000, address('a')],
  ])
  expect(rows[0].market).toBe(monUsdc.address)
  expect([...stamped].sort()).toEqual([500n, 501n])
})

test('rpc fetcher refuses logs that are not confirmed or not from a tracked market', async () => {
  const bad = (overrides: Partial<RawLog>) =>
    createRpcFetcher({
      getLogs: async () => [{ ...trade(1n, 0, 1n, 1n), ...overrides }],
      getBlock: async () => ({ timestamp: 1n }),
    }).fetch(1n, 2n)
  await expect(bad({ blockNumber: null })).rejects.toThrow('Unconfirmed')
  await expect(bad({ address: address('9') })).rejects.toThrow('unconfigured')
})

function hypersync(pages: unknown[], ok = true) {
  const requests: {
    url: string
    headers: Record<string, string>
    body: Record<string, unknown>
  }[] = []
  const post = (async (url: string, init: RequestInit) => {
    requests.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string) as Record<string, unknown>,
    })
    return new Response(JSON.stringify(pages[requests.length - 1]), {
      status: ok ? 200 : 401,
    })
  }) as unknown as typeof fetch
  return {
    requests,
    fetcher: createHypersyncFetcher({
      url: 'https://hs.example',
      token: 'tok',
      post,
    }),
  }
}
const hsLog = (block: number, index: number, price: bigint) => ({
  address: monUsdc.address,
  block_number: block,
  log_index: index,
  transaction_hash: tx('e'),
  data: trade(0n, 0, price, 10_000_000_000n).data,
  topic0: toEventSelector(tradeEvent),
})

// Request and response shapes were observed against a live HyperSync token (2026-10-06); see the fetcher.
test('hypersync fetcher queries all seven markets with an exclusive end, follows next_block and reads hex or numeric quantities', async () => {
  const { requests, fetcher } = hypersync([
    {
      next_block: 130,
      data: [
        {
          blocks: [{ number: 120, timestamp: 1000 }],
          logs: [hsLog(120, 3, 32_500_000_000_000_000n)],
        },
      ],
    },
    {
      next_block: 151,
      data: {
        blocks: [{ number: '0x8c', timestamp: '0x7d1' }],
        logs: [
          {
            ...hsLog(140, 0, 32_600_000_000_000_000n),
            block_number: '0x8c',
            log_index: '0x2',
          },
        ],
      },
    },
  ])
  const rows = await fetcher.fetch(100n, 150n)
  expect(requests).toHaveLength(2)
  expect(requests[0]).toMatchObject({
    url: 'https://hs.example/query',
    headers: { Authorization: 'Bearer tok' },
    body: { from_block: 100, to_block: 151 },
  })
  expect(requests[1].body.from_block).toBe(130)
  const filter = (
    requests[0].body.logs as { address: string[]; topics: string[][] }[]
  )[0]
  expect(filter.address).toHaveLength(7)
  expect(filter.topics).toEqual([[toEventSelector(tradeEvent)]])
  expect(
    rows.map((row) => [row.block, row.logIndex, row.price, row.at]),
  ).toEqual([
    [120, 3, 0.0325, 1_000_000],
    [140, 2, 0.0326, 2_001_000],
  ])
})

test('hypersync failures are errors, never a silently shorter result', async () => {
  await expect(hypersync([{}], false).fetcher.fetch(1n, 5n)).rejects.toThrow(
    '401',
  )
  await expect(
    hypersync([{ next_block: 1, data: [] }]).fetcher.fetch(1n, 5n),
  ).rejects.toThrow('advance')
  await expect(
    hypersync([
      { next_block: 6, data: [{ blocks: [], logs: [hsLog(2, 0, 1n)] }] },
    ]).fetcher.fetch(1n, 5n),
  ).rejects.toThrow('timestamp')
})

test('a hypersync 429 waits out the advertised reset and retries the same page, then gives up', async () => {
  const seen: number[] = []
  const waits: number[] = []
  let limited = 1
  const post = (async (_url: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)).from_block)
    return limited-- > 0
      ? new Response('', { status: 429, headers: { 'x-ratelimit-reset': '12' } })
      : new Response(
          JSON.stringify({
            next_block: 6,
            data: [{ blocks: [{ number: 2, timestamp: 5 }], logs: [hsLog(2, 0, 1n)] }],
          }),
        )
  }) as unknown as typeof fetch
  const pause = async (ms: number) => void waits.push(ms)
  const rows = await createHypersyncFetcher({
    url: 'https://hs.example',
    token: 'tok',
    post,
    pause,
  }).fetch(1n, 5n)
  expect(rows).toHaveLength(1)
  expect(seen).toEqual([1, 1])
  expect(waits).toEqual([13_000])

  waits.length = 0
  limited = Number.POSITIVE_INFINITY
  await expect(
    createHypersyncFetcher({ url: 'https://hs.example', token: 'tok', post, pause }).fetch(1n, 5n),
  ).rejects.toThrow('429')
  expect(waits).toEqual([13_000, 13_000, 13_000])
})
