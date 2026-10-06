// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, fireEvent, render } from '@testing-library/react'
import { ConsoleInputProvider, useConsoleIntent } from '../../console/useConsoleInput'
import { press } from '../../test/harness'
import { RuleBook } from './RuleBook'
import type { ConsoleIntent } from '../../console/intents'


/** What a screen would hear. */
const heard: Array<ConsoleIntent> = []

function Screen() {
  useConsoleIntent((intent) => heard.push(intent))
  return <input aria-label="name" />
}

beforeAll(() => {
  // jsdom has no modal dialog behaviour. These two are the whole contract the
  // rule book relies on: showModal opens it, close() closes it and says so.
  if (!('open' in HTMLDialogElement.prototype)) {
    Object.defineProperty(HTMLDialogElement.prototype, 'open', {
      configurable: true,
      get(this: HTMLDialogElement) {
        return this.hasAttribute('open')
      },
    })
  }
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

beforeEach(() => {
  heard.length = 0
})

async function mount() {
  const root = createRootRoute({
    component: () => (
      <ConsoleInputProvider>
        <RuleBook />
        <Screen />
        <Outlet />
      </ConsoleInputProvider>
    ),
  })
  const disks = createRoute({
    getParentRoute: () => root,
    path: '/disks',
    component: () => null,
  })
  const router = createRouter({
    routeTree: root.addChildren([disks]),
    history: createMemoryHistory({ initialEntries: ['/disks'] }),
  })
  const view = render(<RouterProvider router={router} />)
  await act(async () => {
    await router.load()
  })
  const dialog = () => view.container.querySelector('dialog')!
  return { view, dialog }
}

function type(k: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }))
    target.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true, ...init }))
  })
}

describe('the rule book', () => {
  it('opens on H with the guide for this screen, and no press reaches the screen until it closes', async () => {
    const { view, dialog } = await mount()
    expect(dialog().open).toBe(false)

    type('h')
    expect(dialog().open).toBe(true)
    expect(dialog().textContent).toContain('Select SAVE DISK')

    press('A', 'B', 'START', 'SELECT', 'UP', 'DOWN')
    type('Escape')
    expect(heard).toEqual([])

    fireEvent.click(view.getByText('Close'))
    expect(dialog().open).toBe(false)

    press('A')
    expect(heard).toEqual(['A'])
  })

  it('toggles closed on a second H, and opens from the ? button', async () => {
    const { view, dialog } = await mount()

    fireEvent.click(view.getByRole('button', { name: /open the rule book/i }))
    expect(dialog().open).toBe(true)

    type('H', { shiftKey: true })
    expect(dialog().open).toBe(false)
  })

  it('opens on Shift and / without pressing SELECT on the way', async () => {
    const { dialog } = await mount()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: '?', shiftKey: true, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
    })

    expect(dialog().open).toBe(true)
    expect(heard).toEqual([])
  })

  it('releases the input lock on native Escape cancellation without waiting for a close event', async () => {
    const { dialog } = await mount()
    type('h')
    expect(dialog().open).toBe(true)

    fireEvent(dialog(), new Event('cancel', { cancelable: true }))
    expect(dialog().open).toBe(false)
    expect(heard).toEqual([])

    press('A')
    expect(heard).toEqual(['A'])
  })

  it('stays shut while the player is typing in a field', async () => {
    const { view, dialog } = await mount()

    type('h', {}, view.getByLabelText('name'))

    expect(dialog().open).toBe(false)
  })
})

