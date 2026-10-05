import { useMemo, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand } from '../../config/brand'
import { LadderError, mainnetMarkets } from '@monadboy/sdk'
import { ladderPlanner } from '../../lib/range/ladder-planner'
import { FIXTURE_MARKETS } from '../fixtures'
import { planForOffsets, planForSession } from '../../lib/range/plan'
import { FALLBACK_REALIZED_VOL } from '../sim'
import { pct, price, usd } from '../../lib/format'
import { NO_MARKET_RULES_COPY, ladderErrorCopy } from '../../lib/range/ladder-copy'
import { Panel, PixelText, Toggle, Value } from '../../ui'
import type { PlannedRange, RangePlan } from '../../lib/range/plan'
import type { Ladder, MarketParams } from '@monadboy/sdk'
import type { ManualRange, RangeWidth } from '../../state/session'
import type { Pool } from '../../types/domain'

/** The only five deposit sizes a beginner is offered directly: one number, in
 * one token. A preset row is how that stays one number instead of a text field
 * a console has no keyboard to fill. */
const PRESETS = [10, 25, 50, 75, 100] as const

/**
 * Past either end of the preset row, LEFT/RIGHT stops sticking and starts
 * nudging. Five is small enough to read as a fine adjustment and large
 * enough that walking from a preset to the balance ceiling is a handful of
 * presses, not fifty.
 */
const FINE_STEP = 5

/**
 * Taker fee of the SPEC testnet market (30 bps): the cost the zap swap pays.
 *
 * There is no swap quote path yet, so the swap cost is an estimate built from
 * this fee on the amount that gets swapped. It is a floor, not a quote: the
 * word "est." sits next to every rendering of it, and the inputs view states
 * where it comes from.
 */
const TESTNET_TAKER_FEE_BPS = 30

/** 480 screen less 8px of page padding on each side, the same measurement
 * InRange.tsx uses for its own full-bleed field. */
const STRIP_WIDTH = 464

/**
 * FLOORS, not heights. The strip takes whatever the screen has left over
 * (see the `flex-1` comment on the range picture) and this is the point below
 * which it stops giving ground, because a strip squeezed to a few pixels is
 * not a picture of anything. 44 plus the 12px marker plus the caption row is
 * what lets the whole range block clear the funding panel under it inside the
 * 320px viewport.
 */
const STRIP_MIN_HEIGHT = 44
/** `h-3` on NowMarker. Named so the strip block's floor can count it. */
const NOW_MARKER_HEIGHT = 12
const OVERLAY_STRIP_MIN_HEIGHT = 64

type FocusRow = 'amount' | 'width' | 'autopilot'
const ROWS: ReadonlyArray<FocusRow> = ['amount', 'width', 'autopilot']

/**
 * The three positions in the HOW WIDE row.
 *
 * MANUAL lives here rather than in a section of its own. "Leave the
 * suggestion or edit it" is a different question from "how wide" in
 * semantics, but a section the arrow keys cannot reach is a control most
 * players never touch, and this row is where the fingers already are. It is
 * the same question asked three ways, so it is one row.
 */
type WidthSlot = RangeWidth | 'manual'
const WIDTH_SLOTS: ReadonlyArray<WidthSlot> = ['wide', 'tight', 'manual']

