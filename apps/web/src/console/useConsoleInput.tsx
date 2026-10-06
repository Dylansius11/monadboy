import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { createInputStore } from './input-store'
import type { ReactNode } from 'react'
import type { ConsoleIntent } from './intents'
import type { InputStore } from './input-store'

const InputContext = createContext<InputStore | null>(null)

/**
 * `keyboard={false}` leaves the page's own keys alone: a console shown on a
 * scrolling page must not swallow Space and the arrows. Touch and clicks on
 * the controls still work.
 */
export function ConsoleInputProvider({
  children,
  keyboard = true,
}: {
  children: ReactNode
  keyboard?: boolean
}) {
  const store = useMemo(() => createInputStore(), [])
  useEffect(() => (keyboard ? store.attach() : undefined), [store, keyboard])
  return <InputContext value={store}>{children}</InputContext>
}

function useStore(): InputStore {
  const store = useContext(InputContext)
  if (!store) {
    throw new Error('Console input used outside <ConsoleInputProvider>')
  }
  return store
}

/**
 * Run `handler` on every intent.
 *
 * The handler is held in a ref, so a screen can close over fresh state without
 * resubscribing on every render. Resubscribing on every render is the standard
 * way this hook ends up dropping the first press after a state change.
 */
export function useConsoleIntent(handler: (intent: ConsoleIntent) => void) {
  const store = useStore()
  const ref = useRef(handler)
  ref.current = handler

  useEffect(
    () => store.subscribeIntent((intent) => ref.current(intent)),
    [store],
  )
}

/**
 * The currently held intents, for lighting up the D-pad and buttons.
 *
 * Separate from `useConsoleIntent` on purpose: only the console chrome needs
 * to re-render when a button lights, and it is the only thing that does.
 */
export function useConsolePressed(): ReadonlySet<ConsoleIntent> {
  const store = useStore()
  return useSyncExternalStore(
    store.subscribePressed,
    store.getPressed,
    store.getPressed,
  )
}

/**
 * Lock the console's input while `paused` is true and the caller is mounted.
 *
 * For one modal that owns the keys and the screen (the rule book). While
 * locked nothing reaches any screen from keyboard, touch or gamepad, held
 * intents are dropped, and arrow keys and Space are left alone so the modal
 * can scroll. Unlocks when `paused` turns false or the caller unmounts. One
 * lock, deliberately: two modals locking at once would need a stack, and the
 * console has exactly one such modal.
 */
export function useConsoleInputLock(paused: boolean) {
  const store = useStore()
  useEffect(() => {
    if (!paused) return
    store.setPaused(true)
    return () => store.setPaused(false)
  }, [store, paused])
}

/** Touch handlers for the on-screen controls. */
export function useConsoleControls() {
  const store = useStore()
  return useMemo(
    () => ({
      press: store.press,
      release: store.release,
    }),
    [store],
  )
}
