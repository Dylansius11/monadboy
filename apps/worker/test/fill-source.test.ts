import { expect, test } from 'bun:test'
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAbiItem,
  stringToHex,
  zeroAddress,
} from 'viem'
import type { Abi, Address, PublicClient } from 'viem'
import {
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  mainnetMarkets,
} from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'
import { createDirectFillSource } from '../src/chain/fill-source'
import { address, memoryDb, quiet, tx } from './helpers'

const market: Market = {
  ...mainnetMarkets.find((m) => m.symbol === 'MON_USDC')!,
  chain: 'testnet',
  symbol: 'MON_AUSD',
  address: address('b'),
  quoteSymbol: 'AUSD',
  quoteToken: address('d'),
}
const margin = address('c')
const registry = address('e')
const owner = address('1')
const stranger = address('2')

type Fake = {
  block: number
  index: number
  address: Address
  abi: Abi
  name: string
  values: unknown[]
}
const raw = (event: Fake) => {
  const item = getAbiItem({ abi: event.abi, name: event.name }) as {
    inputs: readonly { name: string; type: string }[]
  }
  return {
    address: event.address,
    blockNumber: BigInt(event.block),
    logIndex: event.index,
    transactionHash: tx(String(event.block % 10)),
    topics: encodeEventTopics({ abi: event.abi, eventName: event.name }),
    data: encodeAbiParameters(item.inputs as never, event.values as never),
  }
}
const book = (
  block: number,
  index: number,
  name: string,
  values: unknown[],
): Fake => ({
  block,
  index,
  address: market.address,
  abi: kuruOrderbookAbi,
  name,
  values,
})
const vault = (
  block: number,
  index: number,
  name: string,
  values: unknown[],
): Fake => ({
  block,
  index,
  address: margin,
  abi: kuruMarginAccountAbi,
  name,
  values,
})
// price 1e8 precision: 10.0 -> 10e8; Trade price is 1e18 scale; size precision 1e10.
const history: Fake[] = [
  vault(99, 0, 'Deposit', [owner, market.quoteToken, 20_000_000n]),
  vault(99, 1, 'Deposit', [owner, address('f'), 5n]),
  book(100, 0, 'FlipOrderCreated', [
    1,
    2,
    owner,
    20_000_000_000n,
    1_000_000_000,
    1_100_000_000,
    true,
  ]),
  book(105, 0, 'Trade', [
    1,
    owner,
    true,
    10n * 10n ** 18n,
    0n,
    stranger,
    stranger,
    20_000_000_000n,
  ]),
  book(105, 1, 'FlippedOrderCreated', [
    2,
    1,
    owner,
    20_000_000_000n,
    1_100_000_000,
    1_000_000_000,
    false,
  ]),
  book(110, 0, 'Trade', [
    2,
    owner,
    false,
    11n * 10n ** 18n,
    0n,
    stranger,
    stranger,
    10_000_000_000n,
  ]),
  book(111, 0, 'Trade', [
    99,
    stranger,
    true,
    10n * 10n ** 18n,
    0n,
    stranger,
    stranger,
    10_000_000_000n,
  ]),
]

function client(head: bigint, overrides: { failLogs?: () => boolean } = {}) {
  const ranges: [bigint, bigint][] = []
  const fake = {
    getBlockNumber: async () => head,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({
      timestamp: blockNumber * 10n,
    }),
    getLogs: async ({
      fromBlock,
      toBlock,
    }: {
      fromBlock: bigint
      toBlock: bigint
    }) => {
      if (overrides.failLogs?.()) throw new Error('rpc down')
      ranges.push([fromBlock, toBlock])
      return history
        .filter((e) => e.block >= fromBlock && e.block <= toBlock)
        .map(raw)
    },
    readContract: async ({
      functionName,
      args,
    }: {
      functionName: string
      args: readonly unknown[]
    }) => {
      if (functionName === 'diskOf')
        return {
          createdAt: args[0] === owner ? 1n : 0n,
          tag: stringToHex('NAD', { size: 12 }),
        }
      if (functionName === 'getBalance')
        return args[1] === market.quoteToken ? 8_000_000n : 0n
      // s_orders: order 2 rests as a sell of 1 base; the others are gone
      if (functionName === 's_orders')
        return args[0] === 2
          ? [owner, 10_000_000_000n, 0, 0, 0, 1_100_000_000, 0, false]
          : [zeroAddress, 0n, 0, 0, 0, 0, 0, false]
      throw new Error(`unexpected ${functionName}`)
    },
  }
  return { ranges, client: fake as unknown as PublicClient }
}
const source = (
  c: PublicClient,
  extra: Partial<Parameters<typeof createDirectFillSource>[0]> = {},
) =>
  createDirectFillSource({
    db: memoryDb(),
    client: c,
    markets: [market],
    margin,
    registry,
    startBlock: 90n,
    chunkBlocks: 50n,
    concurrency: 2,
    now: () => 1234,
    logger: quiet,
    ...extra,
  })

