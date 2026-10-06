import { expect, test } from 'bun:test'
import { mainnetMarkets } from '@monadboy/sdk'
import type { Hex } from 'viem'
import fixture from './fixtures/mon-usdc-l2.json'
import emptyFixture from './fixtures/mon-ausd-l2-empty.json'
import { decodeL2Book, depthWithinBand } from '../src/chain/l2-book'

const monUsdc = mainnetMarkets.find((market) => market.symbol === 'MON_USDC')!
const zero = '0'.repeat(64)
const word = (value: bigint) => value.toString(16).padStart(64, '0')

test('decodes the raw getL2Book response captured from mainnet block 110654890', () => {
  expect(fixture.market).toBe('MON_USDC')
  const book = decodeL2Book(fixture.raw as Hex, monUsdc.params)
  expect(book.block).toBe(110654890n)
  expect(book.bids).toHaveLength(30)
  expect(book.asks).toHaveLength(27)
  expect(book.bids[0]).toEqual({ price: 0.032444, size: 200 })
  expect(book.asks[0]).toEqual({ price: 0.032485, size: 5963.8029492491 })
  expect(book.asks.at(-1)).toEqual({ price: 0.0442, size: 49000 })
  // bids descend and asks ascend: the capture is a real, ordered book
  expect(book.bids.map((l) => l.price)).toEqual(
    [...book.bids.map((l) => l.price)].sort((a, b) => b - a),
  )
  expect(book.asks.map((l) => l.price)).toEqual(
    [...book.asks.map((l) => l.price)].sort((a, b) => a - b),
  )
})

test('depth counts both sides inside the band around the mid and excludes levels outside it', () => {
  const book = decodeL2Book(fixture.raw as Hex, monUsdc.params)
  const mid = (0.032444 + 0.032485) / 2
  const narrow = depthWithinBand(book, mid, 0.02)
  expect(narrow).toBeCloseTo(30342.73523032961, 4)
  expect(depthWithinBand(book, mid, 0.2)).toBeGreaterThan(narrow)
  expect(depthWithinBand(book, mid, 0)).toBe(0)
  expect(depthWithinBand(book, null, 0.02)).toBe(0)
})

test('the real MON_AUSD capture (empty book) decodes to no levels and zero depth', () => {
  const book = decodeL2Book(
    emptyFixture.raw as Hex,
    mainnetMarkets.find((market) => market.symbol === 'MON_AUSD')!.params,
  )
  expect(emptyFixture.raw).toHaveLength(2 + 128)
  expect(book).toEqual({ block: book.block, bids: [], asks: [] })
  expect(book.block).toBeGreaterThan(110_000_000n)
  expect(depthWithinBand(book, 1, 0.02)).toBe(0)
})

test('malformed layouts are rejected rather than guessed at', () => {
  expect(() => decodeL2Book('0x00', monUsdc.params)).toThrow()
  expect(() => decodeL2Book(`0x${zero}${word(1n)}`, monUsdc.params)).toThrow()
  // an ask price with no size word
  expect(() =>
    decodeL2Book(`0x${zero}${zero}${word(5n)}`, monUsdc.params),
  ).toThrow('Missing L2 size')
  // bids never terminated
  expect(() =>
    decodeL2Book(
      `0x${zero}${word(5n)}${word(1n)}${word(6n)}${word(1n)}`,
      monUsdc.params,
    ),
  ).toThrow('terminator')
})
