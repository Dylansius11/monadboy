import type { Address, PublicClient } from 'viem'
import { kuruOrderbookAbi } from '../abi/kuru-orderbook'

export type MarketParams = {
  pricePrecision: bigint
  sizePrecision: bigint
  tickSize: bigint
  minSize: bigint
  maxSize: bigint
  baseDecimals: number
  quoteDecimals: number
  takerFeeBps: number
  makerFeeBps: number
}

/** [U] Placement encodings await spike S2's real testnet order and emitted units. */
export async function readMarketParams(client: PublicClient, market: Address): Promise<MarketParams> {
  const raw = await client.readContract({ address: market, abi: kuruOrderbookAbi, functionName: 'getMarketParams' })
  return {
    pricePrecision: BigInt(raw[0]), sizePrecision: raw[1],
    baseDecimals: Number(raw[3]), quoteDecimals: Number(raw[5]),
    tickSize: BigInt(raw[6]), minSize: raw[7], maxSize: raw[8],
    takerFeeBps: Number(raw[9]), makerFeeBps: Number(raw[10]),
  }
}

// Scale the supplied decimal exactly: binary multiplication can mis-round an exact tick.
function fraction(value: number, precision: bigint): readonly [bigint, bigint] {
  if (!Number.isFinite(value) || value < 0 || precision <= 0n) throw new RangeError('Invalid amount or precision')
  const [decimal, exponent = '0'] = value.toString().split('e')
  const [whole, tail = ''] = decimal.split('.')
  const power = Number(exponent) - tail.length
  const numerator = BigInt(whole + tail) * precision
  return power >= 0 ? [numerator * 10n ** BigInt(power), 1n] : [numerator, 10n ** BigInt(-power)]
}

/** [U] Price times pricePrecision, tick-aligned; S2 must pin this to a real order. */
export function priceToUnits(price: number, p: MarketParams, round: 'down' | 'up'): number {
  if (p.tickSize <= 0n) throw new RangeError('Invalid tick size')
  const [numerator, denominator] = fraction(price, p.pricePrecision)
  const divisor = denominator * p.tickSize
  const ticks = round === 'up' ? (numerator + divisor - 1n) / divisor : numerator / divisor
  const units = ticks * p.tickSize
  if (units > (1n << 32n) - 1n) throw new RangeError('Price exceeds uint32')
  return Number(units)
}

export function unitsToPrice(units: number | bigint, p: MarketParams): number {
  return Number(units) / Number(p.pricePrecision)
}

/** [U] Base times sizePrecision, floored; S2 must pin this to a real order. */
export function sizeToUnits(base: number, p: MarketParams): bigint {
  const [numerator, denominator] = fraction(base, p.sizePrecision)
  const units = numerator / denominator
  if (units > (1n << 96n) - 1n) throw new RangeError('Size exceeds uint96')
  return units
}

export function unitsToSize(units: bigint, p: MarketParams): number {
  return Number(units) / Number(p.sizePrecision)
}

export function bestBidAsk1e18(raw: readonly [bigint, bigint]): { bid: number | null; ask: number | null } {
  return {
    bid: raw[0] === (1n << 256n) - 1n ? null : Number(raw[0]) / 1e18,
    ask: raw[1] === 0n ? null : Number(raw[1]) / 1e18,
  }
}
