import { priceToUnits, sizeToUnits } from '@monadboy/sdk'
import type { MarketParams } from '@monadboy/sdk'
import type { L2Units } from './l2-book'

/** One rung a side of the target: where new orders go, and the offset window in which a resting order still counts. */
export type LadderLevel = { offset: number; min: number; max: number; weight: number }

// Six rungs a side, tightest at 0.2%, out to 16%. Six tenths of each side's value sits within
// 2%: the asks a player's funding zap walks. Every placement costs gas (about 117k, measured on
// chain 10143) and a 50x DEMO target moves about 2.5% per 30 s, so windows are wide and tile
// 0.03%..22%: a move replaces only the orders that left their window, and the outer rungs absorb
// swings without being touched. Replaying 24h of mainnet mids, this layout cost about 45% less
// gas than six rungs packed inside 4.5%.
export const MIRROR_LEVELS: readonly LadderLevel[] = [
  { offset: 0.002, min: 0.0003, max: 0.008, weight: 2 },
  { offset: 0.012, min: 0.008, max: 0.02, weight: 4 },
  { offset: 0.03, min: 0.02, max: 0.045, weight: 1 },
  { offset: 0.06, min: 0.045, max: 0.08, weight: 1 },
  { offset: 0.1, min: 0.08, max: 0.13, weight: 1 },
  { offset: 0.16, min: 0.13, max: 0.22, weight: 1 },
]

export type OwnOrder = { id: number; isBuy: boolean; price: bigint; size: bigint }
export type Placement = { price: number; size: bigint }
export type LadderPlan = { cancel: number[]; bids: Placement[]; asks: Placement[] }

/** The L2 book without the bot's own orders: what a take could trade against, and what a post-only quote must not cross. */
export function externalLevels(book: L2Units, own: readonly OwnOrder[]) {
  const strip = (levels: L2Units['bids'], isBuy: boolean) =>
    levels
      .map((level) => ({
        price: level.price,
        size: own.reduce(
          (left, order) => order.isBuy === isBuy && order.price === level.price ? left - order.size : left,
          level.size,
        ),
      }))
      .filter((level) => level.size > 0n)
  return { bids: strip(book.bids, true), asks: strip(book.asks, false) }
}

/**
 * The single atomic batchUpdate that brings the bot's ladder back around `target`: cancel
 * orders on the wrong side of it, fill empty rungs, and leave every order still inside its
 * window untouched. An empty plan means nothing needs signing. Funds come from free margin
 * plus whatever this same batch releases; a quote that would cross someone else's order is
 * skipped (the take step clears that liquidity first).
 */
