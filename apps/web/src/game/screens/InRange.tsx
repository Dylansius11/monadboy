import { useEffect, useMemo, useRef, useState } from 'react'
import { LadderError, mainnetMarkets, rangeState } from '@monadboy/sdk'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand } from '../../config/brand'
import { planForSession } from '../../lib/range/plan'
import { ladderPlanner } from '../../lib/range/ladder-planner'
import { duration, price } from '../../lib/format'
import { createSim, nudge, recordRebalance, step, summarize } from '../sim'
import { FIXTURE_MARKETS } from '../fixtures'
import { PriceField } from '../PriceField'
import { Meter, Panel, PixelText, Value } from '../../ui'
import type { SpriteAnimation } from '../../ui'
import type { CharacterId } from '../../config/brand'
import type { ManualRange, RangeWidth } from '../../state/session'
import type { RunSummary } from '../sim'
import type { Pool } from '../../types/domain'
import type { Envelope } from '../../lib/envelope'

const NUDGE_LEVELS_PER_PRESS = 4
const JUMP_MS = 300
const TICK_MS = 500
const CONTENT_PROXIMITY = 0.7
const FIELD_WIDTH = 464
const FIELD_HEIGHT = 200

export interface InRangeProps {
  pool: Pool | undefined
  amount: number
  width: RangeWidth
  manualRange: ManualRange | null
  autopilot: boolean
  characterId: CharacterId
  /** Freshness gates the development walk; live wiring belongs to Phase 7. */
  priceFeed?: Envelope<number>
  onWithdraw: (run: RunSummary) => void
  onRebalance: () => void
  onBack: () => void
}

