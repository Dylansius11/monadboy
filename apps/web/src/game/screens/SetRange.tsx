import { useMemo, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand } from '../../config/brand'
import { LadderError, mainnetMarkets } from '@monadboy/sdk'
import { ladderPlanner } from '../../lib/range/ladder-planner'
import { FIXTURE_MARKETS } from '../fixtures'
import { planForOffsets, planForSession } from '../../lib/range/plan'
import { FALLBACK_REALIZED_VOL } from '../sim'
import { pct, price, usd } from '../../lib/format'
import { Panel, PixelText, Toggle, Value } from '../../ui'
import type { PlannedRange, RangePlan } from '../../lib/range/plan'
import type { MarketParams } from '@monadboy/sdk'
import type { ManualRange, RangeWidth } from '../../state/session'
import type { Pool } from '../../types/domain'

const PRESETS = [10, 25, 50, 75, 100] as const

const FINE_STEP = 5

const AUTOPILOT_FEE_PCT = 10

const SWAP_FEE_ESTIMATE_PCT = 0.3

const STRIP_WIDTH = 464

const STRIP_MIN_HEIGHT = 56

const NOW_MARKER_HEIGHT = 12
const OVERLAY_STRIP_MIN_HEIGHT = 64

type FocusRow = 'amount' | 'width' | 'autopilot'
const ROWS: ReadonlyArray<FocusRow> = ['amount', 'width', 'autopilot']

type WidthSlot = RangeWidth | 'manual'
const WIDTH_SLOTS: ReadonlyArray<WidthSlot> = ['wide', 'tight', 'manual']

export interface SetRangeProps {
  
  pool: Pool | undefined
  balance: number
  amount: number
  width: RangeWidth
  
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

function stepPreset(
  current: number,
  direction: 1 | -1,
  presets: ReadonlyArray<number>,
  fineStep: number,
  min: number,
  max: number,
): number {
  const idx = presets.indexOf(current)

  const next = idx + direction
  if (idx !== -1 && next >= 0 && next < presets.length) {
    return clamp(presets[next], min, max)
  }
  return clamp(current + direction * fineStep, min, max)
}

function stepAmount(
  current: number,
  direction: 1 | -1,
  balance: number,
): number {
  return stepPreset(current, direction, PRESETS, FINE_STEP, 0, balance)
}

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
  
  const [widthCursor, setWidthCursor] = useState<WidthSlot>(() =>
    manualRange ? 'manual' : width,
  )

  const fixture = FIXTURE_MARKETS.find((entry) => entry.pool.pairAddress === pool?.pairAddress)
  const mid = fixture?.book.bid != null && fixture.book.ask != null
    ? (fixture.book.bid + fixture.book.ask) / 2 : 0
  // Fixture identities are synthetic; the symbol pair selects real market rules.
  const params = mainnetMarkets.find((market) =>
    market.baseSymbol === pool?.tokenX.symbol && market.quoteSymbol === pool.tokenY.symbol,
  )?.params
  const sigmaDaily = pool?.realizedVol24h ?? FALLBACK_REALIZED_VOL
  const { range, error } = useMemo(() => {
    if (!pool) return { range: null, error: null }
    if (!params) return { range: null, error: 'MARKET_PARAMS_UNAVAILABLE' }
    try {
      return { range: planForSession(mid, width, manualRange, ladderPlanner,
        { budgetQuote: amount, sigmaDaily, params }), error: null }
    } catch (failure) {
      if (!(failure instanceof LadderError)) throw failure
      return { range: null, error: failure.message }
    }
  }, [pool, mid, width, manualRange, amount, sigmaDaily, params])

