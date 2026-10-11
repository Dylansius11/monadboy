// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { testnetMarkets } from '@monadboy/sdk'
import { FundedLive } from './FundedLive'
import { FundedRange } from './FundedRange'
import { FundedResults } from './FundedResults'
import { renderScreen, press } from '../../test/harness'
import type { GameplayState } from '../../chain/gameplay-store'

function actualRead(): GameplayState {
  return {
    status: 'ready',
    market: testnetMarkets[0],
    owner: '0x1111111111111111111111111111111111111111',
    amount: 0.24,
    width: 'wide',
    manual: null,
    sourceFresh: true,
    sourceMid: 0.033,
    mainnetMid: 0.033,
    demoMultiplier: 1,
    demandError: null,
    source: 'kuru-mainnet:MON_USDC',
    sigmaDaily: 0.02,
    busy: false,
    steps: [],
    receipts: [],
    error: null,
    readError: null,
    saveError: null,
    saved: null,
    result: null,
    allowed: true,
    gateReason: null,
    basis: {
      openedAt: 1,
      startBlock: 10n,
      deposit: { base0: 4, quote0: 0.12 },
      low: 0.0328,
      high: 0.0332,
      step: 0.001,
    },
    quote: null,
    exitCostMon: null,
    position: {
      block: 11n,
      head: 11n,
      mid: 0.033,
      bid: 0.03299,
      ask: 0.03301,
      paused: false,
      walletBase: 0.5,
      walletQuote: 10,
      marginBaseRaw: 0n,
      marginQuoteRaw: 0n,
      holdings: {
        marginBase: 0,
        marginQuote: 0,
        restingBase: 4,
        restingQuote: 0.12,
      },
      orders: [
        {
          id: 3,
          linked: 7,
          price: 0.0331,
          flipPrice: 0.033,
          size: 4,
          isBuy: false,
          isFlip: true,
        },
      ],
      fills: [],
      missingOrigins: [99],
      complete: false,
      source: 'INDEXER OFFLINE',
      coverageFrom: 10n,
      valuation: null,
      observedAt: Date.now(),
    },
  }
}
function actions() {
  return {
    clearQuote: vi.fn(),
    quote: vi.fn(),
    quoteExit: vi.fn(),
    confirm: vi.fn(),
    withdraw: vi.fn(),
    recenter: vi.fn(),
    refresh: vi.fn(),
    setAmount: vi.fn(),
    setWidth: vi.fn(),
    setManual: vi.fn(),
    retrySave: vi.fn(),
    back: vi.fn(),
    openLive: vi.fn(),
  }
}

it('unknown fill coverage shows equally visible unavailable SCORE and DAMAGE while keyboard withdrawal still works with source paused', () => {
  const state = actualRead()
  state.sourceFresh = false
  const controls = actions()
  renderScreen(<FundedLive state={state} actions={controls} />)
  expect(screen.getAllByText('Unavailable')).toHaveLength(3)
  expect(screen.getByText('PRICE FEED PAUSED')).toBeInTheDocument()
  press('B')
  expect(controls.withdraw).toHaveBeenCalledOnce()
  expect(controls.recenter).not.toHaveBeenCalled()
})
it('confirmed partial funding exposes recovery and never makes the optional failed history save a withdrawal gate', () => {
  const state = actualRead()
  state.saveError = 'SAVE_COST_FAILED'
  state.position!.orders = []
  state.position!.holdings.marginQuote = 0.12
  const controls = actions()
  renderScreen(<FundedRange state={state} actions={controls} />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Withdraw confirmed partial funds' }),
  )
  expect(controls.withdraw).toHaveBeenCalledOnce()
  expect(controls.confirm).not.toHaveBeenCalled()
})
it('an unavailable recovered result links the real successful exit and allows play to leave while sealed-save retry stays optional', () => {
  const state = actualRead()
  const tx = `0x${'12'.repeat(32)}` as const
  state.result = {
    market: testnetMarkets[0].address,
    openedAt: null,
    closedAt: 3,
    score: null,
    damage: null,
    net: null,
    fills: 1,
    receipts: [tx],
    complete: false,
  }
  state.saveError = 'save failed'
  const controls = actions()
  renderScreen(<FundedResults state={state} actions={controls} />)
  expect(
    screen.getByRole('link', { name: 'Open actual exit step 1' }),
  ).toHaveAttribute('href', expect.stringContaining(tx))
  press('A')
  expect(controls.back).toHaveBeenCalledOnce()
  expect(controls.retrySave).not.toHaveBeenCalled()
})

