import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { USE_FIXTURES } from '../../../config/runtime'
import { FundedGameplay } from '../../../game/screens/FundedGameplay'
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

function ResultsRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  if (USE_FIXTURES) return <FixtureResultsRoute />
  return <FundedGameplay id={id} stage="results"
    onStage={(stage) => navigate({ to: stage === 'live' ? '/play/live/$id' : stage === 'results' ? '/play/results/$id' : '/play/range/$id', params: { id } })}
    onBack={() => navigate({ to: '/disks' })} />
}
