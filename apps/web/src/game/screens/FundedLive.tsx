import { useEffect, useRef, useState } from 'react'
import { rangeState } from '@monadboy/sdk'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { useSession } from '../../state/session'
import { useSound } from '../../sound/SoundProvider'
import { price } from '../../lib/format'
import { Meter, Panel, PixelText, Value } from '../../ui'
import { PriceField } from '../PriceField'
import {
  Inputs,
  Notices,
  ReceiptSteps,
} from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'
import './funded-live.css'

export function FundedLive({ state, actions }: FundedScreenProps) {
  const character = useSession((session) => session.characterId)
  const position = state.position
  const [inspect, setInspect] = useState(false)
  const [recenter, setRecenter] = useState(false)
  const reviewRecenter = () => {
    setRecenter(true)
    actions.quoteExit()
  }
  const [series, setSeries] = useState<number[]>([])
  const [jumping, setJumping] = useState(false)
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { play } = useSound()
  const basis = state.basis
  const low =
    basis?.low ??
    (position?.orders.length
      ? Math.min(
          ...position.orders.flatMap((order) => [
            order.price,
            order.flipPrice || order.price,
          ]),
        )
      : null)
  const high =
    basis?.high ??
    (position?.orders.length
      ? Math.max(
          ...position.orders.flatMap((order) => [
            order.price,
            order.flipPrice || order.price,
          ]),
        )
      : null)
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
    if (mid !== null) setSeries((old) => [...old.slice(-29), mid])
  }, [mid, position?.block])
  useEffect(() => () => clearTimeout(jumpTimer.current), [])
  const seen = useRef<Set<string> | null>(null)
  const previousBand = useRef(band)
  useEffect(() => {
    const realFlips = position?.fills.filter((fill) => fill.isFlippedOrder) ?? []
    const previous = seen.current
    const keys = realFlips.map((fill) => `${fill.tx}:${fill.orderId}:${fill.size}`)
    if (previous === null) seen.current = new Set(keys)
    else {
      if (keys.some((key) => !previous.has(key))) play('coin')
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
      actions.withdraw()
      return
    }
    if (intent === 'A') {
      if (recenter && state.exitCostMon !== null) actions.recenter()
      else if (band === 'OUT_OF_RANGE') reviewRecenter()
      else jump()
    }
    if (intent === 'SELECT') actions.refresh()
  })
  if (!position) {
    return (
      <div className="bg-screen flex h-full flex-col justify-center gap-2 p-2">
        <Panel><PixelText role="body">No current TESTNET position. Refresh chain state to read your position.</PixelText></Panel>
        <button className="pressable min-h-11 text-micro" onClick={actions.refresh}>SELECT Refresh</button>
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
        Range display follows {state.demoMultiplier > 1 ? `DEMO x${state.demoMultiplier} target` : 'mainnet source'}; valuation uses actual TESTNET book mid. Time in range is sampled on this tab only.
      </PixelText>
    </Panel>
  )
  if (inspect) return <Inputs state={state} onClose={() => setInspect(false)}>{details}</Inputs>
  const valuation = position.valuation
  const proximity = mid !== null && low !== null && high !== null && high > low
    ? Math.max(0, Math.min(100, Math.min(mid - low, high - mid) / ((high - low) / 2) * 100))
    : 0
  const status = paused ? 'PRICE FEED PAUSED'
    : band === 'NAD_SENSE' ? 'NAD-SENSE: near your edge'
      : band === 'OUT_OF_RANGE' ? 'OUT OF RANGE: sitting'
        : band === 'IN_RANGE' ? 'IN RANGE' : 'No active range'
  const hasNotices = state.error || state.readError || state.demandError || state.saveError || state.saved
  return (
    <div className={`screen-live screen-funded-live bg-screen flex h-full w-full flex-col gap-1 p-2 ${band === 'NAD_SENSE' && !paused ? 'nad-pulse' : ''}`}>
      <header className="funded-live-heading">
        <PixelText role="body" upper>Current position · MON/AUSD</PixelText>
      </header>
      <div className="funded-live-hud">
        <div><PixelText role="micro" tone="dim" upper>Score</PixelText>
          {valuation ? <Value amount={valuation.score} prefix="+$" decimals={6} tone="gain" /> : <PixelText role="value" tone="gain">Unavailable</PixelText>}
        </div>
        <div><PixelText role="micro" tone="dim" upper>Damage</PixelText>
          {valuation ? <Value amount={valuation.damage} prefix="-$" decimals={6} tone="loss" /> : <PixelText role="value" tone="loss">Unavailable</PixelText>}
        </div>
        <div><PixelText role="micro" tone="dim" upper>Net vs hold</PixelText>
          {valuation ? <Value amount={valuation.net} prefix="$" decimals={6} signed /> : <PixelText role="value">Unavailable</PixelText>}
        </div>
      </div>
      <div className="funded-live-range">
        <PixelText role="micro">RANGE {low === null ? 'unavailable' : price(low)} to {high === null ? 'unavailable' : price(high)}</PixelText>
        <PixelText role="micro" tone="dim" upper>DEMO x{state.demoMultiplier} · TESTNET</PixelText>
        <PixelText role="micro">NOW {mid === null ? 'unavailable' : price(mid)}</PixelText>
      </div>
      <div className="funded-live-arena">
        {recenter ? (
          <Panel flush className="funded-recenter flex flex-col gap-1 p-2">
            <PixelText role="body">Re-center is exit + fresh quote</PixelText>
            <PixelText role="micro">
              {state.exitCostMon === null
                ? 'Reading actual cancellation cost. No exit signed.'
                : `Exit fee estimate: ${state.exitCostMon.toFixed(6)} MON TESTNET. Cancellation is freshly estimated; withdrawal uses the S2 measured shape, not a ceiling.`}
            </PixelText>
            <PixelText role="micro">
              Cancel one ID per linked pair, withdraw, then review S6&apos;s new ladder, zap fee and bounded gas cost before confirming again. No automatic position change.
            </PixelText>
            <div className="funded-recenter-actions">
              <button className="pressable min-h-11 text-micro" disabled={state.busy || state.exitCostMon === null} onClick={actions.recenter}>A Exit and review re-center</button>
              <button className="pressable min-h-11 text-micro" onClick={() => setRecenter(false)}>Keep current position</button>
            </div>
          </Panel>
        ) : mid !== null && low !== null && high !== null ? (
          <PriceField series={series.length ? series : [mid]} lowerPrice={low} upperPrice={high}
            width={464} height={200} character={character}
            animation={paused || band === 'OUT_OF_RANGE' ? 'sit' : jumping ? 'jump' : band === 'NAD_SENSE' ? 'alert' : 'run'}
            jumping={jumping} earning={!paused && band === 'IN_RANGE'} />
        ) : <PixelText role="body">No active range to draw. START opens actual chain inputs.</PixelText>}
      </div>
      <div className={`funded-live-status ${paused || band === 'OUT_OF_RANGE' ? 'funded-status-alarm' : band === 'NAD_SENSE' ? 'funded-status-warn' : ''}`}>
        <PixelText role="micro" upper>{status}</PixelText>
        {!paused && band === 'IN_RANGE' && <Meter value={proximity} segments={12} label="Distance from range edge" />}
        <PixelText role="micro" upper>Autopilot: linked flips</PixelText>
      </div>
      {!paused && band === 'OUT_OF_RANGE' && low !== null && high !== null &&
        position.mid !== null && position.mid >= low && position.mid <= high && (
          <PixelText role="micro" tone="loss" as="p">
            {state.demoMultiplier > 1 ? 'DEMO target' : 'Mainnet price'} is outside this TESTNET range. The book is catching up.
            Jump is available in range; re-centering is manual.
          </PixelText>
        )}
      <div className="funded-live-sources">
        <PixelText role="micro">MAINNET source: {state.mainnetMid === null ? 'unavailable' : price(state.mainnetMid)}</PixelText>
        <PixelText role="micro">{state.demoMultiplier > 1 ? 'DEMO target' : 'MAINNET target'}: {state.sourceMid === null ? 'unavailable' : price(state.sourceMid)}</PixelText>
        <PixelText role="micro">TESTNET book: {position.mid === null ? 'unavailable' : price(position.mid)}</PixelText>
      </div>
      {(state.steps.length > 0 || hasNotices) && (
        <div className="funded-live-receipts">
          <ReceiptSteps state={state} />
          <Notices state={state} />
        </div>
      )}
      <footer className="screen-footer funded-key-line">
        <button className="pressable min-h-11 text-micro" disabled={state.busy || paused}
          onClick={() => recenter && state.exitCostMon !== null ? actions.recenter() : band === 'OUT_OF_RANGE' ? reviewRecenter() : jump()}>
          A {recenter ? 'Confirm exit' : band === 'OUT_OF_RANGE' ? 'Review re-center' : 'Jump'}
        </button>
        <button className="pressable min-h-11 text-micro" disabled={state.busy} onClick={actions.refresh}>SELECT Refresh</button>
        <button className="pressable min-h-11 text-micro" disabled={state.busy} onClick={actions.withdraw}>B {state.busy ? 'Working' : 'Withdraw'}</button>
        <button className="pressable min-h-11 text-micro" onClick={() => setInspect(true)}>START Inputs</button>
      </footer>
    </div>
  )
}
