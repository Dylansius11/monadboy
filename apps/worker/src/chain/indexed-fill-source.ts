import { z } from 'zod'
import type { Hex, PublicClient } from 'viem'
import type { Fill, Market } from '@monadboy/sdk'
import type { DirectFillSource } from './fill-source'
import type {
  DiskFills,
  FillSnapshot,
  FillSource,
  IndexerObservation,
} from '../jobs/leaderboard'
import { describeError } from '../logger'

const numeric = z
  .union([z.number(), z.string()])
  .transform(Number)
  .refine(Number.isFinite)
const address = z.string().regex(/^0x[\da-f]{40}$/i)
const fillSchema = z.object({
  id: z.string().min(1),
  market: address,
  maker: address,
  taker: address,
  order_id: z.string().min(1),
  price: numeric.refine((n) => n > 0),
  size: numeric.refine((n) => n >= 0),
  isBuy: z.boolean(),
  originKnown: z.boolean(),
  isFlippedOrder: z.boolean(),
  flipPrice: numeric.nullable(),
  block: z.union([z.string(), z.number()]).transform(BigInt),
  at: numeric.refine((n) => Number.isSafeInteger(n) && n >= 0),
  tx: z.string().regex(/^0x[\da-f]{64}$/i),
})
const fields =
  'id market maker taker order_id price size isBuy originKnown isFlippedOrder flipPrice block tx at'
const metaQuery = '{ _meta { chainId startBlock progressBlock isReady } }'
const terminalQuery = `query($market:String!,$through:numeric!){ Fill(where:{market:{_eq:$market},block:{_lte:$through}},order_by:{id:desc},limit:1){ ${fields} } }`
const pageQuery = `query($market:String!,$through:numeric!,$after:String!,$limit:Int!){ Fill(where:{market:{_eq:$market},block:{_lte:$through},id:{_gt:$after}},order_by:{id:asc},limit:$limit){ ${fields} } }`
const ordersQuery =
  'query($market:String!,$owner:String!,$after:String!,$limit:Int!){ Order(where:{market:{_eq:$market},owner:{_eq:$owner},id:{_gt:$after}},order_by:{id:asc},limit:$limit){ id orderId } }'
const MAX_PAGES = 1000