export function planMirrorLadder(input: {
  target: number
  params: MarketParams
  own: readonly OwnOrder[]
  free: { base: number; quote: number }
  book: L2Units
  sideNotional: number
  levels?: readonly LadderLevel[]
}): LadderPlan {
  const { target, params: p, own, levels = MIRROR_LEVELS } = input
  const external = externalLevels(input.book, own)
  const bestAsk = external.asks.reduce<bigint | null>((best, l) => best === null || l.price < best ? l.price : best, null)
  const bestBid = external.bids.reduce<bigint | null>((best, l) => best === null || l.price > best ? l.price : best, null)
  const precision = Number(p.pricePrecision)
  const sizePrecision = Number(p.sizePrecision)
  const totalWeight = levels.reduce((sum, level) => sum + level.weight, 0)
  const required: number[] = []
  const optional: number[] = []
  const placed: { bids: Placement[]; asks: Placement[] } = { bids: [], asks: [] }

  for (const isBuy of [true, false]) {
    const priceOf = (units: bigint | number) => Number(units) / precision
    const offsetOf = (units: bigint) => isBuy ? 1 - priceOf(units) / target : priceOf(units) / target - 1
    // Side-asset amount an order locks: AUSD for a bid, MON for an ask.
    const lockOf = (price: bigint | number, size: bigint) =>
      Number(size) / sizePrecision * (isBuy ? priceOf(price) : 1)
    const orders = own.filter((order) => order.isBuy === isBuy)
    const resting = orders.reduce((sum, order) => sum + lockOf(order.price, order.size), 0)
    let available = isBuy ? input.free.quote : input.free.base
    // Side budget in quote units, bounded by what the side actually holds (resting + free).
    const budget = Math.min(input.sideNotional, (available + resting) * (isBuy ? 1 : target))
    const slots = levels.map((level) => {
      const price = priceToUnits(target * (isBuy ? 1 - level.offset : 1 + level.offset), p, isBuy ? 'down' : 'up')
      const size = sizeToUnits(budget * level.weight / totalWeight / priceOf(price), p)
      return { level, price, size, kept: null as OwnOrder | null, worn: [] as OwnOrder[] }
    })
    const spare: { order: OwnOrder; offset: number }[] = []
    for (const order of orders) {
      const offset = offsetOf(order.price)
      if (offset < levels[0].min) {
        // At or through the target: this order is what keeps the book away from it.
        required.push(order.id)
        available += lockOf(order.price, order.size)
        continue
      }
      const slot = slots.find((s) => offset >= s.level.min && offset < s.level.max)
      if (!slot) {
        optional.push(order.id)
        continue
      }
      // A rung eaten down to a quarter by fills is worn: replaced only when that is affordable.
      if (order.size * 4n < slot.size) {
        slot.worn.push(order)
        continue
      }
      const distance = Math.abs(offset - slot.level.offset)
      if (slot.kept && Math.abs(offsetOf(slot.kept.price) - slot.level.offset) <= distance) {
        spare.push({ order, offset })
        continue
      }
      if (slot.kept) spare.push({ order: slot.kept, offset: offsetOf(slot.kept.price) })
      slot.kept = order
    }
    const crosses = (price: number) =>
      isBuy ? bestAsk !== null && BigInt(price) >= bestAsk : bestBid !== null && BigInt(price) <= bestBid
    const open = slots.filter((slot) => !slot.kept && slot.size >= p.minSize && !crosses(slot.price))
    const need = open.reduce((sum, slot) => sum + lockOf(slot.price, slot.size), 0)
    // Duplicates pile up in outer windows as the target walks. Free them, outermost first, only
    // when an empty rung needs the funds.
    spare.sort((a, b) => b.offset - a.offset)
    for (const { order } of spare) {
      if (available >= need) break
      required.push(order.id)
      available += lockOf(order.price, order.size)
    }
    for (const slot of open) {
      const release = slot.worn.reduce((sum, order) => sum + lockOf(order.price, order.size), 0)
      const affordable = Math.min(lockOf(slot.price, slot.size), available + release)
      const size = sizeToUnits(isBuy ? affordable / priceOf(slot.price) : affordable, p)
      const wornSize = slot.worn.reduce((sum, order) => sum + order.size, 0n)
      // Re-placing a worn rung is worth a placement only if it at least doubles that rung.
      if (size < p.minSize || size > p.maxSize || size < wornSize * 2n) continue
      for (const order of slot.worn) required.push(order.id)
      available += release - lockOf(slot.price, size)
      ;(isBuy ? placed.bids : placed.asks).push({ price: slot.price, size })
    }
  }
  if (!required.length && !placed.bids.length && !placed.asks.length)
    return { cancel: [], bids: [], asks: [] }
  // Orders beyond the outer window ride along in a batch that is being signed anyway.
  return { cancel: [...required, ...optional], ...placed }
}

// [V] 2026-10-11, chain 10143: a market sell through twelve one-order flip bid levels estimated
// about 2.25M gas (2,478,352 declared with headroom), over the 2M market-order ceiling, so every
// tick refused it and the asks it was clearing the way for never returned. Six levels fit with
// room for a flip fill's extra placement; the executor halves this again if an estimate still
// exceeds the ceiling (several orders can share one price level).
export const MIRROR_TAKE_LEVELS = 6

/**
 * Other makers' liquidity on the wrong side of the target: asks below it are bought, bids above
 * it are sold into. This is how player orders fill. Only the `levels` nearest the touch are
 * taken in one order; later ticks take the rest. Returns null when nothing (or only dust below
 * one minimum order) is in the way.
 */
export function planTake(input: {
  target: number
  params: MarketParams
  own: readonly OwnOrder[]
  book: L2Units
  levels?: number
}): { side: 'buy'; quote: number } | { side: 'sell'; base: number } | null {
  const { target, params: p, levels = MIRROR_TAKE_LEVELS } = input
  const external = externalLevels(input.book, input.own)
  const price = (units: bigint) => Number(units) / Number(p.pricePrecision)
  // Nearest the touch first: the cheapest asks and the highest bids.
  const asks = external.asks.filter((level) => price(level.price) < target)
    .sort((a, b) => (a.price < b.price ? -1 : 1)).slice(0, levels)
  const bids = external.bids.filter((level) => price(level.price) > target)
    .sort((a, b) => (a.price > b.price ? -1 : 1)).slice(0, levels)
  const askSize = asks.reduce((sum, level) => sum + level.size, 0n)
  const bidSize = bids.reduce((sum, level) => sum + level.size, 0n)
  // Over-take by 0.2%: float-to-unit rounding must never leave a crossing remainder that blocks
  // the bot's inner quotes. The excess meets the bot's own nearest rung, a self-match of at most
  // 0.2% of the notional that Kuru executes like any other.
  if (askSize >= p.minSize)
    return {
      side: 'buy',
      // Gross up for the taker fee in case it comes out of the quote input.
      quote: asks.reduce((sum, level) => sum + price(level.price) * Number(level.size) / Number(p.sizePrecision), 0)
        / (1 - p.takerFeeBps / 10000) * 1.002,
    }
  if (bidSize >= p.minSize)
    return { side: 'sell', base: Number(bidSize) / Number(p.sizePrecision) * 1.002 }
  return null
}
