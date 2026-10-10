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
} from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'
import './funded-live.css'

export function FundedResults({ state, actions }: FundedScreenProps) {
  const [inspect, setInspect] = useState(false)
  const character = useSession((session) => session.characterId)
  const result = state.result
  useConsoleIntent((intent) => {
    if (intent === 'START') setInspect((open) => !open)
    else if (inspect && intent === 'B') setInspect(false)
    else if (!inspect && (intent === 'A' || intent === 'B')) actions.back()
  })
  const detail = result && (
    <Panel flush className="flex flex-col gap-1 p-2">
      <PixelText role="body">Actual cancel / withdrawal receipts</PixelText>
      <PixelText role="micro">
        {result.fills ?? 'Unavailable'} observed maker fills. Closed {new Date(result.closedAt * 1000).toISOString()}.
      </PixelText>
      <PixelText role="micro">
        {result.complete
          ? 'SDK SCORE / DAMAGE / independent NET from complete run coverage.'
          : 'Recovered history has gaps. Numeric history is unavailable; the actual exit receipt is still sealed.'}
      </PixelText>
      <PixelText role="micro">
        Elapsed {result.openedAt === null ? 'unavailable' : duration(Math.max(0, result.closedAt - result.openedAt))}{' '}
        from actual chain timestamps. Time-in-range history is not reconstructed from missing samples.
      </PixelText>
    </Panel>
  )
  if (inspect) return <Inputs state={state} onClose={() => setInspect(false)}>{detail}</Inputs>
  return (
    <div className="screen-results screen-funded-results bg-screen flex h-full w-full flex-col gap-1 p-2">
      <Header title={result ? 'Session over' : 'No confirmed exit'} demoMultiplier={state.demoMultiplier} />
      <div className="funded-results-body">
        {result ? (
          <>
            <div className="funded-result-hero">
              <Sprite character={character} animation={result.net === null || result.net < 0 ? 'sit' : 'idle'} size={64} />
              <Numbers score={result.score} damage={result.damage} net={result.net} />
            </div>
            <div className="funded-result-facts">
              <PixelText role="body">{result.fills ?? 'Unavailable'} observed maker fills</PixelText>
              <PixelText role="body">
                Elapsed {result.openedAt === null ? 'unavailable' : duration(Math.max(0, result.closedAt - result.openedAt))}
              </PixelText>
            </div>
            {!result.complete && (
              <PixelText role="micro" tone="loss">
                Recovered history has gaps. Numeric history is unavailable; the actual exit receipt is still sealed.
              </PixelText>
            )}
          </>
        ) : (
          <Panel>
            <PixelText role="body">
              No successful exit has been recorded. Open your current chain position to cancel and withdraw.
            </PixelText>
            <button className="pressable min-h-11 text-micro underline" onClick={actions.openLive}>Open current position</button>
          </Panel>
        )}
        <div className="funded-result-save" aria-live="polite">
          {!state.saved && !state.saveError && <PixelText role="micro">No matching sealed-save receipt yet. Play and withdrawal remain available.</PixelText>}
          <Notices state={state} />
          {state.saveError && (
            <button className="pressable min-h-11 text-micro underline" disabled={state.busy} onClick={actions.retrySave}>
              Retry optional sealed history save
            </button>
          )}
        </div>
        <div className="funded-result-receipts">
          {result && (
            <div className="funded-result-exits">
              {result.receipts.map((hash, index) => (
                <a key={hash} className="pressable text-micro underline" href={explorerTxUrl(hash)} target="_blank" rel="noreferrer">
                  Open actual exit step {index + 1}
                </a>
              ))}
            </div>
          )}
          <ReceiptSteps state={state} />
        </div>
      </div>
      <footer className="screen-footer funded-result-footer">
        <button className="pressable min-h-11 text-micro" onClick={actions.back}>A / B Back to disks</button>
        <button className="pressable min-h-11 text-micro" onClick={() => setInspect(true)}>START Inputs</button>
        <PixelText role="micro" tone="dim" upper>Play again from a disk</PixelText>
      </footer>
    </div>
  )
}
