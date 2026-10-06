import { useSyncExternalStore } from 'react'
import { useSession } from '../state/session'
import { assertOrigin, cardUser, readChainEnv, resolveRelyingParty } from './config'
import { EJECTED_STATE, createCardManager } from './card-session'
import { browserStorage, createCredentialStore } from './credential-store'
import type { CardManager, CardState, Visibility } from './card-session'

/**
 * The one card in the console's one slot.
 *
 * Created on first use in the browser, never at import: importing this file on
 * the server touches no DOM, no storage and no authenticator.
 */
const browserVisibility: Visibility = {
  hidden: () => document.visibilityState === 'hidden',
  subscribe(listener) {
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  },
}

let manager: CardManager | null = null

export function getCardManager(): CardManager {
  if (manager) return manager
  const created = createCardManager({
    // Dynamic: the authenticator code is reachable only through the client-only
    // loader and must never enter the server bundle or a route's static imports.
    backend: async () => {
      const { loadMeraBackend } = await import('./mera-client')
      return loadMeraBackend()
    },
    relyingParty() {
      const rp = resolveRelyingParty(readChainEnv())
      assertOrigin(rp.id, window.location)
      return rp
    },
    credentials: createCredentialStore(browserStorage),
    visibility: browserVisibility,
    user: () => cardUser(new Date()),
  })
  // The session store mirrors the slot, so an expiry on any route clears the
  // card address everywhere instead of leaving a stale serial on screen.
  created.subscribe(() => {
    const { phase, serial } = created.getState()
    const session = useSession.getState()
    if (phase === 'inserted' && serial) session.insertCard(serial)
    else if (phase === 'ejected') session.ejectCard()
  })
  manager = created
  return created
}

export function useCardState(): CardState {
  return useSyncExternalStore(
    (listener) => getCardManager().subscribe(listener),
    () => manager?.getState() ?? EJECTED_STATE,
    () => EJECTED_STATE,
  )
}
