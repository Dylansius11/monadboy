import { useState } from 'react'
import { explorerTxUrl } from '../../chain/config'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { useSession } from '../../state/session'
import { duration } from '../../lib/format'
import { KeyHints, Panel, PixelText, Sprite } from '../../ui'
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
  // Nothing rested on the book and nothing filled: the run never started, so
  // there is no SCORE or DAMAGE to be unavailable. Older saves without the
  // flag stay on the measured path.
  const aborted = result?.onBook === false && result.fills === 0
  useConsoleIntent((intent) => {
    if (intent === 'START') setInspect((open) => !open)
    else if (inspect && intent === 'B') setInspect(false)
    else if (!inspect && (intent === 'A' || intent === 'B')) actions.back()
  })
  const elapsed = result?.openedAt == null ? null : duration(Math.max(0, result.closedAt - result.openedAt))
  const detail = result && (
    <Panel flush className="flex flex-col gap-1 p-2">
      <PixelText role="body">Actual cancel / withdrawal receipts</PixelText>
      <PixelText role="micro">
        {result.fills ?? 'Unavailable'} observed maker fills. Closed {new Date(result.closedAt * 1000).toISOString()}.
      </PixelText>
      <PixelText role="micro">
        {aborted ? 'No order was on the book at exit and no fill was observed; the exit only withdrew margin.'
          : result.complete
            ? 'SDK SCORE / DAMAGE / independent NET from complete run coverage.'
            : 'Recovered history has gaps. Numeric history is unavailable; the actual exit receipt is still sealed.'}
      </PixelText>
      <PixelText role="micro">
        Elapsed {elapsed ?? 'unavailable'} from actual chain timestamps. Time-in-range history is not reconstructed from missing samples.
      </PixelText>
    </Panel>
  )
  if (inspect) return <Inputs state={state} onClose={() => setInspect(false)}>{detail}</Inputs>
  const position = state.position
  return (
    <div className="screen-results screen-funded-results bg-screen flex h-full w-full flex-col gap-1 p-2">
      <Header title={result ? 'Session over' : 'No confirmed exit'} demoMultiplier={state.demoMultiplier} />
      <div className="funded-results-body">
        {result && aborted && <>
          <section className="funded-result-banner">
            <Sprite character={character} animation="idle" size={64} />
            <div>
              <PixelText role="title" upper as="p">Run aborted</PixelText>
              <PixelText role="body" tone="gain" upper as="p">Funds returned</PixelText>
            </div>
          </section>
          <PixelText role="micro" as="p">No order reached the book and nothing filled, so this run has no SCORE or DAMAGE. The withdrawal is confirmed on chain.</PixelText>
          {position && <section className="funded-card">
            <div className="funded-card-head">
              <PixelText role="micro" tone="dim" upper>Disk balance now</PixelText>
              <PixelText role="micro" tone="dim">TESTNET</PixelText>
            </div>
            <dl className="funded-facts">
              <dt>AUSD</dt><dd>{position.walletQuote.toFixed(6)}</dd>
              <dt>MON</dt><dd>{position.walletBase.toFixed(6)}</dd>
            </dl>
          </section>}
        </>}
        {result && !aborted && <>
          <div className="funded-result-hero">
            <Sprite character={character} animation={result.net === null || result.net < 0 ? 'sit' : 'idle'} size={64} />
            <Numbers score={result.score} damage={result.damage} net={result.net} />
          </div>
          <dl className="funded-facts">
            <dt>Observed maker fills</dt><dd>{result.fills ?? 'Unavailable'}</dd>
            <dt>Elapsed</dt><dd>{elapsed ?? 'unavailable'}</dd>
          </dl>
          {!result.complete && (
            <PixelText role="micro" tone="dim" as="p">
              Fill history had gaps, so the totals stay unavailable rather than guessed. The exit receipts are complete.
            </PixelText>
          )}
        </>}
        {!result && (
          <section className="funded-card">
            <PixelText role="body">
              No successful exit has been recorded. Open your current chain position to cancel and withdraw.
            </PixelText>
            <button className="funded-primary pressable" onClick={actions.openLive}>Open current position</button>
          </section>
        )}
        {state.steps.length > 0 ? <ReceiptSteps steps={state.steps} />
          : result && result.receipts.length > 0 && (
            <div className="funded-result-exits">
              {result.receipts.map((hash, index) => (
                <a key={hash} className="pressable text-micro underline" href={explorerTxUrl(hash)} target="_blank" rel="noreferrer">
                  Open actual exit step {index + 1}
                </a>
              ))}
            </div>
          )}
        <div className="funded-result-save" aria-live="polite">
          {!state.saved && !state.saveError && <PixelText role="micro" tone="dim">No matching sealed-save receipt yet. Play and withdrawal remain available.</PixelText>}
          <Notices state={state} />
          {state.saveError && (
            <button className="pressable min-h-11 text-micro underline" disabled={state.busy} onClick={actions.retrySave}>
              Retry optional sealed history save
            </button>
          )}
        </div>
      </div>
      <KeyHints hints={[{ key: 'A', label: result ? 'Play again' : 'Back' }, { key: 'START', label: 'Inputs' }]} />
    </div>
  )
}
