import type { Address, PublicClient } from 'viem'
import { kuruOrderbookAbi } from '@monadboy/sdk'

// Filled plain orders can retain positive s_orders storage. Actual price-point linked
// membership, not owner/size alone, determines whether inventory is still resting.
export async function readActiveOrder(
  client: PublicClient,
  market: Address,
  id: number,
  blockNumber: bigint,
) {
  const order = await client.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 's_orders',
    args: [id],
    blockNumber,
  })
  if (order[1] === 0n) return null
  const point = await client.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: order[7] ? 's_buyPricePoints' : 's_sellPricePoints',
    args: [BigInt(order[5])],
    blockNumber,
  })
  let cursor = point[0]
  const visited = new Set<number>()
  while (cursor !== 0) {
    if (visited.has(cursor))
      throw new Error('Cyclic order price-point membership')
    visited.add(cursor)
    if (cursor === id) return order
    const entry = await client.readContract({
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 's_orders',
      args: [cursor],
      blockNumber,
    })
    if (entry[5] !== order[5] || entry[7] !== order[7])
      throw new Error('Inconsistent order price-point membership')
    cursor = entry[3]
  }
  return null
}
