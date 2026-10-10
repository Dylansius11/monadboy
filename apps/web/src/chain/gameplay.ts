import {
  bestBidAsk1e18,
  kuruOrderbookAbi,
  kuruMarginAccountAbi,
  erc20Abi,
  scoreCard,
  unitsToPrice,
  unitsToSize,
} from '@monadboy/sdk'
import { decodeEventLog, formatUnits } from 'viem'
import { z } from 'zod'
import deployments from '../../../../packages/sdk/src/deployments.testnet.json'
import type { Address, ContractFunctionReturnType, Hex, PublicClient } from 'viem'
import type { Deposit, Fill, Holdings, Market } from '@monadboy/sdk'

export const MARGIN = '0xd029C2D98ff85D8F64799017fE00a59B1159CE02' as const
export const MARKET_START_BLOCK = BigInt(deployments.orderBook.blockNumber)
export type MarketEvent = {
  kind: string
  args: Record<string, unknown>
  tx: Hex
  at: number
  block: number
  index: number
}
export type ActiveOrder = {
  id: number
  linked: number
  price: number
  flipPrice: number
  size: number
  isBuy: boolean
  isFlip: boolean
}
export type RunBasis = {
  openedAt: number
  startBlock: bigint
  deposit: Deposit
  low: number
  high: number
  step: number
}
export type PositionRead = {
  block: bigint
  head: bigint
  mid: number | null
  bid: number | null
  ask: number | null
  paused: boolean
  walletBase: number
  walletQuote: number
  holdings: Holdings
  orders: ActiveOrder[]
  marginBaseRaw: bigint
  marginQuoteRaw: bigint
  fills: Fill[]
  missingOrigins: number[]
  complete: boolean
  historyError?: string
  source: 'INDEXED' | 'INDEXER OFFLINE'
  coverageFrom: bigint
  valuation: ReturnType<typeof scoreCard> | null
  observedAt: number
}

export function bufferedGas(estimate: bigint, cap: bigint): bigint {
  const limit = (estimate * 120n + 99n) / 100n
  if (estimate <= 0n || limit > cap)
    throw new Error(
      'Measured gas estimate exceeds the bounded transaction budget. No transaction signed.',
    )
  return limit
}

export function rawQuoteCeil(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error('Invalid quote amount.')
  return BigInt(Math.ceil(amount * 10 ** decimals))
}

/** Cancellation also removes the live flipped partner; never submit both. */
export function cancelPairIds(
  orders: readonly { id: number; linked: number }[],
): number[] {
  const selected: number[] = []
  const covered = new Set<number>()
  const reverse = new Map(
    orders
      .filter((order) => order.linked > 0)
      .map((order) => [order.linked, order.id]),
  )
  for (const order of orders) {
    if (covered.has(order.id)) continue
    selected.push(order.id)
    covered.add(order.id)
    if (order.linked) covered.add(order.linked)
    const partner = reverse.get(order.id)
    if (partner) covered.add(partner)
  }
  return selected
}

/** Reachability from the live price-point head, not stale s_orders.size, proves resting membership. */
export function reachableOrderIds(
  head: number,
  orders: ReadonlyMap<number, { next: number }>,
): Set<number> {
  const reachable = new Set<number>()
  for (let id = head; id !== 0;) {
    if (reachable.has(id))
      throw new Error(
        'The live order list contains a cycle; current orders are unavailable.',
      )
    const order = orders.get(id)
    if (!order)
      throw new Error(
        'The live order list has a missing link; current orders are unavailable.',
      )
    reachable.add(id)
    id = order.next
  }
  return reachable
}

