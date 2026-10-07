import { expect, it } from 'vitest'
import { projectMarketEvents } from './gameplay'
import { testnetMarkets } from '@monadboy/sdk'

it('a rewound same-block snapshot does not include a future maker fill cached by an earlier read', () => {
  const owner = '0x1111111111111111111111111111111111111111' as const
  const tx = `0x${'12'.repeat(32)}` as const
  const events = [
    {
      kind: 'FlippedOrderCreated',
      args: { orderId: 5, owner, flippedPrice: 3296700 },
      tx,
      at: 1,
      block: 100,
      index: 0,
    },
    {
      kind: 'Trade',
      args: {
        orderId: 5,
        makerAddress: owner,
        isBuy: true,
        price: '32999970000000000',
        filledSize: '18200018200',
      },
      tx,
      at: 2,
      block: 102,
      index: 0,
    },
  ]
  expect(
    projectMarketEvents(events, testnetMarkets[0], owner, 101n).fills,
  ).toEqual([])
  expect(
    projectMarketEvents(events, testnetMarkets[0], owner, 102n).fills[0].isBuy,
  ).toBe(false)
})
