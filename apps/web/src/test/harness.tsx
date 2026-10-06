import { act, render } from '@testing-library/react'
import { ConsoleInputProvider } from '../console/useConsoleInput'
import { SoundProvider } from '../sound/SoundProvider'
import type { ReactElement, ReactNode } from 'react'
import type { ConsoleIntent } from '../console/intents'

/**
 * How a screen is tested.
 *
 * ui/ and game/ are checked by looking at them (the vitest config only holds
 * lib/ and design/ to a coverage number), and that stays true for LOOK. These
 * tests cover the other half: what the
 * screen does when a button is pressed, and what it renders when the data it
 * wanted is not there. Neither is visible in a screenshot.
 *
 * Two rules make this cheap:
 *
 *   1. A SCREEN IS A COMPONENT, not a route. Route files are wrappers that own
 *      useNavigate and pass callbacks down. So a screen test never needs a
 *      router, and a `.test.tsx` never sits in src/routes/ where the route
 *      generator would turn it into a route. The one routed walk of the
 *      whole loop lives beside this file in loop.test.tsx.
 *   2. INPUT GOES THROUGH THE REAL KEYBOARD PATH. `press('A')` dispatches an
 *      actual keydown, which runs the real intent mapping, the real repeat
 *      policy, and the real store. A test that called a handler directly would
 *      pass while the screen was unreachable by keyboard.
 */

/** Screens use the same input and audio boundaries as the running app. */
export function renderScreen(ui: ReactElement) {
  return render(ui, { wrapper: ScreenProviders })
}

function ScreenProviders({ children }: { children: ReactNode }) {
  return <SoundProvider><ConsoleInputProvider>{children}</ConsoleInputProvider></SoundProvider>
}

/**
 * The key each intent is driven by in a test.
 *
 * Deliberately one key per intent rather than the full map from intents.ts:
 * the map itself is already covered by intents.test.ts, and a test that
 * enumerated every alias would fail when an alias is added rather than when
 * something breaks.
 */
const KEY_FOR: Readonly<Record<ConsoleIntent, string>> = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  A: 'z',
  B: 'x',
  START: 'Enter',
  SELECT: 'Shift',
}

/** One full press and release, the way a person does it. */
export function press(...intents: Array<ConsoleIntent>) {
  for (const intent of intents) {
    const key = KEY_FOR[intent]
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
    })
  }
}

/** Hold a direction for `times` repeats. Actions never repeat, by design. */
export function hold(intent: ConsoleIntent, times: number) {
  const key = KEY_FOR[intent]
  act(() => {
    for (let i = 0; i < times; i += 1) {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key, repeat: i > 0, bubbles: true }),
      )
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
  })
}

/**
 * Advance fake timers inside act, for screens driven by a tick.
 *
 * The caller owns vi.useFakeTimers(). This only exists so the act() wrapper is
 * not copy-pasted into every timing assertion.
 */
export async function tick(
  ms: number,
  timers: { advanceTimersByTime: (ms: number) => unknown },
) {
  await act(async () => {
    timers.advanceTimersByTime(ms)
  })
}
