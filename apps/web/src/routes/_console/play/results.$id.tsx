import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { USE_FIXTURES } from '../../../config/runtime'
import { PrerequisiteGate } from '../../../game/screens/PrerequisiteGate'
import { Results } from '../../../game/screens/Results'
import { executablePool } from '../../../game/eligibility'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/results/$id')({
  component: ResultsRoute,
})

/** S8 reports the recorded fixture run; sealed saves are wired in Phase 7. */
function FixtureResultsRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { difficulty, godMode, characterId, autopilot, amount, lastRun } =
    useSession()
  const pool = useMemo(
    () => executablePool(id, difficulty, godMode)?.pool,
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

/**
 * Production has no real position execution yet (docs/BLOCKERS.md B1, B9), so
 * outside the opt-in fixture mode this route is a blocked state, not a
 * simulation. It never renders the fixture walk.
 */
function ResultsRoute() {
  const navigate = useNavigate()
  if (!USE_FIXTURES) {
    return (
      <PrerequisiteGate
        screen="results"
        backLabel="Back to disks"
        onBack={() => navigate({ to: '/disks' })}
      />
    )
  }
  return <FixtureResultsRoute />
}
