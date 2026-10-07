import { OrderBook } from 'generated'
import type { EvmEvent, HandlerContext, Order } from 'generated'
import { scoreFromFills } from '../../../packages/sdk/src/kuru/position'
import { emptyDisk, orderId, paramsFor } from './state'

type Creation = Pick<
  EvmEvent<'OrderBook', 'FlipOrderCreated' | 'FlippedOrderCreated'>,
  'srcAddress' | 'params'
>

async function createOrder(
  event: Creation,
  context: HandlerContext,
  isFlipped: boolean,
) {
  const market = event.srcAddress.toLowerCase()
  const params = paramsFor(market)
  const id = orderId(market, event.params.orderId)
  const pairedOrderId =
    event.params.flippedId === 0n ? '' : orderId(market, event.params.flippedId)
  const order: Order = {
    id,
    market,
    orderId: event.params.orderId,
    owner: event.params.owner.toLowerCase(),
    price: Number(event.params.price) / params.pricePrecision,
    flipPrice: Number(event.params.flippedPrice) / params.pricePrecision,
    size: event.params.size,
    isBuy: event.params.isBuy,
    isFlipped,
    active: event.params.size > 0n,
    pairedOrderId,
  }
  context.Order.set(order)
  if (pairedOrderId) {
    const paired = await context.Order.get(pairedOrderId)
    if (paired) context.Order.set({ ...paired, pairedOrderId: id })
  }
}

OrderBook.FlipOrderCreated.handler(async ({ event, context }) =>
  createOrder(event, context, false),
)
OrderBook.FlippedOrderCreated.handler(async ({ event, context }) =>
  createOrder(event, context, true),
)
OrderBook.OrderCreated.handler(async ({ event, context }) => {
  const market = event.srcAddress.toLowerCase()
  const params = paramsFor(market)
  context.Order.set({
    id: orderId(market, event.params.orderId),
    market,
    orderId: event.params.orderId,
    owner: event.params.owner.toLowerCase(),
    price: Number(event.params.price) / params.pricePrecision,
    flipPrice: 0,
    size: event.params.size,
    isBuy: event.params.isBuy,
    isFlipped: false,
    active: event.params.size > 0n,
    pairedOrderId: '',
  })
})
OrderBook.FlipOrderUpdated.handler(async ({ event, context }) => {
  const order = await context.Order.get(
    orderId(event.srcAddress, event.params.orderId),
  )
  if (order)
    context.Order.set({
      ...order,
      size: event.params.size,
      active: event.params.size > 0n,
    })
})

async function cancel(
  market: string,
  ids: readonly bigint[],
  context: HandlerContext,
  includePairs: boolean,
) {
  for (const id of ids) {
    const order = await context.Order.get(orderId(market, id))
    if (!order) continue
    context.Order.set({ ...order, active: false, size: 0n })
    if (includePairs && order.pairedOrderId) {
      const paired = await context.Order.get(order.pairedOrderId)
      if (paired) context.Order.set({ ...paired, active: false, size: 0n })
    }
  }
}
OrderBook.FlipOrdersCanceled.handler(async ({ event, context }) =>
  cancel(event.srcAddress, event.params.orderIds, context, true),
)
OrderBook.OrdersCanceled.handler(async ({ event, context }) =>
  cancel(event.srcAddress, event.params.orderIds, context, false),
)

OrderBook.Trade.handler(async ({ event, context }) => {
  const id = `${event.chainId}_${event.block.number}_${event.logIndex}`
  if (await context.Fill.get(id)) return
  const market = event.srcAddress.toLowerCase()
  const params = paramsFor(market)
  const order = await context.Order.get(orderId(market, event.params.orderId))
  const maker = event.params.makerAddress.toLowerCase()
  const at = BigInt(event.block.timestamp)
  const price = Number(event.params.price) / 1e18
  const size = Number(event.params.filledSize) / params.sizePrecision
  const known = order !== undefined && order.owner === maker
  const realizedSpread = known
    ? scoreFromFills([
        {
          orderId: event.params.orderId,
          price,
          size,
          isBuy: !event.params.isBuy,
          isFlippedOrder: order.isFlipped,
          flipPrice: order.flipPrice,
          tx: event.transaction.hash as `0x${string}`,
          at: event.block.timestamp * 1000,
        },
      ])
    : undefined
  // v3.0 supports one indexed filter per query. This bounds work to the last 24h,
  // then selects this market; do not replace rolling volume with a lifetime total.
  const recent = await context.Fill.getWhere({ at: { _gt: at - 86400n } })
  let volume24h = price * size
  for (const fill of recent)
    if (fill.market === market) volume24h += fill.price * fill.size
  context.Fill.set({
    id,
    market,
    order_id: known ? order.id : undefined,
    maker,
    taker: event.params.takerAddress.toLowerCase(),
    price,
    size,
    isBuy: !event.params.isBuy,
    originKnown: known,
    isFlippedOrder: known && order.isFlipped,
    flipPrice: known ? order.flipPrice : undefined,
    block: BigInt(event.block.number),
    tx: event.transaction.hash,
    at,
    realizedSpread,
  })
  context.Market.set({ id: market, lastPrice: price, volume24h, updatedAt: at })
  const disk = (await context.Disk.get(maker)) ?? emptyDisk(maker)
  context.Disk.set({
    ...disk,
    score: disk.score + (realizedSpread ?? 0),
    fills: disk.fills + 1,
    lastFillAt: at,
    scoreComplete: disk.scoreComplete && known,
  })
  if (known)
    context.Order.set({
      ...order,
      size: event.params.updatedSize,
      active: event.params.updatedSize > 0n,
    })
})