// Public read model only. The frozen _meta cursor binds indexed fills to direct basis
// and chain holdings. A ready cursor may lag the head by200blocks; it need not outrun it.
export function createIndexedFillSource({
  url,
  client,
  markets,
  startBlock,
  direct,
  fetcher = fetch,
  pageSize = 500,
  now = Date.now,
}: {
  url?: string
  client: PublicClient
  markets: readonly Market[]
  startBlock?: bigint
  direct: FillSource & Partial<Pick<DirectFillSource, 'hydrate'>>
  fetcher?: typeof fetch
  pageSize?: number
  now?: () => number
}): FillSource & { state: IndexerObservation } {
  const state: IndexerObservation = {
    status: url ? 'offline' : 'not-configured',
    checkedAt: null,
    throughBlock: null,
    headBlock: null,
    lagBlocks: null,
    lastError: url ? 'not-yet-observed' : null,
  }
  async function query(text: string, variables?: Record<string, unknown>) {
    const response = await fetcher(url!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, variables }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`Indexer HTTP ${response.status}`)
    const body = (await response.json()) as {
      data?: Record<string, unknown>
      errors?: unknown[]
    }
    if (body.errors?.length || !body.data)
      throw new Error('Indexer GraphQL response unavailable')
    return body.data
  }
  return {
    state,
    read: async (): Promise<FillSnapshot> => {
      if (!url) {
        const snapshot = await direct.read()
        return { ...snapshot, source: 'direct-logs', indexer: { ...state } }
      }
      try {
        if (startBlock === undefined)
          throw new Error('Indexer start coverage unknown')
        const head = await client.getBlockNumber({ cacheTime: 0 })
        const result = await query(metaQuery)
        const metas = z
          .array(
            z.object({
              chainId: z.number(),
              startBlock: z.number().int(),
              progressBlock: z.number().int(),
              isReady: z.boolean(),
            }),
          )
          .parse(result._meta)
        const meta = metas.find((entry) => entry.chainId === 10143)
        if (
          !meta?.isReady ||
          BigInt(meta.startBlock) > startBlock ||
          BigInt(meta.progressBlock) < startBlock
        )
          throw new Error('Indexer chain/start coverage unavailable')
        const through = BigInt(meta.progressBlock)
        const lag = head - through
        if (lag > 200n || lag < 0n)
          throw new Error(`Indexer cursor outside live coverage: ${lag} blocks`)
        Object.assign(state, {
          checkedAt: now(),
          throughBlock: meta.progressBlock,
          headBlock: Number(head),
          lagBlocks: Number(lag),
        })
        const all = []
        for (const market of markets) {
          const variables = {
            market: market.address.toLowerCase(),
            through: through.toString(),
          }
          const terminalRows = z
            .array(fillSchema)
            .parse((await query(terminalQuery, variables)).Fill)
          if (terminalRows.length > 1)
            throw new Error('Indexer terminal response invalid')
          const terminal = terminalRows[0]?.id ?? ''
          let after = ''
          let reachedTerminal = terminal === ''
          for (let page = 0; !reachedTerminal && page < MAX_PAGES; page++) {
            const rows = z
              .array(fillSchema)
              .parse(
                (
                  await query(pageQuery, {
                    ...variables,
                    after,
                    limit: pageSize,
                  })
                ).Fill,
              )
            if (!rows.length)
              throw new Error('Indexer page ended before frozen terminal')
            for (const row of rows) {
              if (
                row.id <= after ||
                row.id > terminal ||
                row.market.toLowerCase() !== variables.market ||
                row.block > through ||
                row.block < startBlock
              )
                throw new Error('Indexer page cursor/coverage inconsistent')
              if (
                !row.originKnown ||
                row.flipPrice === null ||
                row.flipPrice < 0 ||
                (row.isFlippedOrder && row.flipPrice === 0)
              )
                throw new Error('Indexer order origin unavailable')
              const prefix = `${variables.market}_`
              if (
                !row.order_id.startsWith(prefix) ||
                !/^\d+$/.test(row.order_id.slice(prefix.length))
              )
                throw new Error('Indexer order identity unavailable')
              all.push({
                market,
                maker: row.maker.toLowerCase(),
                fill: {
                  orderId: BigInt(row.order_id.slice(prefix.length)),
                  price: row.price,
                  size: row.size,
                  isBuy: row.isBuy,
                  isFlippedOrder: row.isFlippedOrder,
                  flipPrice: row.flipPrice,
                  tx: row.tx as Hex,
                  at: row.at * 1000,
                } satisfies Fill,
              })
              after = row.id
            }
            reachedTerminal = after === terminal
          }
          if (!reachedTerminal)
            throw new Error('Indexer pagination did not reach frozen terminal')
        }
        const basis = await direct.read(through)
        const disks = new Map<string, DiskFills>()
        for (const disk of basis.disks)
          disks.set(`${disk.market}:${disk.disk.toLowerCase()}`, {
            ...disk,
            fills: [],
          })
        for (const entry of all) {
          const key = `${entry.market.symbol}:${entry.maker}`
          if (!disks.has(key)) {
            if (!direct.hydrate || basis.status !== 'complete')
              throw new Error('Indexer maker basis coverage unavailable')
            const ids = new Set<number>()
            let after = ''
            let done = false
            for (let page = 0; !done && page < MAX_PAGES; page++) {
              const rows = z
                .array(
                  z.object({
                    id: z.string(),
                    orderId: z
                      .union([z.string(), z.number()])
                      .transform(Number)
                      .refine(Number.isSafeInteger),
                  }),
                )
                .parse(
                  (
                    await query(ordersQuery, {
                      market: entry.market.address.toLowerCase(),
                      owner: entry.maker,
                      after,
                      limit: pageSize,
                    })
                  ).Order,
                )
              for (const row of rows) {
                if (row.id <= after)
                  throw new Error('Indexer order page cursor inconsistent')
                ids.add(row.orderId)
                after = row.id
              }
              done = rows.length < pageSize
            }
            if (!done || !ids.has(Number(entry.fill.orderId)))
              throw new Error('Indexer maker order coverage unavailable')
            const hydrated = await direct.hydrate(
              entry.market,
              entry.maker,
              ids,
              through,
            )
            disks.set(key, {
              disk: entry.maker,
              market: entry.market.symbol,
              characterId: null,
              openedAt: entry.fill.at,
              low: null,
              high: null,
              fills: [],
              ...hydrated,
            })
          }
          disks.get(key)!.fills.push(entry.fill)
        }
        for (const disk of disks.values())
          disk.fills.sort((a, b) => a.at - b.at)
        Object.assign(state, { status: 'live', lastError: null })
        return {
          status: basis.status,
          at: now(),
          disks: [...disks.values()],
          source: 'envio',
          indexer: { ...state },
        }
      } catch (cause) {
        Object.assign(state, {
          status: 'offline',
          checkedAt: now(),
          lastError: describeError(cause),
        })
        const snapshot = await direct.read()
        return { ...snapshot, source: 'direct-logs', indexer: { ...state } }
      }
    },
  }
}
