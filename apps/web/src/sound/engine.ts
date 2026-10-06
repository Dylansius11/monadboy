import { createPulseWaves, MIN_REPEAT_SECONDS, scheduleEffect } from './chip'
import type { PulseWaves, SoundEffect } from './chip'

/**
 * `locked`: no trusted gesture has started audio yet, so nothing exists.
 * `ready`: the context has run. `unsupported`: this browser has no Web Audio.
 */
export type EngineStatus = 'locked' | 'ready' | 'unsupported'

/** The background loop's state, reported as it is, never assumed. */
export type MusicStatus = 'idle' | 'loading' | 'playing' | 'failed'

export interface EngineEvents {
  onStatus: (status: EngineStatus) => void
  onMusic: (status: MusicStatus) => void
}

export interface SoundEngine {
  /** Linear output gain, 0 to 1. 0 is silence, not "very quiet". */
  setLevel: (gain: number) => void
  play: (effect: SoundEffect) => void
  dispose: () => void
}

/** Source: public/audio/LICENSE.md. */
export const MUSIC_URL = `${import.meta.env.BASE_URL}audio/starlight-city-loop.mp3`

/** The loop sits well under the effects: a bed, not the foreground. */
const MUSIC_BUS_GAIN = 0.45
const MUSIC_FADE_IN_SECONDS = 2
/** Gain changes glide over a few time constants so a slider drag never zippers. */
const LEVEL_TIME_CONSTANT = 0.02
/** Scheduling slack so the first sample of an effect is never in the past. */
const LEAD_SECONDS = 0.005

/**
 * Events that count as the user's permission to make sound. Browsers differ on
 * which of these they honour (a mouse press counts on pointerdown, touch only
 * on touchend/pointerup, and a key press counts on keydown), so all are
 * listened for and the context is simply asked to resume on each until it runs.
 */
const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const

const INERT: SoundEngine = { setLevel() {}, play() {}, dispose() {} }

/**
 * The audio engine. Constructing it touches no audio: it only listens. The
 * AudioContext is created inside the first trusted gesture and never before,
 * so there is no autoplay violation and nothing to resume on its own.
 *
 * Page hidden: the context is suspended, which pauses the loop and any
 * effect mid-note. Visible again: it resumes only if it had already run, so
 * a tab that was opened in the background and never touched stays silent.
 */
export function createSoundEngine(events: EngineEvents): SoundEngine {
  const Found: typeof AudioContext | undefined = window.AudioContext
  if (typeof Found !== 'function') {
    events.onStatus('unsupported')
    return INERT
  }
  const AudioCtor: typeof AudioContext = Found

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let sfxBus: GainNode | null = null
  let musicBus: GainNode | null = null
  let waves: PulseWaves | null = null
  let musicSource: AudioBufferSourceNode | null = null
  let level = 0
  let everRan = false
  let disposed = false
  const lastPlayed: Partial<Record<SoundEffect, number>> = {}
  const abort = new AbortController()

  function build(): AudioContext | null {
    try {
      const created = new AudioCtor()
      const gain = created.createGain()
      gain.gain.value = level
      // A limiter after the mix: overlapping effects over the loop must squash,
      // never clip.
      const limiter = created.createDynamicsCompressor()
      limiter.threshold.value = -8
      limiter.knee.value = 4
      limiter.ratio.value = 20
      limiter.attack.value = 0.002
      limiter.release.value = 0.12
      gain.connect(limiter)
      limiter.connect(created.destination)

      const sfx = created.createGain()
      sfx.connect(gain)
      const music = created.createGain()
      music.gain.value = 0
      music.connect(gain)

      master = gain
      sfxBus = sfx
      musicBus = music
      waves = createPulseWaves(created)
      created.addEventListener('statechange', onState)
      return created
    } catch {
      // Constructing a context can throw (no output device, blocked policy).
      // Treat it as no audio rather than a crash in the middle of play.
      events.onStatus('unsupported')
      return null
    }
  }

  /** Brings the context in line with page visibility. Safe to call any time. */
  function sync() {
    if (ctx === null || disposed) return
    const state = ctx.state
    if (document.hidden) {
      if (state === 'running') ctx.suspend().catch(() => {})
    } else if (everRan && state !== 'running' && state !== 'closed') {
      // Rejected when the browser wants a fresh gesture; the next one retries.
      ctx.resume().catch(() => {})
    }
  }

  function onState() {
    if (ctx === null || disposed) return
    if (ctx.state === 'running' && !everRan) {
      everRan = true
      events.onStatus('ready')
      void startMusic(ctx)
    }
    sync()
  }

  function onGesture(event: Event) {
    // Script-dispatched events are not permission. Neither is a hidden page.
    if (!event.isTrusted || disposed || document.hidden) return
    if (ctx === null) {
      ctx = build()
      if (ctx === null) {
        // Building failed once; it will fail on every later press too.
        detachGestures()
        return
      }
    }
    if (ctx.state === 'running') {
      // Created already running, so no statechange will announce it.
      if (!everRan) onState()
      return
    }
    ctx.resume().then(onState, () => {})
  }

  async function startMusic(owner: AudioContext) {
    events.onMusic('loading')
    try {
      const response = await fetch(MUSIC_URL, { signal: abort.signal })
      if (!response.ok) throw new Error(`music ${response.status}`)
      const buffer = await owner.decodeAudioData(await response.arrayBuffer())
      if (disposed || musicBus === null) return
      const source = owner.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(musicBus)
      const now = owner.currentTime
      musicBus.gain.setValueAtTime(0, now)
      musicBus.gain.linearRampToValueAtTime(MUSIC_BUS_GAIN, now + MUSIC_FADE_IN_SECONDS)
      source.start()
      musicSource = source
      events.onMusic('playing')
    } catch {
      if (!disposed) events.onMusic('failed')
    }
  }

  function detachGestures() {
    for (const name of GESTURE_EVENTS) {
      window.removeEventListener(name, onGesture, { capture: true })
    }
  }

  for (const name of GESTURE_EVENTS) {
    window.addEventListener(name, onGesture, { capture: true, passive: true })
  }
  document.addEventListener('visibilitychange', sync)

  return {
    setLevel(gain) {
      level = gain
      if (ctx === null || master === null) return
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      if (gain === 0) {
        // Exactly zero, immediately: a glide would leave a tail after "mute".
        master.gain.setValueAtTime(0, now)
      } else {
        master.gain.setTargetAtTime(gain, now, LEVEL_TIME_CONSTANT)
      }
    },

    play(effect) {
      if (ctx === null || sfxBus === null || waves === null) return
      if (ctx.state !== 'running' || level <= 0) return
      const now = ctx.currentTime
      const last = lastPlayed[effect]
      if (last !== undefined && now - last < MIN_REPEAT_SECONDS) return
      lastPlayed[effect] = now
      scheduleEffect(ctx, sfxBus, waves, effect, now + LEAD_SECONDS)
    },

    dispose() {
      if (disposed) return
      disposed = true
      abort.abort()
      detachGestures()
      document.removeEventListener('visibilitychange', sync)
      if (ctx === null) return
      ctx.removeEventListener('statechange', onState)
      try {
        musicSource?.stop()
      } catch {
        // Already stopped.
      }
      musicSource?.disconnect()
      sfxBus?.disconnect()
      musicBus?.disconnect()
      master?.disconnect()
      if (ctx.state !== 'closed') ctx.close().catch(() => {})
      ctx = null
    },
  }
}
