import { useEffect } from 'react'
import { getGameplayController } from '../../chain/gameplay-store'
import { useCardState } from '../../chain/card-store'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { useSession } from '../../state/session'
import { useSound } from '../../sound/SoundProvider'
import { KeyHints, Panel, PixelText } from '../../ui'
import { FundedRange } from './FundedRange'
import { FundedLive } from './FundedLive'
import { FundedResults } from './FundedResults'
import { ReceiptSteps } from './FundedGameplayView'
import type { Actions } from './FundedGameplayView'
import type { ReactNode } from 'react'

export type FundedStage = 'range' | 'live' | 'results'

/** The production controller is never constructed by the marked fixture branch. */
export function FundedGameplay({
  id,
  stage,
  onStage,
  onBack,
}: {
  id: string
  stage: FundedStage
  onStage: (stage: FundedStage) => void
  onBack: () => void
}) {
  const card = useCardState()
  const diskId = useSession((state) => state.diskId)
  const controller = getGameplayController()
  const state = controller.useState()
  const slot = diskId === 1 || diskId === 2 || diskId === 3 ? diskId : null
  useEffect(() => {
    if (card.phase !== 'inserted' || slot === null) return
    const current = controller.useState.getState()
    if (current.owner !== card.disks?.[slot] || current.market === null)
      void controller.open(id, slot)
  }, [card.phase, card.serial, card.disks, slot, id, controller])
  useEffect(() => {
    if (card.phase !== 'inserted' || slot === null) return
    const tick = () => {
      if (document.hidden) return
      if (stage !== 'results') void controller.keepMirrorActive()
      if (!controller.useState.getState().busy) void controller.refresh()
    }
    const timer = setInterval(tick, 5000)
    document.addEventListener('visibilitychange', tick)
    tick()
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [card.phase, slot, controller, stage])
  const { play } = useSound()
  const actions: Actions = {
    clearQuote: () => controller.useState.setState({ quote: null }),
    quote: () => void controller.quote(),
    quoteExit: () => void controller.quoteExit(),
    confirm: () =>
      void controller.confirm().then((success) => {
        if (success) onStage('live')
      }),
    withdraw: () =>
      void controller.withdraw().then((success) => {
        if (success) {
          play('withdraw')
          onStage('results')
        }
      }),
    // Re-center is an actual exit, followed by S6's fresh quote/cost and another explicit confirmation.
    recenter: () =>
      void controller.withdraw().then((success) => {
        if (success) {
          play('withdraw')
          onStage('range')
        }
      }),
    refresh: () => void controller.refresh(),
    setAmount: controller.setAmount,
    setWidth: controller.setWidth,
    setManual: controller.setManual,
    retrySave: () => void controller.retrySave(),
    back: onBack,
    openLive: () => onStage('live'),
  }
  if (card.phase !== 'inserted' || slot === null)
    return (
      <Unavailable
        onBack={onBack}
        text={
          card.phase !== 'inserted'
            ? 'INSERT CARD to recover your chain-owned position. Broadcast receipts remain valid.'
            : 'Open a saved disk first. The server never chooses your signing identity.'
        }
      >
        <ReceiptSteps steps={state.steps} />
      </Unavailable>
    )
  if (!state.market || !state.position)
    return (
      <Unavailable
        onBack={onBack}
        text={
          state.error ??
          state.readError ??
          'Reading verified TESTNET contracts and this disk account.'
        }
      >
        <button
          className="pressable min-h-11 underline"
          onClick={() => void controller.open(id, slot)}
        >
          Retry chain read
        </button>
      </Unavailable>
    )
  return stage === 'range' ? (
    <FundedRange state={state} actions={actions} />
  ) : stage === 'live' ? (
    <FundedLive state={state} actions={actions} />
  ) : (
    <FundedResults state={state} actions={actions} />
  )
}

function Unavailable({
  text,
  onBack,
  children,
}: {
  text: string
  onBack: () => void
  children?: ReactNode
}) {
  useConsoleIntent((intent) => {
    if (intent === 'B' || intent === 'A') onBack()
  })
  return (
    <div className="screen-range bg-screen flex h-full flex-col gap-2 p-2">
      <PixelText role="title">TESTNET position</PixelText>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <Panel>
          <PixelText role="body">{text}</PixelText>
        </Panel>
        {children}
      </div>
      <KeyHints hints={[{ key: 'B', label: 'Back' }]} />
    </div>
  )
}
