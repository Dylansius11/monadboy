import { CardError, cardErrorCopy, meraCodeOf } from './errors'
import { DISK_SLOTS } from './card'
import type { Address } from 'viem'
import type { CardBackend, CardCeremony, CardMaterial, DiskLease, DiskSlot } from './card'
import type { RelyingParty } from './config'
import type { CredentialStore } from './credential-store'
import type { ErrorCopy } from './errors'

/**
 * Held for the whole time the console is on, so a trade never prompts; ended
 * when the card leaves. 10 minutes hidden is the SPEC 4.1 ceiling.
 */
export const HIDDEN_EXPIRY_MS = 10 * 60 * 1000

export type Ceremony = 'insert' | 'new'
export type EndReason = 'eject' | 'expired'

/**
 * What the screens may see. Addresses and status only: no key, no PRF output,
 * no seal key and no decrypted disk ever appears in a state snapshot.
 */
export interface CardState {
  readonly phase: 'ejected' | 'reading' | 'inserted'
  /** Which ceremony is in flight, while `reading`. */
  readonly ceremony: Ceremony | null
  /** Short address of index 0. Null when no card is held. */
  readonly serial: Address | null
  readonly disks: Readonly<Record<DiskSlot, Address>> | null
  /** Why the last card left, until the next one is read. */
  readonly endedBy: EndReason | null
  /** The last failed ceremony, printable as is. */
  readonly error: ErrorCopy | null
}

export const EJECTED_STATE: CardState = {
  phase: 'ejected',
  ceremony: null,
  serial: null,
  disks: null,
  endedBy: null,
  error: null,
}

/** Whether the tab is hidden, and a way to hear about it. Injected so the clock is testable. */
export interface Visibility {
  hidden: () => boolean
  subscribe: (listener: () => void) => () => void
}

export interface CardDeps {
  backend: () => Promise<CardBackend>
  /** The relying party for this build, after the secure origin and domain checks. Throws a CardError. */
  relyingParty: () => RelyingParty
  credentials: CredentialStore
  visibility: Visibility
  user: () => { name: string; displayName: string }
}

interface Held {
  material: CardMaterial
  addresses: Readonly<Record<DiskSlot, Address>>
}

export interface CardManager {
  getState: () => CardState
  subscribe: (listener: () => void) => () => void
  /** INSERT CARD. Never creates a passkey. */
  insert: () => Promise<void>
  /** NEW CARD. Creates a passkey, a different card every time. */
  create: () => Promise<void>
  /** Ends every signing session now. Safe at any time, including mid ceremony. */
  eject: () => void
  /** A revocable grip on one disk. Throws CARD_EJECTED when nothing is held. */
  lease: (slot: DiskSlot) => DiskLease
}

/**
 * The card lifecycle, as a plain store with no React and no DOM.
 *
 * The invariants it exists to keep:
 *  - At most one ceremony runs; a second press is CARD_BUSY, not a second prompt.
 *  - INSERT never creates a passkey. Only `create` does.
 *  - A ceremony finishing after EJECT (or after another ceremony took over) is
 *    discarded and its sessions are ended before anyone can use them.
 *  - Replacing a card ends the old card's sessions; a failed ceremony leaves
 *    the previous card, if any, untouched.
 *  - Hidden for more than 10 minutes, or explicit EJECT, ends every session.
 *  - Only credential metadata is persisted, and only on success.
 * Secrets live in `held` inside this closure and never in `CardState`.
 */
