import { useEffect, useMemo, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundProvider'
import { LadderError, mainnetMarkets, rangeState } from '@monadboy/sdk'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand } from '../../config/brand'
import { planForSession } from '../../lib/range/plan'
import { ladderPlanner } from '../../lib/range/ladder-planner'
import { duration, pct, price, usd, usdFine } from '../../lib/format'
import { ladderErrorCopy, NO_MARKET_RULES_COPY } from '../../lib/range/ladder-copy'
import {
  createSim, DAMAGE_APR, FALLBACK_REALIZED_VOL, FEE_APR, nudge, REBALANCE_COST_FRACTION,
  recordRebalance, step, STEP_SECONDS, summarize,
} from '../sim'
import { FIXTURE_MARKETS } from '../fixtures'
import { PriceField } from '../PriceField'
import { Meter, Panel, PixelText, Value } from '../../ui'
import type { SpriteAnimation } from '../../ui'
import type { CharacterId } from '../../config/brand'
import type { ManualRange, RangeWidth } from '../../state/session'
import type { RunSummary } from '../sim'
import type { Pool } from '../../types/domain'
import type { Envelope } from '../../lib/envelope'

/** SELECT walks this many ladder levels per press toward the nearer edge.
 * Enough presses to feel deliberate on stage, not so many that a presenter is
 * still mashing the button when the pitch clock is running. */
const NUDGE_LEVELS_PER_PRESS = 4

/** A tap of A that visibly leaves the ground and comes back. A fixed-length
 * swap is the whole mini-game and costs four lines instead of a hold-timer
 * and a physics curve. */
const JUMP_MS = 300

/** The sim ticks twice a second. setInterval, not requestAnimationFrame,
 * because the runner is CSS on the compositor and a per-frame JS loop would
 * burn battery to redraw nothing. */
const TICK_MS = 500

/**
 * Above this proximity (0 at an edge, 1 at the centre) the Monanimal is
 * visibly pleased.
 *
 * The gap below 1 matters: if happiness covered the whole in-range band, the
 * character would smile right up to the moment NAD-SENSE fires, and the face
 * would be reassuring at exactly the wrong time. Happy means the middle, not
 * merely "not yet warned".
 */
const CONTENT_PROXIMITY = 0.7

/**
 * The price field, in pixels.
 *
 * 464 is the 480 screen less 8px of page padding on each side. 200 is what is
 * left after the header (20), the range row (12), the bottom cluster (52), and
 * the gaps, and it is deliberately the largest number that fits: every pixel
 * not spent on a label belongs to the thing the player is actually watching.
 */
const FIELD_WIDTH = 464
const FIELD_HEIGHT = 200

export interface InRangeProps {
  /** Undefined is a render state, never a throw. findPool returns exactly this
   * when the id in the URL matches nothing on this save disk. */
  pool: Pool | undefined
  amount: number
  width: RangeWidth
  /** S6's hand moved edges, if any. planForSession treats this as an edit ON
   * TOP of width, never a parallel mode: null plays the WIDE/TIGHT suggestion,
   * present plays exactly what S6 drew. plan.ts owns the precedence. */
  manualRange: ManualRange | null
  autopilot: boolean
  characterId: CharacterId
  /** Freshness gates the development walk; live wiring belongs to Phase 7. */
  priceFeed?: Envelope<number>
  /** Hands the finished run out, so S8 can report on it without replaying
   * the seeded walk (a re-run at a different tick count produces different
   * numbers from the ones the player just watched). */
  onWithdraw: (run: RunSummary) => void
  onRebalance: () => void
  onBack: () => void
}

/**
 * S7 runs a visibly marked development fixture, never a live position.
 *
 * A component, not a route: it takes callbacks, never imports useNavigate,
 * and knows nothing about `$id`. That is what lets this file be tested with
 * `renderScreen` and a keypress instead of a router.
 */
