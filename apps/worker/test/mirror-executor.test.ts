import { expect, test } from 'bun:test'
import { encodeAbiParameters, encodeEventTopics } from 'viem'
import type { Hex, PublicClient } from 'viem'
import { kuruOrderbookAbi, priceToUnits, testnetMarkets } from '@monadboy/sdk'
import type { MarketParams } from '@monadboy/sdk'
import { createMirrorExecutor } from '../src/chain/mirror-executor'
import { MIRROR_LEVELS, planMirrorLadder, planTake } from '../src/chain/mirror-ladder'
import type { Treasury } from '../src/chain/treasury'
import { memoryDb } from './helpers'

const market = testnetMarkets.find((entry) => entry.symbol === 'MON_AUSD')!
const BOT = '0x2FBF1B1063EF5e5d0422D8c4c4357640f99F7c1F' as const
const OTHER = '0x1111111111111111111111111111111111111111' as const
const PRESET = 2 // largest fixed player funding preset, AUSD
const params: MarketParams = {
  pricePrecision: 100000000n, sizePrecision: 10000000000n,
  baseDecimals: 18, quoteDecimals: 6,
  tickSize: 1n, minSize: 15000000000n, maxSize: (1n << 96n) - 1n, takerFeeBps: 30, makerFeeBps: 0,
}
const units = (price: number) => Math.round(price * 1e8)

type Order = { owner: string; size: bigint; price: number; isBuy: boolean }
type Call = { functionName: string; args: readonly unknown[] }

