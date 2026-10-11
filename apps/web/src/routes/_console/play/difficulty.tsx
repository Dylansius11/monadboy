import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Difficulty } from '../../../game/screens/Difficulty'
import { useSession } from '../../../state/session'
import { USE_FIXTURES } from '../../../config/runtime'
import { getShelfController } from '../../../chain/shelf-store'
import { useCardState } from '../../../chain/card-store'
import { useConsoleIntent } from '../../../console/useConsoleInput'
import { ageNowMs, useNow, useTrackerRead } from '../../../lib/worker/queries'
import { toTrackerSnapshot } from '../../../game/data/tracker'
import { KeyHints, Panel, PixelText } from '../../../ui'
import type { Difficulty as Tier } from '../../../types/domain'

export const Route = createFileRoute('/_console/play/difficulty')({
  ssr: false,
  component: DifficultyRoute,
})

function DifficultyRoute() {
  return USE_FIXTURES ? <FixtureDifficultyRoute /> : <RealDifficultyRoute />
}

function FixtureDifficultyRoute() {
  const navigate = useNavigate()
  const { difficulty, godMode, chooseDifficulty } = useSession()
  return <Difficulty difficulty={difficulty} godMode={godMode}
    onChange={(next) => chooseDifficulty(next, godMode)}
    onConfirm={(next, nextGodMode) => { chooseDifficulty(next, nextGodMode); void navigate({ to: '/play/tracker' }) }}
    onBack={() => void navigate({ to: '/cartridges' })} />
}

function RealDifficultyRoute() {
  const navigate = useNavigate()
  const { difficulty, godMode, diskId, chooseDifficulty } = useSession()
  const card = useCardState()
  const shelf = getShelfController()
  const state = shelf.useShelf()
  const read = useTrackerRead()
  const now = useNow(1000)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (card.phase === 'inserted' && state.status === 'idle') void shelf.refresh() }, [card.phase, state.status, shelf])
  const slot = diskId === 1 || diskId === 2 || diskId === 3 ? diskId : null
  const selected = slot === null ? null : state.shelf?.slots[slot]
  useConsoleIntent((intent) => { if (intent === 'B' && selected?.kind !== 'disk') void navigate({ to: '/disks' }) })
  if (card.phase !== 'inserted' || selected?.kind !== 'disk') return <div className="bg-screen flex h-full flex-col gap-2 p-2">
    <PixelText role="title" upper>Choose a saved disk first</PixelText>
    <Panel>{state.error?.text ?? 'Insert your card and open one of its three saved disks. No demo disk is substituted.'}</Panel>
    <KeyHints className="mt-auto" hints={[{ key: 'B', label: 'Disks' }]} />
  </div>
  let preview
  if (read.kind === 'ready') {
    const ageMs = ageNowMs(read.data.ageMs, read.receivedAt, now)
    const counts = { easy: 0, normal: 0, hard: 0 }
    for (const tier of ['easy', 'normal', 'hard'] as const) {
      counts[tier] = toTrackerSnapshot(read.data, { difficulty: tier, godMode: false, ageMs }).pools.filter((pool) => pool.passes).length
    }
    preview = { counts, total: read.data.markets.length,
      source: `Worker /v1/tracker; ${read.data.source}; age ${ageMs === null ? 'not reported' : `${Math.floor(ageMs / 1000)}s`}. ${read.offline ? 'Offline, showing the last read.' : read.refreshError ? 'Refresh failed, showing the last read.' : ''} ${read.data.coverage?.complete ? '24h trade coverage complete.' : '24h trade coverage incomplete; missing inputs are not zero.'}` }
  }
  async function confirm(next: Tier, nextGodMode: boolean) {
    if (slot === null) return
    const saved = await shelf.savePreferences(slot, next, nextGodMode)
    if (saved && mounted.current) { chooseDifficulty(next, nextGodMode); await navigate({ to: '/play/tracker' }) }
  }
  return <Difficulty difficulty={difficulty} godMode={godMode} fixture={false} preview={preview}
    pending={state.working !== null} error={state.createError?.text}
    onChange={(next) => chooseDifficulty(next, godMode)} onConfirm={(next, modifier) => void confirm(next, modifier)}
    onBack={() => void navigate({ to: '/cartridges' })} />
}
