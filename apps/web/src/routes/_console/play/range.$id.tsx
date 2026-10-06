import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { USE_FIXTURES } from '../../../config/runtime'
import { PrerequisiteGate } from '../../../game/screens/PrerequisiteGate'
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

/**
 * Production has no real position execution yet (docs/BLOCKERS.md B1, B9), so
 * outside the opt-in fixture mode this route is a blocked state, not a
 * simulation. It never renders the fixture walk.
 */
function SetRangeRoute() {
  const navigate = useNavigate()
  if (!USE_FIXTURES) {
    return (
      <PrerequisiteGate
        screen="range"
        backLabel="Back to tracker"
        onBack={() => navigate({ to: '/play/tracker' })}
      />
    )
  }
  return <FixtureSetRangeRoute />
}
