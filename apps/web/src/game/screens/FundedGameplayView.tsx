import { mainnetMarkets, monad } from '@monadboy/sdk'
import { explorerAddressUrl, explorerTxUrl } from '../../chain/config'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { price } from '../../lib/format'
import { KeyHints, Panel, PixelText, Value } from '../../ui'
import type { GameplayState } from '../../chain/gameplay-store'
import type { ExecutionStep } from '../../chain/market-execution'
import type { ReactNode } from 'react'
import './funded.css'

const sourceMarket = mainnetMarkets.find((market) => market.symbol === 'MON_USDC')

export type Actions = {
  clearQuote: () => void
  quote: () => void
  quoteExit: () => void
  confirm: () => void
  withdraw: () => void
  recenter: () => void
  refresh: () => void
  setAmount: (amount: number) => void
  setWidth: (width: 'wide' | 'tight') => void
  setManual: (manual: { low: number; high: number } | null) => void
  retrySave: () => void
  back: () => void
  openLive: () => void
}
export type FundedScreenProps = { state: GameplayState; actions: Actions }
export function Header({
  title, demoMultiplier = 1, pair = 'MON / AUSD',
}: { title: string; demoMultiplier?: number; pair?: string }) {
  return (
    <header className="funded-header">
      <PixelText role="body" upper>{title}</PixelText>
      <PixelText role="body" upper>{pair}</PixelText>
      <PixelText role="micro" tone="dim">{demoMultiplier > 1 ? `TESTNET · DEMO x${demoMultiplier} price motion` : 'TESTNET'}</PixelText>
    </header>
  )
}

/**
 * The real steps as a checklist: one row each, the state in its marker's
 * shape, the block it landed in and the transaction one tap away. `planned`
 * lists steps that will run but have not started, so progress reads as a
 * list being ticked off rather than a log appearing line by line.
 */
