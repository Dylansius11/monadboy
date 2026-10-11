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

it('unknown fill coverage shows equally visible unavailable SCORE and DAMAGE while keyboard withdrawal still works with the book paused', () => {
  const state = actualRead()
  state.position!.paused = true
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
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw to disk' }))
  expect(controls.withdraw).toHaveBeenCalledOnce()
  press('A')
  expect(controls.withdraw).toHaveBeenCalledTimes(2)
  expect(controls.quote).not.toHaveBeenCalled()
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
  state.position!.mid = 0.04
  const controls = actions()
  const view = renderScreen(<FundedLive state={state} actions={controls} />)
  press('A')
  press('A')
  expect(controls.recenter).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Exit and re-center' }),
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
  press('SELECT')
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
  // Opening MANUAL applies editable edges around the book mid at once.
  const [applied] = controls.setManual.mock.calls[0]
  expect(applied.low).toBeLessThan(0.033)
  expect(applied.high).toBeGreaterThan(0.033)
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
  expect(screen.getByText('Observed maker fills').nextElementSibling).toHaveTextContent('Unavailable')
  expect(screen.queryByText('Run aborted')).not.toBeInTheDocument()
  view.rerender(<FundedLive state={state} actions={controls} />)
  press('START')
  expect(screen.getByText(/Unavailable observed maker fills, Unavailable flipped-origin/)).toBeInTheDocument()
})

function quoted(state: GameplayState): NonNullable<GameplayState['quote']> {
  return {
    ladder: { step: 0.02, levels: 2, low: 0.0317, high: 0.0343, clamped: true, baseNeeded: 3.6, quoteNeeded: 0.12, zapQuote: 0.12,
      orders: [0.0317, 0.0324, 0.0336, 0.0343].map((price, index) => ({ price, flipPrice: price, size: 1, isBuy: index < 2, priceUnits: 0, flipUnits: 0, sizeUnits: 0n })) },
    block: state.position!.block, at: Date.now(), zapRaw: 1n, depositRaw: 1n, minimumBaseRaw: 1n, quotedBase: 3.6,
    takerFeeQuote: 0.0004, gasPrice: 1n, sampleGas: 1n, gasCostMon: 0.15, quoteRequired: 0.24,
  }
}

it('confirming ticks off the actual steps in order, with the ones still to run listed as waiting', () => {
  const state = actualRead()
  state.position!.orders = []
  state.quote = quoted(state)
  state.busy = true
  const hash = `0x${'78'.repeat(32)}` as const
  state.steps = [
    { step: 'Approve AUSD', state: 'confirmed', hash, receipt: { step: 'Approve AUSD', hash, block: 12n, estimate: 1n, gas: 2n, gasUsed: 1n, effectiveGasPrice: 1n, status: 'success' } },
    { step: 'Deposit AUSD', state: 'broadcast' },
  ]
  renderScreen(<FundedRange state={state} actions={actions()} />)
  const rows = [...screen.getByRole('list', { name: 'Actual transaction steps' }).querySelectorAll('li')]
  expect(rows.map((row) => [row.querySelector('.funded-step-name')!.textContent, row.dataset.state])).toEqual([
    ['Approve AUSD', 'confirmed'],
    ['Deposit AUSD', 'broadcast'],
    ['Zap MON to margin', 'waiting'],
    ['Provision flip ladder', 'waiting'],
  ])
  expect(rows[0]).toHaveTextContent('#12')
  expect(screen.queryByRole('button', { name: 'MAX' })).not.toBeInTheDocument()
})

it('a quote is reviewed in place: A confirms, B returns to editing instead of leaving', () => {
  const state = actualRead()
  state.position!.orders = []
  state.quote = quoted(state)
  const controls = actions()
  renderScreen(<FundedRange state={state} actions={controls} />)
  expect(screen.getByText('Capped by depth or minimum order size. These are the actual edges.')).toBeInTheDocument()
  expect(screen.getByText('0.150000 MON, not a ceiling')).toBeInTheDocument()
  press('B')
  expect(controls.clearQuote).toHaveBeenCalledOnce()
  expect(controls.back).not.toHaveBeenCalled()
  press('A')
  expect(controls.confirm).toHaveBeenCalledOnce()
})

it('an exit with nothing on the book and no fills is an aborted run with funds returned, not three unavailable totals', () => {
  const state = actualRead()
  state.result = {
    market: testnetMarkets[0].address, openedAt: null, closedAt: 3,
    score: null, damage: null, net: null, fills: 0, receipts: [], complete: false, onBook: false,
  }
  const view = renderScreen(<FundedResults state={state} actions={actions()} />)
  expect(screen.getAllByText('Run aborted').length).toBeGreaterThan(0)
  expect(screen.getByText('Funds returned')).toBeInTheDocument()
  expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
  expect(screen.getByText('AUSD').nextElementSibling).toHaveTextContent('10.000000')
  // A real run, or a save from before the flag existed, keeps its measured figures.
  view.rerender(<FundedResults state={{ ...state, result: { ...state.result, onBook: true } }} actions={actions()} />)
  expect(screen.queryByText('Funds returned')).not.toBeInTheDocument()
  expect(screen.getAllByText('Unavailable')).toHaveLength(3)
})

it('a quote that stretched to cover the DEMO target says so on Set Range, and says nothing otherwise', () => {
  const state = actualRead()
  state.position!.orders = []
  state.demoMultiplier = 20
  state.quote = quoted(state)
  const plain = renderScreen(<FundedRange state={state} actions={actions()} />)
  expect(screen.queryByText(/catching up to the/)).toBeNull()
  plain.unmount()
  state.rangeNote = 'COVERS_TARGET'
  renderScreen(<FundedRange state={state} actions={actions()} />)
  expect(screen.getByText('TESTNET book is catching up to the DEMO target; range stretched to cover both.')).toBeInTheDocument()
})