  useConsoleIntent((intent) => {

    if (manualOpen) return

    if (!pool) {
      if (intent === 'B') onBack()
      return
    }

    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'A') {

      if (range && focusRow === 'width' && widthCursor === 'manual') {
        setManualOpen(true)
        return
      }
      if (range) onConfirm()
      return
    }
    if (intent === 'SELECT') {

      if (range) setManualOpen(true)
      return
    }

    if (intent === 'UP' || intent === 'DOWN') {
      const idx = ROWS.indexOf(focusRow)
      const nextIdx = idx + (intent === 'UP' ? -1 : 1)

      if (nextIdx >= 0 && nextIdx < ROWS.length) setFocusRow(ROWS[nextIdx])
      return
    }

    if (intent === 'LEFT' || intent === 'RIGHT') {
      const direction = intent === 'LEFT' ? -1 : 1
      if (focusRow === 'amount') {
        onChangeAmount(stepAmount(amount, direction, balance))
        return
      }
      if (focusRow === 'width') {
        const idx = WIDTH_SLOTS.indexOf(widthCursor)
        const nextIdx = idx + direction
        
        if (nextIdx < 0 || nextIdx >= WIDTH_SLOTS.length) return
        const next = WIDTH_SLOTS[nextIdx]
        setWidthCursor(next)

        if (next !== 'manual') onChangeWidth(next)
        return
      }
      onToggleAutopilot(!autopilot)
    }
  })

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
  const nowLeftPct = range ? ((mid - lowPrice) / (highPrice - lowPrice)) * 100 : 50
  // Equal quote budget on each side of the ladder; quantities are value estimates.
  const quoteAmount = amount / 2
  const baseAmount = amount / 2
  const swapCostEstimate = baseAmount * (SWAP_FEE_ESTIMATE_PCT / 100)
  const vol = sigmaDaily

  return (
    <div className="bg-screen relative flex h-full w-full flex-col gap-1 p-2">
      
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <PixelText role="body" upper>
            Set your range
          </PixelText>
          
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>
        <PixelText role="body" upper>
          {pool.tokenX.symbol} / {pool.tokenY.symbol}
        </PixelText>
      </div>

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
          
          <div className="flex items-baseline gap-1">
            {PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={String(preset)}
                selected={amount === preset}

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
          
          <div className="flex flex-col">
            <div className="flex gap-1">
              {WIDTH_SLOTS.map((slot) => (
                <Chip
                  key={slot}
                  label={slot}

                  selected={
                    slot === 'manual'
                      ? manualRange !== null
                      : width === slot && !manualRange
                  }

                  cursor={focusRow === 'width' && widthCursor === slot}
                  onSelect={() => {
                    setWidthCursor(slot)
                    setFocusRow('width')
                    if (slot === 'manual') { if (range) setManualOpen(true) }
                    else onChangeWidth(slot)
                  }}
                />
              ))}
            </div>
            
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

      {error ? (
        <Panel className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <PixelText role="body" upper>{error}</PixelText>
        </Panel>
      ) : range ? (
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        
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
        
        <div
          className="flex items-baseline justify-between gap-2"
          style={{ width: STRIP_WIDTH }}
        >
          <PixelText role="micro" tone="dim" className="tabular-nums">
            {pct(range.plan.step * 100, 2)} steps, {range.plan.levels} levels per side
          </PixelText>
        </div>
      </div>

      ) : null}

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
        
        <PixelText role="micro" tone="dim" className="whitespace-nowrap">
          {`we swap part of your ${pool.tokenY.symbol} first. swap cost ~${usd(swapCostEstimate)} est.`}
        </PixelText>
      </Panel>

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
          {`keeps you in range. fee: ${pct(AUTOPILOT_FEE_PCT, 0)} of earnings.`}
        </PixelText>
      </div>

      <div className="grid grid-cols-3 items-center gap-1">
        
        {focusRow === 'width' && widthCursor === 'manual' ? (
          <FooterButton
            label="A edit range"
            onClick={() => { if (range) setManualOpen(true) }}
          />
        ) : (
          <FooterButton label="A confirm" onClick={() => { if (range) onConfirm() }} />
        )}
        <FooterButton label="B back" align="center" onClick={onBack} />
        
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

const START_PRESETS = [-25, -15, -10, -5] as const
const END_PRESETS = [5, 10, 15, 25] as const
const MANUAL_FINE_STEP = 1

const START_MIN = -90
const START_MAX = -1
const END_MIN = 1
const END_MAX = 400

type EditRow = 'start' | 'end'
const EDIT_ROWS: ReadonlyArray<EditRow> = ['start', 'end']

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
  range: PlannedRange
  manualRange: ManualRange | null
  onApply: (next: ManualRange) => void
  onCancel: () => void
  onUseSuggestion: () => void
}) {

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

  const { preview, error } = useMemo(() => {
    try {
      return { preview: planForOffsets(mid, { lowerPct: start, upperPct: end },
        ladderPlanner, { budgetQuote: amount, sigmaDaily, params }, width), error: null }
    } catch (failure) {
      if (!(failure instanceof LadderError)) throw failure
      return { preview: null, error: failure.message }
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

      {error ? <Panel className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        <PixelText role="body" upper>{error}</PixelText>
      </Panel> : preview ? (
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
            leftPct={
              ((mid - lowPrice) / (highPrice - lowPrice)) * 100
            }
          />
        </div>
        <div style={{ width: STRIP_WIDTH }}>
          <PixelText role="micro" tone="dim" className="tabular-nums">
            {pct(preview.plan.step * 100, 2)} steps, {preview.plan.levels} levels per side
          </PixelText>
        </div>
      </div>

      ) : null}

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

function NowMarker({ leftPct }: { leftPct: number }) {
  return (
    <div className="relative h-3 shrink-0" style={{ width: STRIP_WIDTH }}>
      <span
        className="absolute top-0 -translate-x-1/2"
        style={{ left: `${leftPct}%` }}
      >
        <PixelText role="micro" tone="dim">
          ▲ now
        </PixelText>
      </span>
    </div>
  )
}

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

function FocusCursor({ active }: { active: boolean }) {
  if (!active) return null
  return <span aria-hidden="true" className="bg-ink h-3 w-1 shrink-0" />
}

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