export function ReceiptSteps({ steps, planned = [], verbose = false }: { steps: readonly ExecutionStep[]; planned?: readonly string[]; verbose?: boolean }) {
  const rows = [...steps, ...planned.filter((name) => !steps.some((step) => step.step === name)).map((name) => ({ step: name, state: 'waiting' as const }))]
  if (!rows.length) return null
  return (
    <ol aria-live="polite" aria-label="Actual transaction steps" className="funded-steps">
      {rows.map((step, index) => {
        const sent = step.state === 'waiting' ? null : step
        const state = sent?.receipt?.status === 'reverted' ? 'reverted' : step.state
        const failed = state === 'reverted' || state === 'not-sent' || state === 'unconfirmed'
        const note = sent?.state === 'not-sent' ? sent.detail ?? 'operation interrupted'
          : sent?.state === 'unconfirmed' ? sent.hash ? 'confirmation unavailable; check explorer' : 'outcome unknown: refresh chain state'
            : verbose && sent?.receipt ? `gas limit ${sent.receipt.gas.toString()}` : null
        return (
          <li key={step.step} className="funded-step" data-state={state}>
            <span aria-hidden="true" className="funded-step-marker">{failed ? '!' : state === 'confirmed' ? 'OK' : index + 1}</span>
            <span className="funded-step-name">{step.step}</span>
            <span className="funded-step-status">
              {state === 'confirmed' ? sent?.receipt ? `#${sent.receipt.block.toString()}` : 'confirmed'
                : state === 'broadcast' ? 'sent' : state === 'not-sent' ? 'not sent' : state === 'unconfirmed' ? 'unknown' : state}
            </span>
            {sent?.hash
              ? <a className="funded-step-link pressable" href={explorerTxUrl(sent.hash)} target="_blank" rel="noreferrer" aria-label={`Open ${step.step} transaction`}>TX ↗</a>
              : <span className="funded-step-link" aria-hidden="true" />}
            {note && <span className="funded-step-note">{note}</span>}
          </li>
        )
      })}
    </ol>
  )
}
/** `error={false}` when the screen states the operation error in its own card. */
export function Notices({ state, error = true }: { state: GameplayState; error?: boolean }) {
  const hasError = state.demandError || (error && state.error) || state.readError || state.saveError || state.position?.historyError
  return (
    <>
      {hasError && (
        <div role="alert" aria-live="polite" className="funded-notices">
          <Panel flush className="flex flex-col gap-1 p-2">
            {state.demandError && <PixelText role="micro" tone="loss" as="p">{state.demandError}</PixelText>}
            {error && state.error && <PixelText role="micro" tone="loss" as="p">{state.error}</PixelText>}
            {state.readError && (
              <PixelText role="micro" tone="loss" as="p">
                Latest chain read failed: {state.readError}. The last good read is retained, not refreshed.
              </PixelText>
            )}
            {state.saveError && <PixelText role="micro" tone="loss" as="p">Optional history save failed. {state.saveError}</PixelText>}
            {state.position?.historyError && <PixelText role="micro" tone="loss" as="p">{state.position.historyError}</PixelText>}
          </Panel>
        </div>
      )}
      {state.saved && (
        <a className="funded-saved text-micro underline" href={explorerTxUrl(state.saved.hash)} target="_blank" rel="noreferrer">
          SAVED TO CARD. Matching DiskSaved receipt.
        </a>
      )}
    </>
  )
}
export function SourceLinks({ state }: { state: GameplayState }) {
  const position = state.position
  return (
    <div className="funded-sources flex flex-wrap gap-x-3 gap-y-1 text-micro">
      {state.market && <a
        className="underline"
        href={explorerAddressUrl(state.market.address)}
        target="_blank"
        rel="noreferrer"
      >
        TESTNET book / orders
      </a>}
      {state.owner && <a
        className="underline"
        href={explorerAddressUrl(state.owner)}
        target="_blank"
        rel="noreferrer"
      >
        Disk account / balances
      </a>}
      {sourceMarket && state.mainnetMid !== null && (
        <a className="underline" href={`${monad.blockExplorers.default.url}/address/${sourceMarket.address}`} target="_blank" rel="noreferrer">
          MAINNET source book
        </a>
      )}
      <span>
        {position?.source} / snapshot block {position?.block.toString()} /{' '}
        {position ? (position.head - position.block).toString() : 'unavailable'}{' '}
        blocks behind RPC head
      </span>
    </div>
  )
}
export function Numbers({
  score,
  damage,
  net,
}: {
  score: number | null
  damage: number | null
  net: number | null
}) {
  return (
    <Panel flush className="funded-numbers grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 p-2">
      <PixelText role="body" upper>
        Score
      </PixelText>
      <div className="text-right">
        {score === null ? (
          <PixelText role="value">Unavailable</PixelText>
        ) : (
          <Value amount={score} prefix="$" decimals={6} tone="gain" />
        )}
      </div>
      <PixelText role="body" upper>
        Damage
      </PixelText>
      <div className="text-right">
        {damage === null ? (
          <PixelText role="value">Unavailable</PixelText>
        ) : (
          <Value amount={damage} prefix="-$" decimals={6} tone="loss" />
        )}
      </div>
      <PixelText role="micro" upper>
        Net vs hold
      </PixelText>
      <div className="text-right">
        {net === null ? (
          <PixelText role="micro">Unavailable</PixelText>
        ) : (
          <Value amount={net} prefix="$" decimals={6} signed />
        )}
      </div>
    </Panel>
  )
}
export function Inputs({
  state,
  onClose,
  children,
}: {
  state: GameplayState
  onClose: () => void
  children?: ReactNode
}) {
  useConsoleIntent((intent) => {
    if (intent === 'B' || intent === 'START') onClose()
  })
  const position = state.position
  if (!position) return null
  return (
    <div className="screen-inputs bg-screen flex h-full w-full flex-col gap-2 p-2">
      <Header title="Actual inputs" demoMultiplier={state.demoMultiplier} />
      <div className="funded-inputs-body">
      {position.historyError && <div role="alert" className="funded-notices"><Panel flush className="p-2"><PixelText role="micro" tone="loss">{position.historyError}</PixelText></Panel></div>}
      <Panel flush className="flex flex-col gap-1 p-2">
        <PixelText role="micro">
          TESTNET book bid{' '}
          {position.bid === null ? 'unavailable' : price(position.bid)}, ask{' '}
          {position.ask === null ? 'unavailable' : price(position.ask)}; block{' '}
          {position.block.toString()}.
        </PixelText>
        <PixelText role="micro">
          Source: {state.source ?? 'unavailable'}, mid{' '}
          {state.sourceMid === null ? 'unavailable' : price(state.sourceMid)};{' '}
          {state.sourceFresh ? 'fresh' : 'paused'}.
        </PixelText>
        <PixelText role="micro">
          SDK scoreFromFills counts flipped-origin maker spread only. Raw
          Trade.isBuy is taker direction and is inverted once. Indexed isBuy is
          already maker direction.
        </PixelText>
        <PixelText role="micro">
          SDK valueNow = (marginBase + restingBase) * mid + marginQuote +
          restingQuote.
        </PixelText>
        <PixelText role="micro">
          NET = valueNow - valueHodl. DAMAGE = max(0, SCORE - NET). Quote token
          valued at $1, a labelled arithmetic convention.
        </PixelText>
        <PixelText role="micro">
          {position.source}; log coverage from{' '}
          {position.coverageFrom.toString()};{' '}
          {position.complete
            ? 'complete for current run'
            : 'incomplete history, unavailable totals'}
          .
        </PixelText>
        <PixelText role="micro">
          Live graph is tab-local 5s samples, not reconstructed history. Gaps
          are not counted as zero time in range.
        </PixelText>
      </Panel>
      {children}
      {position.orders.map((order) => (
        <PixelText key={order.id} role="micro">
          Order {order.id}: {order.isBuy ? 'buy' : 'sell'}{' '}
          {order.size.toFixed(8)} MON at {price(order.price)}; flip{' '}
          {price(order.flipPrice)}; linked {order.linked || 'none'}.
        </PixelText>
      ))}
      {position.fills.map((fill, index) => (
        <a
          key={`${fill.tx}:${index}`}
          className="pressable text-micro underline"
          href={explorerTxUrl(fill.tx)}
          target="_blank"
          rel="noreferrer"
        >
          Maker {fill.isBuy ? 'buy' : 'sell'} order {fill.orderId.toString()},{' '}
          {fill.size.toFixed(8)} MON at {price(fill.price)},{' '}
          {fill.isFlippedOrder ? 'flipped SCORE' : 'initial inventory only'}.
        </a>
      ))}
      <ReceiptSteps steps={state.steps} verbose />
      <SourceLinks state={state} />
      </div>
      <KeyHints hints={[{ key: 'B', label: 'Close' }]} />
    </div>
  )
}
