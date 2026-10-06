import type { Database } from 'bun:sqlite'
import { decodeEventLog, parseUnits } from 'viem'
import type { Address, Hex, PublicClient } from 'viem'
import {
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  priceToUnits,
  readMarketParams,
  sizeToUnits,
} from '@monadboy/sdk'
import type { Market, MarketParams } from '@monadboy/sdk'
import type { MirrorAction, MirrorExecutor } from '../jobs/mirror'
import type { Treasury } from './treasury'

// Resting quotes sit 0.1% either side of the mainnet target (SPEC 5.2).
export const QUOTE_OFFSET = 0.001

export type MirrorGas = { marketOrder: bigint; batchUpdate: bigint }

// Every call is state-changing and carries an explicit gas limit: Monad charges the limit.
// [U, S2] isMargin semantics, the market-buy quote-size unit and post-only batchUpdate are
// pinned only against the ABI until spike S2 exercises them on our deployed market.
export function createMirrorExecutor({
  db,
  client,
  treasury,
  market,
  margin,
  gas,
}: {
  db: Database
  client: PublicClient
  treasury: Treasury
  market: Market
  margin: Address
  gas: MirrorGas
}): MirrorExecutor {
  let params: MarketParams | undefined
  const read = async () =>
    (params ??= await readMarketParams(client, market.address))
  const bot = treasury.account.address
  const balance = async (token: Address, decimals: number) =>
    Number(
      await client.readContract({
        address: margin,
        abi: kuruMarginAccountAbi,
        functionName: 'getBalance',
        args: [bot, token],
      }),
    ) /
    10 ** decimals

  async function refreshQuotes(
    p: MarketParams,
    targetMid: number,
    quoteNotional: number,
  ): Promise<Hex | undefined> {
    const bid = priceToUnits(targetMid * (1 - QUOTE_OFFSET), p, 'down')
    const ask = priceToUnits(targetMid * (1 + QUOTE_OFFSET), p, 'up')
    const size = sizeToUnits(quoteNotional / targetMid, p)
    if (size < p.minSize || size > p.maxSize || bid <= 0 || ask <= bid)
      return undefined
    const resting = db
      .query<{ order_id: string }, [string]>(
        'SELECT order_id FROM mirror_quotes WHERE market = ?',
      )
      .all(market.address)
    const cancel: number[] = []
    for (const { order_id } of resting) {
      const order = await client.readContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: 's_orders',
        args: [Number(order_id)],
      })
      if (order[1] > 0n) cancel.push(Number(order_id))
    }
    const { hash } = await treasury.send((nonce) =>
      treasury.wallet.writeContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: 'batchUpdate',
        args: [[bid], [size], [ask], [size], cancel, true],
        gas: gas.batchUpdate,
        nonce,
      }),
    )
    const receipt = await client.getTransactionReceipt({ hash })
    const created: string[] = []
    for (const entry of receipt.logs) {
      if (entry.address.toLowerCase() !== market.address.toLowerCase()) continue
      try {
        const event = decodeEventLog({
          abi: kuruOrderbookAbi,
          data: entry.data,
          topics: entry.topics,
        })
        if (event.eventName === 'OrderCreated')
          created.push(String(event.args.orderId))
      } catch {
        continue
      }
    }
    db.transaction(() => {
      db.query('DELETE FROM mirror_quotes WHERE market = ?').run(market.address)
      for (const id of created)
        db.query(
          'INSERT INTO mirror_quotes (market, order_id) VALUES (?, ?)',
        ).run(market.address, id)
    })()
    return hash
  }

  async function take(
    p: MarketParams,
    action: MirrorAction,
    targetMid: number,
  ): Promise<Hex | undefined> {
    const send = (
      functionName: 'placeAndExecuteMarketBuy' | 'placeAndExecuteMarketSell',
      amount: bigint,
    ) =>
      treasury.send((nonce) =>
        treasury.wallet.writeContract({
          address: market.address,
          abi: kuruOrderbookAbi,
          functionName,
          args: [amount, 0n, true, false],
          gas: gas.marketOrder,
          nonce,
        }),
      )
    if (action.kind === 'buy')
      return (
        await send(
          'placeAndExecuteMarketBuy',
          parseUnits(action.notional.toFixed(p.quoteDecimals), p.quoteDecimals),
        )
      ).hash
    const size = sizeToUnits(action.notional / targetMid, p)
    return size >= p.minSize && size <= p.maxSize
      ? (await send('placeAndExecuteMarketSell', size)).hash
      : undefined
  }

  return {
    inventory: async () => {
      const p = await read()
      return {
        base: await balance(market.baseToken, p.baseDecimals),
        quote: await balance(market.quoteToken, p.quoteDecimals),
      }
    },
    execute: async (action, targetMid) => {
      const p = await read()
      const hashes: Hex[] = []
      if (action.kind === 'buy' || action.kind === 'sell') {
        const taken = await take(p, action, targetMid)
        if (taken) hashes.push(taken)
      }
      const quoted = await refreshQuotes(p, targetMid, action.quoteNotional)
      if (quoted) hashes.push(quoted)
      return hashes
    },
  }
}