test('attributes Trade logs to the disk that owns the maker order and tracks flip status per order', async () => {
  const { client: c } = client(130n)
  const snapshot = await source(c).read()
  expect(snapshot.status).toBe('complete')
  expect(snapshot.disks).toHaveLength(1)
  const [one] = snapshot.disks
  expect(one).toMatchObject({
    disk: owner,
    market: 'MON_AUSD',
    tag: 'NAD',
    characterId: null,
    low: 10,
    high: 11,
  })
  expect(
    one.fills.map((f) => ({
      orderId: f.orderId,
      price: f.price,
      size: f.size,
      isBuy: f.isBuy,
      isFlippedOrder: f.isFlippedOrder,
      flipPrice: f.flipPrice,
      at: f.at,
    })),
  ).toEqual([
    {
      orderId: 1n,
      price: 10,
      size: 2,
      isBuy: true,
      isFlippedOrder: false,
      flipPrice: 11,
      at: 1_050_000,
    },
    {
      orderId: 2n,
      price: 11,
      size: 1,
      isBuy: false,
      isFlippedOrder: true,
      flipPrice: 10,
      at: 1_100_000,
    },
  ])
})

test('valuation inputs come from chain state: net margin deposits for the market tokens, margin balances and resting orders', async () => {
  const [one] = (await source(client(130n).client).read()).disks
  expect(one.deposit).toEqual({ base0: 0, quote0: 20 })
  expect(one.holdings).toEqual({
    marginBase: 0,
    marginQuote: 8,
    restingBase: 1,
    restingQuote: 0,
  })
})

test('history is read forward in bounded chunks and resumed from the cursor, so partial is reported until the head is reached', async () => {
  const db = memoryDb()
  const a = client(500n)
  const first = createDirectFillSource({
    db,
    client: a.client,
    markets: [market],
    margin,
    startBlock: 90n,
    chunkBlocks: 50n,
    concurrency: 2,
    groupsPerRun: 1,
    logger: quiet,
  })
  expect((await first.read()).status).toBe('partial')
  expect(a.ranges).toEqual([
    [90n, 139n],
    [140n, 189n],
  ])
  const second = createDirectFillSource({
    db,
    client: a.client,
    markets: [market],
    margin,
    startBlock: 90n,
    chunkBlocks: 50n,
    concurrency: 2,
    groupsPerRun: 1,
    logger: quiet,
  })
  await second.read()
  expect(a.ranges.slice(2)).toEqual([
    [190n, 239n],
    [240n, 289n],
  ])
})

test('a failing log read is unavailable and does not advance the cursor', async () => {
  const db = memoryDb()
  let down = true
  const a = client(130n, { failLogs: () => down })
  const s = createDirectFillSource({
    db,
    client: a.client,
    markets: [market],
    margin,
    startBlock: 90n,
    chunkBlocks: 50n,
    logger: quiet,
  })
  expect((await s.read()).status).toBe('unavailable')
  expect(db.query('SELECT COUNT(*) AS n FROM fill_cursors').get()).toEqual({
    n: 0,
  })
  down = false
  expect((await s.read()).status).toBe('complete')
})

test('no configured market and no start block are explicit states, never an empty ranking claim', async () => {
  const c = client(130n).client
  expect((await source(c, { markets: [] }).read()).status).toBe(
    'no-market-configured',
  )
  expect((await source(c, { startBlock: undefined }).read()).status).toBe(
    'unavailable',
  )
})
