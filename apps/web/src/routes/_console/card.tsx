import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MemoryCard } from '../../game/screens/MemoryCard'
import { FIXTURE_CARD_ADDRESS } from '../../game/fixtures'
import { useSession } from '../../state/session'

export const Route = createFileRoute('/_console/card')({
  component: MemoryCardRoute,
})

/** INSERT and NEW CARD use a marked fixture until Mera is wired in Phase 7. */
function MemoryCardRoute() {
  const navigate = useNavigate()
  const { cardAddress, insertCard } = useSession()

  return (
    <MemoryCard
      cardAddress={cardAddress}
      onInsert={() => {
        insertCard(FIXTURE_CARD_ADDRESS)
        navigate({ to: '/disks' })
      }}
      onBack={() => navigate({ to: '/' })}
    />
  )
}
