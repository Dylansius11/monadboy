import { explorerAddressUrl, explorerTxUrl } from '../../chain/config'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { price } from '../../lib/format'
import { Panel, PixelText, Value } from '../../ui'
import type { GameplayState } from '../../chain/gameplay-store'

export type Actions = {
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
export function Header({ title, demoMultiplier = 1 }: { title: string; demoMultiplier?: number }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-1">
      <PixelText role="title" upper>
        {title}
      </PixelText>
      <PixelText role="micro" upper>
        {demoMultiplier > 1 ? `DEMO x${demoMultiplier} · TESTNET` : 'MON/AUSD TESTNET'}
      </PixelText>
    </header>
  )
}
export function ReceiptSteps({ state }: { state: GameplayState }) {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      {state.steps.map((step) => (
        <div
          key={step.step}
          className="flex flex-wrap items-baseline gap-1 text-micro"
        >
          <span>
            {step.step}:{' '}
            {step.state === 'checking'
              ? 'checking cost / block spacing'
              : step.state}
          </span>
          {step.hash && (
            <a
              className="underline"
              href={explorerTxUrl(step.hash)}
              target="_blank"
              rel="noreferrer"
            >
              Open transaction
            </a>
          )}
          {step.receipt && (
            <span>
              block {step.receipt.block.toString()}, limit{' '}
              {step.receipt.gas.toString()}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
export function Notices({ state }: { state: GameplayState }) {
  return (
    <>
      {state.demandError && (
        <PixelText role="micro" tone="loss" as="p">{state.demandError}</PixelText>
      )}
      {state.error && (
        <PixelText role="micro" tone="loss" as="p" aria-live="polite">
          {state.error}
        </PixelText>
      )}
      {state.readError && (
        <PixelText role="micro" tone="loss" as="p">
          Latest chain read failed: {state.readError}. The last good read is
          retained, not refreshed.
        </PixelText>
      )}
      {state.saveError && (
        <PixelText role="micro" tone="loss" as="p">
          Optional history save failed. {state.saveError}
        </PixelText>
      )}
      {state.saved && (
        <a
          className="text-micro underline"
          href={explorerTxUrl(state.saved.hash)}
          target="_blank"
          rel="noreferrer"
        >
          SAVED TO CARD. Matching DiskSaved receipt.
        </a>
      )}
    </>
  )
}
export function SourceLinks({ state }: { state: GameplayState }) {
  const position = state.position
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-micro">
      <a
        className="underline"
        href={explorerAddressUrl(state.market!.address)}
        target="_blank"
        rel="noreferrer"
      >
        TESTNET book / orders
      </a>
      <a
        className="underline"
        href={explorerAddressUrl(state.owner!)}
        target="_blank"
        rel="noreferrer"
      >
        Disk account / balances
      </a>
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
}: {
  state: GameplayState
  onClose: () => void
}) {
  useConsoleIntent((intent) => {
    if (intent === 'B' || intent === 'START') onClose()
  })
  const position = state.position!
  return (
    <div className="screen-inputs bg-screen flex h-full w-full flex-col gap-2 overflow-y-auto p-2">
      <Header title="Actual inputs" demoMultiplier={state.demoMultiplier} />
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
      <ReceiptSteps state={state} />
      <SourceLinks state={state} />
      <button className="pressable min-h-11 text-micro" onClick={onClose}>
        B Close inputs
      </button>
    </div>
  )
}