export interface SetRangeProps {
  /** Undefined is a render state, never a throw. */
  pool: Pool | undefined
  balance: number
  amount: number
  width: RangeWidth
  /** Null is the default: WIDE/TIGHT alone. */
  manualRange: ManualRange | null
  autopilot: boolean
  onChangeAmount: (next: number) => void
  onChangeWidth: (next: RangeWidth) => void
  onChangeManualRange: (next: ManualRange | null) => void
  onToggleAutopilot: (next: boolean) => void
  onConfirm: () => void
  onBack: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Where LEFT/RIGHT on a preset row send the value: the neighbour preset, or
 * (past either end of the list) a fine nudge, clamped to [min, max].
 *
 * Shared by the AMOUNT row and the manual editor's START/END rows: both are
 * "walk a preset list, then fall back to a fixed step" with different
 * presets and different clamps, and this is the one place that shape lives.
 */
function stepPreset(
  current: number,
  direction: 1 | -1,
  presets: ReadonlyArray<number>,
  fineStep: number,
  min: number,
  max: number,
): number {
  const idx = presets.indexOf(current)
  // Bounds-checked on the INDEX, not on the value it produces. `presets[-1]`
  // is undefined at runtime but typed as a number here (the project does not
  // set noUncheckedIndexedAccess), so a truthiness guard on the result reads
  // as dead code to the linter and is the sort of check that gets deleted.
  // `.at()` would type it honestly and is wrong for the opposite reason:
  // `.at(-1)` wraps to the LAST preset, so LEFT from the first would jump to
  // the last.
  const next = idx + direction
  if (idx !== -1 && next >= 0 && next < presets.length) {
    return clamp(presets[next], min, max)
  }
  return clamp(current + direction * fineStep, min, max)
}

/** The AMOUNT row's own ceiling is the balance; session.ts enforces the same
 * one on setAmount, so this just keeps LEFT/RIGHT from ever asking for more
 * than the chip row could show as disabled. */
function stepAmount(
  current: number,
  direction: 1 | -1,
  balance: number,
): number {
  return stepPreset(current, direction, PRESETS, FINE_STEP, 0, balance)
}

/**
 * S6, the setup screen.
 *
 * A component, not a route: it takes callbacks, never imports useNavigate,
 * and knows nothing about `$id`. Same contract as InRange.tsx.
 */
export function SetRange({
  pool,
  balance,
  amount,
  width,
  manualRange,
  autopilot,
  onChangeAmount,
  onChangeWidth,
  onChangeManualRange,
  onToggleAutopilot,
  onConfirm,
  onBack,
}: SetRangeProps) {
  const [focusRow, setFocusRow] = useState<FocusRow>('amount')
  const [manualOpen, setManualOpen] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  /**
   * Where the cursor sits INSIDE the width row, which is not the same thing
   * as the width in force.
   *
   * WIDE and TIGHT apply the moment the cursor lands on them, so for those
   * two the distinction never shows. MANUAL is the reason it exists: walking
   * onto it has to look like something before anything has been edited, and
   * `manualRange !== null` cannot say that because it is still null until the
   * player applies an edit. Cursor and applied are two facts and the chip row
   * shows both: the cursor is a solid ink fill, the applied range is the
   * accent fill. Cancel out of the editor and MANUAL keeps the cursor and
   * loses nothing, because it never had the accent to begin with.
   */
  const [widthCursor, setWidthCursor] = useState<WidthSlot>(() =>
    manualRange ? 'manual' : width,
  )

  const fixture = FIXTURE_MARKETS.find(
    (entry) => entry.pool.pairAddress === pool?.pairAddress,
  )
  // A fixture without a book has no price, and no price means no range
  // (NO_PRICE copy), never an invented mid.
  const mid =
    fixture?.book.bid != null && fixture.book.ask != null
      ? (fixture.book.bid + fixture.book.ask) / 2
      : 0
  // Fixture identities are synthetic; the symbol pair selects real market rules.
  const params = mainnetMarkets.find(
    (market) =>
      market.baseSymbol === pool?.tokenX.symbol &&
      market.quoteSymbol === pool.tokenY.symbol,
  )?.params
  const sigmaDaily = pool?.realizedVol24h ?? FALLBACK_REALIZED_VOL
  // The one place a width (or a hand moved edge) becomes a ladder plan on this
  // screen. S7 calls the same function with the same inputs, so the range
  // shown here is the range that gets funded. A planner failure becomes player
  // copy, never a raw code and never a throw.
  const { range, error } = useMemo(() => {
    if (!pool) return { range: null, error: null }
    if (!params) return { range: null, error: NO_MARKET_RULES_COPY }
    try {
      return {
        range: planForSession(mid, width, manualRange, ladderPlanner, {
          budgetQuote: amount,
          sigmaDaily,
          params,
        }),
        error: null,
      }
    } catch (failure) {
      if (!(failure instanceof LadderError)) throw failure
      return { range: null, error: ladderErrorCopy(failure) }
    }
  }, [pool, mid, width, manualRange, amount, sigmaDaily, params])

  useConsoleIntent((intent) => {
    // The inputs view is a full-screen read-only page: B or START closes it,
    // and nothing else on the screen can fire underneath it.
    if (inspecting) {
      if (intent === 'B' || intent === 'START') setInspecting(false)
      return
    }

    // The manual editor mounts as its own component with its own
    // useConsoleIntent subscription while it is open (below), which is the
    // real guarantee that a key press cannot reach both handlers. This early
    // return is the second layer: even if that ever changed, A here can
    // never reach onConfirm while the overlay covers the screen.
    if (manualOpen) return

    if (!pool) {
      if (intent === 'B') onBack()
      return
    }

    // SELECT is taken by the manual editor, so START opens the inputs view.
    if (intent === 'START') {
      setInspecting(true)
      return
    }

    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'A') {
      // A is CONFIRM everywhere except on the MANUAL chip, where it opens the
      // editor. That is one key meaning two things, which is normally how a
      // console screen gets a player into trouble, and it is safe here only
      // because the footer's first slot rewrites itself to say which one is
      // live right now. If that footer ever stops changing, this branch has
      // to go with it. Without a range (a failed plan) A does nothing.
      if (range && focusRow === 'width' && widthCursor === 'manual') {
        setManualOpen(true)
        return
      }
      if (range) onConfirm()
      return
    }
    if (intent === 'SELECT') {
      // Manual range (start price, end price, "-10%" presets) is behind a
      // toggle and never the default path. It opens SEEDED from whichever
      // WIDE/TIGHT edges are already on screen, so it reads as an edit on top
      // of the suggestion rather than a second, competing mode.
      if (range) setManualOpen(true)
      return
    }

    if (intent === 'UP' || intent === 'DOWN') {
      const idx = ROWS.indexOf(focusRow)
      const nextIdx = idx + (intent === 'UP' ? -1 : 1)
      // No wrap: a cursor that wraps past the end of a three-item list feels
      // broken, not clever, the first time a player hits it.
      if (nextIdx >= 0 && nextIdx < ROWS.length) setFocusRow(ROWS[nextIdx])
      return
    }

    // Every other intent has been handled above, so this is LEFT or RIGHT.
    const direction = intent === 'LEFT' ? -1 : 1
    if (focusRow === 'amount') {
      onChangeAmount(stepAmount(amount, direction, balance))
      return
    }
    if (focusRow === 'width') {
      const idx = WIDTH_SLOTS.indexOf(widthCursor)
      const nextIdx = idx + direction
      // No wrap, same rule as every other cursor on this screen.
      if (nextIdx < 0 || nextIdx >= WIDTH_SLOTS.length) return
      const next = WIDTH_SLOTS[nextIdx]
      setWidthCursor(next)
      // WIDE and TIGHT apply on arrival: they are cheap, reversible, and
      // waiting for a second press to confirm a two-state toggle is the kind
      // of ceremony that makes a console screen feel slow. session.ts's
      // setWidth also clears manualRange, so walking back onto one of them IS
      // "give me the suggestion again".
      // MANUAL applies nothing. It opens an overlay, which is not cheap and
      // not reversible by walking away, so it waits for A.
      if (next !== 'manual') onChangeWidth(next)
      return
    }
    onToggleAutopilot(!autopilot)
  })

