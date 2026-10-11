import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { price, usdFine } from '../../lib/format'
import { KeyHints, Panel, PixelText, Value } from '../../ui'
import { Header, Inputs, Notices, ReceiptSteps } from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'

const AMOUNTS = [0.24, 0.48, 1, 2]

/**
 * S6 on a funded disk. One decision read top to bottom: how much, how wide,
 * the ladder those two choices draw, then what you will hold and pay. A
 * quote turns the same screen into the confirmation; confirming turns it into
 * the step checklist. A run that stopped partway is a recovery card with one
 * primary action, never a wall of red text.
 */
export function FundedRange({ state, actions }: FundedScreenProps) {
  const [focus, setFocus] = useState<'amount' | 'width'>('amount')
  const [manual, setManual] = useState(false)
  const [inspect, setInspect] = useState(false)
  const [editRecovery, setEditRecovery] = useState(false)
  const position = state.position
  const quote = state.quote
  const orders = useMemo(() => quote?.ladder.orders.slice().sort((a, b) => a.price - b.price) ?? [], [quote])
  const onBook = Boolean(position?.orders.length)
  const stranded = Boolean(position && !onBook && (position.holdings.marginBase > 0 || position.holdings.marginQuote > 0))
  const funding = state.busy && quote !== null
  const recovery = stranded && !funding && !quote && !editRecovery && !manual
  const body = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [quote, state.error, state.readError, state.saveError, inspect])
  useLayoutEffect(() => {
    const el = body.current
    if (!el?.clientHeight) return
    el.querySelector<HTMLElement>('[data-focused="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [focus, editRecovery, manual])
  // A finished withdrawal leaves nothing to recover; the next run starts at setup.
  useEffect(() => {
    if (!stranded) setEditRecovery(false)
  }, [stranded])
  const blocked = !state.sourceFresh || Boolean(position?.paused) || !state.allowed
  const primary = () => {
    if (state.busy || !position) return
    if (onBook) actions.openLive()
    else if (recovery) actions.withdraw()
    else if (blocked) return
    else if (quote) actions.confirm()
    else actions.quote()
  }
  // Opening MANUAL applies editable edges at once, so the ladder, the pressed
  // key and the next quote all describe the same range.
  const toggleManual = () => {
    const mid = position?.mid
    if (!manual && state.manual === null && mid)
      actions.setManual({ low: Number((mid * 0.995).toPrecision(4)), high: Number((mid * 1.005).toPrecision(4)) })
    setManual(!manual)
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
    if (state.busy) return
    if (intent === 'B') {
      if (quote) actions.clearQuote()
      else actions.back()
      return
    }
    if (intent === 'A') {
      primary()
      return
    }
    if (onBook) return
    if (intent === 'UP' || intent === 'DOWN' || intent === 'LEFT' || intent === 'RIGHT') setEditRecovery(true)
    if (intent === 'UP' || intent === 'DOWN')
      setFocus((row) => (row === 'amount' ? 'width' : 'amount'))
    if (intent === 'LEFT' || intent === 'RIGHT') {
      if (focus === 'amount') actions.setAmount(Math.max(0, Math.round((state.amount + (intent === 'RIGHT' ? 0.12 : -0.12)) * 100) / 100))
      else {
        setManual(false)
        actions.setWidth(state.width === 'wide' ? 'tight' : 'wide')
      }
    }
    if (intent === 'SELECT') toggleManual()
  })
  if (!position) return null
  const low = quote?.ladder.low ?? state.manual?.low ?? state.basis?.low ?? null
  const high = quote?.ladder.high ?? state.manual?.high ?? state.basis?.high ?? null
  const mid = position.mid
  const now = low !== null && high !== null && high > low && mid !== null
    ? Math.max(0, Math.min(100, (mid - low) / (high - low) * 100)) : null
  if (inspect) return (
    <Inputs state={state} onClose={() => setInspect(false)}>
      <details className="funded-range-details text-micro">
        <summary className="pressable min-h-11">How width and re-arming work</summary>
        <p>Width couples ladder spacing and depth using {state.sigmaDaily === null ? 'unavailable observed volatility; use manual edges' : `${(state.sigmaDaily * 100).toFixed(2)}% daily volatility${state.demoMultiplier > 1 ? `, amplified x${state.demoMultiplier} for DEMO` : ''}`}. Not a prediction. Order limits can shrink either width. Flip orders re-arm natively. Re-centering is manual; no automatic re-center signing.</p>
      </details>
      <PixelText role="micro">Actual TESTNET bid/ask. MAINNET source: {state.mainnetMid === null ? 'unavailable' : price(state.mainnetMid)}.{state.demoMultiplier > 1 && <> DEMO target: {state.sourceMid === null ? 'unavailable' : price(state.sourceMid)}.</>}</PixelText>
      {quote && <Panel flush className="flex flex-col gap-1 p-2">
        <PixelText role="body">Range {price(quote.ladder.low)} to {price(quote.ladder.high)}</PixelText>
        <PixelText role="micro">Lock {quote.ladder.baseNeeded.toFixed(8)} MON + {quote.ladder.quoteNeeded.toFixed(6)} AUSD.</PixelText>
        <PixelText role="micro">{quote.depositRaw > 0n ? `Deposit before margin zap: ${quote.quoteRequired.toFixed(6)} AUSD.` : 'Existing chain margin covers this ladder; no additional deposit.'}</PixelText>
        <details className="funded-range-details text-micro">
          <summary className="pressable min-h-11">Review minimum output and gas checks</summary>
          {quote.zapRaw > 0n ? <>
            <PixelText role="micro">Buy minimum {quote.quotedBase.toFixed(8)} MON. Taker fee est. {usdFine(quote.takerFeeQuote)} + 1% quote headroom.</PixelText>
            <PixelText role="micro">Actual funded simulation enforces this minimum output. Price movement beyond headroom stops before signing.</PixelText>
          </> : <PixelText role="micro">Existing MON margin covers the sell side. No swap, fee or minimum-output claim.</PixelText>}
          <PixelText role="micro">Measured-shape fee est. {quote.gasCostMon.toFixed(6)} MON, not a ceiling. Each step re-estimates bounded gas + 20%.</PixelText>
          <PixelText role="micro">Quote block {quote.block.toString()}. Steps are separate transactions, not atomic.</PixelText>
        </details>
        <details className="funded-range-details text-micro">
          <summary className="pressable min-h-11">Open actual ladder inputs</summary>
          {quote.ladder.orders.map((order, index) => <p key={index}>{order.isBuy ? 'BUY' : 'SELL'} {order.size.toFixed(8)} at {price(order.price)}; flip {price(order.flipPrice)}</p>)}
        </details>
      </Panel>}
    </Inputs>
  )
  const planned = quote ? [
    ...(quote.depositRaw > 0n ? ['Deposit AUSD'] : []),
    ...(quote.zapRaw > 0n ? ['Zap MON to margin'] : []),
    'Provision flip ladder',
  ] : []
  const title = funding ? 'Funding' : onBook ? 'Run on book' : recovery ? 'Recovery' : quote ? 'Confirm' : 'Set range'
  const primaryLabel = state.busy ? 'Working' : onBook ? 'Open run' : recovery ? 'Withdraw' : quote ? 'Confirm' : 'Quote'
  const showSetup = !funding && !onBook && !recovery
  return (
    <div className="screen-range screen-funded-range bg-screen flex h-full w-full flex-col gap-1 p-2" data-mode={funding ? 'funding' : quote ? 'confirm' : 'setup'}>
      <Header title={title} demoMultiplier={state.demoMultiplier} />
      <div ref={body} className="funded-body funded-range-body">
        <Notices state={state} error={!stranded} />
        {funding && <ReceiptSteps steps={state.steps} planned={planned} />}
        {onBook && <section className="funded-card">
          <PixelText role="body" upper>Your run is on the book</PixelText>
          <PixelText role="micro">{position.orders.length} TESTNET flip orders are resting. A opens the run; withdraw from there.</PixelText>
        </section>}
        {stranded && !funding && <section className="funded-card funded-recovery" data-compact={!recovery}>
          <div className="funded-card-head">
            <PixelText role="body" upper>Funds in margin</PixelText>
            <PixelText role="micro" tone="dim">TESTNET</PixelText>
          </div>
          {recovery && state.error && <PixelText role="micro" tone="loss" as="p">{state.error}</PixelText>}
          <dl className="funded-facts">
            <dt>AUSD</dt><dd>{position.holdings.marginQuote.toFixed(6)}</dd>
            <dt>MON</dt><dd>{position.holdings.marginBase.toFixed(8)}</dd>
          </dl>
          {!state.allowed && <PixelText role="micro" tone="loss">{state.gateReason}</PixelText>}
          <button className="funded-primary pressable" disabled={state.busy} onClick={actions.withdraw}>Withdraw to disk</button>
          {recovery && <PixelText role="micro" tone="dim">Nothing is on the book. Withdraw, or use the D-pad to set a new range with these funds.</PixelText>}
        </section>}
        {stranded && !funding && state.steps.length > 0 && <ReceiptSteps steps={state.steps} />}
        {showSetup && <div className="funded-choices">
          <section className="funded-choice" data-focused={focus === 'amount'}>
            <div className="funded-choice-head">
              <PixelText role="micro" tone="dim" upper>How much?</PixelText>
              <Value amount={state.amount} decimals={2} suffix=" AUSD" />
            </div>
            <div className="funded-amount-keys">
              {AMOUNTS.map((amount) => <button key={amount} className="funded-key pressable" aria-pressed={state.amount === amount} disabled={state.busy} onClick={() => actions.setAmount(amount)}>{amount}</button>)}
              <button className="funded-key pressable" aria-pressed={state.amount === position.walletQuote} disabled={state.busy} onClick={() => actions.setAmount(position.walletQuote)}>MAX</button>
            </div>
            {!quote && <PixelText role="micro" tone="dim">Disk holds {position.walletQuote.toFixed(2)} AUSD · {position.walletBase.toFixed(4)} MON</PixelText>}
          </section>
          <section className="funded-choice" data-focused={focus === 'width'}>
            <div className="funded-choice-head">
              <PixelText role="micro" tone="dim" upper>How wide?</PixelText>
              <PixelText role="micro" tone="dim">{state.manual ? 'Your own edges' : state.width === 'wide' ? 'More room' : 'Closer edges'}</PixelText>
            </div>
            <div className="funded-width-keys">
              {(['wide', 'tight'] as const).map((width) => <button key={width} className="funded-key pressable" aria-pressed={state.width === width && state.manual === null} disabled={state.busy} onClick={() => { setManual(false); actions.setWidth(width) }}>{width.toUpperCase()}</button>)}
              <button className="funded-key pressable" aria-pressed={state.manual !== null} aria-expanded={manual} disabled={state.busy} onClick={toggleManual}>MANUAL</button>
            </div>
            {manual && <div className="funded-manual" data-focused="true">
              <label>
                <PixelText role="micro" tone="dim" upper>Low price</PixelText>
                <input aria-label="Low price" type="number" step="0.000001" inputMode="decimal" defaultValue={state.manual?.low ?? ''} onChange={(event) => actions.setManual({ low: Number(event.target.value), high: state.manual?.high ?? (mid ?? 0) * 1.005 })} />
              </label>
              <label>
                <PixelText role="micro" tone="dim" upper>High price</PixelText>
                <input aria-label="High price" type="number" step="0.000001" inputMode="decimal" defaultValue={state.manual?.high ?? ''} onChange={(event) => actions.setManual({ high: Number(event.target.value), low: state.manual?.low ?? (mid ?? 0) * 0.995 })} />
              </label>
            </div>}
          </section>
          {state.sigmaDaily === null && state.manual === null && <PixelText role="micro" tone="loss">No volatility reading. Use manual edges.</PixelText>}
        </div>}
        {!onBook && !recovery && <section className="funded-ladder-card">
          <div className="funded-ladder-edges">
            <span><PixelText role="micro" tone="dim">LOW </PixelText><PixelText role="micro">{low === null ? 'unquoted' : price(low)}</PixelText></span>
            <span className="funded-ladder-key" aria-hidden="true"><i /> AUSD <i /> MON</span>
            <span><PixelText role="micro" tone="dim">HIGH </PixelText><PixelText role="micro">{high === null ? 'unquoted' : price(high)}</PixelText></span>
          </div>
          <div className="funded-ladder" role="img" aria-label={quote ? `Actual ladder from ${low} to ${high}, ${quote.ladder.levels} levels per side` : 'Ladder unavailable until actual quote'}>
            {orders.length > 0 ? orders.map((order, index) => <span key={index} className={order.isBuy ? 'bg-sunk' : 'bg-accent'} />) : <PixelText role="micro" tone="dim">{state.manual ? 'MANUAL EDGES · LEVELS NOT QUOTED' : state.basis ? 'LAST FUNDED EDGES · LEVELS NOT QUOTED' : 'A QUOTE DRAWS THE REAL LEVELS'}</PixelText>}
          </div>
          <div className="funded-now">
            {now !== null && <span style={{ left: `${now}%` }} data-side={now > 70 ? 'left' : 'right'}><i aria-hidden="true" /><PixelText role="micro" tone="dim">now</PixelText></span>}
          </div>
          <PixelText role="micro" tone="dim">Book mid {mid === null ? 'unavailable' : price(mid)}{quote && <> · {(quote.ladder.step * 100).toFixed(2)}% steps · {quote.ladder.levels}+{quote.ladder.levels} levels</>}</PixelText>
          {quote?.ladder.clamped && <PixelText role="micro" tone="loss" as="p">Capped by depth or minimum order size. These are the actual edges.</PixelText>}
          {quote && state.rangeNote && <PixelText role="micro" as="p">{state.rangeNote === 'COVERS_TARGET'
            ? `TESTNET book is catching up to the ${state.demoMultiplier > 1 ? 'DEMO target' : 'mainnet price'}; range stretched to cover both.`
            : `TESTNET book is far from the ${state.demoMultiplier > 1 ? 'DEMO target' : 'mainnet price'}; range stretched as far as the ladder allows and does not reach it.`}</PixelText>}
        </section>}
        {quote && <section className="funded-card funded-hold">
          <div className="funded-card-head">
            <PixelText role="micro" tone="dim" upper>You will hold</PixelText>
            <PixelText role="micro" tone="dim">TESTNET</PixelText>
          </div>
          <div className="funded-hold-figures">
            <span><Value amount={quote.ladder.quoteNeeded} decimals={4} /><PixelText role="micro" tone="dim"> AUSD</PixelText></span>
            <PixelText role="micro" tone="dim">+</PixelText>
            <span><Value amount={quote.ladder.baseNeeded} decimals={6} /><PixelText role="micro" tone="dim"> MON</PixelText></span>
          </div>
          <dl className="funded-facts">
            <dt>Swap fee est.</dt><dd>{quote.zapRaw > 0n ? `${usdFine(quote.takerFeeQuote)} + 1% headroom` : 'none, margin covers sells'}</dd>
            <dt>Gas est.</dt><dd>{quote.gasCostMon.toFixed(6)} MON, not a ceiling</dd>
            <dt>Steps</dt><dd>separate txs, not atomic</dd>
          </dl>
        </section>}
        {!funding && !onBook && (!state.sourceFresh || position.paused) && <div className="funded-range-alert text-micro">PRICE FEED PAUSED. Empty/crossed/stale or spread above 2%. Withdrawal remains available.</div>}
        {!funding && !stranded && !onBook && !state.allowed && <div className="funded-range-alert text-micro">{state.gateReason}</div>}
        {!funding && !stranded && state.steps.length > 0 && <ReceiptSteps steps={state.steps} />}
      </div>
      <KeyHints hints={[
        { key: 'A', label: primaryLabel, disabled: state.busy || (!onBook && !recovery && blocked) },
        { key: 'B', label: quote ? 'Edit' : 'Back', disabled: state.busy },
        ...(!funding && !onBook ? [{ key: 'SELECT' as const, label: 'Manual', disabled: state.busy }] : []),
        { key: 'START', label: 'Inputs' },
      ]} />
    </div>
  )
}
