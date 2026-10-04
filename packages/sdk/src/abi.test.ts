import { describe, expect, it } from 'vitest'
import { decodeEventLog, encodeAbiParameters, toEventSelector } from 'viem'
import { kuruOrderbookAbi } from './abi/kuru-orderbook'

// Full topics: docs/research/kuru.md, cast keccak '<canonical signature>'.
const topics = {
  Trade: '0xf16924fba1c18c108912fcacaac7450c98eb3f2d8c0a3cdf3df7066c08f21581',
  FlipOrderCreated: '0xf81d3fdea8a7ee9c5c09179882e1bce1c513a741146e453167d9e8912c8eb3aa',
  FlippedOrderCreated: '0x49496a41b922bdba3ff7f57bb0992ab1a1a3ee95b5ae5bd7271c67861f018352',
  FlipOrderUpdated: '0xb74e966bc873b8c144fab39c9981210f50130885e89caf4556c0840cec741dcd',
  FlipOrdersCanceled: '0x5f815e5292cf3b123df58ad6d4531c085d94d5717a3b02740369a04273fde96c',
  OrdersCanceled: '0x386974f41b61738b510019ccd5a3524a43eccf0d136929e09d524e87aeeca2c4',
  OrderCreated: '0xb81bbaf150467ef3096ed6220cb963abc169bffd2eb88f26c47359ef344cf94c',
} as const

describe('live OrderBook events', () => {
  it.each(Object.entries(topics))('%s retains its live topic', (name, topic) => {
    const event = kuruOrderbookAbi.filter((item) => item.type === 'event').find((item) => item.name === name)
    expect(event).toBeDefined()
    expect(toEventSelector(event!)).toBe(topic)
  })

  it('decodes a non-indexed Trade price larger than uint32', () => {
    const address = '0x0000000000000000000000000000000000000000'
    const data = encodeAbiParameters(
      [{ type: 'uint40' }, { type: 'address' }, { type: 'bool' }, { type: 'uint256' },
        { type: 'uint96' }, { type: 'address' }, { type: 'address' }, { type: 'uint96' }],
      [1, address, true, 33364000000000000n, 10n, address, address, 5n],
    )
    const decoded = decodeEventLog({ abi: kuruOrderbookAbi, eventName: 'Trade', strict: true, data, topics: [topics.Trade] })
    expect(decoded.eventName).toBe('Trade')
    expect(decoded.args?.price).toBe(33364000000000000n)
    expect(decoded.args?.filledSize).toBe(5n)
  })
})