// An in-memory Kuru book: resting orders, margin balances, getL2Book and price-point membership,
// with batchUpdate applying cancels and placements in one step like the contract.
function fakeChain({ base = 300, quote = 10 }: { base?: number; quote?: number } = {}) {
  const orders = new Map<number, Order>()
  let nextId = 1
  let block = 100n
  const free = { base: BigInt(Math.round(base * 1e9)) * 10n ** 9n, quote: BigInt(Math.round(quote * 1e6)) }
  const sends: Call[] = []
  const selfMatched = { quote: 0n }
  const logs = new Map<Hex, { address: string; data: Hex; topics: Hex[] }[]>()
  const lock = (o: Order) => o.isBuy ? o.size * BigInt(o.price) / 1000000000000n : o.size * 10n ** 8n
  const place = (owner: string, price: number, size: bigint, isBuy: boolean) => {
    const id = nextId++
    orders.set(id, { owner, size, price, isBuy })
    return id
  }
  const atPrice = (price: number, isBuy: boolean) =>
    [...orders].filter(([, o]) => o.price === price && o.isBuy === isBuy).map(([id]) => id)
  const bidsBestFirst = () => [...orders].filter(([, o]) => o.isBuy).sort((a, b) => b[1].price - a[1].price)
  const l2 = () => {
    const word = (v: bigint | number) => BigInt(v).toString(16).padStart(64, '0')
    const side = (isBuy: boolean) => {
      const levels = new Map<number, bigint>()
      for (const o of orders.values()) if (o.isBuy === isBuy) levels.set(o.price, (levels.get(o.price) ?? 0n) + o.size)
      return [...levels].sort((a, b) => isBuy ? b[0] - a[0] : a[0] - b[0]).map(([p, s]) => word(p) + word(s)).join('')
    }
    return `0x${word(block)}${side(true)}${word(0)}${side(false)}` as Hex
  }
  const client = {
    getBlockNumber: async () => block,
    readContract: async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      if (functionName === 'getMarketParams')
        return [100000000, 10000000000n, market.baseToken, 18n, market.quoteToken, 6n, 1, 15000000000n, (1n << 96n) - 1n, 30n, 0n]
      if (functionName === 'getBalance') return args![1] === market.baseToken ? free.base : free.quote
      if (functionName === 'getL2Book') return l2()
      if (functionName === 's_orders') {
        const id = Number(args![0])
        const o = orders.get(id)
        if (!o) return [OTHER, 0n, 0, 0, 0, 0, 0, false]
        const peers = atPrice(o.price, o.isBuy)
        return [o.owner, o.size, 0, peers[peers.indexOf(id) + 1] ?? 0, 0, o.price, 0, o.isBuy]
      }
      if (functionName === 's_buyPricePoints' || functionName === 's_sellPricePoints') {
        const peers = atPrice(Number(args![0]), functionName === 's_buyPricePoints')
        return [peers[0] ?? 0, peers.at(-1) ?? 0]
      }
      throw new Error(`Unexpected read: ${functionName}`)
    },
    simulateContract: async () => ({}),
    estimateContractGas: async () => 500000n,
    getTransactionReceipt: async ({ hash }: { hash: Hex }) => ({ logs: logs.get(hash) ?? [] }),
  } as unknown as PublicClient
  const write = async (call: Call) => {
    sends.push(call)
    const hash = `0x${sends.length.toString(16).padStart(64, '0')}` as Hex
    const created: { address: string; data: Hex; topics: Hex[] }[] = []
    if (call.functionName === 'batchUpdate') {
      const [buyPrices, buySizes, sellPrices, sellSizes, cancel] = call.args as [number[], bigint[], number[], bigint[], number[]]
      for (const id of cancel) {
        const o = orders.get(id)!
        if (o.owner !== BOT) throw new Error('owner')
        if (o.isBuy) free.quote += lock(o)
        else free.base += lock(o)
        orders.delete(id)
      }
      const add = (price: number, size: bigint, isBuy: boolean) => {
        const o = { owner: BOT, size, price, isBuy }
        if (o.isBuy) free.quote -= lock(o)
        else free.base -= lock(o)
        if (free.quote < 0n || free.base < 0n) throw new Error('InsufficientBalance')
        const id = place(BOT, price, size, isBuy)
        created.push({
          address: market.address,
          topics: encodeEventTopics({ abi: kuruOrderbookAbi, eventName: 'OrderCreated' }) as Hex[],
          data: encodeAbiParameters(
            [{ type: 'uint40' }, { type: 'address' }, { type: 'uint96' }, { type: 'uint32' }, { type: 'bool' }],
            [id, BOT, size, price, isBuy],
          ),
        })
      }
      buyPrices.forEach((price, i) => add(price, buySizes[i], true))
      sellPrices.forEach((price, i) => add(price, sellSizes[i], false))
    } else if (call.functionName === 'placeAndExecuteMarketBuy') {
      // Walk asks from the cheapest, the bot's own included (Kuru self-matches).
      let quoteLeft = BigInt(call.args[0] as bigint) * 10n ** 6n / 10n ** 8n * 9970n / 10000n
      for (const [id, o] of [...orders].filter(([, o]) => !o.isBuy).sort((a, b) => a[1].price - b[1].price)) {
        if (quoteLeft <= 0n) break
        const cost = o.size * BigInt(o.price) / 1000000000000n
        if (o.owner === BOT) selfMatched.quote += cost < quoteLeft ? cost : quoteLeft
        if (cost <= quoteLeft) { orders.delete(id); quoteLeft -= cost; free.base += o.size * 10n ** 8n }
        else { const take = quoteLeft * 1000000000000n / BigInt(o.price); o.size -= take; quoteLeft = 0n; free.base += take * 10n ** 8n }
      }
    } else if (call.functionName === 'placeAndExecuteMarketSell') {
      // Walk bids from the highest, the bot's own included.
      let baseLeft = BigInt(call.args[0] as bigint)
      for (const [id, o] of bidsBestFirst()) {
        if (baseLeft <= 0n) break
        const fill = o.size < baseLeft ? o.size : baseLeft
        o.size -= fill
        baseLeft -= fill
        free.quote += fill * BigInt(o.price) / 1000000000000n
        if (o.size === 0n) orders.delete(id)
      }
      free.base -= (BigInt(call.args[0] as bigint) - baseLeft) * 10n ** 8n
    }
    logs.set(hash, created)
    block += 3n
    return hash
  }
  const treasury = {
    account: { address: BOT },
    send: async (build: (nonce: number) => Promise<Hex>) => {
      const hash = await build(0)
      return { hash, blockNumber: block, gasUsed: 500000n, effectiveGasPrice: 100n }
    },
    wallet: { writeContract: async (call: Call) => write(call) },
  } as unknown as Treasury
  return { client, treasury, orders, sends, free, place, selfMatched, bidsBestFirst }
}

function executorFor(chain: ReturnType<typeof fakeChain>, db = memoryDb(), extra: Partial<Parameters<typeof createMirrorExecutor>[0]> = {}) {
  return {
    db,
    executor: createMirrorExecutor({
      db, client: chain.client, treasury: chain.treasury, market,
      margin: '0xd029C2D98ff85D8F64799017fE00a59B1159CE02',
      gas: { marketOrder: 2000000n, batchUpdate: 4000000n },
      sideNotional: 4, maxTakeNotional: 5, ...extra,
    }),
  }
}

const ownSide = (chain: ReturnType<typeof fakeChain>, isBuy: boolean) =>
  [...chain.orders.values()].filter((o) => o.owner === BOT && o.isBuy === isBuy)