  // Not a throw, not a spinner: a real panel with a real way out.
  if (!pool) {
    return (
      <div className="bg-screen flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <Panel className="flex flex-col gap-2">
          <PixelText role="title" upper>
            Pool not found
          </PixelText>
          <PixelText role="body">
            This pool is not on the current save disk, or it never made this
            tier&apos;s cut.
          </PixelText>
        </Panel>
        <PixelText role="micro" tone="dim" upper>
          B back
        </PixelText>
      </div>
    )
  }

  const lowPrice = range?.plan.low ?? 0
  const highPrice = range?.plan.high ?? 0
  // Read off the plan, never hardcoded to 50%, so an asymmetric manual range
  // does not draw "now" in the wrong place.
  const nowLeftPct = range ? ((mid - lowPrice) / (highPrice - lowPrice)) * 100 : 50
  // Display SDK funding in quote-value units; any size-rounding dust stays unallocated.
  const quoteAmount = range?.plan.quoteNeeded ?? 0
  const baseAmount = (range?.plan.baseNeeded ?? 0) * mid
  const swapCostEstimate = (range?.plan.zapQuote ?? 0) * (TESTNET_TAKER_FEE_BPS / 10_000)
  // The width caption's provenance line reads off this. The fallback constant
  // is shared with the simulation, so S6 and S7 agree on volatility.
  const vol = sigmaDaily

  if (inspecting) {
    return (
      <div className="bg-screen flex h-full w-full flex-col gap-2 p-2">
        <PixelText role="title" upper>FIXTURE inputs</PixelText>
        <Panel className="flex flex-col gap-1">
          <PixelText role="micro">TESTNET funds do not move here. Quote token valued at $1.</PixelText>
          <PixelText role="micro">{`Amount ${usd(amount)} of ${usd(balance)} TESTNET balance`}</PixelText>
          <PixelText role="micro">
            {manualRange
              ? `Manual edges ${pct(manualRange.lowerPct, 0)} / +${pct(manualRange.upperPct, 0)} around mid ${price(mid)}`
              : `24h vol ${pct(vol * 100, 0)}; width +/-${pct(range?.requestedWidthPct ?? 0, 1)} around mid ${price(mid)}`}
          </PixelText>
          <PixelText role="micro">Width is arithmetic from 24h vol, not a prediction.</PixelText>
          {range ? (
            <>
              <PixelText role="micro">
                {`Edges ${price(lowPrice)} to ${price(highPrice)}; ${pct(range.plan.step * 100, 2)} steps, ${range.plan.levels} levels per side`}
              </PixelText>
              <PixelText role="micro">
                {`Holdings ${usd(quoteAmount)} ${pool.tokenY.symbol} + ${usd(baseAmount)} ${pool.tokenX.symbol} at mid ${price(mid)}`}
              </PixelText>
              <PixelText role="micro">
                {`Swap ${usd(range.plan.zapQuote)} ${pool.tokenY.symbol}; swap cost ~${usd(swapCostEstimate)} est. at a ${pct(TESTNET_TAKER_FEE_BPS / 100, 1)} testnet taker fee, before slippage and gas.`}
              </PixelText>
            </>
          ) : (
            <PixelText role="micro">{error}</PixelText>
          )}
        </Panel>
        <PixelText role="micro" upper>B or Start close inputs</PixelText>
      </div>
    )
  }

