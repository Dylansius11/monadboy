import { openDisk } from '@monadboy/sdk'
import { keccak256 } from 'viem'
import { create } from 'zustand'
import { explorerAddressUrl, explorerTxUrl } from './config'
import { CardError, cardErrorCopy } from './errors'
import { newDiskPlaintext, toSaveDisk, zDiskPlaintext } from './disk-plaintext'
import { ensureFunded, requestDrip, saveDisk, verifyRegistry } from './registry'
import type { DiskPlaintext } from '@monadboy/sdk'
import type { Address, Hex } from 'viem'
import type { DiskLease, DiskSlot } from './card'
import type { CardState } from './card-session'
import type { ErrorCopy } from './errors'
import type { Fetch, RegistryChain, SavedDisk, VerifiedRegistry } from './registry'
import type { Difficulty, SaveDisk } from '../types/domain'

/**
 * What the registry says about one card's three disks.
 *
 * Nothing here is invented: a slot is `empty` only when the registry answered
 * and holds nothing, and any failed read or failed decryption is `error`, never
 * a quiet empty slot that would read as "restore worked, you had no disks".
 */
export interface DiskProof {
  /** keccak256 of the sealed bytes: provable persistence without revealing a field. */
  sealedHash: Hex
  updatedAt: number
  explorerUrl: string
}

interface SlotBase {
  slot: DiskSlot
  address: Address
  /** Testnet MON balance of the disk account, or null when it could not be read. */
  balance: bigint | null
}

export type SlotView =
  | (SlotBase & { kind: 'empty' })
  | (SlotBase & { kind: 'error'; error: ErrorCopy })
  | (SlotBase & { kind: 'disk'; disk: SaveDisk; plaintext: DiskPlaintext; proof: DiskProof })

export interface Shelf {
  registry: VerifiedRegistry
  slots: Readonly<Record<DiskSlot, SlotView>>
}

async function readSlot(chain: RegistryChain, registry: VerifiedRegistry, grip: DiskLease): Promise<SlotView> {
  const { slot, address } = grip
  const balance = await chain.balance(address).catch(() => null)
  let record
  try {
    record = await chain.diskOf(registry.address, address)
  } catch {
    grip.assertLive()
    return { kind: 'error', slot, address, balance, error: cardErrorCopy(new CardError('REGISTRY_READ_FAILED')) }
  }
  grip.assertLive()
  if (record.createdAt === 0n) return { kind: 'empty', slot, address, balance }

  try {
    const opened = await openDisk(grip.sealKey, record.sealedData, {
      chainId: registry.chainId,
      registry: registry.address,
      disk: address,
    })
    const plaintext = zDiskPlaintext.parse(opened)
    grip.assertLive()
    return {
      kind: 'disk',
      slot,
      address,
      balance,
      plaintext,
      disk: toSaveDisk(slot, address, plaintext),
      proof: {
        sealedHash: keccak256(record.sealedData),
        updatedAt: Number(record.updatedAt),
        explorerUrl: explorerAddressUrl(address),
      },
    }
  } catch (error) {
    // A card that left mid-decrypt is not an unreadable disk.
    grip.assertLive()
    return { kind: 'error', slot, address, balance, error: cardErrorCopy(new CardError('DISK_UNREADABLE', undefined, { cause: error })) }
  }
}

/**
 * Passkey, three derived addresses, three registry reads, three local
 * decryptions. No server and no localStorage: this is the whole restore path.
 */
export async function loadShelf(
  chain: RegistryChain,
  registry: VerifiedRegistry,
  lease: (slot: DiskSlot) => DiskLease,
): Promise<Shelf> {
  const [one, two, three] = await Promise.all(
    ([1, 2, 3] as const).map((slot) => readSlot(chain, registry, lease(slot))),
  )
  return { registry, slots: { 1: one, 2: two, 3: three } }
}

export interface ShelfState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  shelf: Shelf | null
  /** Why the shelf itself could not be loaded (configuration, wrong chain, no registry). */
  error: ErrorCopy | null
  /** A disk being funded or saved. */
  working: { slot: DiskSlot; step: 'funding' | 'saving' } | null
  /** The last confirmed save. Set only from a successful receipt. */
  saved: { slot: DiskSlot; txHash: Hex; sealedHash: Hex; explorerUrl: string } | null
  /** Why the last create or preference-save attempt stopped. */
  createError: ErrorCopy | null
}

const IDLE: ShelfState = {
  status: 'idle',
  shelf: null,
  error: null,
  working: null,
  saved: null,
  createError: null,
}

export interface ShelfDeps {
  card: {
    getState: () => CardState
    lease: (slot: DiskSlot) => DiskLease
  }
  /** Throws a CardError when the registry address is missing or invalid. */
  registryAddress: () => Address
  chain: () => RegistryChain
  /** Throws WORKER_UNCONFIGURED when there is no worker to ask. */
  workerUrl: () => string
  fetch: Fetch
  now: () => number
}

export interface ShelfController {
  useShelf: () => ShelfState
  getState: () => ShelfState
  /** Reads, derives and decrypts all three slots. */
  refresh: () => Promise<void>
  /** Funds a verified-empty slot, seals a blank disk and saves it. Null when nothing was saved. */
  createDisk: (slot: DiskSlot) => Promise<SavedDisk | null>
  /** Re-read the sealed disk, preserve private fields and save only the chosen profile. */
  savePreferences: (slot: DiskSlot, difficulty: Difficulty, godMode: boolean) => Promise<SavedDisk | null>
  /** Drops decrypted data from memory. Called whenever the card leaves. */
  clear: () => void
}


