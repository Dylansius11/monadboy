// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMirrorDemand } from './mirror-demand'
import type { DiskLease } from './card'

const address = '0x0000000000000000000000000000000000000001'
let hidden = false
let live = true
const signMessage = vi.fn().mockResolvedValue('0xab')
const lease = { address, account: { signMessage }, isLive: () => live, assertLive() { if (!live) throw new Error('CARD_EJECTED') } } as unknown as DiskLease
beforeEach(() => {
  hidden = false
  live = true
  vi.clearAllMocks()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})
afterEach(() => vi.unstubAllGlobals())
it('hiding aborts an in-flight demand renewal and showing permits a fresh pulse', async () => {
  let signal: AbortSignal | undefined
  const started = Promise.withResolvers<void>()
  vi.mocked(fetch).mockImplementationOnce(async (_input, init) => {
    signal = init?.signal ?? undefined
    started.resolve()
    const response = Promise.withResolvers<Response>()
    signal?.addEventListener('abort', () => response.reject(new Error('aborted')))
    return response.promise
  })
  const demand = createMirrorDemand(lease, address, 'https://worker.example')
  const pulse = demand.pulse()
  await started.promise
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  expect(signal?.aborted).toBe(true)
  await pulse
  hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  await demand.pulse()
  expect(fetch).toHaveBeenCalledTimes(2)
  demand.stop()
})
it('renewals are throttled to fifteen seconds and stop prevents any further signing', async () => {
  const demand = createMirrorDemand(lease, address, 'https://worker.example')
  await demand.pulse()
  await demand.pulse()
  expect(signMessage).toHaveBeenCalledOnce()
  demand.stop()
  await demand.pulse()
  expect(signMessage).toHaveBeenCalledOnce()
})
it('hide or eject while signing prevents sending the completed signature', async () => {
  const signature = Promise.withResolvers<string>()
  signMessage.mockReturnValueOnce(signature.promise)
  const demand = createMirrorDemand(lease, address, 'https://worker.example')
  const pulse = demand.pulse()
  hidden = true
  signature.resolve('0xab')
  await pulse
  expect(fetch).not.toHaveBeenCalled()
  demand.stop()
})
