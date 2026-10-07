import { expect, it } from 'vitest'
import { createTestIndexer } from 'generated'

const market = '0xd9f66b3bdbb1741f33e01fa3acb514623e0a60bc' as const
const maker = '0x1111111111111111111111111111111111111111' as const
const taker = '0x2222222222222222222222222222222222222222' as const
const block = 68941000
const timestamp = 1791367000
const metadata = (
  logIndex: number,
  at = timestamp + Math.floor(logIndex / 2),
) => ({
  srcAddress: market,
  logIndex,
  block: { number: block + Math.floor(logIndex / 2), timestamp: at },
  transaction: { hash: `0x${'ab'.repeat(32)}` },
})
const initial = {
  contract: 'OrderBook' as const,
  event: 'FlipOrderCreated' as const,
  params: {
    orderId: 1n,
    flippedId: 0n,
    owner: maker,
    size: 10000000000n,
    price: 3300000n,
    flippedPrice: 3333000n,
    isBuy: true,
  },
  ...metadata(0),
}
const initialFill = {
  contract: 'OrderBook' as const,
  event: 'Trade' as const,
  params: {
    orderId: 1n,
    makerAddress: maker,
    takerAddress: taker,
    txOrigin: taker,
    isBuy: false,
    price: 33000000000000000n,
    updatedSize: 0n,
    filledSize: 10000000000n,
  },
  ...metadata(1),
}
const flipped = {
  contract: 'OrderBook' as const,
  event: 'FlippedOrderCreated' as const,
  params: {
    orderId: 2n,
    flippedId: 1n,
    owner: maker,
    size: 10000000000n,
    price: 3333000n,
    flippedPrice: 3300000n,
    isBuy: false,
  },
  ...metadata(2),
}
const eligibleFill = {
  contract: 'OrderBook' as const,
  event: 'Trade' as const,
  params: {
    orderId: 2n,
    makerAddress: maker,
    takerAddress: taker,
    txOrigin: taker,
    isBuy: true,
    price: 33330000000000000n,
    updatedSize: 6000000000n,
    filledSize: 4000000000n,
  },
  ...metadata(3),
}

it('counts only flipped-origin maker spread and does not double-count a repeated log', async () => {
  const indexer = createTestIndexer()
  await indexer.process({
    chains: { 10143: { simulate: [initial, initialFill] } },
  })
  expect((await indexer.Disk.get(maker))?.score).toBe(0)
  await indexer.process({
    chains: { 10143: { simulate: [flipped, eligibleFill, eligibleFill] } },
  })
  const disk = await indexer.Disk.getOrThrow(maker)
  expect(disk.score).toBeCloseTo(0.000132, 12)
  expect(disk.fills).toBe(2)
  expect(disk.scoreComplete).toBe(true)
  const fill = await indexer.Fill.getOrThrow(`10143_${block + 1}_3`)
  expect(fill.isBuy).toBe(false)
  expect(fill.isFlippedOrder).toBe(true)
  expect(fill.realizedSpread).toBeCloseTo(0.000132, 12)
  expect((await indexer.Order.getOrThrow(`${market}_2`)).size).toBe(6000000000n)
})

it('marks a missing order origin incomplete rather than inventing initial-fill zero spread', async () => {
  const indexer = createTestIndexer()
  const unknown = {
    ...eligibleFill,
    params: { ...eligibleFill.params, orderId: 99n },
  }
  await indexer.process({ chains: { 10143: { simulate: [unknown] } } })
  const fill = await indexer.Fill.get(`10143_${block + 1}_3`)
  expect(fill?.originKnown).toBe(false)
  expect(fill?.realizedSpread).toBeUndefined()
  expect((await indexer.Disk.get(maker))?.scoreComplete).toBe(false)
})

it('cancels both members of a partially filled linked pair without erasing independent orders', async () => {
  const indexer = createTestIndexer()
  const pair = {
    ...flipped,
    params: { ...flipped.params, orderId: 3n, flippedId: 2n, isBuy: true },
    ...metadata(4),
  }
  const separate = {
    ...initial,
    params: { ...initial.params, orderId: 9n },
    ...metadata(5),
  }
  const cancel = {
    contract: 'OrderBook' as const,
    event: 'FlipOrdersCanceled' as const,
    params: { orderIds: [2n], owner: maker },
    ...metadata(6),
  }
  await indexer.process({
    chains: {
      10143: {
        simulate: [
          initial,
          initialFill,
          flipped,
          eligibleFill,
          pair,
          separate,
          cancel,
        ],
      },
    },
  })
  expect((await indexer.Order.get(`${market}_2`))?.active).toBe(false)
  expect((await indexer.Order.get(`${market}_3`))?.active).toBe(false)
  expect((await indexer.Order.get(`${market}_9`))?.active).toBe(true)
})

it('expires old market volume using event timestamps rather than cumulative lifetime trades', async () => {
  const indexer = createTestIndexer()
  const later = { ...eligibleFill, ...metadata(4, timestamp + 86401) }
  await indexer.process({
    chains: { 10143: { simulate: [initial, initialFill, flipped, later] } },
  })
  expect((await indexer.Market.get(market))?.volume24h).toBeCloseTo(
    0.013332,
    12,
  )
})
