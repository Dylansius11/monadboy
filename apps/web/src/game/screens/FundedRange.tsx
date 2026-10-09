import { useLayoutEffect, useRef, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { price, usdFine } from '../../lib/format'
import { Panel, PixelText, Value } from '../../ui'
import {
  Header,
  Inputs,
  Notices,
  ReceiptSteps,
  SourceLinks,
} from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'

export function FundedRange({ state, actions }: FundedScreenProps) {
  const [focus, setFocus] = useState<'amount' | 'width'>('amount')
  const [manual, setManual] = useState(false)
  const [inspect, setInspect] = useState(false)
  const position = state.position!
  const quote = state.quote
  const body = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [quote, state.error, state.readError, state.saveError, inspect])
  const recovered =
    position.orders.length > 0 ||
    position.holdings.marginBase > 0 ||
    position.holdings.marginQuote > 0
  const primary = () => {
    if (state.busy) return
    if (position.orders.length) actions.openLive()
    else if (quote) actions.confirm()
    else actions.quote()
  }
  useConsoleIntent((intent) => {
    if (intent === 'START') {
      setInspect((open) => !open)
      return
    }
    if (inspect) {
      if (intent === 'B') setInspect(false)
      return
    }
    if (intent === 'B') {
      if (!state.busy) actions.back()
      return
    }
    if (state.busy) return
    if (intent === 'A') {
      primary()
      return
    }
    if (intent === 'UP' || intent === 'DOWN')
      setFocus((row) => (row === 'amount' ? 'width' : 'amount'))
    if (intent === 'LEFT' || intent === 'RIGHT') {
      if (focus === 'amount')
        actions.setAmount(
          Math.max(
            0,
            Math.round(
              (state.amount + (intent === 'RIGHT' ? 0.12 : -0.12)) * 100,
            ) / 100,
          ),
        )
      else actions.setWidth(state.width === 'wide' ? 'tight' : 'wide')
    }
    if (intent === 'SELECT') setManual((open) => !open)
  })
  if (inspect) return <Inputs state={state} onClose={() => setInspect(false)} />
  return (
    <div className="screen-range screen-funded-range bg-screen flex h-full w-full flex-col gap-1 p-2">
      <Header title={quote ? 'Confirm real steps' : 'Set range'} />
      <div ref={body} className="funded-body funded-range-body flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <Notices state={state} />
        {state.steps.length > 0 && <ReceiptSteps state={state} />}
        {quote && (
          <Panel flush className="funded-range-review flex flex-col gap-1 p-2">
            <PixelText role="body" as="h2">
              Range {price(quote.ladder.low)} to {price(quote.ladder.high)}
            </PixelText>
            <PixelText role="micro">
              {quote.ladder.levels} buy + {quote.ladder.levels} sell flip levels
            </PixelText>
            {quote.ladder.clamped && (
              <PixelText role="micro" tone="loss">
                Range capped by ladder depth or minimum order size. Review the
                actual endpoints above.
              </PixelText>
            )}
            <PixelText role="micro">
              Lock {quote.ladder.baseNeeded.toFixed(8)} MON +{' '}
              {quote.ladder.quoteNeeded.toFixed(6)} AUSD.
            </PixelText>
            <PixelText role="micro">
              {quote.depositRaw > 0n
                ? `Deposit before margin zap: ${quote.quoteRequired.toFixed(6)} AUSD.`
                : 'Existing chain margin covers this ladder; no additional deposit.'}
            </PixelText>
            {quote.zapRaw > 0n ? (
              <PixelText role="micro">
                Swap fee est. {usdFine(quote.takerFeeQuote)} + 1% quote headroom.
              </PixelText>
            ) : (
              <PixelText role="micro">No swap needed; existing MON margin covers sells.</PixelText>
            )}
            <PixelText role="micro">
              Gas fee est. {quote.gasCostMon.toFixed(6)} MON, not a ceiling.
            </PixelText>
            <PixelText role="micro">
              Separate transactions, not atomic. Confirmed partial funds can be withdrawn.
            </PixelText>
            <details className="funded-range-details text-micro">
              <summary className="pressable min-h-11">
                Review minimum output and gas checks
              </summary>
            {quote.zapRaw > 0n ? (
              <>
                <PixelText role="micro">
                  Buy minimum {quote.quotedBase.toFixed(8)} MON. Taker fee est.{' '}
                  {usdFine(quote.takerFeeQuote)} + 1% quote headroom.
                </PixelText>
                <PixelText role="micro">
                  Actual funded simulation enforces this minimum output. Price
                  movement beyond headroom stops before signing.
                </PixelText>
              </>
            ) : (
              <PixelText role="micro">
                Existing MON margin covers the sell side. No swap, fee or
                minimum-output claim.
              </PixelText>
            )}
            <PixelText role="micro">
              Measured-shape fee est. {quote.gasCostMon.toFixed(6)} MON, not a
              ceiling. Each step re-estimates bounded gas + 20%.
            </PixelText>
            <PixelText role="micro">
              Quote block {quote.block.toString()}. Steps are separate
              transactions, not atomic.
            </PixelText>
            </details>
            <details className="funded-range-details text-micro">
              <summary className="pressable min-h-11">
                Open actual ladder inputs
              </summary>
              {quote.ladder.orders.map((order, index) => (
                <p key={index}>
                  {order.isBuy ? 'BUY' : 'SELL'} {order.size.toFixed(8)} at{' '}
                  {price(order.price)}; flip {price(order.flipPrice)}
                </p>
              ))}
            </details>
          </Panel>
        )}
        <Panel flush className="range-choices flex flex-col gap-1 p-2">
          <div className="flex items-baseline justify-between">
            <PixelText role="body" upper>
              Amount
            </PixelText>
            <Value amount={state.amount} decimals={2} suffix=" AUSD" />
          </div>
          <div className="flex flex-wrap gap-1">
            {[0.24, 0.48, 1, 2].map((amount) => (
              <button
                key={amount}
                className={`pressable min-h-11 border px-2 text-micro ${state.amount === amount ? 'bg-accent text-ink-invert' : 'bg-panel'}`}
                aria-pressed={state.amount === amount}
                disabled={state.busy}
                onClick={() => actions.setAmount(amount)}
              >
                {amount}
              </button>
            ))}
            <button
              className="pressable min-h-11 px-2 text-micro underline"
              onClick={() => actions.setAmount(position.walletQuote)}
              disabled={state.busy}
            >
              MAX
            </button>
          </div>
          <PixelText role="micro">
            Actual disk: {position.walletQuote.toFixed(6)} AUSD +{' '}
            {position.walletBase.toFixed(6)} MON TESTNET.
          </PixelText>
          <div className="flex flex-wrap items-center gap-2">
            <PixelText role="micro" upper>
              How wide
            </PixelText>
            {(['wide', 'tight'] as const).map((width) => (
              <button
                key={width}
                className={`pressable min-h-11 border px-2 text-micro ${state.width === width ? 'bg-accent text-ink-invert' : 'bg-panel'}`}
                aria-pressed={state.width === width}
                disabled={state.busy}
                onClick={() => actions.setWidth(width)}
              >
                {width.toUpperCase()}
              </button>
            ))}
            <button
              className="pressable min-h-11 text-micro underline"
              onClick={() => setManual((open) => !open)}
            >
              Manual
            </button>
          </div>
          <PixelText role="micro">
            WIDE: more room. TIGHT: closer edges. Order limits can shrink either.
          </PixelText>
          {state.sigmaDaily === null && state.manual === null && (
            <PixelText role="micro" tone="loss">
              No volatility reading. Use manual edges.
            </PixelText>
          )}
          <details className="funded-range-details text-micro">
            <summary className="pressable min-h-11">How width and re-arming work</summary>
            <p>
              Width couples ladder spacing and depth using{' '}
              {state.sigmaDaily === null
                ? 'unavailable observed volatility; use manual edges'
                : `${(state.sigmaDaily * 100).toFixed(2)}% observed daily volatility`}
              . Not a prediction. Flip orders re-arm natively. Re-centering is
              manual; no automatic re-center signing.
            </p>
          </details>
          {manual && (
            <div className="flex flex-col gap-1">
              <label className="text-micro">
                Low price{' '}
                <input
                  aria-label="Low price"
                  className="bg-sunk border-edge min-h-11 w-full border px-2"
                  type="number"
                  step="0.000001"
                  defaultValue={position.mid ? position.mid * 0.995 : ''}
                  onChange={(event) =>
                    actions.setManual({
                      low: Number(event.target.value),
                      high: state.manual?.high ?? position.mid! * 1.005,
                    })
                  }
                />
              </label>
              <label className="text-micro">
                High price{' '}
                <input
                  aria-label="High price"
                  className="bg-sunk border-edge min-h-11 w-full border px-2"
                  type="number"
                  step="0.000001"
                  defaultValue={position.mid ? position.mid * 1.005 : ''}
                  onChange={(event) =>
                    actions.setManual({
                      high: Number(event.target.value),
                      low: state.manual?.low ?? position.mid! * 0.995,
                    })
                  }
                />
              </label>
            </div>
          )}
        </Panel>
        <Panel flush className="flex flex-col gap-1 p-2">
          <PixelText role="body">
            Book mid{' '}
            {position.mid === null ? 'unavailable' : price(position.mid)}
          </PixelText>
          <PixelText role="micro">
            Actual TESTNET bid/ask. Mainnet price source:{' '}
            {state.sourceMid === null ? 'unavailable' : price(state.sourceMid)}.
          </PixelText>
          {(!state.sourceFresh || position.paused) && (
            <PixelText role="micro" tone="loss">
              PRICE FEED PAUSED. Empty/crossed/stale or spread above 2%.
              Withdrawal remains available.
            </PixelText>
          )}
          {!state.allowed && (
            <PixelText role="micro" tone="loss">
              {state.gateReason}
            </PixelText>
          )}
        </Panel>
        {recovered && (
          <Panel flush className="flex flex-col gap-1 p-2">
            <PixelText role="body">Chain recovery available</PixelText>
            <PixelText role="micro">
              {position.orders.length} active orders; free margin{' '}
              {position.holdings.marginBase.toFixed(8)} MON +{' '}
              {position.holdings.marginQuote.toFixed(6)} AUSD TESTNET. Re-quote
              only the missing funds or withdraw.
            </PixelText>
            <button
              className="pressable min-h-11 text-micro underline"
              disabled={state.busy}
              onClick={actions.withdraw}
            >
              Withdraw confirmed partial funds
            </button>
          </Panel>
        )}
        <SourceLinks state={state} />
      </div>
      <footer className="screen-footer flex flex-wrap items-center justify-between gap-1">
        <button
          className="pressable min-h-11 text-micro"
          disabled={
            state.busy ||
            (!position.orders.length &&
              (!state.sourceFresh || position.paused || !state.allowed))
          }
          onClick={primary}
        >
          A{' '}
          {state.busy
            ? 'Working'
            : position.orders.length
              ? 'Open position'
              : quote
                ? 'Confirm steps'
                : 'Get actual quote'}
        </button>
        <button
          className="pressable min-h-11 text-micro"
          disabled={state.busy}
          onClick={actions.back}
        >
          B Back
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
