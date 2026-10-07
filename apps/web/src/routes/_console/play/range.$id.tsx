import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { USE_FIXTURES } from '../../../config/runtime'
import { FundedGameplay } from '../../../game/screens/FundedGameplay'
import { SetRange } from '../../../game/screens/SetRange'
import { executablePool } from '../../../game/eligibility'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/range/$id')({
  component: SetRangeRoute,
})

/**
 * S6's route (ARCHITECTURE.md §6): a route owns navigation and session
 * wiring, everything else is `SetRange` taking props. A pool the tracker
 * would refuse to start is treated as missing, so the URL cannot skip the gate.
 */
function FixtureSetRangeRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const {
    difficulty,
    godMode,
    amount,
    width,
    manualRange,
    autopilot,
    balance,
    setAmount,
    setWidth,
    setManualRange,
    setAutopilot,
  } = useSession()
  const pool = useMemo(
    () => executablePool(id, difficulty, godMode)?.pool,
    [id, difficulty, godMode],
  )

  return (
    <SetRange
      pool={pool}
      balance={balance}
      amount={amount}
      width={width}
      manualRange={manualRange}
      autopilot={autopilot}
      onChangeAmount={setAmount}
      onChangeWidth={setWidth}
      onChangeManualRange={setManualRange}
      onToggleAutopilot={setAutopilot}
      onConfirm={() => navigate({ to: '/play/live/$id', params: { id } })}
      onBack={() => navigate({ to: '/play/tracker' })}
    />
  )
}

function SetRangeRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  if (USE_FIXTURES) return <FixtureSetRangeRoute />
  return <FundedGameplay id={id} stage="range"
    onStage={(stage) => navigate({ to: stage === 'live' ? '/play/live/$id' : stage === 'results' ? '/play/results/$id' : '/play/range/$id', params: { id } })}
    onBack={() => navigate({ to: '/play/tracker' })} />
}
