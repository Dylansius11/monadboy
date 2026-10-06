// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { encodeAbiParameters, encodeEventTopics, keccak256, pad } from 'viem'
import { deriveSealKey, diskRegistryAbi, openDisk, sealDisk } from '@monadboy/sdk'
import { newDiskPlaintext } from './disk-plaintext'
import { createCardManager } from './card-session'
import { createCredentialStore } from './credential-store'
import { createShelfController } from './shelf'
import type { RegistryChain } from './registry'
import type { CardMaterial } from './card'

it('a create finishing after eject cannot republish private shelf state or a stale error', async () => {
  const account = privateKeyToAccount(`0x${'01'.repeat(32)}`)
  const sealKey = await deriveSealKey(new Uint8Array(32).fill(2), 1)
  const handle = { address: account.address, account, sealKey }
  const material: CardMaterial = {
    serial: account.address,
    disks: { 1: { ...handle, slot: 1 }, 2: { ...handle, slot: 2 }, 3: { ...handle, slot: 3 } },
    end: () => {},
  }
  const card = createCardManager({
    backend: async () => ({ create: async () => ({ credential: { credentialId: 'test' }, material }), recover: async () => { throw new Error('unused') } }),
    relyingParty: () => ({ id: 'localhost', name: 'test' }),
    credentials: createCredentialStore(() => null), user: () => ({ name: 'test', displayName: 'test' }),
    visibility: { hidden: () => false, subscribe: () => () => {} },
  })
  await card.create()
  let funding = false
  const reached = Promise.withResolvers<void>()
  const resumed = Promise.withResolvers<bigint>()
  const chain: RegistryChain = {
    chainId: async () => 10143,
    code: async () => '0x60',
    balance: async () => { if (!funding) return 0n; reached.resolve(); return resumed.promise },
    diskOf: async () => ({ createdAt: 0n, updatedAt: 0n, difficulty: 0, godMode: false, tag: '0x', sealedData: '0x' }),
    estimateSave: async () => { throw new Error('must not save') },
    save: async () => { throw new Error('must not save') },
    receipt: async () => { throw new Error('must not save') },
  }
  const shelf = createShelfController({
    card, chain: () => chain, registryAddress: () => account.address,
    workerUrl: () => 'https://worker.example', now: () => 1000,
    fetch: async () => Response.json({ status: 'supply-unavailable' }, { status: 503 }),
  })
  await shelf.refresh()
  expect(shelf.getState().shelf?.slots[1].kind).toBe('empty')
  funding = true
  const creating = shelf.createDisk(1)
  await reached.promise
  card.eject()
  shelf.clear()
  resumed.resolve(0n)
  expect(await creating).toBeNull()
  expect(shelf.getState()).toMatchObject({ status: 'idle', shelf: null, createError: null, saved: null })
})

async function preferenceShelf(holdAfterReceipt = false) {
  const account = privateKeyToAccount(`0x${'03'.repeat(32)}`)
  const sealKey = await deriveSealKey(new Uint8Array(32).fill(4), 1)
  const registry = account.address
  const aad = { chainId: 10143, registry, disk: account.address }
  const original = { ...newDiskPlaintext(123), name: 'private name', notes: 'private notes', difficulty: 2 as const, godMode: true,
    runs: [{ market: account.address, openedAt: 1, closedAt: 2, score: 9, damage: 3, fills: 4 }] }
  let sealedData = await sealDisk(sealKey, original, aad)
  const handle = { address: account.address, account, sealKey }
  const card = createCardManager({
    backend: async () => ({ create: async () => ({ credential: { credentialId: 'test' }, material: {
      serial: account.address, disks: { 1: { ...handle, slot: 1 }, 2: { ...handle, slot: 2 }, 3: { ...handle, slot: 3 } }, end: () => {},
    } }), recover: async () => { throw new Error('unused') } }),
    relyingParty: () => ({ id: 'localhost', name: 'test' }), credentials: createCredentialStore(() => null),
    user: () => ({ name: 'test', displayName: 'test' }), visibility: { hidden: () => false, subscribe: () => () => {} },
  })
  await card.create()
  const tag = `0x${'00'.repeat(12)}` as const
  const txHash = `0x${'11'.repeat(32)}` as const
  let confirmed = false
  const readReached = Promise.withResolvers<void>()
  const readResume = Promise.withResolvers<void>()
  const chain: RegistryChain = {
    chainId: async () => 10143, code: async () => '0x60', balance: async () => 10n ** 18n,
    diskOf: async () => {
      if (holdAfterReceipt && confirmed) { readReached.resolve(); await readResume.promise }
      return { createdAt: 123n, updatedAt: 456n, difficulty: 2, godMode: true, tag, sealedData }
    },
    estimateSave: async () => 100_000n,
    save: async (_registry, _account, args) => { sealedData = args[0]; return txHash },
    receipt: async () => {
      confirmed = true
      return {
      status: 'success', blockNumber: 789n,
      logs: [{
        address: registry, topics: [encodeEventTopics({ abi: diskRegistryAbi, eventName: 'DiskSaved' })[0], pad(account.address, { size: 32 })],
        data: encodeAbiParameters([{ type: 'uint64' }, { type: 'bytes32' }, { type: 'uint8' }, { type: 'bool' }, { type: 'bytes12' }],
          [456n, keccak256(sealedData), 1, false, tag]),
        blockHash: txHash, blockNumber: 789n, transactionHash: txHash, transactionIndex: 0, logIndex: 0, removed: false,
      }],
      }
    },
  }
  const shelf = createShelfController({
    card, chain: () => chain, registryAddress: () => registry, now: () => 1000,
    workerUrl: () => 'https://worker.example', fetch: async () => { throw new Error('must not drip an existing disk') },
  })
  await shelf.refresh()
  return { card, shelf, original, sealKey, aad, txHash, readReached, readResume, ciphertext: () => sealedData }
}

it('changing difficulty preserves sealed notes and history and cannot carry GOD MODE below HARD', async () => {
  const { card, shelf, original, sealKey, aad, txHash, ciphertext } = await preferenceShelf()
  await shelf.savePreferences(1, 'normal', true)
  const restored = await openDisk(sealKey, ciphertext(), aad)
  expect(restored).toEqual({ ...original, difficulty: 1, godMode: false, characterId: 'moyaki' })
  expect(shelf.getState().saved?.txHash).toBe(txHash)
  card.eject()
})

it('eject during the confirmed-save refresh cannot complete a preference action for the old card', async () => {
  const { card, shelf, readReached, readResume } = await preferenceShelf(true)
  const saving = shelf.savePreferences(1, 'normal', false)
  await readReached.promise
  card.eject()
  shelf.clear()
  readResume.resolve()
  expect(await saving).toBeNull()
  expect(shelf.getState()).toMatchObject({ status: 'idle', shelf: null, saved: null })
})
