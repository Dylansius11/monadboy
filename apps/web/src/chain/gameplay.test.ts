import { describe, expect, it } from 'vitest'
import { kuruMarginAccountAbi, kuruOrderbookAbi, planLadder, scoreFromFills, testnetMarkets } from '@monadboy/sdk'
import { createPublicClient, custom, decodeFunctionData, encodeAbiParameters } from 'viem'
import { quoteFunding } from './market-execution'
import type { Hex } from 'viem'
import type { PositionRead } from './gameplay'
import {
  cancelPairIds,
  projectMarketEvents,
  rawQuoteCeil,
  bufferedGas,
  createPositionReader,
  MARGIN,
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
  it('rejects a minimum-base preview when the buffered fill-or-kill input exceeds all asks', async () => {
    const ladder = planLadder({
      mid: 0.033,
      mode: 'TIGHT',
      budgetQuote: 0.4752,
      sigmaDaily: 0,
      manual: { low: 0.032934, high: 0.033066 },
      params: market.params,
    })
    await expect(
      quoteFunding(historicalBookClient(), market, ladder, unfundedPosition),
    ).rejects.toThrow()
  })
  it('keeps fee and slippage funding for a ladder within the same historical ask capacity', async () => {
    const ladder = planLadder({
      mid: 0.033,
      mode: 'TIGHT',
      budgetQuote: 0.24,
      sigmaDaily: 0,
      manual: { low: 0.032934, high: 0.033066 },
      params: market.params,
    })
    const quote = await quoteFunding(
      historicalBookClient(),
      market,
      ladder,
      unfundedPosition,
    )
    expect(quote.minimumBaseRaw).toBe(3636363636200000000n)
    expect(quote.zapRaw).toBe(121654n)
    expect(quote.depositRaw).toBe(241654n)
    expect(quote.takerFeeQuote).toBeCloseTo(0.00036134651496390335, 12)
  })
  it('recovers margin funds without any ladder or sealed basis from public chain balances', async () => {
    let failHistory = false
    let failBalance = false
    const client = createPublicClient({
      transport: custom({
        request: async ({ method, params }) => {
          if (method === 'eth_blockNumber') return '0x1000'
          if (method === 'eth_getBalance') return '0x0'
          if (method === 'eth_getLogs') {
            if (failHistory) throw new Error('Log history unavailable')
            return []
          }
          if (method !== 'eth_call') throw new Error(`Unexpected read ${method}`)
          const [call, snapshotBlock] = params as [{ to: string; data: Hex }, string]
          expect(snapshotBlock).toBe('0x1000')
          let amount = 0n
          if (call.to.toLowerCase() === MARGIN.toLowerCase()) {
            if (failBalance) throw new Error('Balance unavailable')
            const decoded = decodeFunctionData({ abi: kuruMarginAccountAbi, data: call.data })
            if (decoded.functionName !== 'getBalance') throw new Error('Unexpected margin read')
            amount = decoded.args[1].toLowerCase() === market.baseToken.toLowerCase()
              ? 2n * 10n ** BigInt(market.params.baseDecimals)
              : 120000n
          } else if (call.to.toLowerCase() === market.address.toLowerCase()) {
            const decoded = decodeFunctionData({ abi: kuruOrderbookAbi, data: call.data })
            if (decoded.functionName === 'bestBidAsk')
              return encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [0n, 0n])
            if (decoded.functionName !== 's_orderIdCounter')
              throw new Error('Unexpected order read')
          }
          return encodeAbiParameters([{ type: 'uint256' }], [amount])
        },
      }),
    })
    const position = await createPositionReader(client, market, owner)(null)
    expect(position.orders).toEqual([])
    expect(position.holdings).toMatchObject({ marginBase: 2, marginQuote: 0.12 })
    expect(position.valuation).toBeNull()
    failHistory = true
    const recovered = await createPositionReader(client, market, owner)(null)
    expect(recovered).toMatchObject({
      orders: [],
      holdings: { marginBase: 2, marginQuote: 0.12 },
      complete: false,
      historyError: expect.any(String),
      valuation: null,
    })
    failBalance = true
    await expect(createPositionReader(client, market, owner)(null)).rejects.toThrow('Balance unavailable')
  })
})

// Public MON-AUSD getL2Book capture at block 69567406, before the S22 zap.
function historicalBookClient() {
  const words = [
    69567406n,
    3298142n, 434450669n,
    3296700n, 18241269831n,
    3295256n, 18243838631n,
    3293400n, 18236476264n,
    3292164n, 18225094497n,
    0n,
    3301441n, 17764026544n,
    3303300n, 18181818181n,
    3304533n, 18190921911n,
    3306600n, 18181818181n,
  ]
  const book: Hex = `0x${words.map((word) => word.toString(16).padStart(64, '0')).join('')}`
  return createPublicClient({
    transport: custom({
      request: async ({ method }) => {
        if (method === 'eth_call')
          return encodeAbiParameters([{ type: 'bytes' }], [book])
        if (method === 'eth_gasPrice') return '0x174876e800'
        throw new Error(`Unexpected public RPC method: ${method}`)
      },
    }),
  })
}

const unfundedPosition: PositionRead = {
  block: 69567406n,
  head: 69567406n,
  mid: 0.033,
  bid: 0.03298142,
  ask: 0.03301441,
  paused: false,
  walletBase: 1,
  walletQuote: 1,
  holdings: { marginBase: 0, marginQuote: 0, restingBase: 0, restingQuote: 0 },
  orders: [],
  marginBaseRaw: 0n,
  marginQuoteRaw: 0n,
  fills: [],
  missingOrigins: [],
  complete: false,
  source: 'INDEXED',
  coverageFrom: 69567406n,
  valuation: null,
  observedAt: 0,
}
