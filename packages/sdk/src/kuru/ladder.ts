import { priceToUnits, sizeToUnits, unitsToPrice, unitsToSize } from './encoding'
import type { MarketParams } from './encoding'

export type Mode = 'WIDE' | 'TIGHT'
export type LadderInput = {
  mid: number; mode: Mode; budgetQuote: number; sigmaDaily: number; params: MarketParams
  manual?: { low: number; high: number }
}
export type LadderOrder = {
  price: number; flipPrice: number; size: number; isBuy: boolean
  priceUnits: number; flipUnits: number; sizeUnits: bigint
}
export type Ladder = {
  step: number; levels: number; low: number; high: number; orders: LadderOrder[]
  baseNeeded: number; quoteNeeded: number; zapQuote: number; clamped: boolean
}
export class LadderError extends Error {
  constructor(public readonly code: 'AMOUNT_TOO_SMALL' | 'NO_PRICE' | 'BAD_MANUAL_RANGE') {
    super(code)
    this.name = 'LadderError'
  }
}

/** [U] Pure SPEC 5.4 arithmetic; testnet execution semantics remain gated by S2. */
export function planLadder({ mid, mode, budgetQuote, sigmaDaily, params, manual }: LadderInput): Ladder {
  if (!Number.isFinite(mid) || mid <= 0) throw new LadderError('NO_PRICE')
  if (!Number.isFinite(budgetQuote) || budgetQuote <= 0) throw new LadderError('AMOUNT_TOO_SMALL')
  if (manual && (!Number.isFinite(manual.low) || !Number.isFinite(manual.high)
    || manual.low <= 0 || manual.low >= mid || manual.high <= mid)) {
    throw new LadderError('BAD_MANUAL_RANGE')
  }
  if (!manual && (!Number.isFinite(sigmaDaily) || sigmaDaily < 0)) throw new RangeError('Invalid volatility')

  // Manual overrides mode/volatility. The wider side selects the common flip step;
  // interpolate each side to its own endpoint because SPEC does not define asymmetry.
  const lowerWidth = manual ? (mid - manual.low) / mid : 0
  const upperWidth = manual ? (manual.high - mid) / mid : 0
  const halfWidth = manual ? Math.max(lowerWidth, upperWidth)
    : Math.min(0.2, Math.max(0.005, (mode === 'TIGHT' ? 1 : 2.5) * sigmaDaily))
  const steps = [0.001, 0.0025, 0.005, 0.01, 0.02] as const
  const step = steps.find((s) => Math.ceil(halfWidth / s) <= 8) ?? 0.02
  let levels = Math.min(8, Math.max(2, Math.ceil(halfWidth / step)))
  const initialLevels = levels
  const clamped = halfWidth > 8 * step
  const widthScale = clamped ? 8 * step / halfWidth : 1
  // Keep spacing fixed when dropping outer pairs; only quotePerLevel is recomputed.
  const buyStep = manual ? lowerWidth * widthScale / levels : step
  const sellStep = manual ? upperWidth * widthScale / levels : step

  for (; levels >= 2; levels--) {
    const quotePerLevel = budgetQuote / (2 * levels)
    const orders: LadderOrder[] = []
    let baseNeeded = 0
    let quoteNeeded = 0
    let belowMin = false
    for (const isBuy of [true, false]) {
      for (let i = 1; i <= levels; i++) {
        const target = mid * (isBuy ? 1 - i * buyStep : 1 + i * sellStep)
        const priceUnits = priceToUnits(target, params, isBuy ? 'down' : 'up')
        const price = unitsToPrice(priceUnits, params)
        if (price <= 0) throw new LadderError('NO_PRICE')
        const flipUnits = priceToUnits(isBuy ? price * (1 + step) : price / (1 + step),
          params, isBuy ? 'up' : 'down')
        if (isBuy ? flipUnits <= priceUnits || price >= mid : flipUnits >= priceUnits || price <= mid) {
          throw new RangeError('Tick cannot represent a passive flip pair')
        }
        const sizeUnits = sizeToUnits(quotePerLevel / (isBuy ? price : mid), params)
        if (sizeUnits > params.maxSize) throw new RangeError('Size exceeds market maxSize')
        if (sizeUnits < params.minSize || sizeUnits === 0n) belowMin = true
        const size = unitsToSize(sizeUnits, params)
        orders.push({ price, flipPrice: unitsToPrice(flipUnits, params), size,
          isBuy, priceUnits, flipUnits, sizeUnits })
        if (isBuy) quoteNeeded += price * size
        else baseNeeded += size
      }
    }
    if (belowMin) continue
    // zapQuote = mid * sum(sell base sizes): quote to buy their base at mid.
    // Fees/slippage/gas are separate execution costs, not extra ladder allocation.
    return {
      step, levels, low: orders[levels - 1].price, high: orders[orders.length - 1].price,
      orders, baseNeeded, quoteNeeded, zapQuote: baseNeeded * mid, clamped: clamped || levels < initialLevels,
    }
  }
  throw new LadderError('AMOUNT_TOO_SMALL')
}

/** S2 must verify provisionOrRevert=true before these arrays are submitted. */
export function batchProvisionArgs(l: Ladder): readonly [number[], number[], bigint[], boolean[], boolean] {
  return [l.orders.map((o) => o.priceUnits), l.orders.map((o) => o.flipUnits),
    l.orders.map((o) => o.sizeUnits), l.orders.map((o) => o.isBuy), true]
}
