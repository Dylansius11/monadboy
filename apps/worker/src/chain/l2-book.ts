import type { Hex, PublicClient } from 'viem'
import { kuruOrderbookAbi } from '@monadboy/sdk'
import type { Market, MarketParams } from '@monadboy/sdk'

export type L2Book = {
  block: bigint
  bids: { price: number; size: number }[]
  asks: { price: number; size: number }[]
}

// Kuru layout [V, two real captures]: block word, bid price/size pairs, a zero word, ask pairs to EOF.
// An empty book is just the block word and the bid terminator (2 words).
export function decodeL2Book(
  data: Hex,
  params: Pick<MarketParams, 'pricePrecision' | 'sizePrecision'>,
): L2Book {
  if (!/^0x(?:[a-fA-F0-9]{64}){2,}$/.test(data))
    throw new Error('Invalid L2 word layout')
  let offset = 66
  const book: L2Book = { block: BigInt(data.slice(0, 66)), bids: [], asks: [] }
  for (const side of [book.bids, book.asks]) {
    let terminated = false
    while (offset < data.length) {
      const price = BigInt(`0x${data.slice(offset, offset + 64)}`)
      offset += 64
      if (price === 0n) {
        terminated = true
        break
      }
      if (offset + 64 > data.length) throw new Error('Missing L2 size')
      const size = BigInt(`0x${data.slice(offset, offset + 64)}`)
      offset += 64
      side.push({
        price: Number(price) / Number(params.pricePrecision),
        size: Number(size) / Number(params.sizePrecision),
      })
    }
    if (!terminated && side === book.bids)
      throw new Error('Missing L2 bid terminator')
  }
  if (offset !== data.length) throw new Error('Trailing L2 words')
  return book
}

// Quote-unit value of resting orders within `band` (a fraction) of the mid, both sides.
export function depthWithinBand(
  book: L2Book,
  mid: number | null,
  band: number,
): number {
  if (mid === null || mid <= 0) return 0
  let depth = 0
  for (const side of [book.bids, book.asks]) {
    for (const level of side)
      if (Math.abs(level.price / mid - 1) <= band)
        depth += level.price * level.size
  }
  return depth
}

// Two reads per market: the best prices (1e18 scale) and the packed L2 book at the same head.
export function createBookReader(client: PublicClient) {
  return async (
    market: Market,
  ): Promise<{ raw: Hex; best: readonly [bigint, bigint] }> => {
    const [best, raw] = await Promise.all([
      client.readContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: 'bestBidAsk',
      }),
      client.readContract({
        address: market.address,
        abi: kuruOrderbookAbi,
        functionName: 'getL2Book',
      }),
    ])
    return { raw, best }
  }
}
