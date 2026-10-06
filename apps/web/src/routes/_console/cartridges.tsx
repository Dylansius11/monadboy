import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { USE_FIXTURES } from '../../config/runtime'
import { CartridgeSelect } from '../../game/screens/CartridgeSelect'
import { cartridges, findDisk } from '../../game/fixtures'
import { useSession } from '../../state/session'
import { getShelfController } from '../../chain/shelf-store'
import { useCardState } from '../../chain/card-store'
import type { SaveDisk } from '../../types/domain'

export const Route = createFileRoute('/_console/cartridges')({
  ssr: false,
  component: CartridgeSelectRoute,
})

function CartridgeSelectRoute() {
  return USE_FIXTURES ? <FixtureCartridges /> : <RealCartridges />
}

function FixtureCartridges() {
  const diskId = useSession((state) => state.diskId)
  return <Shelf disk={useMemo(() => findDisk(diskId), [diskId])} fixture />
}

function RealCartridges() {
  const diskId = useSession((state) => state.diskId)
  const card = useCardState()
  const state = getShelfController().useShelf()
  const entry = diskId === 1 || diskId === 2 || diskId === 3 ? state.shelf?.slots[diskId] : undefined
  return <Shelf disk={card.phase === 'inserted' && entry?.kind === 'disk' ? entry.disk : undefined} fixture={false} />
}

function Shelf({ disk, fixture }: { disk: SaveDisk | undefined; fixture: boolean }) {
  const navigate = useNavigate()
  return <CartridgeSelect disk={disk} cartridges={useMemo(() => cartridges(), [])} fixture={fixture}
    onInsert={() => void navigate({ to: disk || fixture ? '/play/difficulty' : '/disks' })}
    onLeaderboard={() => void navigate({ to: '/leaderboard', search: { window: '24h' } })}
    onBack={() => void navigate({ to: '/disks' })} />
}