export function InRange({
  pool, amount, width, manualRange, autopilot, characterId, priceFeed,
  onWithdraw, onRebalance, onBack,
}: InRangeProps) {
  const { play } = useSound()
  const book = FIXTURE_MARKETS.find(({ pool: fixture }) => fixture.pairAddress === pool?.pairAddress)?.book
  const openingMid = book?.bid != null && book.ask != null ? (book.bid + book.ask) / 2 : 0
  // The player's range SHAPE. planForSession is the one entry point plan.ts
  // documents: it reads the width or the manual edit, whichever wins, and
  // answers with a step and a level count either way. That shape is what was
  // funded at deposit time and a rebalance must never change it, only where
  // it sits (see anchorMid below). Width and step are one coupled control,
  // never two raw ones; this is the one place that coupling gets computed. A
  // planner failure becomes player copy, never a raw code.
  const planned = useMemo(() => {
    if (!pool) return { range: null, error: null }
    const market = mainnetMarkets.find(({ baseSymbol, quoteSymbol }) =>
      baseSymbol === pool.tokenX.symbol && quoteSymbol === pool.tokenY.symbol)
    if (!market) return { range: null, error: NO_MARKET_RULES_COPY }
    try {
      return {
        range: planForSession(openingMid, width, manualRange, ladderPlanner, {
          budgetQuote: amount, sigmaDaily: pool.realizedVol24h ?? FALLBACK_REALIZED_VOL, params: market.params,
        }).plan,
        error: null,
      }
    } catch (error) {
      if (!(error instanceof LadderError)) throw error
      return { range: null, error: ladderErrorCopy(error) }
    }
  }, [pool, openingMid, amount, width, manualRange])
  const range = planned.range
  // Range and price have separate anchors: re-centering moves liquidity only.
  // Not derived from `sim`, on purpose: sim.mid is where PRICE is, and the
  // anchor is where the player's LIQUIDITY is. Conflating them is what would
  // let a rebalance move nothing while still counting as one.
  const [anchorMid, setAnchorMid] = useState(openingMid)
  // The live edges: the plan's shape, scaled to this render's anchor.
  // range.low/high are anchored at DEPOSIT time and must not be read here, or
  // a rebalance recomputes the shape but not where it sits.
  const edges = useMemo(() => range && openingMid > 0 ? {
    ...range, low: range.low * anchorMid / openingMid, high: range.high * anchorMid / openingMid,
  } : null, [range, anchorMid, openingMid])
  // The hooks are never conditional (pool can be undefined, the not-found path
  // below still has to render), only their initial values are.
  const [sim, setSim] = useState(() => pool && range ? createSim(pool, openingMid) : null)
  const [jumping, setJumping] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const jumpTimeout = useRef<number>(undefined)
  // A feed that is not live freezes the walk: no ticks, no SCORE, no clock,
  // and A and SELECT go inert. B still withdraws.
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
  const lastSound = useRef({ score: sim?.feesEarnedUsd ?? 0, state })
  useEffect(() => {
    const score = sim?.feesEarnedUsd ?? 0
    if (score > lastSound.current.score) play('coin')
    if (state !== lastSound.current.state && state !== 'IN_RANGE') play('alert')
    lastSound.current = { score, state }
  }, [sim?.feesEarnedUsd, state, play])

  useConsoleIntent((intent) => {
    // The inputs view is a full-screen read-only page: B or START closes it,
    // and it never withdraws.
    if (inspecting) {
      if (intent === 'B' || intent === 'START') setInspecting(false)
      return
    }
    if (!pool || !sim || !range || !edges) {
      if (intent === 'B') onBack()
      return
    }
    if (intent === 'START') { setInspecting(true); return }
    if (intent === 'B') { play('withdraw'); onWithdraw(summarize(sim)); return }
    if (paused) return
    if (intent === 'A') {
      if (state === 'OUT_OF_RANGE') {
        // recordRebalance is the count S8 prints, and it means what it says:
        // the range moves to the current price in the same press, so the NEXT
        // render is back in range. A counter that went up while the range
        // never moved would imply an action that did not occur. Same shape,
        // new anchor: this crystallises the position around the current
        // price, and the cost is charged.
        setSim((current) => current ? recordRebalance(current, amount) : current)
        setAnchorMid(sim.mid)
        onRebalance()
        return
      }
      // The entire mini-game input: a fixed-length swap, see JUMP_MS above.
      setJumping(true)
      clearTimeout(jumpTimeout.current)
      jumpTimeout.current = window.setTimeout(() => setJumping(false), JUMP_MS)
      return
    }
    if (intent === 'SELECT') {
      // Walk toward whichever edge is nearer, so repeated presses are always
      // making progress instead of oscillating around the centre. The moved
      // price is appended to the history so the chart shows it on this frame.
      const towardLower = sim.mid - edges.low <= edges.high - sim.mid
      setSim((current) => {
        if (!current) return current
        const next = nudge(current, towardLower ? -1 : 1, NUDGE_LEVELS_PER_PRESS, range.step)
        return { ...next, history: [...current.history.slice(-29), next.mid] }
      })
    }
  })

  // Not a throw, not a spinner: a real panel with a real way out. A failed
  // plan names its reason in player words and says no funds moved.
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

  /**
   * The character's face is the fastest readout on the screen, so it has to
   * say the same thing the numbers do.
   *
   * `happy` is reserved for the safe middle. A motion preference must never
   * change what a screen is saying: the CSS handles reduced motion by parking
   * the loop, so the frame here is purely a function of where price is (and
   * of the feed being paused).
   */
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
      <div className="screen-inputs bg-screen flex h-full w-full flex-col gap-2 p-2">
        <PixelText role="title" upper>FIXTURE inputs</PixelText>
        <Panel className="flex flex-col gap-1">
          <PixelText role="micro">TESTNET simulation, not chain fills. Quote token valued at $1.</PixelText>
          <PixelText role="micro">Deposit {usd(amount)}; {width.toUpperCase()}; {manualRange ? 'manual edges' : 'width suggestion'}</PixelText>
          <PixelText role="micro">Book bid {price(book?.bid ?? 0)}; ask {price(book?.ask ?? 0)}; opening mid {price(openingMid)}</PixelText>
          <PixelText role="micro">Current mid {price(nowPrice)}; low {price(lowPrice)}; high {price(highPrice)}</PixelText>
          <PixelText role="micro">SCORE {usdFine(summary.feesEarnedUsd)}; NET {usdFine(summary.netUsd)}; DAMAGE {usdFine(damage)}</PixelText>
          <PixelText role="micro">DAMAGE = max(0, SCORE - NET)</PixelText>
          <PixelText role="micro">{`FIXTURE SCORE accrues at ${pct(FEE_APR * 100, 0)} annually in range; damage at ${pct(DAMAGE_APR * 100, 0)} outside.`}</PixelText>
          <PixelText role="micro">{sim.ticksInRange}/{sim.totalTicks} ticks in range; each tick represents {duration(STEP_SECONDS)}.</PixelText>
          <PixelText role="micro">{`Manual re-center costs ${pct(REBALANCE_COST_FRACTION * 100, 2)} of the deposit; count ${sim.rebalances}.`}</PixelText>
          <PixelText role="micro">Best streak {duration(sim.bestStreakSeconds)}; elapsed {duration(sim.elapsedSeconds)}.</PixelText>
          <PixelText role="micro">Feed {priceFeed?.freshness ?? 'fixture'}{priceFeed?.note ? ': ' + priceFeed.note : ''}</PixelText>
        </Panel>
        <PixelText role="micro" upper>B or Start close inputs</PixelText>
      </div>
    )
  }

  return (
    /* nad-pulse on the OUTER frame, so the whole screen flinches rather than
       one widget inside it. The warning has to be felt, and a border you
       notice from four metres is the cheapest way to say it. Gated behind
       prefers-reduced-motion in styles.css. */
    <div
      className={`screen-live bg-screen flex h-full w-full flex-col gap-1 p-2 ${
        warning ? 'nad-pulse' : ''
      }`}
    >
      {/* Header, on a three column grid so SCORE is genuinely centred rather
          than merely between two things of unequal width.
          Never hide a loss: DAMAGE sits at the same visual weight as SCORE. */}
      <div className="live-header grid grid-cols-3 items-baseline">
        <div className="flex items-baseline gap-1">
          <PixelText role="body" upper>
            {pool.tokenX.symbol}/{pool.tokenY.symbol}
          </PixelText>
          {/* Every number here is a simulation over a committed fixture.
              Eight pixels of honesty. */}
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>

        <div className="flex items-baseline justify-center gap-1">
          <PixelText role="micro" tone="dim" upper>
            Score
          </PixelText>
          <Value amount={sim.feesEarnedUsd} prefix="$" decimals={2} signed />
          {/* A word, not a pause glyph. The pixel face has pragmatic coverage,
              and a missing glyph renders as a tofu box next to the headline
              number on the one screen that has to survive a photograph. A word
              also reads from four metres. Shown whenever SCORE is frozen: out
              of range, or the feed is not live. */}
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
          {/* Not `signed`, because damage is stored positive and is never a
              gain: the tone Value derives from amount<0 would render a green
              +$0.00 at the start of every session. The minus and the loss tone
              are both stated instead. Dropping the tone with the sign would
              leave DAMAGE the same size as SCORE but the same colour as a
              neutral label, which is the rule half-kept. */}
          <Value amount={damage} prefix="-$" decimals={2} tone="loss" />
        </div>
      </div>

      {/* The range as numbers, tight under the header. The field draws the
          same two edges as lines; this row is what makes them readable as
          prices rather than as decoration. The middle label marks the money
          as testnet and names the key behind the inputs view. */}
      <div className="live-range flex items-baseline justify-between">
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

      {/* The screen. Everything above and below is a label on this. */}
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

      {/* The bottom cluster: warning, then instruments, then controls.
          Grouped in its own wrapper with a tighter gap than the screen above
          it, so the three text rows read as one block of chrome and the field
          keeps the space instead of the gaps taking it. */}
      <div className="live-instruments flex flex-col gap-1">
        {/* ONE banner slot, always in the same place, directly above the
            readings it is warning you about. Paused feed, OUT OF RANGE and
            NAD-SENSE all use it, so the most important messages on the screen
            teach the player one place to look. The slot is reserved whether or
            not anything is in it: a strip that appeared and disappeared would
            shove the field by its own height at the exact moment price moves. */}
        <div className="live-banner h-5 shrink-0">
          {paused ? (
            <div className="border-edge bg-alarm flex h-full items-center justify-center overflow-hidden border px-1">
              <PixelText role="body" className="text-center">PRICE FEED PAUSED</PixelText>
            </div>
          ) : state === 'OUT_OF_RANGE' ? (
            /* STATIC, not a marquee. A scrolling line is one line and it is
               the wrong one here: on stage the words OUT OF RANGE would spend
               most of their time off the left edge, and that phrase is the one
               thing the room has to read. Short enough to sit still across
               464px. AUTOPILOT only re-arms orders after fills, and no fills
               are possible out of range, so the line says what the player
               lost and what getting it back costs. */
            <div className="border-edge bg-alarm flex h-full items-center justify-center overflow-hidden border px-1">
              <PixelText role="body" className="text-center">
                {autopilot
                  ? 'OUT OF RANGE. you stopped earning. re-centering is manual and costs a swap.'
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

        {/* Instruments. Always on, in every state: the moment a player most
            needs to know whether autopilot is even on is the moment they are
            out of range, so this row is never replaced by the alarm.
            Three columns, like the header, so AUTOPILOT is genuinely centred
            rather than parked against whatever the meter's width happens to
            be. Two rows that centre on the same axis read as one instrument
            panel; two rows that merely balance do not. */}
        <div className="live-status grid grid-cols-3 items-center">
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

        {/* Controls, pinned to the corners. A is jump in range, recentre out
            of range. SELECT nudges price toward the nearer edge, so the
            out-of-range moment can be demonstrated on demand. B always
            withdraws. A real rebalance costs a swap and gas, so the out of
            range label says so in the same line rather than offering a free
            action. No dollar figure: there is no swap quote path yet, and a
            number this screen made up would be exactly the kind of claim the
            product rules forbid. */}
        <div className="screen-footer flex items-center justify-between">
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
