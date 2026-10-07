import type { Disk } from 'generated'
import markets from '../../../packages/sdk/src/markets.testnet.json' with { type: 'json' }

export const orderId = (market: string, id: bigint) =>
  `${market.toLowerCase()}_${id}`

export function paramsFor(address: string) {
  const market = markets.find(
    (row) => row.address.toLowerCase() === address.toLowerCase(),
  )
  if (!market || market.chain !== 'testnet')
    throw new Error(`No verified testnet params for indexed market ${address}`)
  return {
    pricePrecision: Number(market.params.pricePrecision),
    sizePrecision: Number(market.params.sizePrecision),
  }
}

export function emptyDisk(id: string): Disk {
  return {
    id: id.toLowerCase(),
    score: 0,
    fills: 0,
    lastFillAt: 0n,
    saves: 0,
    scoreComplete: true,
    lastSaveBlock: 0n,
    lastSaveLogIndex: -1,
  }
}
