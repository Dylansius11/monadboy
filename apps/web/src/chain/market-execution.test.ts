import { beforeEach, expect, it, vi } from 'vitest'
import { testnetMarkets } from '@monadboy/sdk'
import { fundAndProvision, sendDiskTransaction } from './market-execution'
import type { DiskLease } from './card'
import type { ExecutionStep, FundingQuote } from './market-execution'
import type { PublicClient } from 'viem'
import type * as Viem from 'viem'

const wallet = vi.hoisted(() => ({ prepareTransactionRequest: vi.fn(), signTransaction: vi.fn() }))
vi.mock('viem', async (original) => ({ ...await original<typeof Viem>(), createWalletClient: () => wallet }))
vi.mock('./sender', () => ({ withSenderLock: async (_address: string, work: () => Promise<unknown>) => work(), waitForSender: async () => {}, rememberSenderBlock: vi.fn(), browserTransport: vi.fn() }))

const market = testnetMarkets[0]
const hash = `0x${'12'.repeat(32)}` as const
function setup() {
  let live = true
  const lease = { address: market.address, account: {}, isLive: () => live, assertLive() { if (!live) throw new Error('CARD_EJECTED') } } as DiskLease
  const client = { getCode: vi.fn().mockResolvedValue('0x01'), estimateGas: vi.fn().mockResolvedValue(100n), sendRawTransaction: vi.fn().mockResolvedValue(hash), waitForTransactionReceipt: vi.fn().mockResolvedValue({ blockNumber: 7n, gasUsed: 100n, effectiveGasPrice: 1n, status: 'success' }) }
  const steps: ExecutionStep[] = []
  const run = () => sendDiskTransaction(client as unknown as PublicClient, 'https://rpc.example', lease, { to: market.address, data: '0x', cap: 1000n }, 'Provision flip ladder', (step) => steps.push(step))
  return { lease, client, steps, run, eject: () => { live = false } }
}
beforeEach(() => {
  vi.clearAllMocks()
  wallet.prepareTransactionRequest.mockResolvedValue({})
  wallet.signTransaction.mockResolvedValue('0xab')
})
it('eject while checking provision cost terminates the unsent step without signing', async () => {
  const test = setup()
  const estimate = Promise.withResolvers<bigint>()
  test.client.estimateGas.mockReturnValue(estimate.promise)
  const running = test.run()
  await vi.waitFor(() => expect(test.steps.at(-1)?.state).toBe('checking'))
  test.eject()
  estimate.resolve(100n)
  await expect(running).rejects.toThrow('CARD_EJECTED')
  expect(test.steps.at(-1)).toMatchObject({ step: 'Provision flip ladder', state: 'not-sent', detail: 'card ejected' })
  expect(wallet.signTransaction).not.toHaveBeenCalled()
})
it('an estimate network error terminates the unsent step', async () => {
  const test = setup()
  test.client.estimateGas.mockRejectedValue(new Error('RPC offline'))
  await expect(test.run()).rejects.toThrow('RPC offline')
  expect(test.steps.at(-1)).toMatchObject({ state: 'not-sent' })
})
it('a receipt network error keeps the broadcast hash and marks confirmation unavailable', async () => {
  const test = setup()
  test.client.waitForTransactionReceipt.mockRejectedValue(new Error('RPC offline'))
  await expect(test.run()).rejects.toThrow('RPC offline')
  expect(test.steps.at(-1)).toMatchObject({ state: 'unconfirmed', hash })
})
it('eject after broadcast still publishes the real confirmed receipt', async () => {
  const test = setup()
  test.client.waitForTransactionReceipt.mockImplementation(async () => {
    test.eject()
    return { blockNumber: 7n, gasUsed: 100n, effectiveGasPrice: 1n, status: 'success' }
  })
  await test.run()
  expect(test.steps.at(-1)).toMatchObject({ state: 'confirmed', receipt: { hash, status: 'success' } })
})
it('an expired quote rejects before any funding transaction', async () => {
  const test = setup()
  const quote = { at: Date.now() - 60001 } as FundingQuote
  await expect(fundAndProvision(test.client as unknown as PublicClient, 'https://rpc.example', test.lease, market, quote, (step) => test.steps.push(step), async () => {})).rejects.toThrow('Quote expired')
  expect(test.steps).toEqual([])
  expect(wallet.signTransaction).not.toHaveBeenCalled()
})
it('the broadcast request is not described as unsent while its RPC response is pending', async () => {
  const test = setup()
  const pending = Promise.withResolvers<typeof hash>()
  test.client.sendRawTransaction.mockReturnValue(pending.promise)
  const running = test.run()
  await vi.waitFor(() => expect(test.client.sendRawTransaction).toHaveBeenCalledOnce())
  expect(test.steps.at(-1)?.state).toBe('broadcast')
  test.eject()
  pending.reject(new Error('RPC response lost'))
  await expect(running).rejects.toThrow('RPC response lost')
  expect(test.steps.at(-1)).toMatchObject({ state: 'unconfirmed' })
})
