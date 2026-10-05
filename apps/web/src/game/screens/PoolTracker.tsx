import { useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { characters } from '../../config/brand'
import { GATE_COPY, UNVERIFIED_COPY } from '../../lib/scoring/gates'
import { ageInDays, compactUsd } from '../../lib/format'
import { FIXTURE_NOW } from '../fixtures'
import { nextPin, panFor, riskBand, scoreToPosition } from '../map'
import { BAND_FILL, WorldMap } from '../WorldMap'
import { MapPin, PIN_SIZE, PIN_SIZE_SELECTED } from '../MapPin'
import { Meter, Panel, PixelText, Sprite } from '../../ui'
import { fallback } from '../../lib/envelope'
import { useSession } from '../../state/session'
import type { ReactNode } from 'react'
import type { CharacterId } from '../../config/brand'
import type { ScoredPool } from '../fixtures'
import type { CursorDirection } from '../map'
import type { GateSet } from '../../types/domain'

export interface PoolTrackerProps {
  
  pools: Array<ScoredPool>
  
  characterId: CharacterId
  
  gates: GateSet
  onPlayPool: (pairAddress: string) => void
  onBack: () => void
}

const PLOT_HEIGHT = 200
const RADAR_SIZE = 32

const ZOOM_LEVELS = [1, 2, 3] as const

function bucket(score: number, low: string, mid: string, high: string): string {
  if (score >= 75) return high
  if (score >= 40) return mid
  return low
}

const poolBookThin = (entry: ScoredPool): boolean =>
  entry.book.bid === null || entry.book.ask === null

const isPlayable = ({ network }: ScoredPool): boolean => network === 'testnet'

const FIXTURE_SOURCE = fallback(
  'Development market fixtures',
  FIXTURE_NOW * 1000,
  'Not live. Snapshot 2026-10-05.',
)

const ASSUMED_FEE_RATE = 0.003

function feeIncomePct(pool: ScoredPool['pool']): number | null {
  if (pool.volume24hUsd === null) return null
  if (pool.tvlUsd <= 0) return 0
  return (pool.volume24hUsd / pool.tvlUsd) * ASSUMED_FEE_RATE * 365 * 100
}

const QUOTES: Record<CharacterId, string> = {
  molandak: 'deep, old, boring. boring is good.',
  moyaki: 'it moves. so do I. we get along.',
  mouch: 'if it is not shaking, why bother.',
}

const DIRECTIONS: ReadonlySet<CursorDirection> = new Set([
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
])

export function PoolTracker({
  pools,
  characterId,
  gates,
  onPlayPool,
  onBack,
}: PoolTrackerProps) {
  const choosePool = useSession((session) => session.choosePool)
  const [view, setView] = useState<'map' | 'inspect'>('map')
  const [cursorIndex, setCursorIndex] = useState(0)
  const [zoomStep, setZoomStep] = useState(0)
  const zoom = ZOOM_LEVELS[zoomStep]

  const character = characters[characterId]
  const passing = pools.filter((p) => p.passes)
  const selected = pools[cursorIndex]

  useConsoleIntent((intent) => {

    if (passing.length === 0) {
      if (intent === 'B') onBack()
      return
    }

    if (view === 'inspect') {
      if (intent === 'B') {
        setView('map')
        return
      }
      if (intent === 'A' && selected.passes && isPlayable(selected) && !poolBookThin(selected)) {
        choosePool(selected.pool.pairAddress)
        onPlayPool(selected.pool.pairAddress)
      }
      return
    }

    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'A') {
      setView('inspect')
      return
    }

    if (intent === 'SELECT') {
      setZoomStep((step) => (step + 1) % ZOOM_LEVELS.length)
      return
    }
    if (DIRECTIONS.has(intent as CursorDirection)) {
      setCursorIndex((current) =>
        nextPin(
          pools.map((p) => p.score),
          current,
          intent as CursorDirection,
        ),
      )
    }
  })

  if (passing.length === 0) {
    return (
      <div className="bg-screen flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <Panel className="flex flex-col gap-2">
          <PixelText role="title" upper>
            Nothing passed
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            FIXTURE · {FIXTURE_SOURCE.freshness} · {FIXTURE_SOURCE.note}
          </PixelText>
          <PixelText role="body">
            {character.label}&apos;s filter removed every pool at this
            difficulty. Try an easier tier.
          </PixelText>
        </Panel>
        <PixelText role="micro" tone="dim" upper>
          B back
        </PixelText>
      </div>
    )
  }

  return (
    <div className="bg-screen flex h-full w-full flex-col gap-1 p-2">
      
      <div className="grid grid-cols-3 items-baseline">
        <div className="flex items-baseline gap-1">
          <PixelText role="body" upper>
            Pool tracker
          </PixelText>
          
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>
        <PixelText role="micro" tone="dim" className="text-center" upper>
          {character.label} · {character.tier}
        </PixelText>
        <PixelText role="micro" upper className="text-right tabular-nums">
          {passing.length} passed
        </PixelText>
      </div>
      <PixelText role="micro" tone="dim" upper>
        FIXTURE source · {FIXTURE_SOURCE.freshness} · {FIXTURE_SOURCE.note}
      </PixelText>

      {view === 'inspect' ? (
        <InspectPanel
          entry={selected}
          quote={QUOTES[characterId]}
          quoteSpeaker={character.label}
          characterId={characterId}
        />
      ) : (
        <MapView
          pools={pools}
          cursorIndex={cursorIndex}
          characterLabel={character.label}
          gates={gates}
          zoom={zoom}
          onZoom={(delta) =>
            setZoomStep((step) =>
              Math.max(0, Math.min(ZOOM_LEVELS.length - 1, step + delta)),
            )
          }
        />
      )}
    </div>
  )
}