  return (
    <div className="bg-screen relative flex h-full w-full flex-col gap-1 p-2">
      {/* Header. Body weight, not title: this screen has three controls, a
          picture, and a funding preview to fit inside 320px, and a 24px title
          row buys eight pixels of screen name at the cost of eight pixels of
          the thing the screen is for. InRange.tsx makes the same trade. */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <PixelText role="body" upper>
            Set your range
          </PixelText>
          {/* Every number below comes from a committed fixture, not a live
              quote. Eight pixels of honesty. */}
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>
        {/* Names the key behind the inputs view, where the numbers below are
            sourced. Plain text, not a button: a pressable here would add its
            padding to the header row and cost the picture below 8px. */}
        <PixelText role="micro" tone="dim" upper>
          Start inputs
        </PixelText>
        <PixelText role="body" upper>
          {pool.tokenX.symbol} / {pool.tokenY.symbol}
        </PixelText>
      </div>

      {/* HOW MUCH and HOW WIDE share one row. Stacked, the blocks plus the
          range picture plus the funding preview come to roughly 460px inside a
          320px viewport that clips silently. Side by side costs nothing
          legible, and the questions are read together anyway ("how much, how
          wide, and am I editing it") rather than as separate steps.

          MANUAL is the third position of the width row and answers whether the
          suggestion still stands, which is why the chip row below says both
          what is applied and where the cursor is.

          The cursor bar plus a background fill both mark focus, because a ring
          on an 8px label reads as "a slightly bolder label", not as a cursor. */}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div
          className={`flex flex-col gap-1 p-1 ${focusRow === 'amount' ? 'bg-sunk' : ''}`}
        >
          <div className="flex items-center gap-1">
            <FocusCursor active={focusRow === 'amount'} />
            <PixelText role="micro" tone="dim" upper>
              How much?
            </PixelText>
            <PixelText
              role="micro"
              tone="dim"
              className="ml-auto pl-2 tabular-nums"
            >
              TESTNET balance {usd(balance)}
            </PixelText>
          </div>
          {/* The chosen amount sits BESIDE the chips, not on a row under
              them. A 20px `Value` on its own row would cost this column 24px
              of a budget with no margin to give. Same size, same prominence,
              one row fewer, and it reads better anyway: the number lands where
              the chip that set it is. */}
          <div className="flex items-baseline gap-1">
            {PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={String(preset)}
                selected={amount === preset}
                // Disabled, not hidden: the balance ceiling has to be visible,
                // not merely enforced.
                disabled={preset > balance}
                onSelect={() => onChangeAmount(Math.min(preset, balance))}
              />
            ))}
            <Value amount={amount} decimals={2} className="ml-1" />
            <PixelText role="micro" tone="dim" upper>
              {pool.tokenY.symbol}
            </PixelText>
          </div>
        </div>

        <div
          className={`flex flex-col gap-1 p-1 ${focusRow === 'width' ? 'bg-sunk' : ''}`}
        >
          <div className="flex items-center gap-1">
            <FocusCursor active={focusRow === 'width'} />
            <PixelText role="micro" tone="dim" upper>
              How wide?
            </PixelText>
          </div>
          {/* Chips and their caption share a gapless block, so the sentence
              that explains the chips sits ON them rather than floating four
              pixels off looking like it belongs to the range picture below. */}
          <div className="flex flex-col">
            <div className="flex gap-1">
              {WIDTH_SLOTS.map((slot) => (
                <Chip
                  key={slot}
                  label={slot}
                  // APPLIED, not focused. Neither WIDE nor TIGHT reads as
                  // applied once a hand moved edge is in play: showing WIDE as
                  // chosen while the funded range is actually the player's own
                  // edit would be a lie the picture below contradicts.
                  selected={
                    slot === 'manual'
                      ? manualRange !== null
                      : width === slot && !manualRange
                  }
                  // FOCUSED, which is a different fact. Only drawn while the
                  // width row holds the row cursor, so a solid ink chip never
                  // appears on a row the arrow keys are not currently driving.
                  cursor={focusRow === 'width' && widthCursor === slot}
                  onSelect={() => {
                    setWidthCursor(slot)
                    setFocusRow('width')
                    if (slot === 'manual') {
                      if (range) setManualOpen(true)
                    } else {
                      onChangeWidth(slot)
                    }
                  }}
                />
              ))}
            </div>
            {/* Fixed height whether or not the text differs, so toggling width
                never shifts the range picture below it.

                This is the derivation of the edge prices in eight pixels: the
                volatility read off the pool, and the half width WIDE or TIGHT
                turns it into. Once a hand moved edge exists it says MANUAL and
                prints the edges instead, because the same eight pixels crediting
                the player's own number to the pool's volatility would be worse
                than saying nothing. */}
            <div className="h-3">
              <PixelText role="micro" tone="dim">
                {manualRange
                  ? `manual  ${pct(manualRange.lowerPct, 0)} / +${pct(manualRange.upperPct, 0)}`
                  : `vol ${pct(vol * 100, 0)} -> +/-${pct(range?.requestedWidthPct ?? 0, 1)}`}
              </PixelText>
            </div>
          </div>
        </div>
      </div>

