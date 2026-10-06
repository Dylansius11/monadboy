import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Leaderboard } from '../../game/screens/Leaderboard'
import { useLeaderboardRead, useNow } from '../../lib/worker/queries'
import { LEADERBOARD_WINDOWS } from '../../lib/worker/schemas'
import type { LeaderboardWindow } from '../../lib/worker/schemas'

export const Route = createFileRoute('/_console/leaderboard')({
  // The window lives in the URL so a reload, a share and the back button all
  // keep it. Anything that is not a known window is the default, never an error.
  validateSearch: (search: Record<string, unknown>): { window: LeaderboardWindow } => ({
    window:
      LEADERBOARD_WINDOWS.find((option) => option === search.window) ?? '24h',
  }),
  component: LeaderboardRoute,
})

/**
 * S9's route (ARCHITECTURE.md §6): navigation and the worker read only,
 * everything else is `Leaderboard` taking props. There is no fixture mode:
 * a leaderboard is the worker's chain-derived answer or an honest state.
 */
function LeaderboardRoute() {
  const { window } = Route.useSearch()
  const navigate = useNavigate()
  const view = useLeaderboardRead(window)
  const now = useNow(15_000)

  return (
    <Leaderboard
      window={window}
      onWindowChange={(next) => navigate({ to: '/leaderboard', search: { window: next } })}
      view={view}
      now={now}
      onBack={() => navigate({ to: '/cartridges' })}
    />
  )
}
