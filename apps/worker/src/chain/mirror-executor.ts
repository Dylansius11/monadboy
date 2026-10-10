import type { Database } from 'bun:sqlite'
import { decodeEventLog } from 'viem'
import type { Address, Hex, PublicClient } from 'viem'
import {
  bestBidAsk1e18,
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  priceToUnits,
  quoteToUnits,
  readMarketParams,
  sizeToUnits,
} from '@monadboy/sdk'
import type { Market, MarketParams } from '@monadboy/sdk'
import type { MirrorAction, MirrorExecutor } from '../jobs/mirror'
import type { Treasury } from './treasury'
import { readActiveOrder } from './active-order'
import type { GasBudget } from './gas-budget'

// Resting quotes sit 0.1% either side of the mainnet target (SPEC 5.2).
export const QUOTE_OFFSET = 0.001

export type MirrorGas = { marketOrder: bigint; batchUpdate: bigint }

// S2 proved margin input/output and book-scaled quote input. Simulate and estimate each
// shape before signing: a passive refresh can cross a still-resting third-party bid/ask.
export function createMirrorExecutor({
  db,
  client,
  treasury,
  market,
  margin,
  gas,
  budget,
  assertActive,
}: {
  db: Database
  client: PublicClient
  treasury: Treasury
  market: Market
  margin: Address
  gas: MirrorGas
  budget?: GasBudget
  assertActive?: () => void
}): MirrorExecutor {
  let params: MarketParams | undefined
  const read = async () =>
    (params ??= await readMarketParams(client, market.address))
  const bot = treasury.account.address
  const balance = async (token: Address, decimals: number, blockNumber?: bigint) =>
    Number(
      await client.readContract({
        address: margin,
        abi: kuruMarginAccountAbi,
        functionName: 'getBalance',
        args: [bot, token],
        blockNumber,
      }),
    ) /
    10 ** decimals

  async function sendChecked(
    request: {
      address: Address
      abi: typeof kuruOrderbookAbi
      functionName: 'batchUpdate' | 'batchCancelOrders' | 'placeAndExecuteMarketBuy' | 'placeAndExecuteMarketSell'
      args: readonly [readonly number[]] | readonly [readonly number[], readonly bigint[], readonly number[], readonly bigint[], readonly number[], boolean] | readonly [bigint, bigint, boolean, boolean]
    },
    ceiling: bigint,
    assertSource?: () => void | Promise<void>,
  ) {
    // The bounded RPC estimator avoids the native-payout anomaly observed in S2.
    const call = { ...request, account: treasury.account } as Parameters<typeof client.estimateContractGas>[0]
    await client.simulateContract(call)
    const estimate = await client.estimateContractGas({ ...call, gas: ceiling })
    const limit = (estimate * 120n + 99n) / 100n
    if (limit > ceiling) throw new Error(`Mirror gas budget exceeded: ${limit} > ${ceiling}`)
    return treasury.send(async (nonce) => {
      // Queue spacing/nonces may await: revalidate immediately before a new trade/quote.
      // Cancellation has no source guard because recovering owned resting funds is safe.
      assertActive?.()
      await assertSource?.()
      const fees = budget ? await client.estimateFeesPerGas({ chain: undefined, type: 'eip1559' }) : undefined
      if (fees) await assertSource?.()
      assertActive?.()
      const reservation = fees && budget ? budget.reserve(limit, fees.maxFeePerGas) : null
      const hash = await treasury.wallet.writeContract({
        ...request, gas: limit, nonce,
        ...(fees ? { maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas } : {}),
      })
      if (reservation !== null) budget!.record(reservation, hash)
      return hash
    })
  }

  async function cancelOwnedQuotes(): Promise<Hex | undefined> {
    const ids: number[] = []
    const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
    for (const row of db.query<{ order_id: string }, [string]>(
      'SELECT order_id FROM mirror_quotes WHERE market = ?',
    ).all(market.address)) {
      const order = await readActiveOrder(client, market.address, Number(row.order_id), blockNumber)
      if (order && order[0].toLowerCase() === bot.toLowerCase())
        ids.push(Number(row.order_id))
    }
    let hash: Hex | undefined
    if (ids.length) {
      hash = (await sendChecked({
        address: market.address, abi: kuruOrderbookAbi,
        functionName: 'batchCancelOrders', args: [ids],
      }, gas.batchUpdate)).hash
    }
    // Remove rows only after confirmed cancellation (or confirmed already-filled orders).
    db.query('DELETE FROM mirror_quotes WHERE market = ?').run(market.address)
    return hash
  }

  async function refreshQuotes(
    p: MarketParams,
    targetMid: number,
    quoteNotional: number,
    assertSource: () => void | Promise<void>,
  ): Promise<Hex | undefined> {
    const bid = priceToUnits(targetMid * (1 - QUOTE_OFFSET), p, 'down')
    const ask = priceToUnits(targetMid * (1 + QUOTE_OFFSET), p, 'up')
    // Owned quotes were canceled before any take. These are post-take FREE balances,
    // not wallet funds or a second count of formerly locked resting inventory.
    const availableBase = await balance(market.baseToken, p.baseDecimals)
    const availableQuote = await balance(market.quoteToken, p.quoteDecimals)
    const askPrice = Number(ask) / Number(p.pricePrecision)
    const bidPrice = Number(bid) / Number(p.pricePrecision)
    const size = sizeToUnits(Math.min(quoteNotional / askPrice, availableBase, availableQuote / bidPrice), p)
    if (size < p.minSize || size > p.maxSize || bid <= 0 || ask <= bid)
      return undefined
    const { hash } = await sendChecked({
      address: market.address,
      abi: kuruOrderbookAbi,
      functionName: 'batchUpdate',
      args: [[bid], [size], [ask], [size], [], true],
    }, gas.batchUpdate, assertSource)
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
    assertSource: () => void | Promise<void>,
  ): Promise<Hex | undefined> {
    await assertSource()
    const { bid, ask } = bestBidAsk1e18(await client.readContract({
      address: market.address, abi: kuruOrderbookAbi, functionName: 'bestBidAsk',
    }))
    // With every owned quote gone, only an external side at/toward target can execute.
    if (action.kind === 'buy' ? ask === null || ask > targetMid : bid === null || bid < targetMid)
      return undefined
    const send = (
      functionName: 'placeAndExecuteMarketBuy' | 'placeAndExecuteMarketSell',
      amount: bigint,
    ) =>
      sendChecked({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName,
        args: [amount, 0n, true, false],
      }, gas.marketOrder, assertSource)
    if (action.kind === 'buy')
      return (
        await send(
          'placeAndExecuteMarketBuy',
          quoteToUnits(action.notional, p),
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
      const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
      let base = await balance(market.baseToken, p.baseDecimals, blockNumber)
      let quote = await balance(market.quoteToken, p.quoteDecimals, blockNumber)
      // Decision inventory includes funds that execute() will release by canceling
      // owned quotes. A filled storage row or someone else's order is not inventory.
      for (const row of db.query<{ order_id: string }, [string]>(
        'SELECT order_id FROM mirror_quotes WHERE market = ?',
      ).all(market.address)) {
        const order = await readActiveOrder(client, market.address, Number(row.order_id), blockNumber)
        if (!order || order[0].toLowerCase() !== bot.toLowerCase()) continue
        const size = Number(order[1]) / Number(p.sizePrecision)
        if (order[7]) quote += size * (order[5] / Number(p.pricePrecision))
        else base += size
      }
      return { base, quote }
    },
    execute: async (action, targetMid, assertSource) => {
      const p = await read()
      const hashes: Hex[] = []
      try {
        if (budget) {
          const fees = await client.estimateFeesPerGas({ chain: undefined, type: 'eip1559' })
          // Keep room for cancel + take + replacement before removing liquidity.
          budget.assertRoom((2n * gas.batchUpdate + gas.marketOrder) * fees.maxFeePerGas)
        }
        const canceled = await cancelOwnedQuotes()
        if (canceled) hashes.push(canceled)
        if (action.kind === 'buy' || action.kind === 'sell') {
          const taken = await take(p, action, targetMid, assertSource)
          if (taken) hashes.push(taken)
        }
        const quoted = await refreshQuotes(p, targetMid, action.quoteNotional, assertSource)
        if (quoted) hashes.push(quoted)
        return hashes
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { hashes })
      }
    },
  }
}
