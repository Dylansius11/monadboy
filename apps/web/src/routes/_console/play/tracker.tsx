import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { PoolTracker } from '../../../game/screens/PoolTracker'
import { fixtureGates, scoredPools } from '../../../game/fixtures'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/tracker')({
  component: Tracker,
})

/** The screen records only executable TESTNET picks; this route opens S6. */
function Tracker() {
  const navigate = useNavigate()
  const { difficulty, godMode, characterId } = useSession()
  const pools = useMemo(
    () => scoredPools(difficulty, godMode),
    [difficulty, godMode],
  )

  return (
    <PoolTracker
      pools={pools}
      characterId={characterId}
      gates={fixtureGates(difficulty)}
      onPlayPool={(pairAddress) => {
        navigate({ to: '/play/range/$id', params: { id: pairAddress } })
      }}
      onBack={() => navigate({ to: '/play/difficulty' })}
    />
  )
}