it('keyboard cannot start re-center before its exit cost is available, but accepts a real zero-cost quote', () => {
  const state = actualRead()
  state.sourceMid = 0.04
  const controls = actions()
  const view = renderScreen(<FundedLive state={state} actions={controls} />)
  press('A')
  press('A')
  expect(controls.recenter).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'A Exit and review re-center' }),
  ).toBeDisabled()
  view.rerender(
    <FundedLive state={{ ...state, exitCostMon: 0 }} actions={controls} />,
  )
  press('A')
  expect(controls.recenter).toHaveBeenCalledOnce()
})

it('the live refresh key refreshes chain state and Inputs never withdraws', () => {
  const state = actualRead()
  const controls = actions()
  renderScreen(<FundedLive state={state} actions={controls} />)
  fireEvent.click(screen.getByRole('button', { name: 'SELECT Refresh' }))
  expect(controls.refresh).toHaveBeenCalledOnce()
  press('START')
  press('B')
  expect(controls.withdraw).not.toHaveBeenCalled()
  expect(screen.getByRole('img', { name: 'Price against your range' })).toBeInTheDocument()
})

it('a failed optional results save can retry without leaving the confirmed exit', () => {
  const state = actualRead()
  state.result = {
    market: testnetMarkets[0].address, openedAt: 1, closedAt: 3,
    score: 0.001, damage: 0.0002, net: 0.0008, fills: 1,
    receipts: [], complete: true,
  }
  state.saveError = 'save failed'
  const controls = actions()
  renderScreen(<FundedResults state={state} actions={controls} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry optional sealed history save' }))
  expect(controls.retrySave).toHaveBeenCalledOnce()
  expect(controls.back).not.toHaveBeenCalled()
})

it('range setup exposes equal manual and amount keys without inventing an unquoted ladder', () => {
  const state = actualRead()
  if (state.position) state.position.orders = []
  state.basis = null
  const controls = actions()
  renderScreen(<FundedRange state={state} actions={controls} />)
  expect(screen.getByText('How much?')).toBeInTheDocument()
  expect(screen.getByText('TESTNET')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Ladder unavailable until actual quote' })).toBeInTheDocument()
  expect(screen.queryByText('YOU WILL HOLD')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'MANUAL' }))
  expect(screen.getByRole('spinbutton', { name: 'Low price' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'MAX' }))
  expect(controls.setAmount).toHaveBeenCalledWith(10)
  press('A')
  expect(controls.quote).toHaveBeenCalledOnce()
})

it('range notices and receipt states preserve accessible evidence and recovery', () => {
  const state = actualRead()
  const tx = `0x${'34'.repeat(32)}` as const
  state.error = 'Card ejected. Insert the same disk to recover.'
  state.steps = [{ step: 'deposit', state: 'confirmed', hash: tx }]
  renderScreen(<FundedRange state={state} actions={actions()} />)
  expect(screen.getByRole('alert')).toHaveTextContent(state.error)
  expect(screen.getByRole('list', { name: 'Actual transaction steps' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open deposit transaction' })).toHaveAttribute('href', expect.stringContaining(tx))
})

it('a mined reverted receipt never appears as a successful funded step', () => {
  const state = actualRead()
  const hash = `0x${'56'.repeat(32)}` as const
  state.steps = [{
    step: 'provision', state: 'confirmed', hash,
    receipt: { step: 'provision', hash, block: 12n, estimate: 100n, gas: 120n, gasUsed: 110n, effectiveGasPrice: 1n, status: 'reverted' },
  }]
  renderScreen(<FundedRange state={state} actions={actions()} />)
  const row = screen.getByRole('list', { name: 'Actual transaction steps' }).querySelector('li')!
  expect(row).toHaveAttribute('data-state', 'reverted')
  expect(row).toHaveTextContent('reverted')
  expect(row).not.toHaveTextContent('OK')
})

it('unavailable fill history stays unavailable in results and live Inputs, never an invented zero', () => {
  const state = actualRead()
  state.position = state.position && { ...state.position, historyError: 'Logs unavailable' }
  state.result = {
    market: testnetMarkets[0].address, openedAt: null, closedAt: 3,
    score: null, damage: null, net: null, fills: null, receipts: [], complete: false,
  }
  const controls = actions()
  const view = renderScreen(<FundedResults state={state} actions={controls} />)
  expect(screen.getByText('Unavailable observed maker fills')).toBeInTheDocument()
  expect(screen.queryByText('0 observed maker fills')).not.toBeInTheDocument()
  view.rerender(<FundedLive state={state} actions={controls} />)
  press('START')
  expect(screen.getByText(/Unavailable observed maker fills, Unavailable flipped-origin/)).toBeInTheDocument()
})
