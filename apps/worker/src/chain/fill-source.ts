import type { Database } from 'bun:sqlite'
import { decodeEventLog, hexToString } from 'viem'
import type { Address, Hex, PublicClient } from 'viem'
import {
  diskRegistryAbi,
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
} from '@monadboy/sdk'
import type { Deposit, Fill, Holdings, Market } from '@monadboy/sdk'
import type { DiskFills, FillSnapshot, FillSource } from '../jobs/leaderboard'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'
import { readActiveOrder } from './active-order'

export type DirectFillSource = FillSource & {
  hydrate: (market: Market, owner: string, ids: ReadonlySet<number>, throughBlock: bigint) => Promise<Pick<DiskFills, 'tag' | 'deposit' | 'holdings'>>
}

type Stored = {
  kind:
    | 'Trade'
    | 'FlipOrderCreated'
    | 'FlippedOrderCreated'
    | 'Deposit'
    | 'Withdrawal'
  args: Record<string, string | boolean>
  tx: Hex
  at: number
}
type Ingest = { block: number; index: number; event: Stored }
const MARKET_EVENTS: Partial<Record<string, true>> = {
  Trade: true,
  FlipOrderCreated: true,
  FlippedOrderCreated: true,
}
const MARGIN_EVENTS: Partial<Record<string, true>> = { Deposit: true, Withdrawal: true }
const json = (value: unknown) =>
  JSON.stringify(value, (_, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  )

// Direct-log FillSource for the testnet market. Public RPC caps getLogs at 100 blocks [V], so
// history is read forward from `startBlock` in bounded chunk groups and cached; until the
// head is reached the snapshot is `partial`, which the leaderboard never turns into totals.
export function createDirectFillSource({
  db,
  client,
  markets,
  margin,
  registry,
  startBlock,
  chunkBlocks = 100n,
  concurrency = 4,
  groupsPerRun = 8,
  now = Date.now,
  logger = log,
}: {
  db: Database
  client: PublicClient
  markets: readonly Market[]
  margin: Address
  registry?: Address
  startBlock?: bigint
  chunkBlocks?: bigint
  concurrency?: number
  groupsPerRun?: number
  now?: () => number
  logger?: Logger
}): DirectFillSource {
  async function ingest(market: Market, head: bigint): Promise<boolean> {
    const saved = db
      .query<{ next_block: number }, [string]>(
        'SELECT next_block FROM fill_cursors WHERE market = ?',
      )
      .get(market.address)
    let next = saved ? BigInt(saved.next_block) : startBlock!
    const tokens = new Set([
      market.baseToken.toLowerCase(),
      market.quoteToken.toLowerCase(),
    ])
    for (let group = 0; group < groupsPerRun && next <= head; group++) {
      const ranges: [bigint, bigint][] = []
      for (
        let from = next;
        from <= head && ranges.length < concurrency;
        from += chunkBlocks
      )
        ranges.push([
          from,
          from + chunkBlocks - 1n < head ? from + chunkBlocks - 1n : head,
        ])
      const chunks = await Promise.all(
        ranges.map(([fromBlock, toBlock]) =>
          client.getLogs({
            address: [market.address, margin],
            fromBlock,
            toBlock,
          }),
        ),
      )
      const found: Ingest[] = []
      const stamps = new Map<bigint, number>()
      for (const entry of chunks.flat()) {
        const fromMargin = entry.address.toLowerCase() === margin.toLowerCase()
        const payload = { data: entry.data, topics: entry.topics }
        let decoded
        try {
          decoded = fromMargin
            ? decodeEventLog({ abi: kuruMarginAccountAbi, ...payload })
            : decodeEventLog({ abi: kuruOrderbookAbi, ...payload })
        } catch {
          continue
        }
        const kind: string = decoded.eventName
        if (!(fromMargin ? MARGIN_EVENTS : MARKET_EVENTS)[kind]) continue
        const args = JSON.parse(json(decoded.args)) as Stored['args']
        if (fromMargin && !tokens.has(String(args.token).toLowerCase()))
          continue
        stamps.set(entry.blockNumber, 0)
        found.push({
          block: Number(entry.blockNumber),
          index: entry.logIndex,
          event: {
            kind: kind as Stored['kind'],
            args,
            tx: entry.transactionHash,
            at: 0,
          },
        })
      }
      await Promise.all(
        [...stamps.keys()].map(async (blockNumber) =>
          stamps.set(
            blockNumber,
            Number((await client.getBlock({ blockNumber })).timestamp) * 1000,
          ),
        ),
      )
      const last = ranges.at(-1)![1]
      db.transaction(() => {
        for (const { block, index, event } of found) {
          const at = stamps.get(BigInt(block)) ?? 0
          db.query(
            'INSERT OR IGNORE INTO fill_events (market, block, log_index, at, json) VALUES (?, ?, ?, ?, ?)',
          ).run(market.address, block, index, at, json({ ...event, at }))
        }
        db.query(
          'INSERT OR REPLACE INTO fill_cursors (market, next_block) VALUES (?, ?)',
        ).run(market.address, Number(last + 1n))
      })()
      next = last + 1n
    }
    return next > head
  }

  async function tag(disk: Address): Promise<string | null> {
    if (!registry) return null
    try {
      const record = await client.readContract({
        address: registry,
        abi: diskRegistryAbi,
        functionName: 'diskOf',
        args: [disk],
      })
      return record.createdAt === 0n
        ? null
        : hexToString(record.tag).replace(/\0+$/, '') || null
    } catch {
      return null
    }
  }

  async function holdings(
    market: Market,
    owner: Address,
    ids: ReadonlySet<number>,
    blockNumber: bigint,
  ): Promise<Holdings> {
    const p = market.params
    const balance = async (token: Address, decimals: number) =>
      Number(
        await client.readContract({
          address: margin,
          abi: kuruMarginAccountAbi,
          functionName: 'getBalance',
          args: [owner, token],
          blockNumber,
        }),
      ) /
      10 ** decimals
    // Started together so the batched client folds them into shared Multicall3 calls.
    const [orders, marginBase, marginQuote] = await Promise.all([
      Promise.all([...ids].map((id) => readActiveOrder(client, market.address, id, blockNumber))),
      balance(market.baseToken, p.baseDecimals),
      balance(market.quoteToken, p.quoteDecimals),
    ])
    let restingBase = 0
    let restingQuote = 0
    for (const order of orders) {
      if (!order || order[0].toLowerCase() !== owner.toLowerCase())
        continue
      const size = Number(order[1]) / Number(p.sizePrecision)
      if (order[7]) restingQuote += size * (order[5] / Number(p.pricePrecision))
      else restingBase += size
    }
    return { marginBase, marginQuote, restingBase, restingQuote }
  }

  function assemble(
    market: Market,
    throughBlock: bigint,
  ): Map<string, DiskFills & { ids: Set<number> }> {
    const p = market.params
    const scale = Number(p.pricePrecision)
    const orders = new Map<
      string,
      { flipPrice: number; isFlipped: boolean; owner: string }
    >()
    const disks = new Map<string, DiskFills & { ids: Set<number> }>()
    const rows = db
      .query<{ json: string }, [string, bigint]>(
        'SELECT json FROM fill_events WHERE market = ? AND block <= ? ORDER BY block, log_index',
      )
      .all(market.address, throughBlock)
    for (const { json: text } of rows) {
      const event = JSON.parse(text) as Stored
      if (
        event.kind === 'FlipOrderCreated' ||
        event.kind === 'FlippedOrderCreated'
      ) {
        const owner = String(event.args.owner).toLowerCase()
        orders.set(String(event.args.orderId), {
          flipPrice: Number(event.args.flippedPrice) / scale,
          isFlipped: event.kind === 'FlippedOrderCreated',
          owner,
        })
        const disk = disks.get(owner) ?? {
          disk: owner,
          market: market.symbol,
          tag: null,
          characterId: null,
          openedAt: event.at,
          low: null,
          high: null,
          fills: [],
          holdings: null,
          deposit: null,
          ids: new Set<number>(),
        }
        disks.set(owner, disk)
        const prices = [
          Number(event.args.price) / scale,
          Number(event.args.flippedPrice) / scale,
        ]
        disk.low = Math.min(disk.low ?? Infinity, ...prices)
        disk.high = Math.max(disk.high ?? 0, ...prices)
        disk.ids
          .add(Number(event.args.orderId))
          .add(Number(event.args.flippedId))
      } else if (event.kind === 'Trade') {
        const order = orders.get(String(event.args.orderId))
        if (!order) continue
        const fill: Fill = {
          orderId: BigInt(String(event.args.orderId)),
          flipPrice: order.flipPrice,
          isFlippedOrder: order.isFlipped,
          // Trade.isBuy is the taker's side; SDK fills describe the maker's inventory.
          isBuy: !event.args.isBuy,
          price: Number(event.args.price) / 1e18,
          size: Number(event.args.filledSize) / Number(p.sizePrecision),
          tx: event.tx,
          at: event.at,
        }
        disks.get(order.owner)!.fills.push(fill)
      }
    }
    return disks
  }

  function netDeposit(market: Market, owner: string, throughBlock: bigint): Deposit {
    const totals = { base: 0, quote: 0 }
    for (const { json: text } of db
      .query<{ json: string }, [string, bigint]>(
        "SELECT json FROM fill_events WHERE market = ? AND block <= ? AND json_extract(json, '$.kind') IN ('Deposit', 'Withdrawal')",
      )
      .all(market.address, throughBlock)) {
      const event = JSON.parse(text) as Stored
      if (String(event.args.owner).toLowerCase() !== owner) continue
      const token = String(event.args.token).toLowerCase()
      const sign = event.kind === 'Deposit' ? 1 : -1
      if (token === market.baseToken.toLowerCase())
        totals.base +=
          (sign * Number(event.args.amount)) / 10 ** market.params.baseDecimals
      else if (token === market.quoteToken.toLowerCase())
        totals.quote +=
          (sign * Number(event.args.amount)) / 10 ** market.params.quoteDecimals
    }
    // A swap can withdraw more of one token than was deposited. Preserve signed
    // cash flows or a fully exited position acquires phantom HODL-relative DAMAGE.
    return { base0: totals.base, quote0: totals.quote }
  }

  return {
    hydrate: async (market, owner, ids, throughBlock) => ({
      tag: await tag(owner as Address),
      deposit: netDeposit(market, owner, throughBlock),
      holdings: await holdings(market, owner as Address, ids, throughBlock),
    }),
    read: async (throughBlock?: bigint): Promise<FillSnapshot> => {
      if (!markets.length)
        return { status: 'no-market-configured', at: now(), disks: [] }
      if (startBlock === undefined)
        return { status: 'unavailable', at: now(), disks: [] }
      try {
        const head = throughBlock ?? await client.getBlockNumber({ cacheTime: 0 })
        let complete = true
        const disks: DiskFills[] = []
        for (const market of markets) {
          complete = (await ingest(market, head)) && complete
          const assembled = [...assemble(market, head).values()]
          disks.push(...await Promise.all(assembled.map(async ({ ids, ...disk }) => ({
            ...disk,
            tag: await tag(disk.disk as Address),
            deposit: netDeposit(market, disk.disk, head),
            holdings: await holdings(market, disk.disk as Address, ids, head).catch(
              () => null,
            ),
          }))))
        }
        return { status: complete ? 'complete' : 'partial', at: now(), disks }
      } catch (error) {
        logger('leaderboard.fills-unavailable', { error: describeError(error) })
        return { status: 'unavailable', at: now(), disks: [] }
      }
    },
  }
}
