/**
 * The console's sound effects, synthesized: pulse-wave notes with short
 * envelopes, the way a handheld's two pulse channels would play them. No
 * samples, so there is nothing to license and nothing to load.
 */

export type SoundEffect =
  | 'move'
  | 'confirm'
  | 'back'
  | 'boot'
  | 'coin'
  | 'alert'
  | 'withdraw'

/** Pulse duty cycles of the classic chips: thin and nasal to hollow square. */
type Duty = 0.125 | 0.25 | 0.5

/** One band-limited wave per duty cycle, built once per context. */
export type PulseWaves = Record<Duty, PeriodicWave>

interface Note {
  /** Seconds after the effect starts. */
  readonly at: number
  readonly hz: number
  /** Pitch slide target, reached by the end of the note. */
  readonly toHz?: number
  readonly dur: number
  readonly duty: Duty
  /** Peak linear gain of this note. A square wave is loud: keep these low. */
  readonly peak: number
}

const note = (at: number, hz: number, dur: number, duty: Duty, peak: number, toHz?: number): Note =>
  ({ at, hz, dur, duty, peak, toHz })

// Equal-temperament frequencies used below.
const C5 = 523.25, E5 = 659.25, G5 = 783.99, B5 = 987.77
const C6 = 1046.5, E6 = 1318.51, G6 = 1567.98, C7 = 2093.0
const A4 = 440.0, A5 = 880.0, F5 = 698.46, D5 = 587.33, B4 = 493.88

export const EFFECTS: Readonly<Record<SoundEffect, ReadonlyArray<Note>>> = {
  // A cursor tick. Quiet and tiny because a held d-pad repeats it.
  move: [note(0, A5, 0.035, 0.25, 0.2)],
  // Two rising notes: accepted.
  confirm: [note(0, E5, 0.055, 0.5, 0.26), note(0.055, B5, 0.11, 0.5, 0.26)],
  // Two falling notes: backed out.
  back: [note(0, D5, 0.055, 0.25, 0.24), note(0.055, A4, 0.1, 0.25, 0.24)],
  // The power-on chime: a short pick-up and a long high note.
  boot: [note(0, C6, 0.09, 0.5, 0.26), note(0.09, C7, 0.55, 0.5, 0.24)],
  // A real flip fill. Bright, thin duty, the one sound that should cut through.
  coin: [note(0, B5, 0.06, 0.125, 0.3), note(0.06, E6, 0.32, 0.125, 0.3)],
  // Two alternating tones, twice. Urgent without being a scream.
  alert: [
    note(0, F5, 0.09, 0.5, 0.26), note(0.1, B4, 0.09, 0.5, 0.26),
    note(0.22, F5, 0.09, 0.5, 0.26), note(0.32, B4, 0.14, 0.5, 0.26),
  ],
  // Funds coming home: a rising arpeggio that settles on a slide down.
  withdraw: [
    note(0, C5, 0.07, 0.25, 0.26), note(0.07, E5, 0.07, 0.25, 0.26),
    note(0.14, G5, 0.07, 0.25, 0.26), note(0.21, C6, 0.07, 0.25, 0.26),
    note(0.28, G6, 0.32, 0.25, 0.24, E6),
  ],
}

/** Same effect twice inside this many seconds is dropped, not stacked. */
export const MIN_REPEAT_SECONDS = 0.04

/** The ramp up from silence. Starting a wave at full level is the click. */
const ATTACK_SECONDS = 0.004
/** Tail after the note's end for the release to finish before the oscillator stops. */
const STOP_PAD_SECONDS = 0.02
const HARMONICS = 24

/**
 * Band-limited pulse waves, one per duty. A pulse of duty d has the Fourier
 * series sum over n of (2 / (n pi)) sin(n pi d) cos(n w t); cutting it at 24
 * harmonics keeps the chip bite without the aliasing a raw `square` type
 * brings at C7.
 */
export function createPulseWaves(ctx: BaseAudioContext): PulseWaves {
  const wave = (duty: Duty): PeriodicWave => {
    const real = new Float32Array(HARMONICS + 1)
    const imag = new Float32Array(HARMONICS + 1)
    for (let n = 1; n <= HARMONICS; n++) {
      real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
    }
    return ctx.createPeriodicWave(real, imag)
  }
  return { 0.125: wave(0.125), 0.25: wave(0.25), 0.5: wave(0.5) }
}

/**
 * Schedules one effect on `bus`. Every note ramps from zero, decays, and ramps
 * back to zero before its oscillator stops, so neither edge clicks. Nodes
 * disconnect themselves when the oscillator ends.
 */
export function scheduleEffect(
  ctx: BaseAudioContext,
  bus: AudioNode,
  waves: PulseWaves,
  effect: SoundEffect,
  startAt: number,
): void {
  for (const n of EFFECTS[effect]) {
    const t = startAt + n.at
    const end = t + n.dur

    const osc = ctx.createOscillator()
    osc.setPeriodicWave(waves[n.duty])
    osc.frequency.setValueAtTime(n.hz, t)
    if (n.toHz !== undefined) osc.frequency.exponentialRampToValueAtTime(n.toHz, end)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(n.peak, t + ATTACK_SECONDS)
    env.gain.exponentialRampToValueAtTime(n.peak * 0.4, t + n.dur * 0.75)
    env.gain.linearRampToValueAtTime(0, end)

    osc.connect(env)
    env.connect(bus)
    osc.onended = () => {
      osc.disconnect()
      env.disconnect()
    }
    osc.start(t)
    osc.stop(end + STOP_PAD_SECONDS)
  }
}
