import type { Database } from 'bun:sqlite'
import { decodeEventLog } from 'viem'
import type { Address, Hex, PublicClient } from 'viem'
import {
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  quoteToUnits,
  readMarketParams,
  sizeToUnits,
} from '@monadboy/sdk'
import type { Market, MarketParams } from '@monadboy/sdk'
import type { MirrorExecutor, MirrorOutcome } from '../jobs/mirror'
import type { Treasury } from './treasury'
import { readActiveOrder } from './active-order'
import type { GasBudget } from './gas-budget'
import { decodeL2Units } from './l2-book'
import { MIRROR_LEVELS, MIRROR_TAKE_LEVELS, planMirrorLadder, planTake } from './mirror-ladder'
import type { LadderPlan, OwnOrder } from './mirror-ladder'
import type { L2Units } from './l2-book'

type MirrorView = {
  p: MarketParams
  free: { base: number; quote: number }
  own: OwnOrder[]
  book: L2Units
}

export type MirrorGas = { marketOrder: bigint; batchUpdate: bigint }

// Declared gas limit as a percentage of a fresh estimate (see sendChecked).
const GAS_HEADROOM_PERCENT = 110n

// Refused before any reservation or signature: nothing was sent.
class GasCeilingError extends Error {}

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
  sideNotional,
  maxTakeNotional,
  deadband = 0,
}: {
  db: Database
  client: PublicClient
  treasury: Treasury
  market: Market
  margin: Address
  gas: MirrorGas
  budget?: GasBudget
  assertActive?: () => void
  // Quote units (AUSD) each side of the ladder aims to hold, bounded by inventory.
  sideNotional: number
  // Quote units (AUSD) one tick may take from other makers on the wrong side of the target.
  maxTakeNotional: number
  // Fraction the target must move from the last signed ladder before the next one is signed.
  // Fills that leave a side with fewer than half its rungs are replenished regardless.
  deadband?: number
}): MirrorExecutor {
  let center: number | null = null
  let params: MarketParams | undefined
  const read = async () =>
    (params ??= await readMarketParams(client, market.address))
  const bot = treasury.account.address
  const balance = async (token: Address, decimals: number, blockNumber: bigint) =>
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
      functionName: 'batchUpdate' | 'placeAndExecuteMarketBuy' | 'placeAndExecuteMarketSell'
      args: readonly [readonly number[], readonly bigint[], readonly number[], readonly bigint[], readonly number[], boolean] | readonly [bigint, bigint, boolean, boolean]
    },
    ceiling: bigint,
    assertSource: () => void | Promise<void>,
  ) {
    const call = { ...request, account: treasury.account } as Parameters<typeof client.estimateContractGas>[0]
    // Preflight before queueing: a post-only cross or missing funds is refused without waiting.
    await client.simulateContract(call)
    let reservation: number | null = null
    const sent = await treasury.send(async (nonce) => {
      // Queue spacing/nonces may await: revalidate immediately before signing.
      assertActive?.()
      await assertSource()
      // Estimated here, one block from inclusion, so the limit only has to absorb what can
      // change in that block. Monad bills the declared limit, not gas used: headroom is paid.
      // eth_estimateGas returns the exact minimum for the current state; one price point
      // flipping between empty and occupied moves a placement by about 57k (117k vs 60k,
      // measured), under 10% of the smallest two-order batch (511k). The bounded RPC
      // estimator also avoids the native-payout anomaly observed in S2.
      const estimate = await client.estimateContractGas({ ...call, gas: ceiling })
      const limit = (estimate * GAS_HEADROOM_PERCENT + 99n) / 100n
      if (limit > ceiling) throw new GasCeilingError(`Mirror gas budget exceeded: ${limit} > ${ceiling}`)
      const fees = budget ? await client.estimateFeesPerGas({ chain: undefined, type: 'eip1559' }) : undefined
      await assertSource()
      assertActive?.()
      // Reserves this transaction's declared limit x maxFee, nothing more: a refusal here
      // leaves the resting ladder exactly as it was, because every quote change is one batch.
      reservation = fees && budget ? budget.reserve(limit, fees.maxFeePerGas) : null
      const hash = await treasury.wallet.writeContract({
        ...request, gas: limit, nonce,
        ...(fees ? { maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas } : {}),
      })
      if (reservation !== null) budget!.record(reservation, hash)
      return hash
    })
    // Monad bills the declared limit at the effective price; settle the reservation to that.
    if (reservation !== null) budget!.settle(reservation, sent.gasUsed * sent.effectiveGasPrice)
    return sent.hash
  }

  // Started together so the batched client folds them into shared Multicall3 calls.
  function quotes(blockNumber: bigint) {
    const rows = db.query<{ order_id: string }, [string]>(
      'SELECT order_id FROM mirror_quotes WHERE market = ?',
    ).all(market.address)
    return Promise.all(rows.map(async (row) => {
      const id = Number(row.order_id)
      return { id, order: await readActiveOrder(client, market.address, id, blockNumber) }
    }))
  }

  // Same-block margin balances, live owned orders and the L2 book.
  async function observe(): Promise<MirrorView> {
    const p = await read()
    const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
    const [base, quote, rows, raw] = await Promise.all([
      balance(market.baseToken, p.baseDecimals, blockNumber),
      balance(market.quoteToken, p.quoteDecimals, blockNumber),
      quotes(blockNumber),
      client.readContract({
        address: market.address, abi: kuruOrderbookAbi, functionName: 'getL2Book', blockNumber,
      }),
    ])
    const own: OwnOrder[] = []
    const gone: string[] = []
    for (const { id, order } of rows) {
      if (order && order[0].toLowerCase() === bot.toLowerCase())
        own.push({ id, isBuy: order[7], price: BigInt(order[5]), size: order[1] })
      else gone.push(String(id))
    }
    // Authoritative price-point membership says these rows no longer rest (filled or canceled).
    const forget = db.query('DELETE FROM mirror_quotes WHERE market = ? AND order_id = ?')
    db.transaction(() => { for (const id of gone) forget.run(market.address, id) })()
    return { p, free: { base, quote }, own, book: decodeL2Units(raw) }
  }

  // One atomic batchUpdate: cancellations and replacements land in the same block, so the
  // book never shows a side without the bot's quotes.
  async function batch(plan: LadderPlan, assertSource: () => void | Promise<void>) {
    const hash = await sendChecked({
      address: market.address,
      abi: kuruOrderbookAbi,
      functionName: 'batchUpdate',
      args: [
        plan.bids.map((order) => order.price), plan.bids.map((order) => order.size),
        plan.asks.map((order) => order.price), plan.asks.map((order) => order.size),
        plan.cancel, true,
      ],
    }, gas.batchUpdate, assertSource)
    const receipt = await client.getTransactionReceipt({ hash })
    const created: string[] = []
    for (const entry of receipt.logs) {
      if (entry.address.toLowerCase() !== market.address.toLowerCase()) continue
      try {
        const event = decodeEventLog({ abi: kuruOrderbookAbi, data: entry.data, topics: entry.topics })
        if (event.eventName === 'OrderCreated') created.push(String(event.args.orderId))
      } catch {
        continue
      }
    }
    const forget = db.query('DELETE FROM mirror_quotes WHERE market = ? AND order_id = ?')
    const remember = db.query('INSERT OR IGNORE INTO mirror_quotes (market, order_id) VALUES (?, ?)')
    db.transaction(() => {
      for (const id of plan.cancel) forget.run(market.address, String(id))
      for (const id of created) remember.run(market.address, id)
    })()
    return hash
  }

  const reconcile = async (view: MirrorView, target: number, assertSource: () => void | Promise<void>) => {
    const plan = planMirrorLadder({ target, params: view.p, own: view.own, free: view.free, book: view.book, sideNotional })
    return plan.cancel.length || plan.bids.length || plan.asks.length ? batch(plan, assertSource) : null
  }

  return {
    execute: async (targetMid, assertSource): Promise<MirrorOutcome> => {
      const hashes: Hex[] = []
      try {
        let view = await observe()
        // Inside the deadband the resting ladder stays as signed: the book lags the target by at
        // most the deadband and nothing is sent, unless fills thinned a side to under half.
        const half = Math.ceil(MIRROR_LEVELS.length / 2)
        const thinned = [true, false].some((isBuy) => view.own.filter((order) => order.isBuy === isBuy).length < half)
        if (center !== null && Math.abs(targetMid / center - 1) < deadband && !thinned)
          return { kind: 'hold', reason: 'within-deadband', notional: 0, hashes }
        const first = await reconcile(view, targetMid, assertSource)
        if (first) hashes.push(first)
        center = targetMid
        let levels = MIRROR_TAKE_LEVELS
        let take = planTake({ target: targetMid, params: view.p, own: view.own, book: view.book, levels })
        // Another maker's order sits on the wrong side of the target (a player's ladder). With
        // the bot's own crossed quotes gone in that batch, take it so the book walks to target.
        if (take && first) {
          view = await observe()
          take = planTake({ target: targetMid, params: view.p, own: view.own, book: view.book, levels })
        }
        if (!take)
          return {
            kind: first ? 'quote' : 'hold',
            reason: first ? 'ladder-reconciled' : 'ladder-current',
            notional: 0,
            hashes,
          }
        const p = view.p
        const minimum = Number(p.minSize) / Number(p.sizePrecision)
        let notional = 0
        let side = take.side
        // Each filled order costs gas: take fewer levels until one market order fits its ceiling.
        for (;;) {
          if (!take) return { kind: first ? 'quote' : 'hold', reason: 'take-unfunded', notional: 0, hashes }
          side = take.side
          notional = take.side === 'buy'
            ? Math.min(take.quote, maxTakeNotional, view.free.quote)
            : Math.min(take.base, maxTakeNotional / targetMid, view.free.base) * targetMid
          if (notional < minimum * targetMid)
            return { kind: first ? 'quote' : 'hold', reason: 'take-unfunded', notional: 0, hashes }
          try {
            hashes.push(await sendChecked({
              address: market.address,
              abi: kuruOrderbookAbi,
              ...(take.side === 'buy'
                ? { functionName: 'placeAndExecuteMarketBuy', args: [quoteToUnits(notional, p), 0n, true, false] } as const
                : { functionName: 'placeAndExecuteMarketSell', args: [sizeToUnits(notional / targetMid, p), 0n, true, false] } as const),
            }, gas.marketOrder, assertSource))
            break
          } catch (error) {
            if (!(error instanceof GasCeilingError) || levels === 1) throw error
            levels = Math.floor(levels / 2)
            take = planTake({ target: targetMid, params: p, own: view.own, book: view.book, levels })
          }
        }
        // Now that the way is clear, place the rungs the first batch had to skip.
        const second = await reconcile(await observe(), targetMid, assertSource)
        if (second) hashes.push(second)
        return {
          kind: side,
          reason: side === 'buy' ? 'below-target' : 'above-target',
          notional,
          hashes,
        }
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { hashes })
      }
    },
  }
}
