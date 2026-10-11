import { useEffect, useMemo, useRef, useState } from 'react'
import { rangeState } from '@monadboy/sdk'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { useSession } from '../../state/session'
import { useSound } from '../../sound/SoundProvider'
import { price, usdDecimals } from '../../lib/format'
import { KeyHints, Meter, Panel, PixelText, Value } from '../../ui'
import { PriceField } from '../PriceField'
import {
  Inputs,
  Notices,
  ReceiptSteps,
} from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'
import './funded-live.css'

/** The live window: thirty chain reads, one per gameplay tick. */
const SAMPLE_CAPACITY = 30
const SAMPLE_MS = 5000

export function FundedLive({ state, actions }: FundedScreenProps) {
  const character = useSession((session) => session.characterId)
  const position = state.position
  const [inspect, setInspect] = useState(false)
  const [recenter, setRecenter] = useState(false)
  // The checklist shows only this exit's steps, not the funding receipts above them.
  const [exitFrom, setExitFrom] = useState<number | null>(null)
  const reviewRecenter = () => {
    setRecenter(true)
    actions.quoteExit()
  }
  const exit = (run: () => void) => {
    setExitFrom((from) => from ?? state.steps.length)
    run()
  }
  const [samples, setSamples] = useState<{ series: number[]; newestAt: number }>({ series: [], newestAt: 0 })
  const [jumping, setJumping] = useState(false)
  const [flips, setFlips] = useState(0)
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { play } = useSound()
  const basis = state.basis
  const edges = position?.orders.flatMap((order) => [order.price, order.flipPrice || order.price]) ?? []
  const low = basis?.low ?? (edges.length ? Math.min(...edges) : null)
  const high = basis?.high ?? (edges.length ? Math.max(...edges) : null)
  const mid =
    state.sourceFresh && state.sourceMid !== null
      ? state.sourceMid
      : position?.mid ?? null
  const band =
    mid !== null && low !== null && high !== null
      ? rangeState(
          mid,
          low,
          high,
          basis ? (position?.mid ?? mid) * basis.step : (high - low) / 8,
        )
      : null
  const paused =
    !state.sourceFresh ||
    !position ||
    position.paused ||
    Date.now() - position.observedAt > 15000
  useEffect(() => {
    if (mid !== null) setSamples((old) => ({ series: [...old.series.slice(1 - SAMPLE_CAPACITY), mid], newestAt: Date.now() }))
  }, [mid, position?.block])
  const sampling = useMemo(() => ({ capacity: SAMPLE_CAPACITY, intervalMs: SAMPLE_MS, newestAt: samples.newestAt }), [samples.newestAt])
  useEffect(() => () => clearTimeout(jumpTimer.current), [])
  const seen = useRef<Set<string> | null>(null)
  const previousBand = useRef(band)
  useEffect(() => {
    const realFlips = position?.fills.filter((fill) => fill.isFlippedOrder) ?? []
    const previous = seen.current
    const keys = realFlips.map((fill) => `${fill.tx}:${fill.orderId}:${fill.size}`)
    if (previous === null) seen.current = new Set(keys)
    else {
      if (keys.some((key) => !previous.has(key))) {
        play('coin')
        setFlips((count) => count + 1)
      }
      // A bounded offline read can omit fills; returning coverage is not a new fill.
      for (const key of keys) previous.add(key)
    }
    if (
      !paused &&
      band !== null &&
      band !== previousBand.current &&
      band !== 'IN_RANGE'
    )
      play('alert')
    previousBand.current = band
  }, [position?.fills, band, paused, play])
  const jump = () => {
    if (paused || state.busy) return
    play('jump')
    setJumping(true)
    clearTimeout(jumpTimer.current)
    jumpTimer.current = setTimeout(() => setJumping(false), 300)
  }
  const primary = () => {
    if (recenter) {
      if (state.exitCostMon !== null) exit(actions.recenter)
    } else if (band === 'OUT_OF_RANGE') reviewRecenter()
    else jump()
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
      if (recenter) setRecenter(false)
      else exit(actions.withdraw)
      return
    }
    if (intent === 'A') primary()
    if (intent === 'SELECT') actions.refresh()
  })
  if (!position) {
    return (
      <div className="screen-live screen-funded-live bg-screen flex h-full flex-col gap-2 p-2">
        <div className="funded-live-arena items-center">
          <Panel><PixelText role="body">No current TESTNET position. Refresh chain state to read your position.</PixelText></Panel>
        </div>
        <KeyHints hints={[{ key: 'SELECT', label: 'Refresh' }, { key: 'START', label: 'Inputs' }]} />
      </div>
    )
  }
  const details = (
    <Panel flush className="flex flex-col gap-1 p-2">
      <PixelText role="micro">
        {position.orders.length} active chain orders. {position.historyError ? 'Unavailable' : position.fills.length} observed maker fills,{' '}
        {position.historyError ? 'Unavailable' : position.fills.filter((fill) => fill.isFlippedOrder).length} flipped-origin.
      </PixelText>
      <PixelText role="micro">
        Margin + resting: {(position.holdings.marginBase + position.holdings.restingBase).toFixed(8)} MON +{' '}
        {(position.holdings.marginQuote + position.holdings.restingQuote).toFixed(6)} AUSD TESTNET.
      </PixelText>
      <PixelText role="micro">
        {position.source}. {position.complete
          ? 'Current run log coverage complete.'
          : `History has unavailable gaps before block ${position.coverageFrom.toString()}. SCORE/DAMAGE/NET are unavailable, not zero.`}
      </PixelText>
      <PixelText role="micro">
        Range display follows {state.demoMultiplier > 1 ? `DEMO x${state.demoMultiplier} target` : 'mainnet source'}; valuation uses actual TESTNET book mid. Linked flip orders re-arm on chain. The field holds the newest 5s sample until the next one.
      </PixelText>
    </Panel>
  )
  if (inspect) return <Inputs state={state} onClose={() => setInspect(false)}>{details}</Inputs>
  const valuation = position.valuation
  const figureDecimals = usdDecimals(valuation?.score ?? 0, valuation?.damage ?? 0, valuation?.net ?? 0)
  const proximity = mid !== null && low !== null && high !== null && high > low
    ? Math.max(0, Math.min(100, Math.min(mid - low, high - mid) / ((high - low) / 2) * 100))
    : 0
  const tone = paused || band === 'OUT_OF_RANGE' ? 'alarm' : band === 'NAD_SENSE' ? 'warn' : band === 'IN_RANGE' ? 'earning' : 'idle'
  const status = paused ? 'PRICE FEED PAUSED'
    : band === 'NAD_SENSE' ? 'NAD-SENSE · near your edge'
      : band === 'OUT_OF_RANGE' ? 'OUT OF RANGE · sitting'
        : band === 'IN_RANGE' ? 'IN RANGE · earning on flips' : 'No active range'
  const exiting = exitFrom !== null && (state.busy || state.error !== null)
  return (
    <div className={`screen-live screen-funded-live bg-screen flex h-full w-full flex-col gap-1 p-2 ${band === 'NAD_SENSE' && !paused ? 'nad-pulse' : ''}`}>
      <header className="funded-live-heading">
        <PixelText role="body" upper>Live · MON/AUSD</PixelText>
        <PixelText role="micro" tone="dim">{state.demoMultiplier > 1 ? `TESTNET · DEMO x${state.demoMultiplier}` : 'TESTNET'}</PixelText>
      </header>
      <div className="funded-live-hud">
        <div key={`score-${flips}`} className="funded-hud-cell" data-flash={flips > 0}>
          <PixelText role="micro" tone="dim" upper>Score</PixelText>
          {valuation ? <Value amount={valuation.score} prefix="+$" decimals={figureDecimals} tone="gain" /> : <PixelText role="value" tone="gain">Unavailable</PixelText>}
        </div>
        <div className="funded-hud-cell">
          <PixelText role="micro" tone="dim" upper>Damage</PixelText>
          {valuation ? <Value amount={valuation.damage} prefix="-$" decimals={figureDecimals} tone="loss" /> : <PixelText role="value" tone="loss">Unavailable</PixelText>}
        </div>
        <div className="funded-hud-net">
          <PixelText role="micro" tone="dim" upper>Net vs hold</PixelText>
          {valuation ? <Value amount={valuation.net} prefix="$" decimals={figureDecimals} signed role="body" /> : <PixelText role="body">Unavailable</PixelText>}
        </div>
      </div>
      <div className="funded-live-range">
        <PixelText role="micro"><PixelText role="micro" tone="dim">RANGE </PixelText>{low === null ? 'unavailable' : price(low)} to {high === null ? 'unavailable' : price(high)}</PixelText>
        <PixelText role="micro"><PixelText role="micro" tone="dim">NOW </PixelText>{mid === null ? 'unavailable' : price(mid)}</PixelText>
      </div>
      <div className="funded-live-arena" data-tone={tone}>
        {exiting ? (
          <div className="funded-live-exit">
            <PixelText role="body" upper>{state.busy ? 'Ending run' : 'Exit stopped'}</PixelText>
            <ReceiptSteps steps={state.steps.slice(exitFrom)} />
          </div>
        ) : recenter ? (
          <section className="funded-card funded-recenter">
            <div className="funded-card-head">
              <PixelText role="body" upper>Re-center</PixelText>
              <PixelText role="micro" tone="dim">TESTNET</PixelText>
            </div>
            <PixelText role="micro" as="p">Re-centering is an exit and a fresh quote: cancel one ID per linked pair, withdraw, then review a new ladder, zap fee and gas before confirming again. Nothing changes automatically.</PixelText>
            <dl className="funded-facts">
              <dt>Exit fee est.</dt>
              <dd>{state.exitCostMon === null ? 'reading' : `${state.exitCostMon.toFixed(6)} MON, not a ceiling`}</dd>
            </dl>
            <div className="funded-recenter-actions">
              <button className="funded-primary pressable" disabled={state.busy || state.exitCostMon === null} onClick={() => exit(actions.recenter)}>Exit and re-center</button>
              <button className="funded-secondary pressable" onClick={() => setRecenter(false)}>Keep position</button>
            </div>
          </section>
        ) : mid !== null && low !== null && high !== null ? (
          <>
            <PriceField series={samples.series.length ? samples.series : [mid]} lowerPrice={low} upperPrice={high}
              width={464} height={200} character={character} sampling={samples.series.length ? sampling : undefined}
              animation={paused || band === 'OUT_OF_RANGE' ? 'sit' : jumping ? 'jump' : band === 'NAD_SENSE' ? 'alert' : 'run'}
              jumping={jumping} earning={!paused && band === 'IN_RANGE'} />
            {flips > 0 && <span key={flips} className="funded-flip-pop" aria-hidden="true">+FLIP</span>}
          </>
        ) : <PixelText role="body">No active range to draw. START opens actual chain inputs.</PixelText>}
      </div>
      <div className="funded-live-status" data-tone={tone} role="status">
        <PixelText role="micro" upper>{status}</PixelText>
        {tone === 'earning' && <Meter value={proximity} segments={12} label="Distance from range edge" />}
      </div>
      {!paused && band === 'OUT_OF_RANGE' && low !== null && high !== null &&
        position.mid !== null && position.mid >= low && position.mid <= high && (
          <PixelText role="micro" tone="loss" as="p">
            {state.demoMultiplier > 1 ? 'DEMO target' : 'Mainnet price'} left your range; the TESTNET book is still inside and catching up.
          </PixelText>
        )}
      <dl className="funded-live-sources">
        <div><dt>Mainnet</dt><dd>{state.mainnetMid === null ? 'unavailable' : price(state.mainnetMid)}</dd></div>
        <div><dt>{state.demoMultiplier > 1 ? 'Demo target' : 'Target'}</dt><dd>{state.sourceMid === null ? 'unavailable' : price(state.sourceMid)}</dd></div>
        <div><dt>Testnet book</dt><dd>{position.mid === null ? 'unavailable' : price(position.mid)}</dd></div>
      </dl>
      <Notices state={state} />
      <KeyHints hints={[
        { key: 'A', label: recenter ? 'Exit' : band === 'OUT_OF_RANGE' ? 'Recenter' : 'Jump', disabled: state.busy || (recenter ? state.exitCostMon === null : paused) },
        { key: 'B', label: recenter ? 'Keep' : state.busy ? 'Working' : 'Withdraw', disabled: state.busy },
        { key: 'START', label: 'Inputs' },
      ]} />
    </div>
  )
}
