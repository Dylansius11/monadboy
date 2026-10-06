import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { createSoundEngine } from './engine'
import type { EngineStatus, MusicStatus, SoundEngine } from './engine'
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  clampVolume,
  isMuteShortcut,
  outputGain,
  parsePrefs,
} from './levels'
import type { SoundPrefs } from './levels'
import type { SoundEffect } from './chip'

export type { SoundEffect } from './chip'
export type { EngineStatus, MusicStatus } from './engine'

export interface SoundApi {
  /** 0 to 1. The one slider scales the music and the effects together. */
  volume: number
  setVolume: (value: number) => void
  /** Muting never changes `volume`; unmuting returns to it exactly. */
  muted: boolean
  toggleMute: () => void
  /** Fire and forget. Silent until the first trusted gesture, and when muted. */
  play: (effect: SoundEffect) => void
  /**
   * `locked`: waiting for the first key press or tap. `ready`: audio is
   * running. `unsupported`: this browser has no Web Audio, so there is no sound
   * and the console should say so.
   */
  status: EngineStatus
  /** The background loop: `failed` when the file could not be fetched or decoded. */
  music: MusicStatus
}

const SoundContext = createContext<SoundApi | null>(null)

/** Volume and mute only. Harmless, local, and read after hydration, not during. */
interface PrefsStore {
  subscribe: (listener: () => void) => () => void
  get: () => SoundPrefs
  getServer: () => SoundPrefs
  set: (next: SoundPrefs) => void
}

function createPrefsStore(): PrefsStore {
  let current: SoundPrefs | null = null
  const listeners = new Set<() => void>()

  function storage(): Storage | null {
    try {
      return window.localStorage
    } catch {
      // Blocked storage is a normal browser setting, not an error.
      return null
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get() {
      current ??= parsePrefs(storage()?.getItem(PREFS_STORAGE_KEY) ?? null)
      return current
    },
    getServer: () => DEFAULT_PREFS,
    set(next) {
      current = next
      try {
        storage()?.setItem(PREFS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Full or blocked: the preference lasts for this session instead.
      }
      for (const listener of listeners) listener()
    },
  }
}

/**
 * Owns the sound engine for the whole console. Mount it once, above every
 * screen: the volume and the loop belong to the hardware, not to a route.
 *
 * Nothing audio exists until the first trusted key press or tap. Server render
 * and hydration see the default volume; the stored one applies right after.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPrefsStore)
  const prefs = useSyncExternalStore(store.subscribe, store.get, store.getServer)
  const [status, setStatus] = useState<EngineStatus>('locked')
  const [music, setMusic] = useState<MusicStatus>('idle')
  const engine = useRef<SoundEngine | null>(null)
  const gain = outputGain(prefs)

  // The engine is recreated per mount, so React's dev double-mount builds,
  // tears down and rebuilds cleanly and unmount leaves no context, listener or
  // media node behind.
  useEffect(() => {
    setStatus('locked')
    setMusic('idle')
    const created = createSoundEngine({ onStatus: setStatus, onMusic: setMusic })
    created.setLevel(outputGain(store.get()))
    engine.current = created
    return () => {
      created.dispose()
      engine.current = null
    }
  }, [store])

  useEffect(() => {
    engine.current?.setLevel(gain)
  }, [gain])

  const setVolume = useCallback(
    (value: number) => store.set({ ...store.get(), volume: clampVolume(value) }),
    [store],
  )
  const toggleMute = useCallback(() => {
    const now = store.get()
    store.set({ ...now, muted: !now.muted })
  }, [store])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isMuteShortcut(event, event.target)) toggleMute()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleMute])

  const play = useCallback((effect: SoundEffect) => engine.current?.play(effect), [])

  const api = useMemo<SoundApi>(
    () => ({
      volume: prefs.volume,
      setVolume,
      muted: prefs.muted,
      toggleMute,
      play,
      status,
      music,
    }),
    [prefs.volume, prefs.muted, setVolume, toggleMute, play, status, music],
  )

  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>
}

export function useSound(): SoundApi {
  const api = useContext(SoundContext)
  if (api === null) throw new Error('useSound must be used inside <SoundProvider>')
  return api
}
