import { useSyncExternalStore } from 'react'

/**
 * Installing the console as an app.
 *
 * Chromium hands the page a `beforeinstallprompt` event it may replay once as
 * the install dialog; it can fire before React hydrates, so the listener is
 * attached when this module loads, not when a button mounts. iOS has no such
 * event: the only way in is Share, then Add to Home Screen, so the offer there
 * is a hint. Running as the installed app (or right after installing) there is
 * nothing to offer.
 */

/** Chromium's install event; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** What the page can offer: the native dialog, the iOS hint, or nothing. */
export type InstallOffer = 'prompt' | 'ios' | 'none'

export function installOffer(state: {
  standalone: boolean
  installed: boolean
  canPrompt: boolean
  ios: boolean
}): InstallOffer {
  if (state.standalone || state.installed) return 'none'
  if (state.canPrompt) return 'prompt'
  return state.ios ? 'ios' : 'none'
}

/** Every iOS browser is WebKit and installs through Share; iPadOS reports as a Mac with touch. */
export function isIos(nav: { userAgent: string; maxTouchPoints: number }): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)
}

const STANDALONE = '(display-mode: standalone)'

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // keep the browser's own mini-infobar out of the way; the page offers it
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    notify()
  })
}

function snapshot(): InstallOffer {
  const standalone =
    window.matchMedia(STANDALONE).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return installOffer({ standalone, installed, canPrompt: deferred !== null, ios: isIos(navigator) })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // opening the installed app switches this display mode on
  const display = window.matchMedia(STANDALONE)
  display.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    display.removeEventListener('change', listener)
  }
}

/** The current offer; the server render and hydration always see 'none'. */
export function useInstallOffer(): InstallOffer {
  return useSyncExternalStore(subscribe, snapshot, () => 'none')
}

/** Opens the browser's install dialog. The event is single use, so the offer clears either way. */
export async function promptInstall(): Promise<void> {
  const event = deferred
  if (!event) return
  deferred = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === 'accepted') installed = true
  notify()
}

/** Registers the worker that makes the console installable; it caches nothing (public/sw.js). */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    console.warn('Service worker not registered; the console still runs, without the offline screen.', error)
  })
}
