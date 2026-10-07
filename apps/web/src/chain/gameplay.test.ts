import { describe, expect, it } from 'vitest'
import { scoreFromFills, testnetMarkets } from '@monadboy/sdk'
import {
  cancelPairIds,
  projectMarketEvents,
  rawQuoteCeil,
  bufferedGas,
} from './gameplay'

const owner = '0x1111111111111111111111111111111111111111' as const
const tx = `0x${'a'.repeat(64)}` as const
const market = testnetMarkets[0]

describe('real gameplay consumer boundaries', () => {
  it('cancels once per linked pair, including a link on only the later order', () => {
    expect(
      cancelPairIds([
        { id: 3, linked: 0 },
        { id: 7, linked: 3 },
        { id: 8, linked: 0 },
      ]),
    ).toEqual([3, 8])
  })
  it('does not turn initial taker-direction fills into maker SCORE', () => {
    const events = [
      {
        kind: 'FlipOrderCreated',
        args: {
          orderId: 1,
          flippedId: 0,
          owner,
          size: '18200018200',
          price: 3296700,
          flippedPrice: 3299997,
          isBuy: true,
        },
        tx,
        at: 1,
        block: 1,
        index: 0,
      },
      {
        kind: 'Trade',
        args: {
          orderId: 1,
          makerAddress: owner,
          isBuy: false,
          price: '32967000000000000',
          filledSize: '18200018200',
        },
        tx,
        at: 2,
        block: 2,
        index: 0,
      },
      {
        kind: 'FlippedOrderCreated',
        args: {
          orderId: 5,
          flippedId: 0,
          owner,
          size: '18200018200',
          price: 3299997,
          flippedPrice: 3296700,
          isBuy: false,
        },
        tx,
        at: 2,
        block: 2,
        index: 1,
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
        at: 3,
        block: 3,
        index: 0,
      },
    ]
    const projected = projectMarketEvents(events, market, owner)
    expect(projected.fills.map((fill) => fill.isBuy)).toEqual([true, false])
    expect(projected.fills[0].isFlippedOrder).toBe(false)
    expect(scoreFromFills(projected.fills)).toBeCloseTo(0.0000600054600054, 12)
  })
  it('retains unknown order provenance as a coverage gap instead of a fake zero', () => {
    const projected = projectMarketEvents(
      [
        {
          kind: 'Trade',
          args: {
            orderId: 99,
            makerAddress: owner,
            isBuy: true,
            price: '33000000000000000',
            filledSize: '10000000000',
          },
          tx,
          at: 1,
          block: 1,
          index: 0,
        },
      ],
      market,
      owner,
    )
    expect(projected.missingOrigins).toEqual([99])
    expect(projected.fills).toEqual([])
  })
  it('bounds gas headroom and rounds quote deposits up to raw units', () => {
    expect(bufferedGas(258383n, 2000000n)).toBe(310060n)
    expect(() => bufferedGas(17909681n, 2000000n)).toThrow()
    expect(rawQuoteCeil(0.0603, 6)).toBe(60300n)
  })
})
