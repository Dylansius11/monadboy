import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { DiskSelect } from '../../game/screens/DiskSelect'
import { MAX_DISKS, saveDisks } from '../../game/fixtures'
import { useSession } from '../../state/session'
import { USE_FIXTURES } from '../../config/runtime'
import { RealDiskShelf } from '../../game/screens/RealDiskShelf'

export const Route = createFileRoute('/_console/disks')({
  ssr: false,
  component: DiskSelectRoute,
})

/**
 * S2's route (ARCHITECTURE.md §6): a route owns navigation and session wiring.
 *
 * Opening a disk sets BOTH the disk and the difficulty it is bound to. A disk
 * IS a difficulty (ERD.md section 2, SAVE_DISK ||--|| DIFFICULTY), so letting
 * the player open a HARD disk and then land on S4 still holding the previous
 * disk's EASY gates would filter the tracker by the wrong tier and show a pool
 * list that disagrees with the disk that opened it.
 */
function DiskSelectRoute() {
  return USE_FIXTURES ? <FixtureDiskSelectRoute /> : <RealDiskSelectRoute />
}

function RealDiskSelectRoute() {
  const navigate = useNavigate()
  const { openDisk, chooseDifficulty } = useSession()
  return <RealDiskShelf onOpen={(disk) => {
    openDisk(disk.diskId)
    chooseDifficulty(disk.difficulty, disk.godMode)
    void navigate({ to: '/cartridges' })
  }} onBack={() => void navigate({ to: '/card' })} />
}

function FixtureDiskSelectRoute() {
  const navigate = useNavigate()
  const { openDisk, chooseDifficulty } = useSession()
  const disks = useMemo(() => saveDisks(), [])

  return (
    <DiskSelect
      cardAddress={useSession((s) => s.cardAddress)}
      disks={disks}
      maxDisks={MAX_DISKS}
      onOpen={(diskId) => {
        const disk = disks.find((d) => d.diskId === diskId)
        if (!disk) return
        openDisk(diskId)
        chooseDifficulty(disk.difficulty, disk.godMode)
        navigate({ to: '/cartridges' })
      }}
      onBack={() => navigate({ to: '/card' })}
    />
  )
}
