// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { testnetMarkets } from '@monadboy/sdk'
import { createGameplayController } from './gameplay-store'
import type { CardState } from './card-session'
import type { ExecutionStep, FundingQuote } from './market-execution'
import type * as Sdk from '@monadboy/sdk'
import type * as Config from './config'

const dependencies = vi.hoisted(() => ({ card: { getState: vi.fn(), subscribe: vi.fn(), lease: vi.fn() }, reader: vi.fn(), fund: vi.fn(), withdraw: vi.fn(), openDisk: vi.fn() }))
vi.mock('./card-store', () => ({ getCardManager: () => dependencies.card }))
vi.mock('./config', async (original) => ({ ...await original<typeof Config>(), readChainEnv: () => ({}), resolveRpcUrl: () => 'https://rpc.example', resolveWorkerUrl: () => 'https://worker.example', resolveRegistryAddress: () => '0x0000000000000000000000000000000000000001' }))
vi.mock('./registry', () => ({ createViemChain: () => ({ diskOf: async () => ({ createdAt: 1n, sealedData: '0x' }) }), verifyRegistry: async () => ({ address: '0x0000000000000000000000000000000000000001', chainId: 10143 }), saveDisk: vi.fn() }))
vi.mock('@monadboy/sdk', async (original) => ({ ...await original<typeof Sdk>(), openDisk: dependencies.openDisk }))
vi.mock('./gameplay', () => ({ createPositionReader: () => dependencies.reader }))
vi.mock('./sender', () => ({ gameplayClient: () => ({ getBlock: async () => ({ timestamp: 123n }) }), delay: vi.fn() }))
vi.mock('./market-execution', () => ({ verifyMarket: async (_client: unknown, market: unknown) => market, fundAndProvision: dependencies.fund, cancelAndWithdraw: dependencies.withdraw, quoteExitCost: vi.fn(), quoteFunding: vi.fn() }))
vi.mock('./mirror-demand', () => ({ createMirrorDemand: () => ({ pulse: async () => {}, stop: vi.fn() }) }))

const market = testnetMarkets[0]
let cardState: CardState
let listener: () => void
let live: boolean
beforeEach(() => {
  vi.clearAllMocks()
  live = true
  cardState = { phase: 'inserted', ceremony: null, serial: market.address, disks: { 1: market.address, 2: market.address, 3: market.address }, endedBy: null, error: null }
  dependencies.card.getState.mockImplementation(() => cardState)
  dependencies.card.subscribe.mockImplementation((next: () => void) => { listener = next; return () => {} })
  dependencies.card.lease.mockImplementation(() => ({ address: market.address, sealKey: {}, account: {}, isLive: () => live, assertLive() { if (!live) throw new Error('CARD_EJECTED') } }))
  dependencies.openDisk.mockResolvedValue({ v: 1, name: 'disk', characterId: 'molandak', palette: 'default', difficulty: 0, godMode: false, notes: '', createdAt: 1, runs: [] })
  dependencies.reader.mockResolvedValue({ orders: [], holdings: { marginBase: 2, marginQuote: 0.12, restingBase: 0, restingQuote: 0 }, block: 10n, fills: [], valuation: null })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
})
afterEach(() => vi.unstubAllGlobals())
it('eject immediately terminates checking while the RPC is still pending; reinsert recovers margin without a ladder', async () => {
  const instance = createGameplayController()
  await instance.open(market.address, 1)
  instance.useState.setState({ quote: { at: Date.now() } as FundingQuote })
  const pending = Promise.withResolvers<void>()
  dependencies.fund.mockImplementation(async (_client: unknown, _rpc: string, _lease: unknown, _market: unknown, _quote: unknown, publish: (step: ExecutionStep) => void) => {
    publish({ step: 'Deposit AUSD', state: 'confirmed', receipt: { step: 'Deposit AUSD', hash: '0x12', block: 7n, estimate: 100n, gas: 120n, gasUsed: 100n, effectiveGasPrice: 1n, status: 'success' } })
    publish({ step: 'Provision flip ladder', state: 'checking' })
    await pending.promise
    throw new Error('CARD_EJECTED')
  })
  const running = instance.confirm()
  await vi.waitFor(() => expect(instance.useState.getState().steps.at(-1)?.state).toBe('checking'))
  live = false
  cardState = { ...cardState, phase: 'ejected', serial: null, disks: null, endedBy: 'expired' }
  listener()
  expect(instance.useState.getState().steps.at(-1)).toMatchObject({ state: 'not-sent', detail: 'card ejected' })
  expect(instance.useState.getState().receipts).toHaveLength(1)
  expect(instance.useState.getState().busy).toBe(false)
  pending.resolve()
  expect(await running).toBe(false)
  live = true
  cardState = { ...cardState, phase: 'inserted', serial: market.address }
  listener()
  await instance.open(market.address, 1)
  expect(instance.useState.getState().position).toMatchObject({ orders: [], holdings: { marginBase: 2, marginQuote: 0.12 } })
  dependencies.withdraw.mockResolvedValue({ receipts: [], position: { fills: [], valuation: null, historyError: 'Fill history unavailable' } })
  expect(await instance.withdraw()).toBe(true)
  expect(instance.useState.getState().result?.fills).toBeNull()
})
it('double confirm during an in-flight operation cannot start another funded sequence', async () => {
  const instance = createGameplayController()
  await instance.open(market.address, 1)
  instance.useState.setState({ quote: { at: Date.now() } as FundingQuote })
  const pending = Promise.withResolvers<void>()
  dependencies.fund.mockReturnValue(pending.promise)
  const first = instance.confirm()
  expect(await instance.confirm()).toBe(false)
  expect(dependencies.fund).toHaveBeenCalledOnce()
  pending.reject(new Error('network unavailable'))
  expect(await first).toBe(false)
  expect(instance.useState.getState()).toMatchObject({ busy: false, quote: null })
})
it('opening live gameplay without a saved run basis still recovers chain-owned orders', async () => {
  dependencies.reader.mockResolvedValue({ orders: [{ id: 9, price: 0.03 }], holdings: { marginBase: 0, marginQuote: 0, restingBase: 2, restingQuote: 0.12 } })
  const instance = createGameplayController()
  await instance.open(market.address, 1)
  expect(instance.useState.getState()).toMatchObject({ status: 'ready', basis: null, position: { orders: [{ id: 9 }] } })
})
it('replacing the held card with the same serial discards the revoked gameplay lease', async () => {
  const instance = createGameplayController()
  await instance.open(market.address, 1)
  live = false
  listener()
  expect(instance.useState.getState()).toMatchObject({ status: 'idle', owner: null, position: null })
  live = true
  await instance.open(market.address, 1)
  expect(instance.useState.getState().status).toBe('ready')
})