/** Browser gameplay normalizes Fill.at and sealed run timestamps to chain seconds; SDK scoring does not read timestamps. */
export function projectMarketEvents(
  events: readonly MarketEvent[],
  market: Market,
  owner: Address,
  throughBlock?: bigint,
) {
  const origins = new Map<number, { flipped: boolean; flipPrice: number }>()
  const fills: Fill[] = []
  const missingOrigins: number[] = []
  const lowerOwner = owner.toLowerCase()
  for (const event of [...events]
    .filter(
      (entry) =>
        throughBlock === undefined || BigInt(entry.block) <= throughBlock,
    )
    .sort((a, b) => a.block - b.block || a.index - b.index)) {
    const args = event.args
    const id = Number(args.orderId)
    if (
      (event.kind === 'FlipOrderCreated' ||
        event.kind === 'FlippedOrderCreated') &&
      String(args.owner).toLowerCase() === lowerOwner
    ) {
      origins.set(id, {
        flipped: event.kind === 'FlippedOrderCreated',
        flipPrice: unitsToPrice(Number(args.flippedPrice), market.params),
      })
    } else if (
      event.kind === 'Trade' &&
      String(args.makerAddress).toLowerCase() === lowerOwner
    ) {
      const origin = origins.get(id)
      if (!origin) {
        missingOrigins.push(id)
        continue
      }
      fills.push({
        orderId: BigInt(id),
        price: Number(args.price) / 1e18,
        size: unitsToSize(BigInt(String(args.filledSize)), market.params),
        isBuy: !args.isBuy,
        isFlippedOrder: origin.flipped,
        flipPrice: origin.flipPrice,
        tx: event.tx,
        at: event.at,
      })
    }
  }
  return { fills, missingOrigins }
}

const indexedFill = z.object({
  id: z.string(),
  order_id: z.string().nullable(),
  price: z.coerce.number().finite().positive(),
  size: z.coerce.number().finite().nonnegative(),
  isBuy: z.boolean(),
  originKnown: z.boolean(),
  isFlippedOrder: z.boolean(),
  flipPrice: z.coerce.number().finite().nonnegative().nullable(),
  tx: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  at: z.coerce.number().finite(),
  block: z.coerce.number().finite(),
})
const indexedMeta = z.object({
  chainId: z.coerce.number(),
  startBlock: z.coerce.bigint(),
  progressBlock: z.coerce.bigint(),
  isReady: z.boolean(),
})

export function parseIndexedProjection(
  raw: unknown,
  metadata: unknown,
  startBlock: bigint,
  head: bigint,
) {
  const rows = z.array(indexedFill).parse(raw)
  const sync = z.array(indexedMeta).parse(metadata)
  const missingOrigins = rows
    .filter(
      (row) =>
        !row.originKnown || row.order_id === null || row.flipPrice === null,
    )
    .map((row) => row.id)
  const fills = rows
    .filter(
      (row) =>
        row.originKnown && row.order_id !== null && row.flipPrice !== null,
    )
    .map((row): Fill => ({
      orderId: BigInt(row.order_id!.split(/[:_]/).at(-1)!),
      price: row.price,
      size: row.size,
      isBuy: row.isBuy,
      isFlippedOrder: row.isFlippedOrder,
      flipPrice: row.flipPrice!,
      tx: row.tx as Hex,
      at: row.at,
    }))
  return {
    fills,
    missingOrigins,
    complete:
      missingOrigins.length === 0 &&
      sync.some(
        (row) =>
          row.chainId === 10143 &&
          row.isReady &&
          row.startBlock <= startBlock &&
          row.progressBlock >= head,
      ),
  }
}

