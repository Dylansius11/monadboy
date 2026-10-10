import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { price, usdFine } from '../../lib/format'
import { Panel, PixelText, Value } from '../../ui'
import { Header, Inputs, Notices, ReceiptSteps } from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'

export function FundedRange({ state, actions }: FundedScreenProps) {
  const [focus, setFocus] = useState<'amount' | 'width'>('amount')
  const [manual, setManual] = useState(false)
  const [inspect, setInspect] = useState(false)
  const [editRecovery, setEditRecovery] = useState(false)
  const position = state.position
  const quote = state.quote
  const orders = useMemo(() => quote?.ladder.orders.slice().sort((a, b) => a.price - b.price) ?? [], [quote])
  const recovered = Boolean(position && (position.orders.length > 0 || position.holdings.marginBase > 0 || position.holdings.marginQuote > 0))
  const body = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [quote, state.error, state.readError, state.saveError, inspect])
  useLayoutEffect(() => {
    const el = body.current
    if (!el?.clientHeight) return
    el.querySelector<HTMLElement>('[data-focused="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [focus, editRecovery])
  const primary = () => {
    if (state.busy || !position) return
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
    if (intent === 'UP' || intent === 'DOWN' || intent === 'LEFT' || intent === 'RIGHT') setEditRecovery(true)
    if (intent === 'UP' || intent === 'DOWN')
      setFocus((row) => (row === 'amount' ? 'width' : 'amount'))
    if (intent === 'LEFT' || intent === 'RIGHT') {
      if (focus === 'amount') actions.setAmount(Math.max(0, Math.round((state.amount + (intent === 'RIGHT' ? 0.12 : -0.12)) * 100) / 100))
      else actions.setWidth(state.width === 'wide' ? 'tight' : 'wide')
    }
    if (intent === 'SELECT') setManual((open) => !open)
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
  return (
    <div className="screen-range screen-funded-range bg-screen flex h-full w-full flex-col gap-1 p-2" data-executing={state.busy && state.steps.length > 0} data-recovered={recovered}>
      <Header title={quote ? 'Confirm real steps' : 'Set range'} demoMultiplier={state.demoMultiplier} />
      <div ref={body} className="funded-body funded-range-body">
        <Notices state={state} />
        {recovered && <Panel flush className="funded-range-recovery flex flex-col gap-1 p-2">
          <PixelText role="body">Chain recovery available</PixelText>
          <PixelText role="micro">{position.orders.length} active orders; free margin {position.holdings.marginBase.toFixed(8)} MON + {position.holdings.marginQuote.toFixed(6)} AUSD TESTNET. Re-quote only the missing funds or withdraw.</PixelText>
          {!state.allowed && <PixelText role="micro" tone="loss">{state.gateReason}</PixelText>}
          <button className="funded-key pressable min-h-11 text-micro" disabled={state.busy} onClick={actions.withdraw}>Withdraw confirmed partial funds</button>
        </Panel>}
        <details className="funded-range-setup" open={!recovered || editRecovery || manual}>
          <summary className="pressable min-h-11 text-micro" onClick={(event) => { event.preventDefault(); setEditRecovery((open) => !open) }}>Edit amount and width</summary>
        <div className="funded-range-choices">
          <section className="funded-range-choice" data-focused={focus === 'amount'}>
            <div className="flex items-baseline justify-between gap-1">
              <PixelText role="micro" tone="dim" upper>How much?</PixelText>
              <Value amount={state.amount} decimals={2} suffix=" AUSD" />
            </div>
            <div className="funded-amount-keys">
              {[0.24, 0.48, 1, 2].map((amount) => <button key={amount} className="funded-key pressable min-h-11 text-micro" aria-pressed={state.amount === amount} disabled={state.busy} onClick={() => actions.setAmount(amount)}>{amount}</button>)}
              <button className="funded-key pressable min-h-11 text-micro" aria-pressed={state.amount === position.walletQuote} disabled={state.busy} onClick={() => actions.setAmount(position.walletQuote)}>MAX</button>
            </div>
            <PixelText role="micro" tone="dim">Disk TESTNET: {position.walletQuote.toFixed(6)} AUSD + {position.walletBase.toFixed(6)} MON</PixelText>
          </section>
          <section className="funded-range-choice" data-focused={focus === 'width'}>
            <PixelText role="micro" tone="dim" upper>How wide?</PixelText>
            <div className="funded-width-keys">
              {(['wide', 'tight'] as const).map((width) => <button key={width} className="funded-key pressable min-h-11 text-micro" aria-pressed={state.width === width && state.manual === null} disabled={state.busy} onClick={() => actions.setWidth(width)}>{width.toUpperCase()}</button>)}
              <button className="funded-key pressable min-h-11 text-micro" aria-pressed={manual || state.manual !== null} aria-expanded={manual} onClick={() => setManual((open) => !open)}>MANUAL</button>
            </div>
            <PixelText role="micro" tone="dim">WIDE more room · TIGHT closer edges</PixelText>
          </section>
        </div>
        {state.sigmaDaily === null && state.manual === null && <PixelText role="micro" tone="loss">No volatility reading. Use manual edges.</PixelText>}
        {manual && <Panel flush className="funded-manual grid grid-cols-2 gap-2 p-2">
          <label className="text-micro">Low price <input aria-label="Low price" className="bg-sunk border-edge min-h-11 w-full border px-2" type="number" step="0.000001" defaultValue={state.manual?.low ?? (mid ? mid * 0.995 : '')} onChange={(event) => actions.setManual({ low: Number(event.target.value), high: state.manual?.high ?? (mid ?? 0) * 1.005 })} /></label>
          <label className="text-micro">High price <input aria-label="High price" className="bg-sunk border-edge min-h-11 w-full border px-2" type="number" step="0.000001" defaultValue={state.manual?.high ?? (mid ? mid * 1.005 : '')} onChange={(event) => actions.setManual({ high: Number(event.target.value), low: state.manual?.low ?? (mid ?? 0) * 0.995 })} /></label>
        </Panel>}
        </details>
        {(!recovered || quote) && <div className="funded-range-picture">
          <div className="flex items-baseline justify-between gap-1 text-micro">
            <span>{low === null ? 'Low: unquoted' : price(low)}</span>
            <span className="funded-ladder-key"><i aria-hidden="true" /> AUSD <i aria-hidden="true" /> MON</span>
            <span>{high === null ? 'High: unquoted' : price(high)}</span>
          </div>
          <div className="funded-ladder" role="img" aria-label={quote ? `Actual ladder from ${low} to ${high}, ${quote.ladder.levels} levels per side` : 'Ladder unavailable until actual quote'}>
            {orders.length > 0 ? orders.map((order, index) => <span key={index} className={order.isBuy ? 'bg-sunk' : 'bg-accent'} title={`${order.isBuy ? 'BUY' : 'SELL'} ${price(order.price)}`} />) : <PixelText role="micro" tone="dim">{state.manual ? 'MANUAL EDGES · LEVELS NOT QUOTED' : state.basis ? 'LAST FUNDED EDGES · LEVELS NOT QUOTED' : 'GET ACTUAL QUOTE TO DRAW LEVELS'}</PixelText>}
          </div>
          <div className="funded-now text-micro">
            {now !== null && <span style={{ left: `${now}%` }}><i aria-hidden="true" /> now</span>}
          </div>
          <PixelText role="micro" tone="dim">Book mid {mid === null ? 'unavailable' : price(mid)}{quote && <> · {(quote.ladder.step * 100).toFixed(2)}% steps · {quote.ladder.levels} buy + {quote.ladder.levels} sell flip levels</>}</PixelText>
          {quote?.ladder.clamped && <PixelText role="micro" tone="loss">Capped by depth or minimum order size. Review actual edges.</PixelText>}
        </div>}
        {quote && <Panel flush className="funded-range-funding flex flex-col gap-1 p-2">
          <div className="funded-holdings flex flex-wrap items-baseline gap-1">
            <PixelText role="micro" tone="dim" upper>YOU WILL HOLD</PixelText>
            <span className="inline-flex items-baseline gap-1"><Value amount={quote.ladder.quoteNeeded} decimals={4} /><PixelText role="micro" tone="dim">AUSD</PixelText></span>
            <PixelText role="micro">+</PixelText>
            <span className="inline-flex items-baseline gap-1"><Value amount={quote.ladder.baseNeeded} decimals={6} /><PixelText role="micro" tone="dim">MON</PixelText></span>
          </div>
          <PixelText role="micro" tone="dim">{quote.zapRaw > 0n ? <>Swap fee est. {usdFine(quote.takerFeeQuote)} + 1% quote headroom.</> : 'No swap needed; existing MON margin covers sells.'}</PixelText>
          <PixelText role="micro" tone="dim">Gas fee est. {quote.gasCostMon.toFixed(6)} MON, not a ceiling.</PixelText>
          <PixelText role="micro">Separate transactions, not atomic. Confirmed partial funds can be withdrawn.</PixelText>
        </Panel>}
        {(!state.sourceFresh || position.paused) && <div className="funded-range-alert text-micro">PRICE FEED PAUSED. Empty/crossed/stale or spread above 2%. Withdrawal remains available.</div>}
        {!state.allowed && !recovered && <div className="funded-range-alert text-micro">{state.gateReason}</div>}
        {state.steps.length > 0 && <div className="funded-range-receipts"><ReceiptSteps state={state} /></div>}
      </div>
      <footer className="screen-footer funded-range-footer text-micro">
        <button className="pressable min-h-11" disabled={state.busy || (!position.orders.length && (!state.sourceFresh || position.paused || !state.allowed))} onClick={primary}>A {state.busy ? 'Working' : position.orders.length ? 'Open position' : quote ? 'Confirm steps' : 'Get actual quote'}</button>
        <span aria-hidden="true">·</span><button className="pressable min-h-11" disabled={state.busy} onClick={actions.back}>B Back</button>
        <span aria-hidden="true">·</span><button className="pressable min-h-11" disabled={state.busy} onClick={() => setManual((open) => !open)}>SELECT Manual</button>
        <span aria-hidden="true">·</span><button className="pressable min-h-11" onClick={() => setInspect(true)}>START Inputs</button>
      </footer>
    </div>
  )
}
