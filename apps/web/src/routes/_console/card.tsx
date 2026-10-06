import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MemoryCard } from '../../game/screens/MemoryCard'
import { FIXTURE_CARD_ADDRESS } from '../../game/fixtures'
import { USE_FIXTURES } from '../../config/runtime'
import { getCardManager, useCardState } from '../../chain/card-store'
import { useSession } from '../../state/session'

export const Route = createFileRoute('/_console/card')({ ssr: false, component: MemoryCardRoute })

function MemoryCardRoute() {
  return USE_FIXTURES ? <FixtureCard /> : <RealCard />
}

function FixtureCard() {
  const navigate = useNavigate()
  const { cardAddress, insertCard } = useSession()
  return <MemoryCard cardAddress={cardAddress}
    onInsert={() => { insertCard(FIXTURE_CARD_ADDRESS); void navigate({ to: '/disks' }) }}
    onBack={() => void navigate({ to: '/play' })} />
}

function RealCard() {
  const navigate = useNavigate()
  const state = useCardState()
  async function read(method: 'insert' | 'new') {
    const card = getCardManager()
    try {
      if (card.getState().phase !== 'inserted') {
        if (method === 'new') await card.create()
        else await card.insert()
      }
      if (card.getState().phase === 'inserted') await navigate({ to: '/disks' })
    } catch {
      // The manager publishes the stable, reader-specific error; never create another card on failure.
    }
  }
  return <MemoryCard cardAddress={state.serial} fixture={false}
    pending={state.phase === 'reading'} error={state.error?.text}
    onInsert={(method) => void read(method)} onEject={() => getCardManager().eject()}
    onBack={() => { if (state.phase === 'reading') getCardManager().eject(); void navigate({ to: '/play' }) }} />
}
