/**
 * The rules of the volume knob and the M key, free of any audio device.
 *
 * Everything here is a pure decision that can be wrong in a way nobody hears
 * until it is awkward: a mute that un-mutes itself, a slider at zero that
 * "restores" to a blast, an M typed into a text field flipping the console to
 * silent. They live apart from the engine so they can be pinned without a
 * browser.
 */

export const DEFAULT_VOLUME = 0.6

export interface SoundPrefs {
  /** 0 to 1, the slider position. Never altered by muting. */
  readonly volume: number
  readonly muted: boolean
}

export const DEFAULT_PREFS: SoundPrefs = { volume: DEFAULT_VOLUME, muted: false }

/**
 * Anything that is not a finite number is silence, not a default: a bad value
 * must never be the thing that makes the console louder.
 */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * Slider position to linear gain. Loudness is roughly logarithmic, so a
 * linear slider crams all of its useful range into the bottom fifth; an
 * exponent of 1.5 spreads it without making the middle of the slider quiet.
 *
 * Muted and zero are both exactly 0, never a small number: a gain of 0.001 is
 * still a faint hiss on a chip waveform and reads as a broken mute.
 */
export function outputGain(prefs: SoundPrefs): number {
  if (prefs.muted) return 0
  const volume = clampVolume(prefs.volume)
  return volume <= 0 ? 0 : volume ** 1.5
}

export const PREFS_STORAGE_KEY = 'monadboy.sound.v1'

/** Stored text to prefs. Anything unreadable yields the defaults. */
export function parsePrefs(raw: string | null): SoundPrefs {
  if (raw === null) return DEFAULT_PREFS
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_PREFS
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS
  const { volume, muted } = parsed as Record<string, unknown>
  return {
    volume:
      typeof volume === 'number' && Number.isFinite(volume)
        ? clampVolume(volume)
        : DEFAULT_VOLUME,
    muted: muted === true,
  }
}

/** Input types that take no typed text, so M on them is not a keystroke into a field. */
const NON_TEXT_INPUT_TYPES: Readonly<Partial<Record<string, true>>> = {
  button: true, checkbox: true, color: true, file: true, image: true,
  radio: true, range: true, reset: true, submit: true,
}

/** True when a key press at `target` is going into a text field. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as Element | null
  if (el === null || typeof el.closest !== 'function') return false
  if (el.closest('textarea, select, [role="textbox"], [role="combobox"], [role="searchbox"]')) {
    return true
  }
  if (el.closest('[contenteditable]:not([contenteditable="false"])')) return true
  const input = el.closest('input')
  return input !== null && NON_TEXT_INPUT_TYPES[input.type.toLowerCase()] !== true
}

/**
 * M toggles mute. A bare M only: Ctrl/Cmd/Alt-M belong to the browser and
 * assistive tech, a held key must not flicker the mute, and an IME composition
 * is text being entered.
 */
export function isMuteShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat' | 'isComposing'>,
  target: EventTarget | null,
): boolean {
  if (event.key !== 'm' && event.key !== 'M') return false
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (event.repeat || event.isComposing) return false
  return !isEditableTarget(target)
}
