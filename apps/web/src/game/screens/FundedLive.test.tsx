// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { testnetMarkets } from '@monadboy/sdk'
import { ConsoleInputProvider } from '../../console/useConsoleInput'
import { FundedLive } from './FundedLive'
import type { GameplayState } from '../../chain/gameplay-store'
import type { Actions } from './FundedGameplayView'

const { play } = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('../../sound/SoundProvider', () => ({ useSound: () => ({ play }) }))

it('missing indexed fills cannot replay coins when coverage returns, but a new flip earns one coin', () => {
  const fill = { tx: `0x${'12'.repeat(32)}` as const, orderId: 3n, price: 0.033,
    flipPrice: 0.0331, size: 1, isBuy: true, isFlippedOrder: true, at: 1 }
  const state: GameplayState = {
    status: 'ready', market: testnetMarkets[0], owner: '0x1111111111111111111111111111111111111111',
    amount: 0.24, width: 'wide', manual: null, sourceFresh: true,
    sourceMid: 0.033, mainnetMid: 0.033, demoMultiplier: 1, demandError: null,
    source: 'kuru-mainnet:MON_USDC', sigmaDaily: 0.02, busy: false, steps: [], receipts: [],
    error: null, readError: null, saveError: null, saved: null, result: null,
    allowed: true, gateReason: null, quote: null, exitCostMon: null,
    basis: { openedAt: 1, startBlock: 10n, deposit: { base0: 4, quote0: 0.12 }, low: 0.0328, high: 0.0332, step: 0.001 },
    position: { block: 11n, head: 11n, mid: 0.033, bid: 0.03299, ask: 0.03301,
      paused: false, walletBase: 0.5, walletQuote: 10, marginBaseRaw: 0n, marginQuoteRaw: 0n,
      holdings: { marginBase: 0, marginQuote: 0, restingBase: 4, restingQuote: 0.12 },
      orders: [], fills: [fill], missingOrigins: [], complete: true, source: 'INDEXED',
      coverageFrom: 10n, valuation: null, observedAt: Date.now() },
  }
  const actions: Actions = {
    clearQuote() {}, quote() {}, quoteExit() {}, confirm() {}, withdraw() {}, recenter() {}, refresh() {},
    setAmount() {}, setWidth() {}, setManual() {}, retrySave() {}, back() {}, openLive() {},
  }
  const position = state.position
  if (!position) throw new Error('Test position missing')
  const view = render(<ConsoleInputProvider><FundedLive state={state} actions={actions} /></ConsoleInputProvider>)
  expect(play).not.toHaveBeenCalled()
  view.rerender(<ConsoleInputProvider><FundedLive state={{ ...state, position: { ...position, fills: [], source: 'INDEXER OFFLINE' } }} actions={actions} /></ConsoleInputProvider>)
  view.rerender(<ConsoleInputProvider><FundedLive state={state} actions={actions} /></ConsoleInputProvider>)
  expect(play).not.toHaveBeenCalled()
  const withNewFlip = { ...state, position: { ...position, fills: [fill, { ...fill, orderId: 4n }] } }
  view.rerender(<ConsoleInputProvider><FundedLive state={withNewFlip} actions={actions} /></ConsoleInputProvider>)
  expect(play).toHaveBeenCalledExactlyOnceWith('coin')
  view.rerender(<ConsoleInputProvider><FundedLive state={withNewFlip} actions={actions} /></ConsoleInputProvider>)
  expect(play).toHaveBeenCalledTimes(1)
})
