// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { createCardManager, HIDDEN_EXPIRY_MS } from './card-session'
import { createCredentialStore } from './credential-store'
import { deriveSealKey } from '@monadboy/sdk'
import type { CardCeremony, CardMaterial, DiskHandle, DiskSlot } from './card'

async function material(): Promise<CardMaterial> {
  const disks = {} as Record<DiskSlot, DiskHandle>
  const account = privateKeyToAccount(`0x${'01'.repeat(32)}`)
  for (const slot of [1, 2, 3] as const) disks[slot] = {
    slot, address: account.address, account, sealKey: await deriveSealKey(new Uint8Array(32).fill(3), slot),
  }
  return { serial: account.address, disks, end: vi.fn() }
}

afterEach(() => vi.useRealTimers())

it('eject during a pending ceremony discards its result and cannot revive a signing lease', async () => {
  const held = await material()
  let complete: ((result: CardCeremony) => void) | undefined
  const pending = new Promise<CardCeremony>((resolve) => { complete = resolve })
  const card = createCardManager({
    backend: async () => ({ create: async () => pending, recover: async () => pending }),
    relyingParty: () => ({ id: 'localhost', name: 'test' }),
    credentials: createCredentialStore(() => null), user: () => ({ name: 'test', displayName: 'test' }),
    visibility: { hidden: () => false, subscribe: () => () => {} },
  })
  const reading = card.create()
  const rejected = expect(reading).rejects.toMatchObject({ code: 'CEREMONY_CANCELLED' })
  card.eject()
  complete?.({ material: held, credential: { credentialId: 'test' } })
  await rejected
  expect(card.getState().phase).toBe('ejected')
  expect(held.end).toHaveBeenCalledOnce()
  expect(() => card.lease(1)).toThrow('CARD_EJECTED')
})

it('a lease is revoked when the card expires after more than ten hidden minutes', async () => {
  const held = await material()
  vi.useFakeTimers()
  let hidden = false
  let changed: (() => void) | undefined
  const card = createCardManager({
    backend: async () => ({ create: async () => ({ material: held, credential: { credentialId: 'test' } }), recover: async () => { throw new Error('unused') } }),
    relyingParty: () => ({ id: 'localhost', name: 'test' }),
    credentials: createCredentialStore(() => null), user: () => ({ name: 'test', displayName: 'test' }),
    visibility: { hidden: () => hidden, subscribe: (listener) => { changed = listener; return () => { changed = undefined } } },
  })
  await card.create()
  const lease = card.lease(1)
  hidden = true
  changed?.()
  await vi.advanceTimersByTimeAsync(HIDDEN_EXPIRY_MS)
  expect(lease.isLive()).toBe(true)
  await vi.advanceTimersByTimeAsync(1)
  expect(lease.isLive()).toBe(false)
  expect(() => lease.assertLive()).toThrow('CARD_EXPIRED')
  expect(card.getState().serial).toBeNull()
  expect(held.end).toHaveBeenCalledOnce()
})
