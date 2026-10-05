import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Results } from '../../../game/screens/Results'
import { findPool } from '../../../game/fixtures'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/results/$id')({
  component: ResultsRoute,
})

/** S8 reports the recorded fixture run; sealed saves are wired in Phase 7. */
function ResultsRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { difficulty, godMode, characterId, autopilot, amount, lastRun } =
    useSession()
  const pool = useMemo(
    () => findPool(id, difficulty, godMode)?.pool,
    [id, difficulty, godMode],
  )

  return (
    <Results
      pool={pool}
      run={lastRun}
      amount={amount}
      characterId={characterId}
      autopilot={autopilot}
      onBackToDisks={() => navigate({ to: '/disks' })}
    />
  )
}
