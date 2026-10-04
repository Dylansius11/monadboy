import type { Hex } from 'viem'

export type Fill = {
  orderId: bigint
  price: number
  size: number
  isBuy: boolean
  isFlippedOrder: boolean
  flipPrice: number
  tx: Hex
  at: number
}

export type Holdings = {
  marginBase: number
  marginQuote: number
  restingBase: number
  restingQuote: number
}

export type Deposit = { base0: number; quote0: number }

export function scoreFromFills(fills: Fill[]): number {
  let score = 0
  for (const fill of fills) {
    if (fill.isFlippedOrder) score += Math.abs(fill.flipPrice - fill.price) * fill.size
  }
  return score
}

export function valueNow(h: Holdings, mid: number): number {
  return (h.marginBase + h.restingBase) * mid + h.marginQuote + h.restingQuote
}

export function valueHodl(d: Deposit, mid: number): number {
  return d.base0 * mid + d.quote0
}

export function scoreCard(fills: Fill[], h: Holdings, d: Deposit, mid: number): {
  score: number; damage: number; net: number
} {
  const score = scoreFromFills(fills)
  const net = valueNow(h, mid) - valueHodl(d, mid)
  return { score, damage: Math.max(0, score - net), net }
}

export function rangeState(mid: number, low: number, high: number, step: number):
  'IN_RANGE' | 'NAD_SENSE' | 'OUT_OF_RANGE' {
  if (mid < low || mid > high) return 'OUT_OF_RANGE'
  if (mid - low <= step || high - mid <= step) return 'NAD_SENSE'
  return 'IN_RANGE'
}