/** S7 runs a visibly marked development fixture, never a live position. */
export function InRange({
  pool, amount, width, manualRange, autopilot, characterId, priceFeed,
  onWithdraw, onRebalance, onBack,
}: InRangeProps) {
  const book = FIXTURE_MARKETS.find(({ pool: fixture }) => fixture.pairAddress === pool?.pairAddress)?.book
  const openingMid = book?.bid != null && book.ask != null ? (book.bid + book.ask) / 2 : 0
  const planned = useMemo(() => {
    if (!pool) return { range: null, error: null }
    const market = mainnetMarkets.find(({ baseSymbol, quoteSymbol }) =>
      baseSymbol === pool.tokenX.symbol && quoteSymbol === pool.tokenY.symbol)
    if (!market) return { range: null, error: 'Market parameters unavailable' }
    try {
      return {
        range: planForSession(openingMid, width, manualRange, ladderPlanner, {
          budgetQuote: amount, sigmaDaily: pool.realizedVol24h ?? 0.6, params: market.params,
        }).plan,
        error: null,
      }
    } catch (error) {
      if (!(error instanceof LadderError)) throw error
      return { range: null, error: error.message }
    }
  }, [pool, openingMid, amount, width, manualRange])
  const range = planned.range
  // Range and price have separate anchors: re-centering moves liquidity only.
  const [anchorMid, setAnchorMid] = useState(openingMid)
  const edges = useMemo(() => range && openingMid > 0 ? {
    ...range, low: range.low * anchorMid / openingMid, high: range.high * anchorMid / openingMid,
  } : null, [range, anchorMid, openingMid])
  const [sim, setSim] = useState(() => pool && range ? createSim(pool, openingMid) : null)
  const [jumping, setJumping] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const jumpTimeout = useRef<number>(undefined)
  const paused = priceFeed !== undefined && priceFeed.freshness !== 'live'

  useEffect(() => {
    if (!pool || !edges || paused) return
    const id = setInterval(() => {
      setSim((current) => current ? step(current, pool, edges, amount) : current)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [pool, edges, amount, paused])
  useEffect(() => () => clearTimeout(jumpTimeout.current), [])

  const state = sim && edges
    ? rangeState(sim.mid, edges.low, edges.high, anchorMid * edges.step)
    : 'IN_RANGE'

  useConsoleIntent((intent) => {
    if (inspecting) {
      if (intent === 'B' || intent === 'START') setInspecting(false)
      return
    }
    if (!pool || !sim || !range || !edges) {
      if (intent === 'B') onBack()
      return
    }
    if (intent === 'START') { setInspecting(true); return }
    if (intent === 'B') { onWithdraw(summarize(sim)); return }
    if (paused) return
    if (intent === 'A') {
      if (state === 'OUT_OF_RANGE') {
        setSim((current) => current ? recordRebalance(current, amount) : current)
        setAnchorMid(sim.mid)
        onRebalance()
        return
      }
      setJumping(true)
      clearTimeout(jumpTimeout.current)
      jumpTimeout.current = window.setTimeout(() => setJumping(false), JUMP_MS)
      return
    }
    if (intent === 'SELECT') {
      const towardLower = sim.mid - edges.low <= edges.high - sim.mid
      setSim((current) => {
        if (!current) return current
        const next = nudge(current, towardLower ? -1 : 1, NUDGE_LEVELS_PER_PRESS, range.step)
        return { ...next, history: [...current.history.slice(-29), next.mid] }
      })
    }
  })

  if (!pool || !sim || !range || !edges) {
    return (
      <div className="bg-screen flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <Panel className="flex flex-col gap-2">
          <PixelText role="title" upper>{planned.error ?? 'Position not found'}</PixelText>
          <PixelText role="body">{planned.error ? 'FIXTURE range unavailable. TESTNET funds have not moved.' : 'This pool is not on the current save disk, or it was withdrawn already.'}</PixelText>
        </Panel>
        <PixelText role="micro" tone="dim" upper>B back</PixelText>
      </div>
    )
  }

  const proximity = Math.max(0, Math.min(sim.mid - edges.low, edges.high - sim.mid) / ((edges.high - edges.low) / 2))
  const warning = state === 'NAD_SENSE'
  const summary = summarize(sim)
  const damage = Math.max(0, sim.feesEarnedUsd - summary.netUsd)

  const spriteAnimation: SpriteAnimation =
    paused || state === 'OUT_OF_RANGE'
      ? 'sit'
      : jumping
        ? 'jump'
        : state === 'IN_RANGE'
          ? proximity > CONTENT_PROXIMITY
            ? 'happy'
            : 'run'
          : 'alert'

  const lowPrice = edges.low
  const highPrice = edges.high
  const nowPrice = sim.mid

  if (inspecting) {
    return (
      <div className="bg-screen flex h-full w-full flex-col gap-2 p-2">
        <PixelText role="title" upper>FIXTURE inputs</PixelText>
        <Panel className="flex flex-col gap-1">
          <PixelText role="micro">TESTNET simulation, not chain fills. Quote token valued at $1.</PixelText>
          <PixelText role="micro">Deposit {amount}; {width.toUpperCase()}; {manualRange ? 'manual edges' : 'width suggestion'}</PixelText>
          <PixelText role="micro">Book bid {book?.bid}; ask {book?.ask}; opening mid {openingMid}</PixelText>
          <PixelText role="micro">Current mid {nowPrice}; low {lowPrice}; high {highPrice}</PixelText>
          <PixelText role="micro">SCORE {summary.feesEarnedUsd}; NET {summary.netUsd}; DAMAGE {damage}</PixelText>
          <PixelText role="micro">DAMAGE = max(0, SCORE - NET)</PixelText>
          <PixelText role="micro">FIXTURE SCORE accrues at 18% annually in range; damage at 35% outside.</PixelText>
          <PixelText role="micro">{sim.ticksInRange}/{sim.totalTicks} ticks in range; each tick represents 3600 seconds.</PixelText>
          <PixelText role="micro">Manual re-center costs deposit x 0.0015; count {sim.rebalances}.</PixelText>
          <PixelText role="micro">Best streak {sim.bestStreakSeconds}s; elapsed {sim.elapsedSeconds}s.</PixelText>
          <PixelText role="micro">Feed {priceFeed?.freshness ?? 'fixture'}{priceFeed?.note ? ': ' + priceFeed.note : ''}</PixelText>
        </Panel>
        <PixelText role="micro" upper>B or Start close inputs</PixelText>
      </div>
    )
  }

  return (
    <div
      className={`bg-screen flex h-full w-full flex-col gap-1 p-2 ${
        warning ? 'nad-pulse' : ''
      }`}
    >
      <div className="grid grid-cols-3 items-baseline">
        <div className="flex items-baseline gap-1">
          <PixelText role="body" upper>
            {pool.tokenX.symbol}/{pool.tokenY.symbol}
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>

        <div className="flex items-baseline justify-center gap-1">
          <PixelText role="micro" tone="dim" upper>
            Score
          </PixelText>
          <Value amount={sim.feesEarnedUsd} prefix="$" decimals={2} signed />
          {paused || state === 'OUT_OF_RANGE' ? (
            <PixelText role="micro" tone="loss" upper>
              Paused
            </PixelText>
          ) : null}
        </div>

        <div className="flex items-baseline justify-end gap-1">
          <PixelText role="micro" tone="dim" upper>
            Damage
          </PixelText>
          <Value amount={damage} prefix="-$" decimals={2} tone="loss" />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <PixelText role="micro" tone="dim" upper>
            Range
          </PixelText>
          <PixelText role="micro" className="tabular-nums">
            {price(lowPrice)}
          </PixelText>
          <PixelText role="micro" tone="dim">
            to
          </PixelText>
          <PixelText role="micro" className="tabular-nums">
            {price(highPrice)}
          </PixelText>
        </div>
        <PixelText role="micro" tone="dim" upper>TESTNET / Start inputs</PixelText>
        <div className="flex items-baseline gap-1">
          <PixelText role="micro" tone="dim" upper>
            Now
          </PixelText>
          <PixelText
            role="micro"
            tone={state === 'OUT_OF_RANGE' ? 'loss' : 'ink'}
            className="tabular-nums"
          >
            {price(nowPrice)}
          </PixelText>
        </div>
      </div>

      <PriceField
        series={sim.history}
        lowerPrice={lowPrice}
        upperPrice={highPrice}
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        character={characterId}
        animation={spriteAnimation}
        jumping={jumping}
        earning={!paused && state !== 'OUT_OF_RANGE'}
      />

      <div className="flex flex-col gap-1">
        <div className="h-5 shrink-0">
          {paused ? (
            <div className="border-edge bg-alarm flex h-full items-center justify-center overflow-hidden border px-1">
              <PixelText role="body" className="text-center">PRICE FEED PAUSED</PixelText>
            </div>
          ) : state === 'OUT_OF_RANGE' ? (
            <div className="border-edge bg-alarm flex h-full items-center justify-center overflow-hidden border px-1">
              <PixelText role="body" className="text-center">
                {autopilot
                  ? 'OUT OF RANGE. flip orders re-arm, but re-centering is manual and costs a swap.'
                  : 'OUT OF RANGE. you stopped earning. price walked off your ground.'}
              </PixelText>
            </div>
          ) : warning ? (
            <div className="border-edge bg-warn flex h-full items-center justify-center overflow-hidden border px-1">
              <PixelText role="body" className="text-center">
                {`${brand.ALERT_NAME}: price is close to the edge of your range`}
              </PixelText>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 items-center">
          <div className="flex items-center gap-2">
            <PixelText
              role="micro"
              tone={state === 'OUT_OF_RANGE' ? 'loss' : 'ink'}
              upper
            >
              {state === 'OUT_OF_RANGE' ? 'Out of range' : 'In range'}
            </PixelText>
            <div className="w-16">
              <Meter value={proximity * 100} segments={12} />
            </div>
          </div>
          <PixelText role="micro" className="text-center" upper>
            {brand.AUTOPILOT_NAME} {autopilot ? 'On' : 'Off'}
          </PixelText>
          <PixelText
            role="micro"
            tone="dim"
            className="text-right tabular-nums"
          >
            {duration(sim.elapsedSeconds)}
          </PixelText>
        </div>

        <div className="flex items-center justify-between">
          <PixelText role="micro" upper>
            A {paused ? 'Paused' : state === 'OUT_OF_RANGE' ? 'Recentre, costs a swap' : 'Jump'}
          </PixelText>
          <PixelText role="micro" upper>
            Select {paused ? 'Paused' : 'nudge'}
          </PixelText>
          <PixelText role="micro" upper>
            B Withdraw
          </PixelText>
        </div>
      </div>
    </div>
  )
}
