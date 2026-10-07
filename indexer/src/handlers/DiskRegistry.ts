import { DiskRegistry } from 'generated'
import { emptyDisk } from './state'

DiskRegistry.DiskSaved.handler(async ({ event, context }) => {
  const id = event.params.disk.toLowerCase()
  const disk = (await context.Disk.get(id)) ?? emptyDisk(id)
  const block = BigInt(event.block.number)
  // Source ordering/reorg rollback is handled by HyperIndex; repeated save logs
  // must not increment the public aggregate a second time.
  if (
    disk.lastSaveBlock > block ||
    (disk.lastSaveBlock === block && disk.lastSaveLogIndex >= event.logIndex)
  )
    return
  context.Disk.set({
    ...disk,
    saves: disk.saves + 1,
    lastSaveBlock: block,
    lastSaveLogIndex: event.logIndex,
  })
})

DiskRegistry.DiskErased.handler(async ({ event, context }) => {
  const id = event.params.disk.toLowerCase()
  // Erasing a private save is not an instruction to erase chain-derived SCORE.
  if (!(await context.Disk.get(id))) context.Disk.set(emptyDisk(id))
})