/**
 * Holds the decrypted shelf for the card in the slot, and nothing else.
 *
 * Decrypted plaintext lives only here, in memory, and `clear()` drops it the
 * moment the card is ejected or expires. A load that finishes after `clear()`
 * or after a newer load is ignored.
 */
export function createShelfController(deps: ShelfDeps): ShelfController {
  const store = create<ShelfState>(() => IDLE)
  let verified: { address: Address; registry: Promise<VerifiedRegistry> } | null = null
  let loadId = 0
  let cardGeneration = 0

  function registry(): Promise<VerifiedRegistry> {
    const address = deps.registryAddress()
    if (verified?.address !== address) {
      const attempt = verifyRegistry(deps.chain(), address)
      verified = { address, registry: attempt }
      // A failed check is not remembered: the next screen visit asks the chain again.
      attempt.catch(() => {
        if (verified?.registry === attempt) verified = null
      })
    }
    return verified.registry
  }

  async function refresh() {
    const mine = ++loadId
    store.setState({ status: 'loading', error: null })
    try {
      if (deps.card.getState().phase !== 'inserted') throw new CardError('CARD_EJECTED')
      const verifiedRegistry = await registry()
      const shelf = await loadShelf(deps.chain(), verifiedRegistry, deps.card.lease)
      if (mine === loadId) store.setState({ status: 'ready', shelf, error: null })
    } catch (error) {
      if (mine === loadId) store.setState({ status: 'error', shelf: null, error: cardErrorCopy(error) })
    }
  }

  async function createDisk(slot: DiskSlot): Promise<SavedDisk | null> {
    const current = store.getState()
    if (current.working) return null
    // Only a slot the registry confirmed empty may be written. A slot that could
    // not be read or decrypted is never overwritten with a blank disk.
    if (current.shelf?.slots[slot].kind !== 'empty') return null
    const generation = cardGeneration

    store.setState({ working: { slot, step: 'funding' }, createError: null, saved: null })
    try {
      const lease = deps.card.lease(slot)
      const verifiedRegistry = await registry()
      const chain = deps.chain()
      await ensureFunded(chain, lease, () => requestDrip(deps.workerUrl(), lease.address, deps.fetch))

      // Another device may have written this slot while we were funding it.
      const latest = await chain.diskOf(verifiedRegistry.address, lease.address)
      lease.assertLive()
      if (latest.createdAt !== 0n) throw new CardError('DISK_EXISTS')

      store.setState({ working: { slot, step: 'saving' } })
      const saved = await saveDisk(chain, {
        lease,
        registry: verifiedRegistry,
        plaintext: newDiskPlaintext(Math.floor(deps.now() / 1000)),
      })
      lease.assertLive()
      if (generation !== cardGeneration) return null
      store.setState({
        working: null,
        saved: { slot, txHash: saved.txHash, sealedHash: saved.sealedHash, explorerUrl: explorerTxUrl(saved.txHash) },
      })
      await refresh()
      lease.assertLive()
      if (generation !== cardGeneration) return null
      return saved
    } catch (error) {
      if (generation !== cardGeneration) return null
      store.setState({ working: null, createError: cardErrorCopy(error) })
      if (error instanceof CardError && error.code === 'DISK_EXISTS') await refresh()
      return null
    }
  }

  async function savePreferences(slot: DiskSlot, difficulty: Difficulty, godMode: boolean): Promise<SavedDisk | null> {
    if (store.getState().working || store.getState().shelf?.slots[slot].kind !== 'disk') return null
    const generation = cardGeneration
    store.setState({ working: { slot, step: 'saving' }, createError: null, saved: null })
    try {
      const lease = deps.card.lease(slot)
      const verifiedRegistry = await registry()
      const chain = deps.chain()
      // Preserve the latest chain plaintext, not an earlier screen snapshot.
      const latest = await readSlot(chain, verifiedRegistry, lease)
      if (latest.kind !== 'disk') throw new CardError('DISK_UNREADABLE')
      const saved = await saveDisk(chain, {
        lease,
        registry: verifiedRegistry,
        plaintext: {
          ...latest.plaintext,
          difficulty: difficulty === 'easy' ? 0 : difficulty === 'normal' ? 1 : 2,
          godMode: difficulty === 'hard' && godMode,
          characterId: difficulty === 'easy' ? 'molandak' : difficulty === 'normal' ? 'moyaki' : 'mouch',
        },
      })
      lease.assertLive()
      if (generation !== cardGeneration) return null
      store.setState({
        working: null,
        saved: { slot, txHash: saved.txHash, sealedHash: saved.sealedHash, explorerUrl: explorerTxUrl(saved.txHash) },
      })
      await refresh()
      lease.assertLive()
      if (generation !== cardGeneration) return null
      return saved
    } catch (error) {
      if (generation === cardGeneration) store.setState({ working: null, createError: cardErrorCopy(error) })
      return null
    }
  }

  return {
    useShelf: () => store(),
    getState: () => store.getState(),
    refresh,
    createDisk,
    savePreferences,
    clear() {
      loadId += 1
      cardGeneration += 1
      store.setState(IDLE)
    },
  }
}
