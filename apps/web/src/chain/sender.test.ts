import { afterEach, expect, it, vi } from 'vitest'
import { createPublicClient, custom } from 'viem'
import { gameplayClient, rememberSenderBlock, waitForSender, withSenderLock } from './sender'
import type { DiskLease } from './card'
import type { PublicClient } from 'viem'

const address = '0x1111111111111111111111111111111111111111' as const
afterEach(() => vi.unstubAllGlobals())
it('low-balance signing observes actual recent sender blocks and stops immediately if the held lease is revoked during an await', async () => {
  let live = true
  let codeReads = 0
  const client = createPublicClient({
    transport: custom({
      request: async ({ method }) => {
        if (method === 'eth_chainId') return '0x279f'
        if (method === 'eth_getBalance') {
          live = false
          return '0x1'
        }
        if (method === 'eth_getCode') {
          codeReads++
          return '0x'
        }
        throw new Error(`Unexpected ${method}`)
      },
    }),
  })
  const lease = {
    assertLive: () => {
      if (!live) throw Error('CARD_EJECTED')
    },
  } as DiskLease
  await expect(waitForSender(client, address, lease)).rejects.toThrow(
    'CARD_EJECTED',
  )
  expect(codeReads).toBe(0)
})
it('registry saves and market signatures serialize per sender until the previous receipt wait finishes', async () => {
  const reached = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const actions: string[] = []
  const save = withSenderLock(address, async () => {
    actions.push('save')
    reached.resolve()
    await release.promise
    actions.push('save receipt')
  })
  await reached.promise
  const order = withSenderLock(address, async () => {
    actions.push('order')
  })
  expect(actions).toEqual(['save'])
  release.resolve()
  await Promise.all([save, order])
  expect(actions).toEqual(['save', 'save receipt', 'order'])
})
it('a stalled chain cannot leave block-spacing checks running indefinitely', async () => {
  vi.useFakeTimers()
  let live = true
  const lease = { assertLive() { if (!live) throw new Error('CARD_EJECTED') } } as DiskLease
  const sender = '0x2222222222222222222222222222222222222222'
  rememberSenderBlock(sender, 10n)
  const client = {
    getChainId: async () => 10143,
    getBalance: async () => 1n,
    getCode: async () => '0x',
    getBlockNumber: async () => 10n,
    getBlock: async () => ({ number: 10n, transactions: [] }),
  } as unknown as PublicClient
  let failure: unknown
  const running = waitForSender(client, sender, lease).catch((error: unknown) => { failure = error })
  try {
    await vi.advanceTimersByTimeAsync(30600)
    const timedOut = failure
    live = false
    await vi.advanceTimersByTimeAsync(450)
    await running
    expect(timedOut).toBeInstanceOf(Error)
    expect(String(timedOut)).toContain('Block spacing unavailable')
  } finally {
    vi.useRealTimers()
  }
})
it('parallel public reads share one paced HTTP batch without changing their values', async () => {
  const requests: { at: number; body: unknown }[] = []
  vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string } | { id: number; method: string }[]
    requests.push({ at: Date.now(), body })
    const response = (call: { id: number; method: string }) => ({
      jsonrpc: '2.0', id: call.id, result: call.method === 'eth_blockNumber' ? '0x10' : '0x20',
    })
    return Response.json(Array.isArray(body) ? body.map(response) : response(body))
  })
  const client = gameplayClient('https://batch.example')
  const values = await Promise.all([
    client.getBlockNumber({ cacheTime: 0 }),
    client.getBalance({ address }),
  ])
  expect(values).toEqual([16n, 32n])
  expect(requests).toHaveLength(1)
  expect(Array.isArray(requests[0]?.body)).toBe(true)
  await client.getBlockNumber({ cacheTime: 0 })
  expect(requests).toHaveLength(2)
  expect(requests[1].at - requests[0].at).toBeGreaterThanOrEqual(200)
})
it('a failed JSON-RPC sub-read rejects instead of becoming a zero balance', async () => {
  vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string } | { id: number; method: string }[]
    const response = (call: { id: number; method: string }) => call.method === 'eth_getBalance'
      ? { jsonrpc: '2.0', id: call.id, error: { code: -32000, message: 'Balance unavailable' } }
      : { jsonrpc: '2.0', id: call.id, result: '0x10' }
    return Response.json(Array.isArray(body) ? body.map(response) : response(body))
  })
  const client = gameplayClient('https://batch-failure.example')
  const [head, balance] = await Promise.allSettled([
    client.getBlockNumber({ cacheTime: 0 }),
    client.getBalance({ address }),
  ])
  expect(head).toMatchObject({ status: 'fulfilled', value: 16n })
  expect(balance.status).toBe('rejected')
})