function MapView({
  pools,
  cursorIndex,
  characterLabel,
  gates,
  zoom,
  onZoom,
}: {
  pools: Array<ScoredPool>
  cursorIndex: number
  characterLabel: string
  gates: GateSet
  zoom: number
  onZoom: (delta: number) => void
}) {
  const cursor = scoreToPosition(pools[cursorIndex].score)

  const panX = panFor(cursor.leftPct, zoom)
  const panY = panFor(cursor.topPct, zoom)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex gap-1">
        
        <div className="flex w-4 shrink-0 flex-col items-center justify-center">
          {['H', 'E', 'A', 'T'].map((letter) => (
            <PixelText key={letter} role="micro" tone="dim">
              {letter}
            </PixelText>
          ))}
        </div>

        <div
          className="border-edge relative flex-1 overflow-hidden border"
          style={{ height: PLOT_HEIGHT }}
        >
          
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${zoom}) translate(${panX}%, ${panY}%)`,
              transformOrigin: '0 0',
            }}
          >
            <WorldMap minSafety={gates.minSafety} maxHeat={gates.maxHeat} />

            {pools.map((entry, index) => {
              const { leftPct, topPct } = scoreToPosition(entry.score)
              const selected = index === cursorIndex
              return (
                <div
                  key={entry.pool.pairAddress}
                  className="absolute"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,

                    transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                  }}
                >
                  <MapPin
                    band={riskBand(entry.score.safety)}
                    filtered={!entry.passes}
                    selected={selected}
                    size={selected ? PIN_SIZE_SELECTED : PIN_SIZE}
                  />
                  
                  {selected ? (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 whitespace-nowrap">
                      <PixelText role="micro" upper>
                        {entry.pool.tokenX.symbol}
                      </PixelText>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-end justify-between p-1">
            <PixelText role="micro" tone="dim" upper>
              Deep water
            </PixelText>
            <PixelText role="micro" tone="dim" upper>
              Safe harbour
            </PixelText>
          </div>

          <Minimap pools={pools} cursorIndex={cursorIndex} zoom={zoom} />
        </div>
      </div>

      <div className="flex items-center justify-between pl-5">
        <PixelText role="micro" tone="dim" upper>
          Safety, increasing right. Heat, increasing up.
        </PixelText>
        
        <div className="flex items-center gap-1">
          <ZoomButton
            label="-"
            title="Zoom out"
            disabled={zoom === ZOOM_LEVELS[0]}
            onClick={() => onZoom(-1)}
          />
          <PixelText
            role="micro"
            upper
            className="w-6 text-center tabular-nums"
          >
            {zoom}x
          </PixelText>
          <ZoomButton
            label="+"
            title="Zoom in"
            disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            onClick={() => onZoom(1)}
          />
          <PixelText role="micro" tone="dim" upper>
            Select
          </PixelText>
        </div>
      </div>

      <div className="flex items-center gap-3 pl-5">
        {(
          [
            { band: 'green', label: 'Safe' },
            { band: 'amber', label: 'Risky' },
            { band: 'red', label: 'Very risky' },
          ] as const
        ).map((item) => (
          <div key={item.band} className="flex items-center gap-1">
            <MapPin band={item.band} size={10} />
            <PixelText role="micro" tone="dim" upper>
              {item.label}
            </PixelText>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <MapPin band="green" size={10} filtered />
          <PixelText role="micro" tone="dim" upper>
            {characterLabel} skipped
          </PixelText>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <PixelText role="micro" upper>
          Move cursor
        </PixelText>
        <PixelText role="micro" upper>
          A Inspect
        </PixelText>
        <PixelText role="micro" upper>
          B Back
        </PixelText>
      </div>
    </div>
  )
}

function ZoomButton({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string
  title: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="pressable border-edge bg-panel text-ink disabled:text-ink-dim flex h-4 w-4 items-center justify-center border font-bold leading-none disabled:opacity-40"
    >
      {label}
    </button>
  )
}

function Minimap({
  pools,
  cursorIndex,
  zoom,
}: {
  pools: Array<ScoredPool>
  cursorIndex: number
  zoom: number
}) {
  const cursor = scoreToPosition(pools[cursorIndex].score)
  const windowPct = 100 / zoom

  return (
    <div
      className="border-edge bg-screen absolute bottom-1 left-1 overflow-hidden border"
      style={{ width: RADAR_SIZE, height: RADAR_SIZE }}
      aria-hidden="true"
    >
      <span
        className="radar-sweep-hand bg-accent absolute top-1/2 left-1/2 h-px w-1/2 origin-left opacity-50"
        style={{ transform: 'translateY(-50%)' }}
      />
      {pools.map((entry) => {
        const { leftPct, topPct } = scoreToPosition(entry.score)
        return (
          <span
            key={entry.pool.pairAddress}
            className="absolute"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: 2,
              height: 2,
              transform: 'translate(-50%, -50%)',
              background: BAND_FILL[riskBand(entry.score.safety)],
            }}
          />
        )
      })}
      {zoom > 1 ? (
        <span
          className="border-ink absolute border"
          style={{
            left: `${-panFor(cursor.leftPct, zoom)}%`,
            top: `${-panFor(cursor.topPct, zoom)}%`,
            width: `${windowPct}%`,
            height: `${windowPct}%`,
          }}
        />
      ) : null}
    </div>
  )
}

function InspectPanel({
  entry,
  quote,
  quoteSpeaker,
  characterId,
}: {
  entry: ScoredPool
  quote: string
  quoteSpeaker: string
  characterId: CharacterId
}) {
  const { pool, score, gates, passes } = entry

  const ageSeconds = Math.max(0, FIXTURE_NOW - pool.createdAt)
  const ageIsExact = pool.createdAtIsExact
  const feeIncome = feeIncomePct(pool)

  const dense = gates.failures.length > 2
  const veryDense = gates.failures.length > 4
  const pad = veryDense ? 'py-0.5' : dense ? 'py-1' : 'py-2'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      
      <div
        className={`border-edge flex items-center justify-between border-b ${dense ? 'pb-1' : 'pb-2'}`}
      >
        <div className="flex items-center gap-2">
          <MapPin band={riskBand(score.safety)} filtered={!passes} />
          <PixelText role="title" upper>
            {pool.tokenX.symbol} / {pool.tokenY.symbol}
          </PixelText>
        </div>
        
        <PixelText role="body" tone="dim" upper>
          {poolBookThin(entry) ? 'Thin book' : 'Book ready'}
          {' · '}{isPlayable(entry) ? 'PLAYABLE (TESTNET)' : 'MAINNET ONLY'}
        </PixelText>
      </div>

      <div className={`border-edge flex flex-col gap-1 border-b ${pad}`}>
        <Fact label="Liquidity" value={compactUsd(pool.tvlUsd)}>
          <div className="w-16">
            <Meter value={score.liquidityDepth} segments={10} />
          </div>
          <PixelText role="micro" tone="dim">
            {bucket(score.liquidityDepth, 'thin', 'adequate', 'deep')}
          </PixelText>
        </Fact>

        <Fact
          label="24h volume"
          value={
            pool.volume24hUsd === null
              ? 'not read'
              : compactUsd(pool.volume24hUsd)
          }
        />

        <Fact
          label="Fee income"
          value={
            feeIncome === null ? 'not read' : `${feeIncome.toFixed(1)}% / yr`
          }
        >
          
          <PixelText role="micro" tone="dim">
            {feeIncome === null
              ? 'needs 24h volume, which this rpc will not serve'
              : 'estimate, not a promise'}
          </PixelText>
        </Fact>

        <Fact
          label="Age"
          value={
            ageIsExact ? ageInDays(ageSeconds) : `over ${ageInDays(ageSeconds)}`
          }
        >
          <div className="w-16">
            <Meter value={score.poolAge} segments={10} />
          </div>
          <PixelText role="micro" tone="dim">
            {bucket(score.poolAge, 'new', 'settling in', 'established')}
          </PixelText>
        </Fact>
      </div>

      <div className={`border-edge flex flex-col gap-1 border-b ${pad}`}>
        <div className="flex items-baseline justify-between gap-2">
          <PixelText role="body" upper>
            Safety {score.safety}
          </PixelText>
          <PixelText role="micro" tone="dim" className="tabular-nums">
            depth {score.liquidityDepth} · age {score.poolAge} · pair{' '}
            {score.quoteQuality} · spread {score.lpConcentrationScore}
          </PixelText>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <PixelText role="body" upper>
            Heat {score.heat}
          </PixelText>
          <PixelText role="micro" tone="dim" className="tabular-nums">
            swing {score.realizedVol} · trade {score.turnover} · buzz{' '}
            {score.momentum}
            {score.momentumDegraded ? ' (offline)' : ''}
          </PixelText>
        </div>
      </div>

      <div className="min-h-0 flex-1 py-1">
        {!passes ? (

          <div
            className={`border-edge bg-sunk flex h-full flex-col overflow-hidden border ${
              veryDense ? 'gap-0 p-0.5' : 'gap-1 p-1'
            }`}
          >
            {gates.failures.map((failure) => (
              <PixelText key={failure} role="micro" tone="loss">
                {GATE_COPY[failure]}
              </PixelText>
            ))}
          </div>
        ) : null}
        {gates.unverified.map((check) => (
          <PixelText key={check} role="micro" tone="dim">
            {UNVERIFIED_COPY[check]}
          </PixelText>
        ))}
      </div>

      <div className="flex items-end justify-between gap-2 pt-1">
        <PixelText role="micro" className="flex-1">
          &quot;{quote}&quot; - {quoteSpeaker}
        </PixelText>
        <Sprite character={characterId} animation="idle" size={32} />
      </div>

      <div className="flex items-center justify-between">
        
        <PixelText role="micro" tone={passes ? 'ink' : 'dim'} upper>
          {!passes
            ? 'Locked by the checks above'
            : !isPlayable(entry)
              ? 'MAINNET ONLY'
              : poolBookThin(entry)
                ? 'Thin book · cannot play'
                : 'A Play this pool'}
        </PixelText>
        <PixelText role="micro" upper>
          B Back to map
        </PixelText>
      </div>
    </div>
  )
}

function Fact({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <PixelText role="micro" tone="dim" upper className="w-20 shrink-0">
        {label}
      </PixelText>
      <PixelText role="body" className="w-16 shrink-0 tabular-nums">
        {value}
      </PixelText>
      {children}
    </div>
  )
}
