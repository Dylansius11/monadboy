import { beforeEach, expect, it, vi } from 'vitest'
import { testnetMarkets } from '@monadboy/sdk'
import { fundAndProvision, sendDiskTransaction, zapFailure } from './market-execution'
import { BaseError, RawContractError } from 'viem'
import type { DiskLease } from './card'
import type { ExecutionStep, FundingQuote } from './market-execution'
import type { PublicClient } from 'viem'
import type * as Viem from 'viem'

const wallet = vi.hoisted(() => ({ prepareTransactionRequest: vi.fn(), signTransaction: vi.fn() }))
vi.mock('viem', async (original) => ({ ...await original<typeof Viem>(), createWalletClient: () => wallet }))
vi.mock('./sender', () => ({ withSenderLock: async (_address: string, work: () => Promise<unknown>) => work(), waitForSender: async () => {}, rememberSenderBlock: vi.fn(), browserTransport: vi.fn(), delay: async (ms: number) => { vi.setSystemTime(Date.now() + ms) } }))

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

const word = (value: bigint) => value.toString(16).padStart(64, '0')
// Kuru L2 layout: block word, bids, a zero terminator, then ask (price, size) pairs.
const book = (asks: [number, number][]) =>
  `0x${word(1n)}${word(0n)}${asks.map(([price, size]) => word(BigInt(Math.round(price * 1e8))) + word(BigInt(Math.round(size * 1e10)))).join('')}` as const
const zapQuote = {
  at: Date.now(), depositRaw: 1_000_000n, zapRaw: 120_000n, minimumBaseRaw: 3n * 10n ** 18n,
  ladder: { orders: [], levels: 2 },
} as unknown as FundingQuote

function funding(books: string[]) {
  const test = setup()
  const reads = { book: 0 }
  const client = Object.assign(test.client, {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === 'allowance' ? 10n ** 12n : books[Math.min(reads.book++, books.length - 1)]),
    call: vi.fn(async () => ({ data: `0x${word(4n * 10n ** 18n)}` })),
  })
  const run = () => fundAndProvision(client as unknown as PublicClient, 'https://rpc.example', test.lease, market, { ...zapQuote, at: Date.now() }, (step) => test.steps.push(step), async () => {})
  return { ...test, client, run }
}

it('asks thinned after the deposit: waits for the mirror to refill, then swaps without fill-or-kill', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    const deep = book([[0.03, 10]])
    const test = funding([deep, book([]), book([]), deep])
    await test.run()
    expect(test.steps.some((step) => step.step === 'Zap MON to margin' && step.detail === 'waiting for TESTNET asks to refill')).toBe(true)
    expect(test.steps.filter((step) => step.state === 'confirmed').map((step) => step.step)).toEqual(['Deposit AUSD', 'Zap MON to margin', 'Provision flip ladder'])
    // Last ABI word of placeAndExecuteMarketBuy is _isFillOrKill.
    const [[zap]] = test.client.call.mock.calls as unknown as [[{ data: string }]]
    expect(zap.data.slice(-64)).toBe(word(0n))
  } finally { vi.useRealTimers() }
})

it('asks that never refill end the zap unsent with a precise reason, leaving the deposit recoverable', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    const test = funding([book([[0.03, 10]]), book([[0.03, 1]])])
    await expect(test.run()).rejects.toThrow('TESTNET asks are too thin to swap for your MON right now')
    expect(test.steps.at(-1)).toMatchObject({ step: 'Zap MON to margin', state: 'not-sent', detail: 'TESTNET asks too thin' })
    expect(test.client.call).not.toHaveBeenCalled()
    expect(test.steps.filter((step) => step.state === 'confirmed').map((step) => step.step)).toEqual(['Deposit AUSD'])
  } finally { vi.useRealTimers() }
})

it('a book that moved since the quote refuses before any signature', async () => {
  const test = funding([book([[0.03, 1]])])
  await expect(test.run()).rejects.toThrow('No funds moved')
  expect(test.steps).toEqual([])
  expect(wallet.signTransaction).not.toHaveBeenCalled()
})

it('names Kuru swap reverts instead of an unknown execution revert', () => {
  const revert = (data: `0x${string}`) => new BaseError('Execution reverted for an unknown reason.', { cause: new RawContractError({ data }) })
  expect(zapFailure(revert('0xbb55fd27'))).toContain('asks are too thin')
  expect(zapFailure(revert('0x8199f5f3'))).toContain('moved more than 1%')
  expect(zapFailure(revert('0xf4d678b8'))).toContain('Margin AUSD is short')
  expect(zapFailure(revert('0x12345678'))).toBeNull()
  expect(zapFailure(new Error('RPC offline'))).toBeNull()
})
