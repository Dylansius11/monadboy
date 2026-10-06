import { useConsoleIntent } from '../../console/useConsoleInput'
import { Panel, PixelText } from '../../ui'

export type GatedScreen = 'range' | 'live' | 'results'

/**
 * What each gated screen would have needed, in the player's words. None of
 * them describes a simulation: a run that did not happen on a real market is
 * not reported, watched or set up here.
 */
const COPY: Record<GatedScreen, { title: string; detail: string }> = {
  range: {
    title: 'Positions not open yet',
    detail:
      'Setting a range opens a real TESTNET position. The mirror market, the disk registry and the order encodings behind it are not verified yet, so no position can be opened and nothing here simulates one.',
  },
  live: {
    title: 'No live position',
    detail:
      'A live position needs real flip orders on the TESTNET mirror market and fills read back from the chain. None are running, so there is nothing to watch.',
  },
  results: {
    title: 'No result to show',
    detail:
      'A result needs a real finished position and its chain fills. There is none, and a simulated run is never reported in its place.',
  },
}

export interface PrerequisiteGateProps {
  screen: GatedScreen
  /** Where B and the button go: the tracker, or the disks for results. */
  backLabel: string
  onBack: () => void
}

/**
 * A production stand-in for the play screens whose real execution is not
 * available yet. It is a blocked deployment state, not a success state: it
 * offers no way to continue and names the gates that must close first
 * (docs/BLOCKERS.md B1: funded roles and receipts; B9: trusted encodings,
 * gas and indexed fills).
 */
export function PrerequisiteGate({ screen, backLabel, onBack }: PrerequisiteGateProps) {
  useConsoleIntent((intent) => {
    if (intent === 'B' || intent === 'A') onBack()
  })

  const { title, detail } = COPY[screen]

  return (
    <div
      className="screen-prerequisite bg-screen flex h-full w-full flex-col gap-3 p-4"
      data-prerequisite-gate={screen}
    >
      <div className="flex flex-1 items-center justify-center">
        <Panel className="flex flex-col gap-2">
          <PixelText role="title" upper>
            {title}
          </PixelText>
          <PixelText as="p" role="body">
            {detail}
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            TESTNET only. Waiting on gates B1 and B9.
          </PixelText>
        </Panel>
      </div>
      <div className="screen-footer flex items-center justify-end">
        <button type="button" onClick={onBack} className="pressable">
          <PixelText role="micro" upper>
            B {backLabel}
          </PixelText>
        </button>
      </div>
    </div>
  )
}
