import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { InRange } from '../../../game/screens/InRange'
import { findPool } from '../../../game/fixtures'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/live/$id')({
  component: Live,
})

/**
 * S7's route. ARCHITECTURE.md 2.1: five lines of real work, everything else
 * is `InRange` taking props. `onBack` leaves the position and returns to the
 * tracker, which is where the player picked this pool.
 */
function Live() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const {
    difficulty,
    godMode,
    amount,
    width,
    manualRange,
    autopilot,
    characterId,
    setManualRange,
    finishRun,
  } = useSession()
  const pool = useMemo(
    () => findPool(id, difficulty, godMode)?.pool,
    [id, difficulty, godMode],
  )

  const toTracker = () => navigate({ to: '/play/tracker' })

  return (
    <InRange
      pool={pool}
      amount={amount}
      width={width}
      manualRange={manualRange}
      autopilot={autopilot}
      characterId={characterId}
      onWithdraw={(run) => {
        // The summary is a record of what already happened, not a cache of
        // something recomputable (session.ts's own reasoning for lastRun),
        // so it is stashed before navigating rather than re-derived on S8.
        finishRun(run)
        navigate({ to: '/play/results/$id', params: { id } })
      }}
      // The screen owns the fixture re-center and its cost; the session drops
      // the superseded hand-edited edges so returning to S6 shows the width.
      onRebalance={() => setManualRange(null)}
      onBack={toTracker}
    />
  )
}