async function indexedFills(
  endpoint: string,
  market: Market,
  owner: Address,
  startBlock: bigint,
  head: bigint,
) {
  const rows: z.infer<typeof indexedFill>[] = []
  let offset = 0
  for (;;) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query PositionFills($market:String!,$owner:String!,$start:numeric!,$head:numeric!,$offset:Int!){ Fill(where:{market:{_eq:$market},maker:{_eq:$owner},block:{_gte:$start,_lte:$head}},order_by:[{block:asc},{id:asc}],limit:500,offset:$offset){id order_id price size isBuy originKnown isFlippedOrder flipPrice tx at block} _meta {chainId startBlock progressBlock isReady} }`,
        variables: {
          market: market.address.toLowerCase(),
          owner: owner.toLowerCase(),
          start: startBlock.toString(),
          head: head.toString(),
          offset,
        },
      }),
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) throw new Error('Indexer unavailable')
    const json = (await response.json()) as {
      data?: { Fill?: unknown; _meta?: unknown }
      errors?: unknown
    }
    if (json.errors || !json.data) throw new Error('Indexer query failed')
    const parsed = z.array(indexedFill).parse(json.data.Fill)
    rows.push(...parsed)
    if (parsed.length < 500) {
      return parseIndexedProjection(rows, json.data._meta, startBlock, head)
    }
    offset += parsed.length
  }
}

async function indexedSnapshotBlock(
  endpoint: string,
  head: bigint,
): Promise<bigint | null> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: '{ _meta { chainId startBlock progressBlock isReady } }',
    }),
    signal: AbortSignal.timeout(4000),
  })
  if (!response.ok) return null
  const json = (await response.json()) as {
    data?: { _meta?: unknown }
    errors?: unknown
  }
  if (json.errors || !json.data) return null
  const metadata = z
    .array(indexedMeta)
    .parse(json.data._meta)
    .find(
      (row) =>
        row.chainId === 10143 &&
        row.isReady &&
        row.startBlock <= MARKET_START_BLOCK,
    )
  if (
    !metadata ||
    metadata.progressBlock > head ||
    head - metadata.progressBlock > 199n
  )
    return null
  return metadata.progressBlock
}

async function indexedOrderIds(
  endpoint: string,
  market: Market,
  owner: Address,
  counter: number,
): Promise<number[]> {
  const ids: number[] = []
  let after = ''
  for (;;) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          'query($market:String!,$owner:String!,$after:String!){ Order(where:{market:{_eq:$market},owner:{_eq:$owner},id:{_gt:$after}},order_by:{id:asc},limit:500){ id orderId } }',
        variables: {
          market: market.address.toLowerCase(),
          owner: owner.toLowerCase(),
          after,
        },
      }),
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) throw new Error('Indexed order discovery unavailable')
    const body = (await response.json()) as {
      data?: { Order?: unknown }
      errors?: unknown
    }
    if (body.errors || !body.data)
      throw new Error('Indexed order discovery failed')
    const rows = z
      .array(
        z.object({
          id: z.string(),
          orderId: z.coerce.number().int().positive().max(counter),
        }),
      )
      .parse(body.data.Order)
    for (const row of rows) {
      if (row.id <= after)
        throw new Error('Indexed order cursor is inconsistent')
      ids.push(row.orderId)
      after = row.id
    }
    if (rows.length < 500) return ids
  }
}

type HistoryProjection = {
  fills: Fill[]
  missingOrigins: readonly (string | number)[]
  complete: boolean
  historyError?: string
}
export async function chooseHistory(
  indexed: (() => Promise<HistoryProjection>) | undefined,
  direct: () => Promise<HistoryProjection>,
) {
  if (indexed) {
    try {
      const projection = await indexed()
      if (projection.complete)
        return { ...projection, source: 'INDEXED' as const }
    } catch {
      /* A failed public indexer read switches to bounded actual logs. */
    }
  }
  try {
    return { ...(await direct()), source: 'INDEXER OFFLINE' as const }
  } catch {
    // Current balances and orders remain usable even when historical RPC logs are unavailable.
    return {
      fills: [],
      missingOrigins: [],
      complete: false,
      source: 'INDEXER OFFLINE' as const,
      historyError: 'Maker fill history unavailable. Actual chain balances and orders remain recoverable; fill counts and totals are unavailable.',
    }
  }
}

/** Chain-owned current orders are read even when all indexed/log history is unavailable. */
export function createPositionReader(
  client: PublicClient,
  market: Market,
  owner: Address,
  indexerUrl?: string,
) {
  if (
    market.address.toLowerCase() !==
      deployments.orderBook.address.toLowerCase() ||
    deployments.chainId !== 10143
  ) {
    throw new Error(
      'No receipt-backed deployment coverage is configured for this market.',
    )
  }
  let scanned = 0
  const owned = new Set<number>()
  const events = new Map<string, MarketEvent>()
  let coverageFrom: bigint | null = null
  let coverageTo: bigint | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const read = async (
    basis: RunBasis | null,
    latest: boolean,
  ): Promise<PositionRead> => {
    const head = await client.getBlockNumber({ cacheTime: 0 })
    // Reads and SDK valuation share the actual indexed cursor, never newer holdings with older fills.
    const synced =
      indexerUrl && !latest
        ? await indexedSnapshotBlock(indexerUrl, head).catch(() => null)
        : null
    const block = synced ?? head
    // Independent reads use the same pinned block and share one paced HTTP batch.
    const [counter, marginBaseRaw, marginQuoteRaw, walletBaseRaw, walletQuoteRaw, rawBook] = await Promise.all([
      client.readContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: 's_orderIdCounter',
        blockNumber: block,
      }),
      client.readContract({
        address: MARGIN,
        abi: kuruMarginAccountAbi,
        functionName: 'getBalance',
        args: [owner, market.baseToken],
        blockNumber: block,
      }),
      client.readContract({
        address: MARGIN,
        abi: kuruMarginAccountAbi,
        functionName: 'getBalance',
        args: [owner, market.quoteToken],
        blockNumber: block,
      }),
      client.getBalance({ address: owner, blockNumber: block }),
      client.readContract({
        address: market.quoteToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [owner],
        blockNumber: block,
      }),
      client.readContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: 'bestBidAsk',
        blockNumber: block,
      }),
    ])
    const rawOrders = new Map<number, ContractFunctionReturnType<typeof kuruOrderbookAbi, 'view', 's_orders'>>()
    const pricePoints = new Map<string, Set<number>>()
    const membership = async (price: number, isBuy: boolean) => {
      const key = `${isBuy}:${price}`
      const cached = pricePoints.get(key)
      if (cached) return cached
      const [pointHead] = await client.readContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: isBuy ? 's_buyPricePoints' : 's_sellPricePoints',
        args: [BigInt(price)],
        blockNumber: block,
      })
      const links = new Map<number, { next: number }>()
      for (let id = Number(pointHead); id !== 0;) {
        if (links.has(id)) throw new Error('Current order list has a cycle.')
        let raw = rawOrders.get(id)
        if (!raw) {
          raw = await client.readContract({
            address: market.address,
            abi: kuruOrderbookAbi,
            functionName: 's_orders',
            args: [id],
            blockNumber: block,
          })
          rawOrders.set(id, raw)
        }
        const order = { next: Number(raw[3]) }
        links.set(id, order)
        id = order.next
      }
      const live = reachableOrderIds(Number(pointHead), links)
      pricePoints.set(key, live)
      return live
    }
    const orders: ActiveOrder[] = []
    const readOrder = async (id: number) => {
      const raw = rawOrders.get(id) ?? await client.readContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: 's_orders',
        args: [id],
        blockNumber: block,
      })
      rawOrders.set(id, raw)
      if (raw[0].toLowerCase() !== owner.toLowerCase()) return
      owned.add(id)
      if (raw[1] === 0n || !(await membership(raw[5], raw[7])).has(id)) return
      orders.push({
        id,
        linked: Number(raw[4]),
        price: unitsToPrice(raw[5], market.params),
        flipPrice: unitsToPrice(raw[6], market.params),
        size: unitsToSize(raw[1], market.params),
        isBuy: raw[7],
        isFlip: raw[6] > 0,
      })
    }
    if (scanned > Number(counter)) scanned = Number(counter)
    const discovered =
      synced && indexerUrl
        ? await indexedOrderIds(
            indexerUrl,
            market,
            owner,
            Number(counter),
          ).catch(() => null)
        : null
    if (discovered) {
      for (const id of discovered) owned.add(id)
      scanned = Number(counter)
    }
    for (const id of owned) await readOrder(id)
    for (let id = scanned + 1; id <= Number(counter); id++) {
      await readOrder(id)
      scanned = id
    }
    let restingBase = 0
    let restingQuote = 0
    for (const order of orders) {
      if (order.isBuy) restingQuote += order.size * order.price
      else restingBase += order.size
    }
    const holdings = {
      marginBase: Number(
        formatUnits(marginBaseRaw, market.params.baseDecimals),
      ),
      marginQuote: Number(
        formatUnits(marginQuoteRaw, market.params.quoteDecimals),
      ),
      restingBase,
      restingQuote,
    }
    const walletBase = Number(formatUnits(walletBaseRaw, 18))
    const walletQuote = Number(
      formatUnits(walletQuoteRaw, market.params.quoteDecimals),
    )
    const book = bestBidAsk1e18(rawBook)
    const mid =
      book.bid !== null &&
      book.ask !== null &&
      book.bid > 0 &&
      book.ask >= book.bid
        ? (book.bid + book.ask) / 2
        : null
    const paused = mid === null || (book.ask! - book.bid!) / mid > 0.02
    const direct = async (): Promise<HistoryProjection> => {
      const start = block >= 199n ? block - 199n : 0n
      let from =
        coverageTo === null || coverageTo + 1n < start ? start : coverageTo + 1n
      if (coverageTo !== null && coverageTo + 1n < start) {
        coverageFrom = null
        events.clear()
      }
      if (coverageFrom === null) coverageFrom = from
      while (from <= block) {
        const to = from + 99n < block ? from + 99n : block
        const logs = await client.getLogs({
          address: market.address,
          fromBlock: from,
          toBlock: to,
        })
        const timestamps = new Map<bigint, number>()
        for (const log of logs) {
          let decoded
          try {
            decoded = decodeEventLog({
              abi: kuruOrderbookAbi,
              data: log.data,
              topics: log.topics,
            })
          } catch {
            continue
          }
          if (
            !['Trade', 'FlipOrderCreated', 'FlippedOrderCreated'].includes(
              decoded.eventName,
            )
          )
            continue
          const args = decoded.args as unknown as Record<string, unknown>
          if (
            String(args.owner ?? args.makerAddress).toLowerCase() !==
            owner.toLowerCase()
          )
            continue
          if (!timestamps.has(log.blockNumber))
            timestamps.set(
              log.blockNumber,
              Number(
                (await client.getBlock({ blockNumber: log.blockNumber }))
                  .timestamp,
              ),
            )
          events.set(`${log.transactionHash}:${log.logIndex}`, {
            kind: decoded.eventName,
            args,
            tx: log.transactionHash,
            at: timestamps.get(log.blockNumber)!,
            block: Number(log.blockNumber),
            index: log.logIndex,
          })
        }
        coverageTo = to
        from = to + 1n
      }
      const projection = projectMarketEvents(
        [...events.values()],
        market,
        owner,
        block,
      )
      return {
        ...projection,
        complete:
          basis !== null &&
          coverageFrom <= basis.startBlock &&
          coverageTo! >= block &&
          projection.missingOrigins.length === 0,
      }
    }
    const history = await chooseHistory(
      indexerUrl
        ? () =>
            indexedFills(
              indexerUrl,
              market,
              owner,
              basis?.startBlock ?? MARKET_START_BLOCK,
              block,
            )
        : undefined,
      direct,
    )
    let fills = history.fills
    const missingOrigins = history.missingOrigins.map((origin) =>
      typeof origin === 'number' ? origin : Number(origin.split(/[:_]/).at(-1)),
    )
    const complete = basis !== null && history.complete
    const source = history.source
    if (basis) fills = fills.filter((fill) => fill.at >= basis.openedAt)
    return {
      block,
      head,
      ...book,
      mid,
      paused,
      walletBase,
      walletQuote,
      holdings,
      marginBaseRaw,
      marginQuoteRaw,
      orders,
      fills,
      missingOrigins,
      complete,
      historyError: history.historyError,
      source,
      coverageFrom:
        source === 'INDEXED'
          ? (basis?.startBlock ?? MARKET_START_BLOCK)
          : coverageFrom!,
      valuation:
        complete && mid !== null
          ? scoreCard(fills, holdings, basis.deposit, mid)
          : null,
      observedAt: Date.now(),
    }
  }
  return (basis: RunBasis | null, latest = false) => {
    const pending = queue.catch(() => undefined).then(() => read(basis, latest))
    queue = pending
    return pending
  }
}
