/**
 * The single source of input for the whole application.
 *
 * Deliberately framework-free so it can be created once, outside React, and
 * subscribed to with `useSyncExternalStore`. That matters for one reason: the
 * pressed-state changes on every D-pad tap, hundreds of times a session, and
 * putting it in ordinary React state would re-render every screen on every
 * press.
 */

import {
  GAMEPAD_BUTTONS,
  REPEATABLE,
  intentFromKey,
  intentsFromAxes,
  shouldPreventDefault,
} from './intents'
import type { ConsoleIntent } from './intents'

export type IntentHandler = (intent: ConsoleIntent) => void

export interface InputStore {
  /** Fires once per press, and repeatedly while a direction is held. */
  subscribeIntent: (handler: IntentHandler) => () => void
  /** For the visual state of the D-pad and buttons only. */
  subscribePressed: (onChange: () => void) => () => void
  getPressed: () => ReadonlySet<ConsoleIntent>
  /** Touch and programmatic input enter here. */
  press: (intent: ConsoleIntent) => void
  release: (intent: ConsoleIntent) => void
  /**
   * Locks input for a modal that owns the keys and the screen, such as the
   * rule book. Locking drops every held intent, so nothing stays "down" behind
   * the modal. While locked, no source (keyboard, touch, gamepad) emits, and
   * the keyboard handler leaves keys alone so arrows and Space can scroll the
   * modal. Releases stay safe whatever the state.
   */
  setPaused: (paused: boolean) => void
  /** Attaches window listeners and gamepad polling. Returns a teardown. */
  attach: () => () => void
}

const EMPTY: ReadonlySet<ConsoleIntent> = new Set()

export function createInputStore(): InputStore {
  const intentHandlers = new Set<IntentHandler>()
  const pressedHandlers = new Set<() => void>()

  // Replaced rather than mutated, so useSyncExternalStore sees a new reference
  // only when something actually changed.
  let pressed: ReadonlySet<ConsoleIntent> = EMPTY
  let paused = false
  // Shift is SELECT, and Shift is also how `?` is typed. SELECT therefore
  // fires when Shift is released, and only if no other key was struck while it
  // was down: Shift+/ must open the rule book without pressing SELECT first.
  let shiftArmed = false

  function emit(intent: ConsoleIntent) {
    for (const handler of intentHandlers) handler(intent)
  }

  function setPressed(next: ReadonlySet<ConsoleIntent>) {
    pressed = next
    for (const handler of pressedHandlers) handler()
  }

  function press(intent: ConsoleIntent) {
    if (paused) return
    if (pressed.has(intent)) {
      // Already held. Only directions are allowed to fire again.
      if (REPEATABLE.has(intent)) emit(intent)
      return
    }
    const next = new Set(pressed)
    next.add(intent)
    setPressed(next)
    emit(intent)
  }

  function setPaused(next: boolean) {
    if (paused === next) return
    paused = next
    shiftArmed = false
    if (next && pressed.size > 0) setPressed(EMPTY)
  }

  function release(intent: ConsoleIntent) {
    if (!pressed.has(intent)) return
    const next = new Set(pressed)
    next.delete(intent)
    setPressed(next)
  }

  function attach(): () => void {
    if (typeof window === 'undefined') return () => {}

    const onKeyDown = (e: KeyboardEvent) => {
      // Locked: the keys belong to the modal. Not intercepted, so the arrows
      // and Space scroll it instead of being swallowed by the console.
      if (paused) return
      if (e.key !== 'Shift') shiftArmed = false
      const intent = intentFromKey(e.key)
      if (!intent) return
      if (shouldPreventDefault(e.key)) e.preventDefault()

      if (e.key === 'Shift') {
        if (e.repeat || pressed.has(intent)) return
        shiftArmed = true
        const next = new Set(pressed)
        next.add(intent)
        setPressed(next)
        return
      }

      // The browser's own key repeat drives direction repeat, so the timing
      // matches the user's OS settings rather than a number we invented.
      if (e.repeat && !REPEATABLE.has(intent)) return
      press(intent)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const intent = intentFromKey(e.key)
      if (!intent) return
      if (e.key === 'Shift' && shiftArmed) {
        shiftArmed = false
        if (!paused) emit(intent)
      }
      release(intent)
    }

    // A held key with the window unfocused would otherwise stay held forever.
    const onBlur = () => {
      shiftArmed = false
      setPressed(EMPTY)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    // ---- gamepad -----------------------------------------------------------
    // Polled only while one is connected. A permanent rAF loop on a page that
    // is mostly static is a battery cost for nothing.
    let frame = 0
    let padCount = 0
    const padPressed = new Set<ConsoleIntent>()

    const poll = () => {
      const pads = navigator.getGamepads()
      const seen = new Set<ConsoleIntent>()

      for (const pad of pads) {
        if (!pad) continue
        for (const [index, intent] of Object.entries(GAMEPAD_BUTTONS)) {
          if (pad.buttons[Number(index)]?.pressed) seen.add(intent)
        }
        for (const intent of intentsFromAxes(
          pad.axes[0] ?? 0,
          pad.axes[1] ?? 0,
        )) {
          seen.add(intent)
        }
      }

      for (const intent of seen) {
        if (!padPressed.has(intent)) {
          padPressed.add(intent)
          press(intent)
        }
      }
      for (const intent of [...padPressed]) {
        if (!seen.has(intent)) {
          padPressed.delete(intent)
          release(intent)
        }
      }

      frame = requestAnimationFrame(poll)
    }

    const onConnect = () => {
      padCount += 1
      if (padCount === 1) frame = requestAnimationFrame(poll)
    }
    const onDisconnect = () => {
      padCount = Math.max(0, padCount - 1)
      if (padCount === 0 && frame) {
        cancelAnimationFrame(frame)
        frame = 0
        for (const intent of [...padPressed]) release(intent)
        padPressed.clear()
      }
    }

    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    if (navigator.getGamepads().some(Boolean)) onConnect()

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
      if (frame) cancelAnimationFrame(frame)
      shiftArmed = false
      setPressed(EMPTY)
    }
  }

  return {
    subscribeIntent(handler) {
      intentHandlers.add(handler)
      return () => intentHandlers.delete(handler)
    },
    subscribePressed(onChange) {
      pressedHandlers.add(onChange)
      return () => pressedHandlers.delete(onChange)
    },
    getPressed: () => pressed,
    press,
    release,
    setPaused,
    attach,
  }
}
