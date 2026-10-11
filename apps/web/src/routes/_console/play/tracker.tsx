import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { USE_FIXTURES } from '../../../config/runtime'
import { PoolTracker } from '../../../game/screens/PoolTracker'
import { ReadState } from '../../../game/screens/ReadState'
import { FIXTURE_PROVENANCE } from '../../../game/data/provenance'
import { toTrackerSnapshot } from '../../../game/data/tracker'
import { fixtureGates, scoredPools } from '../../../game/fixtures'
import { nextPlayableTier } from '../../../game/eligibility'
import { ageNowMs, useNow, useTrackerRead } from '../../../lib/worker/queries'
import { useSession } from '../../../state/session'
import type { ReadView } from '../../../lib/worker/queries'
import type { TrackerReadout } from '../../../lib/worker/schemas'

export const Route = createFileRoute('/_console/play/tracker')({
  component: Tracker,
})

/**
 * S5 offers only executable TESTNET picks; this route opens S6 with the chosen
 * pool id in the URL.
 *
 * The pools are the worker's /v1/tracker read. The development fixtures are
 * used only when `USE_FIXTURES` says so (tests, or dev with the opt-in flag):
 * a failed or missing read is a state of its own, never a reason to show them.
 */
function Tracker() {
  return USE_FIXTURES ? <FixtureTracker /> : <WorkerTracker />
}

function FixtureTracker() {
  const navigate = useNavigate()
  const { difficulty, godMode, characterId, chooseDifficulty } = useSession()
  const pools = useMemo(
    () => scoredPools(difficulty, godMode),
    [difficulty, godMode],
  )
  const looserTier = useMemo(
    () => nextPlayableTier(difficulty, (tier) => scoredPools(tier, godMode)),
    [difficulty, godMode],
  )

  return (
    <PoolTracker
      pools={pools}
      characterId={characterId}
      gates={fixtureGates(difficulty)}
      provenance={FIXTURE_PROVENANCE}
      looserTier={looserTier}
      // A tier is chosen where tiers are chosen: S4 opens with its cursor on
      // the offered one, and its A stays the single confirm.
      onTryTier={(tier) => {
        chooseDifficulty(tier, godMode)
        navigate({ to: '/play/difficulty' })
      }}
      onPlayPool={(pairAddress) => {
        navigate({ to: '/play/range/$id', params: { id: pairAddress } })
      }}
      onBack={() => navigate({ to: '/play/difficulty' })}
    />
  )
}

function WorkerTracker() {
  const navigate = useNavigate()
  const view = useTrackerRead()
  const back = () => navigate({ to: '/play/difficulty' })

  if (view.kind !== 'ready') {
    return <ReadState subject="pool tracker" view={view} onBack={back} />
  }
  return <WorkerTrackerReady view={view} onBack={back} />
}

function WorkerTrackerReady({
  view,
  onBack,
}: {
  view: Extract<ReadView<TrackerReadout>, { kind: 'ready' }>
  onBack: () => void
}) {
  const navigate = useNavigate()
  const { difficulty, godMode, characterId, chooseDifficulty } = useSession()
  const now = useNow(15_000)
  const { data, receivedAt, refreshError, offline } = view
  const ageMs = ageNowMs(data.ageMs, receivedAt, now)

  const notes = [
    ...(offline ? ['No connection. This is the last read, not a refresh.'] : []),
    ...(refreshError
      ? [`The latest refresh failed: ${refreshError.message} Showing the last good read.`]
      : []),
  ].join(' ')
  const snapshot = useMemo(
    () =>
      toTrackerSnapshot(data, {
        difficulty,
        godMode,
        ageMs,
        notes: notes ? [notes] : [],
      }),
    [data, difficulty, godMode, ageMs, notes],
  )
  // The same read under each looser tier's gates: an offer to switch is made
  // only when that tier would actually admit a playable TESTNET market.
  const looserTier = useMemo(
    () => nextPlayableTier(difficulty, (tier) =>
      toTrackerSnapshot(data, { difficulty: tier, godMode, ageMs }).pools),
    [data, difficulty, godMode, ageMs],
  )
  if (data.status === 'offline' || snapshot.pools.length === 0) {
    return (
      <ReadState
        subject="pool tracker"
        view={{
          kind: 'empty',
          title: 'No markets scored',
          message:
            'The worker has no scored market snapshot yet, so there is no map to draw. Nothing is shown in its place.',
        }}
        onBack={onBack}
      />
    )
  }

  return (
    <PoolTracker
      pools={snapshot.pools}
      characterId={characterId}
      gates={snapshot.gates}
      provenance={snapshot.provenance}
      looserTier={looserTier}
      // The live tier is saved to the disk, so S4 confirms it, with its
      // cursor already on the offered tier.
      onTryTier={(tier) => {
        chooseDifficulty(tier, godMode)
        navigate({ to: '/play/difficulty' })
      }}
      onPlayPool={(pairAddress) => {
        navigate({ to: '/play/range/$id', params: { id: pairAddress } })
      }}
      onBack={onBack}
    />
  )
}
