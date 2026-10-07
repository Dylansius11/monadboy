import { useState } from 'react'
import { explorerTxUrl } from '../../chain/config'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { useSession } from '../../state/session'
import { duration } from '../../lib/format'
import { Panel, PixelText, Sprite } from '../../ui'
import {
  Header,
  Inputs,
  Numbers,
  Notices,
  ReceiptSteps,
  SourceLinks,
} from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'

export function FundedResults({ state, actions }: FundedScreenProps) {
  const [inspect, setInspect] = useState(false)
  const character = useSession((session) => session.characterId)
  const result = state.result
  useConsoleIntent((intent) => {
    if (intent === 'START') setInspect((open) => !open)
    else if (inspect && intent === 'B') setInspect(false)
    else if (!inspect && (intent === 'A' || intent === 'B')) actions.back()
  })
  if (inspect) return <Inputs state={state} onClose={() => setInspect(false)} />
  return (
    <div className="screen-results bg-screen flex h-full w-full flex-col gap-1 p-2">
      <Header title={result ? 'Session over' : 'No confirmed exit'} />
      <div className="funded-body flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {result ? (
          <>
            <div className="results-money grid grid-cols-[80px_1fr] items-start gap-2">
              <Sprite
                character={character}
                animation={
                  result.net === null || result.net < 0 ? 'sit' : 'idle'
                }
                size={64}
              />
              <Numbers
                score={result.score}
                damage={result.damage}
                net={result.net}
              />
            </div>
            <Panel flush className="flex flex-col gap-1 p-2">
              <PixelText role="body">
                Actual cancel / withdrawal receipts
              </PixelText>
              <PixelText role="micro">
                {result.fills} observed maker fills. Closed{' '}
                {new Date(result.closedAt * 1000).toISOString()}.
              </PixelText>
              <PixelText role="micro">
                {result.complete
                  ? 'SDK SCORE / DAMAGE / independent NET from complete run coverage.'
                  : 'Recovered history has gaps. Numeric history is unavailable; the actual exit receipt is still sealed.'}
              </PixelText>
              {result.receipts.map((hash, index) => (
                <a
                  key={hash}
                  className="pressable min-h-11 text-micro underline"
                  href={explorerTxUrl(hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open actual exit step {index + 1}
                </a>
              ))}
            </Panel>
          </>
        ) : (
          <Panel>
            <PixelText role="body">
              No successful exit has been recorded. Open your current chain
              position to cancel and withdraw.
            </PixelText>
            <button
              className="pressable min-h-11 text-micro underline"
              onClick={actions.openLive}
            >
              Open current position
            </button>
          </Panel>
        )}
        {result && (
          <PixelText role="micro">
            Elapsed{' '}
            {result.openedAt === null
              ? 'unavailable'
              : duration(Math.max(0, result.closedAt - result.openedAt))}{' '}
            from actual chain timestamps. Time-in-range history is not
            reconstructed from missing samples.
          </PixelText>
        )}
        <ReceiptSteps state={state} />
        <Notices state={state} />
        {state.saveError && (
          <button
            className="pressable min-h-11 text-micro underline"
            onClick={actions.retrySave}
          >
            Retry optional sealed history save
          </button>
        )}
        <SourceLinks state={state} />
      </div>
      <footer className="screen-footer flex items-center justify-between gap-1">
        <button
          className="pressable min-h-11 text-micro"
          onClick={actions.back}
        >
          A Back to disks
        </button>
        <button
          className="pressable min-h-11 text-micro"
          onClick={() => setInspect(true)}
        >
          START Inputs
        </button>
      </footer>
    </div>
  )
}
