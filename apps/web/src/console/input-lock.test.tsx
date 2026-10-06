// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { press } from '../test/harness'
import { createInputStore } from './input-store'
import {
  ConsoleInputProvider,
  useConsoleInputLock,
  useConsoleIntent,
} from './useConsoleInput'
import type { ConsoleIntent } from './intents'

/**
 * The input lock exists for one reason: a modal that owns the keys (the rule
 * book) must not let a press reach the screen underneath, where A can confirm
 * a trade. These cover the ways a press could still get through, and the ways
 * the lock could leave the console stuck afterwards.
 */

function key(type: 'keydown' | 'keyup', k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent(type, {
    key: k,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  window.dispatchEvent(event)
  return event
}

const detachers: Array<() => void> = []

function attached() {
  const store = createInputStore()
  const seen: Array<ConsoleIntent> = []
  store.subscribeIntent((intent) => seen.push(intent))
  detachers.push(store.attach())
  return { store, seen }
}

afterEach(() => {
  for (const detach of detachers.splice(0)) detach()
  vi.unstubAllGlobals()
})

describe('a locked console', () => {
  it('emits nothing from the keyboard or from touch, and works again after unlock', () => {
    const { store, seen } = attached()

    store.setPaused(true)
    key('keydown', 'z')
    key('keyup', 'z')
    key('keydown', 'Enter')
    key('keyup', 'Enter')
    store.press('A')
    store.release('A')
    expect(seen).toEqual([])
    expect(store.getPressed().size).toBe(0)

    store.setPaused(false)
    key('keydown', 'z')
    expect(seen).toEqual(['A'])
  })

  it('drops a button held when the lock starts, so it is not stuck down afterwards', () => {
    const { store, seen } = attached()

    key('keydown', 'z')
    expect(store.getPressed().has('A')).toBe(true)

    store.setPaused(true)
    expect(store.getPressed().size).toBe(0)
    // The release arrives while locked, and must be harmless.
    key('keyup', 'z')
    store.setPaused(false)

    // Had A stayed "held", this second press would be swallowed as a repeat.
    key('keydown', 'z')
    expect(seen).toEqual(['A', 'A'])
  })

  it('does not repeat a held direction, and leaves the arrows free to scroll', () => {
    const { store, seen } = attached()

    const first = key('keydown', 'ArrowDown')
    expect(first.defaultPrevented).toBe(true)

    store.setPaused(true)
    const repeated = key('keydown', 'ArrowDown', { repeat: true })
    expect(repeated.defaultPrevented).toBe(false)
    expect(seen).toEqual(['DOWN'])

    // Still physically held when the lock ends: the repeat resumes cleanly.
    store.setPaused(false)
    key('keydown', 'ArrowDown', { repeat: true })
    expect(seen).toEqual(['DOWN', 'DOWN'])
    expect(store.getPressed().has('DOWN')).toBe(true)
  })

  it('ignores a gamepad button, and a button still held at unlock does not fire', () => {
    let frame: FrameRequestCallback = () => {}
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frame = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const held = new Set<number>()
    const original = Object.getOwnPropertyDescriptor(navigator, 'getGamepads')
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          axes: [0, 0],
          buttons: Array.from({ length: 16 }, (_, i) => ({
            pressed: held.has(i),
          })),
        },
      ],
    })

    try {
      const { store, seen } = attached()

      store.setPaused(true)
      held.add(0)
      frame(0)
      expect(seen).toEqual([])

      store.setPaused(false)
      frame(0)
      expect(seen).toEqual([])

      // Let go and press again: a fresh press is a real press.
      held.delete(0)
      frame(0)
      held.add(0)
      frame(0)
      expect(seen).toEqual(['A'])
    } finally {
      if (original) Object.defineProperty(navigator, 'getGamepads', original)
    }
  })
})

describe('Shift is SELECT and also how ? is typed', () => {
  it('fires SELECT when Shift is released, once', () => {
    const { store, seen } = attached()

    key('keydown', 'Shift')
    expect(seen).toEqual([])
    expect(store.getPressed().has('SELECT')).toBe(true)

    key('keyup', 'Shift')
    expect(seen).toEqual(['SELECT'])
    expect(store.getPressed().has('SELECT')).toBe(false)
  })

  it('does not fire SELECT when Shift is part of a combination such as Shift and /', () => {
    const { store, seen } = attached()

    key('keydown', 'Shift')
    key('keydown', '?')
    key('keyup', '?')
    key('keyup', 'Shift')

    expect(seen).toEqual([])
    expect(store.getPressed().size).toBe(0)
  })
})

describe('useConsoleInputLock', () => {
  function Locker() {
    useConsoleInputLock(true)
    return null
  }
  function Listener({ onIntent }: { onIntent: (i: ConsoleIntent) => void }) {
    useConsoleIntent(onIntent)
    return null
  }

  it('blocks screens while the locking component is mounted and frees them when it unmounts', () => {
    const seen: Array<ConsoleIntent> = []
    const tree = (locked: boolean) => (
      <ConsoleInputProvider>
        {locked ? <Locker /> : null}
        <Listener onIntent={(intent) => seen.push(intent)} />
      </ConsoleInputProvider>
    )

    const view = render(tree(true))
    press('A', 'START', 'B')
    expect(seen).toEqual([])

    view.rerender(tree(false))
    press('A')
    expect(seen).toEqual(['A'])
  })
})