      {/* A failed plan replaces the picture with its reason in player words,
          and A stays inert until the amount or edges fund a ladder again. */}
      {error ? (
        <Panel className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <PixelText role="body" upper>{error}</PixelText>
        </Panel>
      ) : range ? (
        /* THE RANGE PICTURE. Biggest single element on the screen on purpose:
           a correct screen with empty space reads as unfinished, and this is
           the thing the screen is actually about.

           It takes `flex-1`: `overflow: hidden` on the viewport does not warn,
           and jsdom does no layout, so no test can see a footer pushed off the
           bottom, which leaves a hand-summed budget against 320px as the only
           other defence. That budget is a guess about how a font renders. The
           strip is the one element on the screen whose exact height carries no
           information, so it absorbs the remainder and every other block keeps
           its natural size. The footer cannot be pushed off, because nothing
           is pushing.

           `min-h-0` is load bearing. A flex item defaults to `min-height:
           auto`, which refuses to shrink below its content, and that is
           precisely how a "flexible" row overflows its parent anyway. */
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          {/* The two edge prices, with the strip's colour key between them.
              The key belongs on the same side of the picture as the two
              numbers it colours: without it the strip is a two-tone bar and
              the funding sentence lower down is an unrelated claim; with it
              the picture IS the explanation. */}
          <div className="flex items-center justify-between">
            <PixelText role="micro" className="tabular-nums">
              {price(lowPrice)}
            </PixelText>
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="bg-sunk border-edge inline-block h-2 w-2 border"
              />
              <PixelText role="micro" tone="dim" upper>
                {pool.tokenY.symbol}
              </PixelText>
              <span
                aria-hidden="true"
                className="bg-accent border-edge ml-1 inline-block h-2 w-2 border"
              />
              <PixelText role="micro" tone="dim" upper>
                {pool.tokenX.symbol}
              </PixelText>
            </span>
            <PixelText role="micro" className="tabular-nums">
              {price(highPrice)}
            </PixelText>
          </div>
          {/* No gap between the strip and its marker: the ▲ points at the tile
              directly above it, so any space between them is space the eye has
              to cross to believe they are the same thing.

              The minHeight is the WHOLE block, strip plus marker, not the
              strip. `min-h-0` is what lets a flex child be squeezed below its
              content, which is exactly what this idiom is for; without a floor
              that counts every child, the block is squeezed to the strip's own
              height and the 12px NowMarker is pushed out the bottom, landing on
              top of the caption row below it. */}
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{
              width: STRIP_WIDTH,
              minHeight: STRIP_MIN_HEIGHT + NOW_MARKER_HEIGHT,
            }}
          >
            <RangeStrip plan={range.plan} mid={mid} minHeight={STRIP_MIN_HEIGHT} />
            <NowMarker leftPct={nowLeftPct} />
          </div>
          {/* Step size, level count, and the clamp notice on one flowed row.
              Flowed, not absolute: absolutely positioned labels sharing a
              small box are how "▲ now" ends up sitting on top of the sentence
              under it, and two flex children cannot land on each other. The
              step is a derived percentage, never raw tick spacing.

              Never hide a clamp. The player asked for a wider range than fits
              in one transaction and got a narrower one; that is said in plain
              words, in the same wording the manual editor uses, not silently
              substituted. */}
          <div
            className="flex items-baseline justify-between gap-2"
            style={{ width: STRIP_WIDTH }}
          >
            <PixelText role="micro" tone="dim" className="tabular-nums">
              {pct(range.plan.step * 100, 2)} steps, {range.plan.levels} levels per side
            </PixelText>
            {range.plan.clamped ? (
              <PixelText role="micro" className="text-right">
                wider than one transaction fits, so this is narrower.
              </PixelText>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* YOU WILL HOLD. Mandatory and load bearing: never collapsed. A Panel
          here, not a bare row, so the one sentence a beginner most needs to
          read does not compete for weight with everything above it.

          Two lines, guaranteed, no more: `flex-wrap` on the first line and a
          sentence long enough to wrap on the second are the two known ways
          this panel can clip a real phone in silence (jsdom does no layout, so
          neither one fails a test). `whitespace-nowrap` on line one and a line
          two kept under ~55 characters make both structurally impossible
          rather than merely usually-fine. p-1, not p-2: the panel has to fit
          inside a budget that is already tight. */}
      <Panel className="flex flex-col gap-1 p-1">
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <PixelText role="micro" tone="dim" upper>
            You will hold
          </PixelText>
          <Value amount={quoteAmount} prefix="$" decimals={2} />
          <PixelText role="micro" tone="dim" upper>
            {pool.tokenY.symbol}
          </PixelText>
          <PixelText role="micro" tone="dim">
            +
          </PixelText>
          <Value amount={baseAmount} prefix="$" decimals={2} />
          <PixelText role="micro" tone="dim" upper>
            {pool.tokenX.symbol}
          </PixelText>
        </div>
        {/* The swap cost is labelled an estimate and stays that way until
            there is a real quote path. */}
        <PixelText role="micro" tone="dim" className="whitespace-nowrap">
          {`we swap part of your ${pool.tokenY.symbol} first. swap cost ~${usd(swapCostEstimate)} est.`}
        </PixelText>
      </Panel>

      {/* AUTOPILOT means flip orders re-arm after every fill. It has no fee
          and it does not re-center the range: that stays manual and costs a
          swap, which is what the caption says. The name is a brand token. The
          caption sits on the toggle's own row, because a second row for it
          costs the same 16px as a row of the range picture. */}
      <div
        className={`flex items-center gap-2 p-1 ${focusRow === 'autopilot' ? 'bg-sunk' : ''}`}
      >
        <FocusCursor active={focusRow === 'autopilot'} />
        <Toggle
          on={autopilot}
          label={brand.AUTOPILOT_NAME}
          onChange={onToggleAutopilot}
        />
        <PixelText role="micro" tone="dim">
          re-arms after every fill. re-centering is manual and costs a swap.
        </PixelText>
      </div>

      {/* Footer. Bare text, the same shape as every other screen's key legend:
          bordered boxes would make this one screen's footer look like a
          toolbar, and a control row that changes shape between screens is a
          control row a player has to re-learn each time. They are still
          <button>s, so a mouse and a thumb keep working.

          Button name, then action. The KEY each button answers to is the
          console shell's job, never a screen's. */}
      <div className="grid grid-cols-3 items-center gap-1">
        {/* The one slot on this screen that rewrites itself, and it has to.
            A means CONFIRM everywhere except on the MANUAL chip, where it
            opens the editor, and a key that quietly means two things is how a
            player funds a position they meant to edit. This label is the whole
            licence for that branch in the intent handler. */}
        {focusRow === 'width' && widthCursor === 'manual' ? (
          <FooterButton
            label="A edit range"
            onClick={() => { if (range) setManualOpen(true) }}
          />
        ) : (
          <FooterButton label="A confirm" onClick={() => { if (range) onConfirm() }} />
        )}
        <FooterButton label="B back" align="center" onClick={onBack} />
        {/* "Select manual", not "manual range": the overlay's own heading
            says "Manual range", and the test for "SELECT opens the editor"
            checks that phrase is absent before the press. Two controls
            saying the same two words would make that check meaningless. */}
        <FooterButton
          label="Select manual"
          align="right"
          onClick={() => { if (range) setManualOpen(true) }}
        />
      </div>

      {manualOpen && range && params ? (
        <ManualRangeEditor
          mid={mid}
          params={params}
          amount={amount}
          sigmaDaily={sigmaDaily}
          width={width}
          range={range}
          manualRange={manualRange}
          onApply={(next) => {
            onChangeManualRange(next)
            setManualOpen(false)
          }}
          onCancel={() => setManualOpen(false)}
          onUseSuggestion={() => {
            onChangeManualRange(null)
            setManualOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

/** START walks toward a wider downside, END toward a wider upside. Presets
 * are the offers a beginner reads off ("current price, -10%, -25%"); past
 * either end of the list, LEFT/RIGHT falls back to a 1% nudge the same way the
 * amount row does. */
const START_PRESETS = [-25, -15, -10, -5] as const
const END_PRESETS = [5, 10, 15, 25] as const
const MANUAL_FINE_STEP = 1
/** The planner rejects an edge that reaches or crosses the price (a range has
 * to straddle it, or it is a resting limit order, a different position). These
 * clamps keep both edges strictly on their own side of it, so the editor can
 * never construct an input the planner refuses. */
const START_MIN = -90
const START_MAX = -1
const END_MIN = 1
const END_MAX = 400

type EditRow = 'start' | 'end'
const EDIT_ROWS: ReadonlyArray<EditRow> = ['start', 'end']

/**
 * The manual range editor: behind a toggle, with a start and end price and
 * presets. A full 480x320 overlay rather than more rows on the base screen,
 * because the base screen's own budget is already spent and this needs a
 * picture of its own to be worth building at all.
 *
 * A separate component, mounted only while `manualOpen` is true, so its
 * useConsoleIntent subscription does not exist to fire when the base
 * screen's does. That is the real guarantee behind "A on the overlay can
 * never reach onConfirm", not just the early-return in SetRange's handler.
 */
function ManualRangeEditor({
  mid,
  params,
  amount,
  sigmaDaily,
  width,
  range,
  manualRange,
  onApply,
  onCancel,
  onUseSuggestion,
}: {
  mid: number
  params: MarketParams
  amount: number
  sigmaDaily: number
  width: RangeWidth
  range: PlannedRange<Ladder>
  manualRange: ManualRange | null
  onApply: (next: ManualRange) => void
  onCancel: () => void
  onUseSuggestion: () => void
}) {
  // Seeded once, at mount, from whatever the player was already looking at:
  // the manual range itself if one exists, or the ACHIEVED edges of the
  // WIDE/TIGHT plan otherwise (not the requested width, which the ladder cap
  // may have clamped away from). Pick wide or tight, the price range appears,
  // and then that is editable again by the player: an editor that opened
  // anywhere else would be a second, competing control rather than an edit on
  // top of the first one.
  const [start, setStart] = useState(() =>
    manualRange
      ? manualRange.lowerPct
      : clamp(Math.round((range.plan.low / mid - 1) * 100), START_MIN, START_MAX),
  )
  const [end, setEnd] = useState(() =>
    manualRange
      ? manualRange.upperPct
      : clamp(Math.round((range.plan.high / mid - 1) * 100), END_MIN, END_MAX),
  )
  const [editRow, setEditRow] = useState<EditRow>('start')

  // planForOffsets, the same function S6 and S7 both call through
  // planForSession, so the plan drawn here previews exactly what APPLY would
  // fund. A planner failure shows player copy and blocks APPLY, rather than
  // throwing inside render, which would be a white screen on stage.
  const { preview, error } = useMemo(() => {
    try {
      return {
        preview: planForOffsets(
          mid,
          { lowerPct: start, upperPct: end },
          ladderPlanner,
          { budgetQuote: amount, sigmaDaily, params },
          width,
        ),
        error: null,
      }
    } catch (failure) {
      if (!(failure instanceof LadderError)) throw failure
      return { preview: null, error: ladderErrorCopy(failure) }
    }
  }, [mid, start, end, amount, sigmaDaily, params, width])

  useConsoleIntent((intent) => {
    if (intent === 'B') {
      onCancel()
      return
    }
    if (intent === 'A') {
      if (preview) onApply({ lowerPct: start, upperPct: end })
      return
    }
    if (intent === 'SELECT') {
      onUseSuggestion()
      return
    }
    if (intent === 'UP' || intent === 'DOWN') {
      const idx = EDIT_ROWS.indexOf(editRow)
      const nextIdx = idx + (intent === 'UP' ? -1 : 1)
      if (nextIdx >= 0 && nextIdx < EDIT_ROWS.length) {
        setEditRow(EDIT_ROWS[nextIdx])
      }
      return
    }
    if (intent === 'LEFT' || intent === 'RIGHT') {
      const direction = intent === 'LEFT' ? -1 : 1
      if (editRow === 'start') {
        setStart((s) =>
          stepPreset(
            s,
            direction,
            START_PRESETS,
            MANUAL_FINE_STEP,
            START_MIN,
            START_MAX,
          ),
        )
      } else {
        setEnd((s) =>
          stepPreset(
            s,
            direction,
            END_PRESETS,
            MANUAL_FINE_STEP,
            END_MIN,
            END_MAX,
          ),
        )
      }
    }
  })

  const lowPrice = preview?.plan.low ?? mid * (1 + start / 100)
  const highPrice = preview?.plan.high ?? mid * (1 + end / 100)

  return (
    <div className="bg-screen absolute inset-0 flex flex-col gap-1 p-2">
      <PixelText role="body" upper>
        Manual range FIXTURE
      </PixelText>

      <EditRowLine
        label="Start"
        pctValue={start}
        priceLabel={price(lowPrice)}
        active={editRow === 'start'}
      />
      <EditRowLine
        label="End"
        pctValue={end}
        priceLabel={price(highPrice)}
        active={editRow === 'end'}
      />

      {error ? (
        <Panel className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <PixelText role="body" upper>{error}</PixelText>
        </Panel>
      ) : preview ? (
        /* The same picture the base screen shows, so moving an edge here is
           seen, not just read as two changing numbers. That correspondence is
           the entire point of this screen. The "now" marker is part of it:
           without it, this strip cannot say where the price actually is
           relative to the edges being moved. */
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ width: STRIP_WIDTH }}
          >
            <RangeStrip
              plan={preview.plan}
              mid={mid}
              minHeight={OVERLAY_STRIP_MIN_HEIGHT}
            />
            <NowMarker
              leftPct={((mid - lowPrice) / (highPrice - lowPrice)) * 100}
            />
          </div>
          <div style={{ width: STRIP_WIDTH }}>
            <PixelText role="micro" tone="dim" className="tabular-nums">
              {preview.plan.clamped
                ? 'wider than one transaction fits, so this is narrower.'
                : `${pct(preview.plan.step * 100, 2)} steps, ${preview.plan.levels} levels per side`}
            </PixelText>
          </div>
        </div>
      ) : null}

      {/* Same three-slot footer as the base screen, same bare-text shape, and
          each slot names its button. A fourth child in this grid would wrap
          to a second row underneath the other three, which reads as a broken
          toolbar. */}
      <div className="grid grid-cols-3 items-center gap-1">
        <FooterButton
          label="A apply"
          onClick={() => { if (preview) onApply({ lowerPct: start, upperPct: end }) }}
        />
        <FooterButton label="B cancel" align="center" onClick={onCancel} />
        <FooterButton
          label="Select use suggestion"
          align="right"
          onClick={onUseSuggestion}
        />
      </div>
    </div>
  )
}

/** One editable edge: a percent offset plus the price it lands on. Two of
 * these are the whole editor body, which is why this is a component rather
 * than JSX repeated twice with the label swapped. */
function EditRowLine({
  label,
  pctValue,
  priceLabel,
  active,
}: {
  label: string
  pctValue: number
  priceLabel: string
  active: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 p-1 ${active ? 'bg-sunk' : ''}`}>
      <div className="flex items-center gap-1">
        <FocusCursor active={active} />
        <PixelText role="micro" tone="dim" upper>
          {label}
        </PixelText>
        <PixelText role="micro" tone="dim" className="ml-auto tabular-nums">
          {pctValue > 0 ? `+${pct(pctValue, 0)}` : pct(pctValue, 0)}
        </PixelText>
      </div>
      <PixelText role="value" className="tabular-nums">
        {priceLabel}
      </PixelText>
    </div>
  )
}

/**
 * The "you are here" marker under a range strip.
 *
 * It gets a row of its own. Sharing a short box with other labels, all
 * absolutely positioned with `top` left to the static position, renders the
 * marker a line below where it was meant to be: on top of the sentence
 * underneath. One absolutely positioned child, `top-0` stated rather than
 * inferred, and nothing else in the box, has no line to be pushed onto. The
 * child is a flex box exactly as tall as the block, so the text sits inside
 * the block instead of hanging out of it.
 *
 * `leftPct` is read off the plan, never hardcoded to 50%, so an asymmetric
 * manual range does not draw "now" in the wrong place.
 */
function NowMarker({ leftPct }: { leftPct: number }) {
  return (
    <div className="relative h-3 shrink-0" style={{ width: STRIP_WIDTH }}>
      <span
        className="absolute top-0 flex h-3 -translate-x-1/2 items-center"
        style={{ left: `${leftPct}%` }}
      >
        <PixelText role="micro" tone="dim">
          ▲ now
        </PixelText>
      </span>
    </div>
  )
}

/**
 * A footer control.
 *
 * Bare text on purpose, so this screen's footer is the same shape as every
 * other screen's key legend. It is a real `<button>` underneath because a
 * phone has no A button, and `pressable` is the same 1px-down affordance the
 * console's other controls use, so it still answers a thumb. What it must not
 * do is grow a border and read as a toolbar.
 */
function FooterButton({
  label,
  align = 'left',
  onClick,
}: {
  label: string
  align?: 'left' | 'center' | 'right'
  onClick: () => void
}) {
  const justify =
    align === 'center'
      ? 'justify-self-center'
      : align === 'right'
        ? 'justify-self-end'
        : 'justify-self-start'

  return (
    <button type="button" onClick={onClick} className={`pressable ${justify}`}>
      <PixelText role="micro" upper>
        {label}
      </PixelText>
    </button>
  )
}

/**
 * The row focus indicator.
 *
 * A left-edge fill, not a ring: a ring on a small shape reads as "a slightly
 * fatter shape," not as a cursor. A block that is either fully there or fully
 * gone reads as a cursor from a phone held at arm's length, which a 2px
 * outline does not.
 *
 * h-3, matching the 12px line box of the micro label it sits beside. Any
 * taller and it would be the tallest thing in that row and set the row's
 * height, costing every label row on this screen pixels it does not have.
 *
 * It renders NOTHING when inactive rather than a transparent block holding
 * its place. Reserving the space would leave all three section labels sitting
 * 8px in from the left edge of their own block permanently, which reads as an
 * indent nobody chose. Now the labels are flush left and the focused row
 * steps forward by exactly the width of the cursor that arrived. The movement
 * IS the second focus signal, alongside the `bg-sunk` fill.
 */
function FocusCursor({ active }: { active: boolean }) {
  if (!active) return null
  return <span aria-hidden="true" className="bg-ink h-3 w-1 shrink-0" />
}

/**
 * A horizontal preset chip.
 *
 * Three fills, because a chip has to answer two independent questions:
 *
 *   `selected`  APPLIED. The accent fill. This is the range being funded.
 *   `cursor`    FOCUSED. The ink fill. This is where the arrow keys are.
 *
 * On WIDE and TIGHT the two coincide, because landing on either applies it.
 * MANUAL is where they come apart: walking onto it has to look like something
 * before any edge has been edited, and `manualRange !== null` is still null at
 * that moment. Applied wins when both are true, since the row's own `bg-sunk`
 * already says which row the cursor is on.
 *
 * Selection is the same solid accent fill Row uses in ui/select.tsx; this is
 * not that component because Row is a list item (role="option", full width,
 * vertical stack) and a chip is none of those.
 */
function Chip({
  label,
  selected,
  cursor = false,
  disabled = false,
  onSelect,
}: {
  label: string
  selected: boolean
  cursor?: boolean
  disabled?: boolean
  onSelect?: () => void
}) {
  const fill = disabled
    ? 'bg-sunk'
    : selected
      ? 'bg-accent'
      : cursor
        ? 'bg-ink'
        : 'bg-panel'
  const tone = disabled ? 'dim' : selected || cursor ? 'invert' : 'ink'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable border-edge border px-2 py-1 ${fill} disabled:opacity-50`}
    >
      <PixelText role="micro" tone={tone} upper>
        {label}
      </PixelText>
    </button>
  )
}

/**
 * The range picture's ladder strip.
 *
 * ui/data.tsx's status palette has no notion of "this level holds only the
 * quote token" versus "this level holds only the base token." That asymmetry
 * (levels BELOW the current price hold the quote token, levels ABOVE hold the
 * base token) is the entire reason this screen shows a funding preview, so
 * reusing a palette that cannot say which token a level holds would draw a
 * picture that disagrees with the sentence under it. A small local strip, two
 * tones plus one active tile, says it correctly.
 */
function RangeStrip({
  plan,
  mid,
  minHeight,
}: {
  plan: RangePlan
  mid: number
  minHeight: number
}) {
  const tiles: Array<'quote' | 'base' | 'active'> = []
  const activeIndex = Math.round(((mid - plan.low) / (plan.high - plan.low)) * plan.levels * 2)
  for (let index = 0; index <= plan.levels * 2; index += 1) {
    const levelPrice = plan.low + ((plan.high - plan.low) * index) / (plan.levels * 2)
    tiles.push(index === activeIndex ? 'active' : levelPrice < mid ? 'quote' : 'base')
  }

  const TILE_CLASS: Record<(typeof tiles)[number], string> = {
    quote: 'bg-sunk',
    base: 'bg-accent',
    active: 'bg-ink',
  }

  return (
    <div
      className="border-edge bg-screen flex min-h-0 flex-1 items-stretch gap-px border p-1"
      style={{ minHeight }}
      role="img"
      aria-label={`Range from ${plan.low} to ${plan.high}, ${plan.levels} levels per side of the current price`}
    >
      {tiles.map((tone, i) => (
        <span key={i} className={`flex-1 ${TILE_CLASS[tone]}`} />
      ))}
    </div>
  )
}