const askDepthWithin = (chain: ReturnType<typeof fakeChain>, mid: number, band: number) =>
  ownSide(chain, false)
    .filter((o) => o.price / 1e8 <= mid * (1 + band))
    .reduce((sum, o) => sum + o.price / 1e8 * Number(o.size) / 1e10, 0)

test('seeds six rungs a side in one batch, with enough asks within 2% to fund the largest preset', async () => {
  const chain = fakeChain()
  const { db, executor } = executorFor(chain)
  const outcome = await executor.execute(0.03, () => {})
  expect(outcome).toMatchObject({ kind: 'quote', reason: 'ladder-reconciled' })
  expect(chain.sends.map((call) => call.functionName)).toEqual(['batchUpdate'])
  expect(ownSide(chain, true)).toHaveLength(MIRROR_LEVELS.length)
  expect(ownSide(chain, false)).toHaveLength(MIRROR_LEVELS.length)
  expect(Math.max(...ownSide(chain, true).map((o) => o.price))).toBe(priceToUnits(0.03 * (1 - MIRROR_LEVELS[0].offset), params, 'down'))
  expect(Math.min(...ownSide(chain, false).map((o) => o.price))).toBe(priceToUnits(0.03 * (1 + MIRROR_LEVELS[0].offset), params, 'up'))
  // A preset's zap buys half its budget in MON plus fee and slippage; the ask side within 2%
  // must hold the whole preset, so the zap has 2x headroom.
  expect(askDepthWithin(chain, 0.03, 0.02)).toBeGreaterThanOrEqual(PRESET)
  expect(db.query('SELECT COUNT(*) AS n FROM mirror_quotes').get()).toEqual({ n: 12 })
  db.close()
})

test('a target move re-quotes atomically: cancels and replacements share one batchUpdate', async () => {
  const chain = fakeChain()
  const { db, executor } = executorFor(chain)
  await executor.execute(0.03, () => {})
  const seeded = chain.sends.length
  expect(await executor.execute(0.03, () => {})).toMatchObject({ kind: 'hold', hashes: [] })
  expect(chain.sends).toHaveLength(seeded)

  await executor.execute(0.0303, () => {})
  const moves = chain.sends.slice(seeded)
  expect(moves.map((call) => call.functionName)).toEqual(['batchUpdate'])
  const [buyPrices, , sellPrices, , cancel] = moves[0].args as [number[], bigint[], number[], bigint[], number[]]
  expect(cancel.length).toBeGreaterThan(0)
  expect(buyPrices.length + sellPrices.length).toBeGreaterThan(0)
  // Sticky rungs: a 1% move touches only the rungs it crossed, not all twelve.
  expect(buyPrices.length + sellPrices.length).toBeLessThan(2 * MIRROR_LEVELS.length)
  // After the single transaction both sides are full again, around the new target.
  expect(ownSide(chain, true).length).toBeGreaterThanOrEqual(MIRROR_LEVELS.length)
  expect(ownSide(chain, false).length).toBeGreaterThanOrEqual(MIRROR_LEVELS.length)
  expect(Math.min(...ownSide(chain, false).map((o) => o.price)) / 1e8).toBeGreaterThan(0.0303)
  expect(Math.max(...ownSide(chain, true).map((o) => o.price)) / 1e8).toBeLessThan(0.0303)
  expect(askDepthWithin(chain, 0.0303, 0.02)).toBeGreaterThanOrEqual(PRESET)
  const rows = db.query<{ order_id: string }, []>('SELECT order_id FROM mirror_quotes').all().map((row) => Number(row.order_id))
  expect(rows.sort((a, b) => a - b)).toEqual([...chain.orders.keys()].sort((a, b) => a - b))
  db.close()
})

test('inventory bounds the ladder: thin MON shrinks the ask side instead of failing', async () => {
  const chain = fakeChain({ base: 30, quote: 10 })
  const { db, executor } = executorFor(chain)
  await executor.execute(0.03, () => {})
  const asks = ownSide(chain, false)
  expect(asks.reduce((sum, o) => sum + Number(o.size) / 1e10, 0)).toBeLessThanOrEqual(30)
  expect(asks.every((o) => o.size >= params.minSize)).toBe(true)
  expect(chain.free.base).toBeGreaterThanOrEqual(0n)
  db.close()
})

