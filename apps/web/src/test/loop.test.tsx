// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { routeTree } from '../routeTree.gen'
import { press } from './harness'
import { FIXTURE_MARKETS } from '../game/fixtures'
import { useSession } from '../state/session'
import type { RunSummary } from '../game/sim'

/**
 * The whole loop through the real route tree. Screens are tested as components;
 * this is the only place the callbacks the routes hand them are exercised.
 */

vi.mock('@tanstack/react-devtools', () => ({ TanStackDevtools: () => null }))
vi.mock('@tanstack/react-router-devtools', () => ({ TanStackRouterDevtoolsPanel: () => null }))
vi.mock('../integrations/tanstack-query/devtools', () => ({ default: null }))

// jsdom lacks the two browser APIs the console's fit-to-viewport hook uses.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver)
Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true })
// nor matchMedia, which the boot reads for reduced motion
vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }))

const TESTNET_ID = FIXTURE_MARKETS.find(({ network }) => network === 'testnet')?.pool.pairAddress ?? ''
const MAINNET_ID = FIXTURE_MARKETS.find(({ network }) => network === 'mainnet')?.pool.pairAddress ?? ''

const FINISHED_RUN: RunSummary = {
  feesEarnedUsd: 1.25,
  damageUsd: 0.5,
  netUsd: 0.75,
  timeInRangePct: 80,
  rebalances: 0,
  bestStreakSeconds: 60,
  elapsedSeconds: 120,
}

beforeEach(() => useSession.setState(useSession.getInitialState(), true))

async function mount(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  await act(async () => {
    await router.load()
  })
  return router
}

describe('the loop, walked with console presses', () => {
  it('powers on at /play and START reaches the memory card; B from the card returns to it', async () => {
    const router = await mount('/play')
    const at = (path: string | RegExp) =>
      waitFor(() => expect(router.state.location.pathname).toMatch(path))

    press('START')
    await at('/card')
    await screen.findByText(/insert memory card/i)
    press('B')
    await at(/^\/play\/?$/)
  })

  it('goes card, disks, cartridges, difficulty, tracker, range, live, results and back to disks', async () => {
    const router = await mount('/card')
    const at = (path: string | RegExp) =>
      waitFor(() => expect(router.state.location.pathname).toMatch(path))

    await screen.findByText(/insert memory card/i)
    press('A')
    await at('/disks')

    press('A')
    await at('/cartridges')
    expect(useSession.getState().diskId).toBe(1)

    press('A')
    await at('/play/difficulty')

    press('RIGHT')
    await screen.findByText(/solid pools, not brand new/i)
    expect(useSession.getState()).toMatchObject({ difficulty: 'normal', characterId: 'moyaki' })
    press('A')
    await at('/play/tracker')

    // The cursor opens on the playable TESTNET market.
    press('A')
    await screen.findByText(/^Playable · Testnet$/i)
    press('A')
    await at(`/play/range/${TESTNET_ID}`)
    await screen.findByText(/set your range/i)

    press('A')
    await at(`/play/live/${TESTNET_ID}`)
    await screen.findByText(/withdraw/i)

    press('B')
    await at(`/play/results/${TESTNET_ID}`)
    await screen.findByText(/session over/i)
    expect(useSession.getState().lastRun).not.toBeNull()

    press('A')
    await at('/disks')
  })
})

describe('a pool reached by URL', () => {
  it.each([
    ['range', /pool not found/i],
    ['live', /position not found/i],
    ['results', /pool not found/i],
  ])('is missing in /play/%s when the market is mainnet only', async (route, copy) => {
    useSession.setState({ lastRun: FINISHED_RUN })
    await mount(`/play/${route}/${MAINNET_ID}`)
    await screen.findByText(copy)
  })

  it.each([
    ['range', /set your range/i],
    ['live', /withdraw/i],
    ['results', /session over/i],
  ])('is shown in /play/%s when it is the executable testnet market', async (route, copy) => {
    useSession.setState({ lastRun: FINISHED_RUN })
    await mount(`/play/${route}/${TESTNET_ID}`)
    await screen.findByText(copy)
    expect(screen.queryByText(/(pool|position) not found/i)).toBeNull()
  })
})

describe('the difficulty route writes the session', () => {
  const WORD_LETTERS = ['I', 'K', 'N', 'O', 'W']

  function spell(container: HTMLElement) {
    for (const letter of WORD_LETTERS) {
      const overlay = container.querySelector('.bg-alarm')
      if (!overlay) throw new Error('GOD MODE overlay is not open')
      const buttons = Array.from(overlay.querySelectorAll('button'))
      const index = buttons.findIndex((button) => button.textContent === letter)
      if (index < 0) throw new Error(`no candidate button reads "${letter}"`)
      for (let i = 0; i < index; i += 1) press('RIGHT')
      press('A')
    }
  }

  it('binds each tier to its mascot and clears GOD MODE on a downgrade', async () => {
    const router = await mount('/play/difficulty')
    press('RIGHT')
    expect(useSession.getState()).toMatchObject({ difficulty: 'normal', characterId: 'moyaki' })
    press('RIGHT')
    expect(useSession.getState()).toMatchObject({ difficulty: 'hard', characterId: 'mouch' })
    press('UP', 'A')
    spell(document.body)
    press('UP', 'A')
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/tracker'))
    expect(useSession.getState()).toMatchObject({ difficulty: 'hard', godMode: true })
    press('B')
    await waitFor(() => expect(router.state.location.pathname).toBe('/play/difficulty'))
    press('LEFT')
    expect(useSession.getState()).toMatchObject({
      difficulty: 'normal',
      characterId: 'moyaki',
      godMode: false,
    })
  })
})
