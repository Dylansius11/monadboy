import { decodeEventLog, parseAbiItem, toEventSelector } from 'viem'
import type { Address, Hex } from 'viem'
import { mainnetMarkets } from '@monadboy/sdk'

// Live signature (not the docs page): price is uint256 at 1e18 scale, nothing indexed. [V] SPEC 2.
export const tradeEvent = parseAbiItem(
  'event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)',
)
const SELECTOR = toEventSelector(tradeEvent)

export type TradeRow = {
  market: Address
  block: number
  logIndex: number
  at: number
  maker: string
  price: number
  size: number
  tx: Hex
}
// Inclusive block range. Resolves to every Trade in range or rejects; never a partial answer.
export type TradeFetcher = {
  name: string
  fetch: (from: bigint, to: bigint) => Promise<TradeRow[]>
}

export type RawLog = {
  address: Address
  data: Hex
  topics: readonly Hex[]
  blockNumber: bigint | null
  logIndex: number | null
  transactionHash: Hex | null
}
export type RpcTradeClient = {
  getBlock: (request: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>
  getLogs: (request: {
    address: Address[]
    event: typeof tradeEvent
    fromBlock: bigint
    toBlock: bigint
  }) => Promise<readonly RawLog[]>
}

const addresses = mainnetMarkets.map((market) => market.address)

export function toRow(log: RawLog, timestampSeconds: number): TradeRow {
  if (
    log.blockNumber === null ||
    log.logIndex === null ||
    log.transactionHash === null
  )
    throw new Error('Unconfirmed trade log')
  const market = mainnetMarkets.find(
    (item) => item.address.toLowerCase() === log.address.toLowerCase(),
  )
  if (!market) throw new Error('Trade from an unconfigured market')
  const { args } = decodeEventLog({
    abi: [tradeEvent],
    data: log.data,
    topics: log.topics as [Hex, ...Hex[]],
  })
  return {
    market: market.address,
    block: Number(log.blockNumber),
    logIndex: log.logIndex,
    at: timestampSeconds * 1000,
    maker: args.makerAddress.toLowerCase(),
    price: Number(args.price) / 1e18,
    size: Number(args.filledSize) / Number(market.params.sizePrecision),
    tx: log.transactionHash,
  }
}

// Public RPC: getLogs is capped at 100 blocks [V]; one call covers all seven markets.
export function createRpcFetcher(client: RpcTradeClient): TradeFetcher {
  return {
    name: 'rpc-getlogs',
    fetch: async (from, to) => {
      const logs = await client.getLogs({
        address: addresses,
        event: tradeEvent,
        fromBlock: from,
        toBlock: to,
      })
      const stamps = new Map<bigint, number>()
      for (const log of logs)
        if (log.blockNumber !== null && !stamps.has(log.blockNumber))
          stamps.set(log.blockNumber, 0)
      await Promise.all(
        [...stamps.keys()].map(async (blockNumber) =>
          stamps.set(
            blockNumber,
            Number((await client.getBlock({ blockNumber })).timestamp),
          ),
        ),
      )
      return logs.map((log) =>
        toRow(log, stamps.get(log.blockNumber ?? -1n) ?? 0),
      )
    },
  }
}

// [V] Observed against a live token (2026-10-06): the request shape and response below work; pages hold
// about 1,100 Trade logs whatever `max_num_logs` says, a 24h window is ~15 pages, and each request costs
// 1000 of a 15000 / 60 s budget (headers `x-ratelimit-remaining`, `x-ratelimit-reset` in seconds). A 429
// is therefore expected during backfill: wait out the reset and retry the same page, never skip it.
// Quantities may arrive as numbers or 0x strings, and `data` as one batch or a list of batches.
const quantity = (value: unknown): number =>
  typeof value === 'string' ? Number(BigInt(value)) : Number(value)
type Batch = {
  blocks?: { number: unknown; timestamp: unknown }[]
  logs?: {
    address: Address
    block_number: unknown
    log_index: unknown
    transaction_hash: Hex
    data: Hex
    topic0: Hex
  }[]
}

const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_MAX_WAIT_MS = 65_000

export function createHypersyncFetcher({
  url,
  token,
  post = fetch,
  timeoutMs = 20_000,
  pause = (ms) => Bun.sleep(ms),
}: {
  url: string
  token: string
  post?: typeof fetch
  timeoutMs?: number
  pause?: (ms: number) => Promise<unknown>
}): TradeFetcher {
  return {
    name: 'hypersync',
    fetch: async (from, to) => {
      const rows: TradeRow[] = []
      let next = Number(from)
      while (next <= Number(to)) {
        let response: Response
        for (let attempt = 0; ; attempt++) {
          response = await post(`${url}/query`, {
            method: 'POST',
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            // to_block is exclusive.
            body: JSON.stringify({
              from_block: next,
              to_block: Number(to) + 1,
              logs: [{ address: addresses, topics: [[SELECTOR]] }],
              field_selection: {
                block: ['number', 'timestamp'],
                log: [
                  'address',
                  'block_number',
                  'log_index',
                  'transaction_hash',
                  'data',
                  'topic0',
                ],
              },
            }),
          })
          if (response.status !== 429 || attempt >= RATE_LIMIT_RETRIES) break
          const header = response.headers.get('x-ratelimit-reset')
          const reset = header === null ? Number.NaN : Number(header)
          await pause(
            Math.min(
              RATE_LIMIT_MAX_WAIT_MS,
              Number.isFinite(reset) && reset >= 0
                ? (reset + 1) * 1000
                : 10_000,
            ),
          )
        }
        if (!response.ok)
          throw new Error(`HyperSync responded ${response.status}`)
        const body = (await response.json()) as {
          next_block?: unknown
          data?: Batch | Batch[]
        }
        const advanced = quantity(body.next_block)
        if (!Number.isFinite(advanced) || advanced <= next)
          throw new Error('HyperSync did not advance')
        for (const batch of Array.isArray(body.data)
          ? body.data
          : body.data
            ? [body.data]
            : []) {
          const stamps = new Map(
            (batch.blocks ?? []).map((block) => [
              quantity(block.number),
              quantity(block.timestamp),
            ]),
          )
          for (const log of batch.logs ?? []) {
            const block = quantity(log.block_number)
            const timestamp = stamps.get(block)
            if (timestamp === undefined)
              throw new Error('HyperSync log without a block timestamp')
            rows.push(
              toRow(
                {
                  address: log.address,
                  data: log.data,
                  topics: [log.topic0],
                  blockNumber: BigInt(block),
                  logIndex: quantity(log.log_index),
                  transactionHash: log.transaction_hash,
                },
                timestamp,
              ),
            )
          }
        }
        next = advanced
      }
      return rows
    },
  }
}