test('a player ask below the target is taken between two batches, self-matching at most 0.3%', async () => {
  const chain = fakeChain()
  const { db, executor } = executorFor(chain)
  await executor.execute(0.03, () => {})
  const seeded = chain.sends.length
  // A player's flip ask rests just above the old target, below the new one.
  chain.place(OTHER, units(0.0302), 20n * 10n ** 10n, false)
  const outcome = await executor.execute(0.0306, () => {})
  const calls = chain.sends.slice(seeded)
  expect(calls.map((call) => call.functionName)).toEqual(['batchUpdate', 'placeAndExecuteMarketBuy', 'batchUpdate'])
  const [firstBids] = calls[0].args as [number[]]
  expect(firstBids.every((price) => price < units(0.0302))).toBe(true)
  expect(outcome).toMatchObject({ kind: 'buy', reason: 'below-target' })
  expect(outcome.notional).toBeCloseTo(0.0302 * 20 / 0.997 * 1.002, 6)
  expect([...chain.orders.values()].some((o) => o.owner === OTHER)).toBe(false)
  expect(Number(chain.selfMatched.quote) / 1e6).toBeLessThanOrEqual(outcome.notional * 0.003)
  expect(Math.max(...ownSide(chain, true).map((o) => o.price)) / 1e8).toBeGreaterThan(0.0302)
  db.close()
})

// Each order a market sell fills costs gas, like Kuru: 200k base plus 170k per filled order puts
// twelve filled flip bids at about 2.25M, the real 2026-10-11 estimate that the 2M ceiling refused.
function gasPerFill(chain: ReturnType<typeof fakeChain>, limits: bigint[]) {
  return {
    ...chain.client,
    estimateContractGas: async ({ functionName, args }: Call) => {
      if (functionName !== 'placeAndExecuteMarketSell') return 500000n
      let left = BigInt(args[0] as bigint)
      let filled = 0n
      for (const [, o] of chain.bidsBestFirst()) {
        if (left <= 0n) break
        left -= o.size
        filled++
      }
      const estimate = 200000n + 170000n * filled
      limits.push((estimate * 110n + 99n) / 100n)
      return estimate
    },
  } as unknown as PublicClient
}

test('stale player bids above the target are taken a gas-bounded slice per tick until asks return', async () => {
  const chain = fakeChain()
  // Twelve one-order player flip bids between 0.0317 and 0.0336 (the live book), target 0.0308.
  for (let i = 0; i < 12; i++) chain.place(OTHER, units(0.0336 - i * 0.00017), 18500000000n, true)
  const limits: bigint[] = []
  const client = gasPerFill(chain, limits)
  const { db, executor } = executorFor({ ...chain, client }, memoryDb(), { client })
  const external = () => [...chain.orders.values()].filter((o) => o.owner === OTHER && o.price > units(0.0308)).length

  const first = await executor.execute(0.0308, () => {})
  expect(first).toMatchObject({ kind: 'sell', reason: 'above-target' })
  expect(limits.every((limit) => limit <= 2000000n)).toBe(true)
  expect(external()).toBeLessThanOrEqual(6)

  await executor.execute(0.0308, () => {})
  expect(external()).toBe(0)
  expect(limits.every((limit) => limit <= 2000000n)).toBe(true)
  // With the way clear the ask side is back, deep enough to fund the largest preset.
  expect(askDepthWithin(chain, 0.0308, 0.02)).toBeGreaterThanOrEqual(PRESET)
  db.close()
})

test('a take that still exceeds the gas ceiling is halved before anything is signed', async () => {
  const chain = fakeChain()
  // Six levels of three orders each: six levels and then three still exceed the 2M ceiling.
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 3; j++) chain.place(OTHER, units(0.0336 - i * 0.0003), 18500000000n, true)
  const limits: bigint[] = []
  const client = gasPerFill(chain, limits)
  const { db, executor } = executorFor({ ...chain, client }, memoryDb(), { client })
  const outcome = await executor.execute(0.0308, () => {})
  expect(outcome).toMatchObject({ kind: 'sell' })
  const sells = chain.sends.filter((call) => call.functionName === 'placeAndExecuteMarketSell')
  expect(sells).toHaveLength(1)
  expect(limits.filter((limit) => limit > 2000000n)).toHaveLength(2)
  expect(limits.at(-1)! <= 2000000n).toBe(true)
  db.close()
})

test('a crossed passive refresh is refused before signing and leaves the ledger unchanged', async () => {
  const chain = fakeChain()
  const client = { ...chain.client, simulateContract: async () => { throw new Error('PostOnlyError') } } as unknown as PublicClient
  const db = memoryDb()
  const executor = createMirrorExecutor({
    db, client, treasury: chain.treasury, market, margin: '0xd029C2D98ff85D8F64799017fE00a59B1159CE02',
    gas: { marketOrder: 2000000n, batchUpdate: 4000000n }, sideNotional: 3, maxTakeNotional: 5,
  })
  let guardCalls = 0
  await expect(executor.execute(0.0268, () => { guardCalls++ })).rejects.toThrow('PostOnlyError')
  expect(chain.sends).toEqual([])
  expect(guardCalls).toBe(0)
  expect(db.query('SELECT * FROM mirror_quotes').all()).toEqual([])
  db.close()
})