export function createCardManager(deps: CardDeps): CardManager {
  let state = EJECTED_STATE
  let held: Held | null = null
  let generation = 0
  let pending: number | null = null
  // After a failed INSERT that used the remembered passkey, the next INSERT
  // asks the authenticator to choose, so a deleted passkey cannot trap the player.
  let skipHint = false
  const listeners = new Set<() => void>()

  let unwatch: (() => void) | null = null
  let hiddenAt: number | null = null
  let timer: number | NodeJS.Timeout | undefined

  function publish(patch: Partial<CardState>) {
    state = { ...state, ...patch }
    for (const listener of [...listeners]) listener()
  }

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function stopWatching() {
    unwatch?.()
    unwatch = null
    clearTimer()
    hiddenAt = null
  }

  function endHeld() {
    const gone = held
    held = null
    stopWatching()
    gone?.material.end()
  }

  function idlePhase() {
    return pending === null ? 'ejected' : 'reading'
  }

  function expire() {
    if (held === null) return
    endHeld()
    publish({ phase: idlePhase(), serial: null, disks: null, endedBy: 'expired' })
  }

  function onVisibility() {
    if (deps.visibility.hidden()) {
      if (hiddenAt === null) {
        hiddenAt = Date.now()
        // Fires even if the tab is throttled; the check on return covers sleep.
        timer = setTimeout(expire, HIDDEN_EXPIRY_MS + 1)
      }
      return
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt
    clearTimer()
    hiddenAt = null
    if (away > HIDDEN_EXPIRY_MS) expire()
  }

  function startWatching() {
    stopWatching()
    unwatch = deps.visibility.subscribe(onVisibility)
    // A card that finished reading while the tab was already hidden starts its clock now.
    onVisibility()
  }

  function fail(error: unknown) {
    publish({ error: cardErrorCopy(error) })
  }

  async function begin(ceremony: Ceremony): Promise<void> {
    if (pending !== null) throw new CardError('CARD_BUSY')

    let rp: RelyingParty
    try {
      rp = deps.relyingParty()
    } catch (error) {
      fail(error)
      throw error
    }

    const mine = ++generation
    pending = mine
    publish({ phase: 'reading', ceremony, error: null })

    let result: CardCeremony
    const hint = ceremony === 'insert' && !skipHint ? deps.credentials.load(rp.id) : null
    try {
      const backend = await deps.backend()
      result =
        ceremony === 'new'
          ? await backend.create({ rp, user: deps.user() })
          : await backend.recover(hint ? { rpId: rp.id, credential: hint } : { rpId: rp.id })
    } catch (error) {
      if (mine === generation) {
        pending = null
        if (hint) skipHint = true
        if (hint && meraCodeOf(error) === 'INPUT_INVALID') deps.credentials.clear()
        publish({ phase: held ? 'inserted' : 'ejected', ceremony: null, error: cardErrorCopy(error) })
      }
      throw error
    }

    if (mine !== generation) {
      // Ejected, or taken over, while the prompt was open. Never usable.
      result.material.end()
      throw new CardError('CEREMONY_CANCELLED')
    }

    pending = null
    skipHint = false
    const replaced = held
    const { material } = result
    const addresses = {
      1: material.disks[1].address,
      2: material.disks[2].address,
      3: material.disks[3].address,
    } satisfies Record<DiskSlot, Address>
    held = { material, addresses }
    replaced?.material.end()
    deps.credentials.save(rp.id, result.credential)
    startWatching()
    publish({
      phase: 'inserted',
      ceremony: null,
      serial: material.serial,
      disks: addresses,
      endedBy: null,
      error: null,
    })
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    insert: () => begin('insert'),
    create: () => begin('new'),
    eject() {
      if (held === null && pending === null) return
      generation += 1
      pending = null
      endHeld()
      publish({ phase: 'ejected', ceremony: null, serial: null, disks: null, endedBy: 'eject', error: null })
    },
    lease(slot) {
      const grip = held
      if (grip === null || !DISK_SLOTS.includes(slot)) {
        throw new CardError(state.endedBy === 'expired' ? 'CARD_EXPIRED' : 'CARD_EJECTED')
      }
      const { address, account, sealKey } = grip.material.disks[slot]
      const isLive = () => held === grip
      return {
        slot,
        address,
        account,
        sealKey,
        isLive,
        assertLive() {
          if (!isLive()) throw new CardError(state.endedBy === 'expired' ? 'CARD_EXPIRED' : 'CARD_EJECTED')
        },
      }
    },
  }
}
