import { useEffect, useRef, useState } from 'react'
import { rangeState } from '@monadboy/sdk'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { useSession } from '../../state/session'
import { useSound } from '../../sound/SoundProvider'
import { price } from '../../lib/format'
import { Panel, PixelText } from '../../ui'
import { PriceField } from '../PriceField'
import {
  Header,
  Inputs,
  Numbers,
  Notices,
  ReceiptSteps,
  SourceLinks,
} from './FundedGameplayView'
import type { FundedScreenProps } from './FundedGameplayView'

export function FundedLive({ state, actions }: FundedScreenProps) {
  const character = useSession((session) => session.characterId)
  const position = state.position!
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
    (position.orders.length
      ? Math.min(
          ...position.orders.flatMap((order) => [
            order.price,
            order.flipPrice || order.price,
          ]),
        )
      : null)
  const high =
    basis?.high ??
    (position.orders.length
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
      : position.mid
  const band =
    mid !== null && low !== null && high !== null
      ? rangeState(
          mid,
          low,
          high,
          basis ? position.mid! * basis.step : (high - low) / 8,
        )
      : null
  const paused =
    !state.sourceFresh ||
    position.paused ||
    Date.now() - position.observedAt > 15000
  useEffect(() => {
    if (mid !== null) setSeries((old) => [...old.slice(-29), mid])
  }, [mid, position.block])
  useEffect(() => () => clearTimeout(jumpTimer.current), [])
  const seen = useRef<Set<string> | null>(null)
  const previousBand = useRef(band)
  useEffect(() => {
    const realFlips = position.fills.filter((fill) => fill.isFlippedOrder)
    const now = new Set(
      realFlips.map((fill) => `${fill.tx}:${fill.orderId}:${fill.size}`),
    )
    if (
      seen.current !== null &&
      realFlips.some(
        (fill) => !seen.current!.has(`${fill.tx}:${fill.orderId}:${fill.size}`),
      )
    )
      play('coin')
    seen.current = now
    if (
      !paused &&
      band !== null &&
      band !== previousBand.current &&
      band !== 'IN_RANGE'
    )
      play('alert')
    previousBand.current = band
  }, [position.fills, band, paused, play])
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
  if (inspect) return <Inputs state={state} onClose={() => setInspect(false)} />
  const valuation = position.valuation
  return (
    <div
      className={`screen-live bg-screen flex h-full w-full flex-col gap-1 p-2 ${band === 'NAD_SENSE' && !paused ? 'nad-pulse' : ''}`}
    >
      <Header title="Current position" demoMultiplier={state.demoMultiplier} />
      <div className="funded-body flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <Numbers
          score={valuation?.score ?? null}
          damage={valuation?.damage ?? null}
          net={valuation?.net ?? null}
        />
        <PixelText role="micro" upper>
          {paused
            ? 'PRICE FEED PAUSED'
            : band === 'NAD_SENSE'
              ? 'NAD-SENSE: near your edge'
              : band === 'OUT_OF_RANGE'
                ? 'OUT OF RANGE: sitting'
                : band === 'IN_RANGE'
                  ? 'IN RANGE'
                  : 'No active range'}
        </PixelText>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-micro">
          <span>MAINNET source: {state.mainnetMid === null ? 'unavailable' : price(state.mainnetMid)}</span>
          {state.demoMultiplier > 1 && (
            <span>DEMO target: {state.sourceMid === null ? 'unavailable' : price(state.sourceMid)}</span>
          )}
          <span>TESTNET book: {position.mid === null ? 'unavailable' : price(position.mid)}</span>
          {low !== null && high !== null && (
            <span>Your range: {price(low)} to {price(high)}</span>
          )}
        </div>
        {!paused && band === 'OUT_OF_RANGE' && low !== null && high !== null &&
          position.mid !== null && position.mid >= low && position.mid <= high && (
            <PixelText role="micro" tone="loss" as="p">
              {state.demoMultiplier > 1 ? 'DEMO target' : 'Mainnet price'} is outside this TESTNET range. The book is catching up.
              Jump is available in range; re-centering is manual.
            </PixelText>
          )}
        {mid !== null && low !== null && high !== null && (
          <PriceField
            series={series.length ? series : [mid]}
            lowerPrice={low}
            upperPrice={high}
            width={464}
            height={200}
            character={character}
            animation={
              paused || band === 'OUT_OF_RANGE'
                ? 'sit'
                : jumping
                  ? 'jump'
                  : band === 'NAD_SENSE'
                    ? 'alert'
                    : 'run'
            }
            jumping={jumping}
            earning={!paused && band === 'IN_RANGE'}
          />
        )}
        <Panel flush className="flex flex-col gap-1 p-2">
          <PixelText role="micro">
            {position.orders.length} active chain orders.{' '}
            {position.fills.length} observed maker fills,{' '}
            {position.fills.filter((fill) => fill.isFlippedOrder).length}{' '}
            flipped-origin.
          </PixelText>
          <PixelText role="micro">
            Margin + resting:{' '}
            {(
              position.holdings.marginBase + position.holdings.restingBase
            ).toFixed(8)}{' '}
            MON +{' '}
            {(
              position.holdings.marginQuote + position.holdings.restingQuote
            ).toFixed(6)}{' '}
            AUSD TESTNET.
          </PixelText>
          <PixelText role="micro">
            {position.source}.{' '}
            {position.complete
              ? 'Current run log coverage complete.'
              : `History has unavailable gaps before block ${position.coverageFrom.toString()}. SCORE/DAMAGE/NET are unavailable, not zero.`}
          </PixelText>
          <PixelText role="micro">
            Range display follows {state.demoMultiplier > 1 ? `DEMO x${state.demoMultiplier} target` : 'mainnet source'}; valuation uses actual
            TESTNET book mid. Time in range is sampled on this tab only.
          </PixelText>
        </Panel>
        {recenter && (
          <Panel flush className="flex flex-col gap-1 p-2">
            <PixelText role="body">Re-center is exit + fresh quote</PixelText>
            <PixelText role="micro">
              {state.exitCostMon === null
                ? 'Reading actual cancellation cost. No exit signed.'
                : `Exit fee estimate: ${state.exitCostMon.toFixed(6)} MON TESTNET. Cancellation is freshly estimated; withdrawal uses the S2 measured shape, not a ceiling.`}
            </PixelText>
            <PixelText role="micro">
              Cancel one ID per linked pair, withdraw, then review S6's new
              ladder, zap fee and bounded gas cost before confirming again. No
              automatic position change.
            </PixelText>
            <button
              className="pressable min-h-11 text-micro underline"
              disabled={state.busy || state.exitCostMon === null}
              onClick={actions.recenter}
            >
              A Exit and review re-center
            </button>
            <button
              className="pressable min-h-11 text-micro"
              onClick={() => setRecenter(false)}
            >
              Keep current position
            </button>
          </Panel>
        )}
        <ReceiptSteps state={state} />
        <Notices state={state} />
        <SourceLinks state={state} />
      </div>
      <footer className="screen-footer flex flex-wrap items-center justify-between gap-1">
        <button
          className="pressable min-h-11 text-micro"
          disabled={state.busy || paused}
          onClick={() => (band === 'OUT_OF_RANGE' ? reviewRecenter() : jump())}
        >
          A {band === 'OUT_OF_RANGE' ? 'Review re-center' : 'Jump'}
        </button>
        <button
          className="pressable min-h-11 text-micro"
          disabled={state.busy}
          onClick={actions.withdraw}
        >
          B {state.busy ? 'Working' : 'Withdraw'}
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