test('demand expiring during nonce spacing refuses the next quote signature', async () => {
  const chain = fakeChain()
  let active = true
  const treasury = {
    ...chain.treasury,
    send: async (build: (nonce: number) => Promise<Hex>) => {
      active = false
      await build(0)
      throw new Error('Must refuse before broadcast')
    },
  } as unknown as Treasury
  const { db, executor } = executorFor({ ...chain, treasury }, memoryDb(), {
    treasury, assertActive: () => { if (!active) throw new Error('No active gameplay') },
  })
  await expect(executor.execute(0.0268, () => {})).rejects.toThrow('No active gameplay')
  expect(chain.sends).toEqual([])
  db.close()
})

test('source is checked after estimation and queue awaits, before a new quote signature', async () => {
  const chain = fakeChain()
  let fresh = true
  const client = {
    ...chain.client,
    estimateContractGas: async () => { fresh = false; return 100000n },
  } as unknown as PublicClient
  const { db, executor } = executorFor({ ...chain, client }, memoryDb(), { client })
  await expect(executor.execute(0.0268, () => {
    if (!fresh) throw new Error('Source became stale')
  })).rejects.toThrow('Source became stale')
  expect(chain.sends).toEqual([])
  db.close()
})

test('inside the deadband nothing is signed; past it, or after fills thin a side, the ladder is re-signed', async () => {
  const chain = fakeChain()
  const { db, executor } = executorFor(chain, memoryDb(), { deadband: 0.01 })
  await executor.execute(0.03, () => {})
  const seeded = chain.sends.length
  expect(await executor.execute(0.03 * 1.009, () => {})).toMatchObject({ kind: 'hold', reason: 'within-deadband' })
  expect(chain.sends).toHaveLength(seeded)
  // A player's zap eats four of the six asks: replenished although the target did not move.
  for (const [id] of [...chain.orders].filter(([, o]) => !o.isBuy).slice(0, 4)) chain.orders.delete(id)
  expect(await executor.execute(0.03 * 1.009, () => {})).toMatchObject({ kind: 'quote' })
  expect(ownSide(chain, false).length).toBeGreaterThanOrEqual(MIRROR_LEVELS.length)
  const replenished = chain.sends.length
  expect(await executor.execute(0.03 * 1.012, () => {})).toMatchObject({ kind: 'hold', reason: 'within-deadband' })
  expect(await executor.execute(0.03 * 1.03, () => {})).toMatchObject({ kind: 'quote' })
  expect(chain.sends).toHaveLength(replenished + 1)
  db.close()
})

test('rows for filled or foreign orders are dropped; only live owned orders are the ladder', async () => {
  const chain = fakeChain()
  const { db, executor } = executorFor(chain)
  await executor.execute(0.03, () => {})
  const foreign = chain.place(OTHER, units(0.02), 20n * 10n ** 10n, true)
  db.query('INSERT INTO mirror_quotes (market, order_id) VALUES (?, ?)').run(market.address, String(foreign))
  db.query('INSERT INTO mirror_quotes (market, order_id) VALUES (?, ?)').run(market.address, '999')
  expect(await executor.execute(0.03, () => {})).toMatchObject({ kind: 'hold' })
  const ids = db.query<{ order_id: string }, []>('SELECT order_id FROM mirror_quotes').all().map((row) => row.order_id)
  expect(ids).not.toContain(String(foreign))
  expect(ids).not.toContain('999')
  expect(ids).toHaveLength(12)
  db.close()
})

test('the planner never quotes through another maker and ignores dust in the take', () => {
  const book = { block: 1n, bids: [], asks: [{ price: BigInt(units(0.0299)), size: 10n ** 9n }] }
  const plan = planMirrorLadder({ target: 0.03, params, own: [], free: { base: 100, quote: 10 }, book, sideNotional: 3 })
  expect(plan.bids.every((bid) => bid.price < units(0.0299))).toBe(true)
  expect(plan.bids.length).toBeLessThan(MIRROR_LEVELS.length)
  // 0.1 MON is under the 1.5 MON minimum order: not worth a market order.
  expect(planTake({ target: 0.03, params, own: [], book })).toBeNull()
})
