import { expect, it } from 'vitest'
import { createPositionReader, MARGIN, reachableOrderIds } from './gameplay'
import { kuruMarginAccountAbi, kuruOrderbookAbi, testnetMarkets } from '@monadboy/sdk'
import { createPublicClient, custom, decodeFunctionData, encodeAbiParameters, encodeFunctionResult } from 'viem'
import type { Hex } from 'viem'

it('a detached fully-filled order cannot double count holdings or become a cancel input merely because stale storage retains size', () => {
  const orders = new Map([
    [96, { next: 0 }],
    [97, { next: 0 }],
    [103, { next: 104 }],
    [104, { next: 0 }],
  ])
  expect([...reachableOrderIds(103, orders)]).toEqual([103, 104])
  expect(reachableOrderIds(0, orders).has(97)).toBe(false)
  expect(() =>
    reachableOrderIds(
      103,
      new Map([
        [103, { next: 104 }],
        [104, { next: 103 }],
      ]),
    ),
  ).toThrow()
})
it('membership traversal and owned-order projection read each order only once per snapshot', async () => {
  const market = testnetMarkets[0]
  const owner = '0x1111111111111111111111111111111111111111'
  const orderReads: number[] = []
  const client = createPublicClient({
    transport: custom({
      request: async ({ method, params }) => {
        if (method === 'eth_blockNumber') return '0x1000'
        if (method === 'eth_getBalance') return '0x0'
        if (method === 'eth_getLogs') return []
        if (method !== 'eth_call') throw new Error(`Unexpected read ${method}`)
        const [call] = params as [{ to: string; data: Hex }]
        if (call.to.toLowerCase() === market.address.toLowerCase()) {
          const decoded = decodeFunctionData({ abi: kuruOrderbookAbi, data: call.data })
          if (decoded.functionName === 's_orderIdCounter')
            return encodeFunctionResult({ abi: kuruOrderbookAbi, functionName: 's_orderIdCounter', result: 2 })
          if (decoded.functionName === 'bestBidAsk')
            return encodeFunctionResult({ abi: kuruOrderbookAbi, functionName: 'bestBidAsk', result: [0n, 0n] })
          if (decoded.functionName === 's_buyPricePoints')
            return encodeFunctionResult({ abi: kuruOrderbookAbi, functionName: 's_buyPricePoints', result: [1, 2] })
          if (decoded.functionName !== 's_orders') throw new Error('Unexpected order read')
          const id = Number(decoded.args[0])
          orderReads.push(id)
          return encodeFunctionResult({
            abi: kuruOrderbookAbi, functionName: 's_orders',
            result: [owner, 100000n, id === 1 ? 0 : 1, id === 1 ? 2 : 0, 0, 3296700, 0, true],
          })
        }
        if (call.to.toLowerCase() === MARGIN.toLowerCase()) {
          const decoded = decodeFunctionData({ abi: kuruMarginAccountAbi, data: call.data })
          if (decoded.functionName !== 'getBalance') throw new Error('Unexpected margin read')
        }
        return encodeAbiParameters([{ type: 'uint256' }], [0n])
      },
    }),
  })
  const position = await createPositionReader(client, market, owner)(null)
  expect(position.orders.map((order) => order.id)).toEqual([1, 2])
  expect(orderReads).toEqual([1, 2])
})
