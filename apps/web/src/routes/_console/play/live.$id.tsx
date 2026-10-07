import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { USE_FIXTURES } from '../../../config/runtime'
import { FundedGameplay } from '../../../game/screens/FundedGameplay'
import { InRange } from '../../../game/screens/InRange'
import { executablePool } from '../../../game/eligibility'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/live/$id')({
  component: Live,
})

/**
 * S7's route (ARCHITECTURE.md §6): navigation and session wiring only,
 * everything else is `InRange` taking props. A pool the tracker would refuse
 * to start is treated as missing. `onBack` leaves the position and returns to
 * the tracker, which is where the player picked this pool.
 */
function FixtureLive() {
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
    () => executablePool(id, difficulty, godMode)?.pool,
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

function Live() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  if (USE_FIXTURES) return <FixtureLive />
  return <FundedGameplay id={id} stage="live"
    onStage={(stage) => navigate({ to: stage === 'live' ? '/play/live/$id' : stage === 'results' ? '/play/results/$id' : '/play/range/$id', params: { id } })}
    onBack={() => navigate({ to: '/disks' })} />
}
