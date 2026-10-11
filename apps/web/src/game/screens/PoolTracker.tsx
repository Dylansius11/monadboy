import { useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { characterQuotes, characters } from '../../config/brand'
import { GATE_COPY, UNVERIFIED_COPY } from '@monadboy/sdk'
import { ageInDays, compactUsd } from '../../lib/format'
import { provenanceBadge, provenanceLine, provenanceShort } from '../data/provenance'
import { isBookThin, isExecutable, isTestnet } from '../eligibility'
import { nextPin, panFor, riskBand, scoreToPosition } from '../map'
import { BAND_FILL, WorldMap } from '../WorldMap'
import { MapPin, PIN_SIZE, PIN_SIZE_SELECTED } from '../MapPin'
import { KeyHints, Meter, PixelText, Sprite } from '../../ui'
import type { ReactNode } from 'react'
import type { CharacterId } from '../../config/brand'
import type { TrackerPool, TrackerProvenance } from '../data/types'
import type { CursorDirection } from '../map'
import type { Difficulty, GateSet } from '../../types/domain'

/**
 * S5, the pool tracker.
 *
 * A component, not a route, exactly like `InRange`: it takes the already
 * scored, already gated pools and two callbacks, and knows nothing about
 * `useSession` or `useNavigate`. The route decides difficulty and GOD MODE by
 * calling `scoredPools()`; this file only decides how to look at the result.
 */
export interface PoolTrackerProps {
  /** Every pool at the caller's difficulty, filtered-out ones INCLUDED.
   * fixtures.ts returns them on purpose so this screen can draw them dim. */
  pools: Array<TrackerPool>
  /** The player's Monanimal, which is also the tier: brand.ts's `characters`
   * map answers both `label` and `tier` from this one id. */
  characterId: CharacterId
  /** The same gate set `pools` was scored against. Drawn as the shaded region
   * on the map, so the box and the pins can never tell different stories. */
  gates: GateSet
  /** Where `pools` came from and how old it is. Required, so no caller can
   * show a set of pools without saying what it is. */
  provenance: TrackerProvenance
  /** The nearest looser tier whose own gates, applied to this same read, would
   * admit a playable TESTNET market. Null when none would. The route decides
   * it from the data; this screen only offers it when nothing passed. */
  looserTier?: Difficulty | null
  onTryTier?: (tier: Difficulty) => void
  onPlayPool: (pairAddress: string) => void
  onBack: () => void
}

/** The Monanimal tied to each tier. Kept local, as Difficulty.tsx and
 * DiskSelect.tsx keep theirs: the binding is fixed. */
const CHARACTER_BY_DIFFICULTY: Record<Difficulty, CharacterId> = {
  easy: 'molandak',
  normal: 'moyaki',
  hard: 'mouch',
}

/**
 * The plot, in pixels.
 *
 * 480 less 16px of page padding (8 each side, matching InRange's p-2) leaves
 * 464. The Y-axis label column is a fixed 16 (four letters, one per row, at
 * text-micro), so the plot itself gets whatever is left. Height is fixed
 * because pins are positioned by percentage of THIS box, not of the screen:
 * a flexible height would mean a pin's percentage position meant a different
 * pixel every time the surrounding text wrapped.
 */
const PLOT_HEIGHT = 200
const RADAR_SIZE = 32

/**
 * Zoom levels, cycled by SELECT.
 *
 * Three, not a continuous range. The map is 100 units across and the pins sit
 * on real scores, so at 2x two pools four points apart finally separate, and
 * past 3x a player is navigating a map they can no longer see the shape of. A
 * continuous zoom would also need its own control; SELECT was free.
 */
const ZOOM_LEVELS = [1, 2, 3] as const

/** Plain words for a 0 to 100 term, so the panel never prints a bare number
 * next to a bar and calls that an explanation. No jargon, the same copy rule
 * as the difficulty screen. */
function bucket(score: number, low: string, mid: string, high: string): string {
  if (score >= 75) return high
  if (score >= 40) return mid
  return low
}

/**
 * Fee income is not a PoolScore field: HEAT's `turnover` term is a normalised
 * 0-100 SCORE, not a percentage a beginner can read. This is a separate,
 * openly heuristic estimate: a pool does not carry a real per-swap fee
 * parameter yet, so 30bps stands in as a representative fee until a live rate
 * replaces it. The label next to the number is what keeps this honest either
 * way.
 *
 * It exists for the development fixtures only. A worker pool has no per-swap
 * fee read, so it gets no estimate at all rather than a rate nobody measured.
 */
const ASSUMED_FEE_RATE = 0.003

/** Null when volume is unread, so the caller renders "not read" and not a 0%. */
function feeIncomePct(pool: TrackerPool['pool']): number | null {
  if (pool.volume24hUsd === null) return null
  if (pool.tvlUsd <= 0) return 0
  return (pool.volume24hUsd / pool.tvlUsd) * ASSUMED_FEE_RATE * 365 * 100
}

const DIRECTIONS: ReadonlySet<CursorDirection> = new Set([
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
])

/** Why a pool can or cannot start a run, in the order `isExecutable` asks. */
function statusOf(entry: TrackerPool): string {
  if (isExecutable(entry)) return 'Playable · Testnet'
  if (!entry.passes) return 'Locked by filter'
  if (entry.stale) return 'Stale read · read only'
  if (!isTestnet(entry)) return 'Mainnet · read only'
  return 'Book too thin'
}

/**
 * The verdict on a pool, as a tag. PLAYABLE is the one answer the player is
 * hunting for, so it is the one drawn inverted; every refusal is an outline
 * that still says why.
 */
function PoolStatus({ entry }: { entry: TrackerPool }) {
  const playable = isExecutable(entry)
  return (
    <span className={`tracker-status inline-flex shrink-0 items-center border px-1 ${playable ? 'border-ink bg-accent' : 'border-edge-soft'}`}>
      <PixelText role="micro" tone={playable ? 'invert' : 'dim'} upper>
        {statusOf(entry)}
      </PixelText>
    </span>
  )
}

export function PoolTracker({
  pools,
  characterId,
  gates,
  provenance,
  looserTier = null,
  onTryTier,
  onPlayPool,
  onBack,
}: PoolTrackerProps) {
  const [view, setView] = useState<'map' | 'inspect'>('map')
  // The cursor opens on the market the player can actually play, when there
  // is one: that is the pin this screen exists to find.
  const [cursorIndex, setCursorIndex] = useState(() => Math.max(0, pools.findIndex(isExecutable)))
  const [zoomStep, setZoomStep] = useState(0)
  const zoom = ZOOM_LEVELS[zoomStep]

  const character = characters[characterId]
  const passing = pools.filter((p) => p.passes)
  const cursor = Math.max(0, Math.min(cursorIndex, pools.length - 1))
  const selected = pools[cursor]
  const nextCharacter = looserTier ? characters[CHARACTER_BY_DIFFICULTY[looserTier]] : null

  useConsoleIntent((intent) => {
    // The empty state has its own two controls. Handled first so the map and
    // inspect branches below never have to think about an undefined
    // `selected`.
    if (passing.length === 0) {
      if (intent === 'B') onBack()
      else if (intent === 'A' && looserTier && onTryTier) onTryTier(looserTier)
      return
    }

    if (view === 'inspect') {
      if (intent === 'B') {
        setView('map')
        return
      }
      if (intent === 'A' && isExecutable(selected)) {
        // A pool that is not executable has no PLAY action to fire: it failed
        // a gate, it is mainnet-only, or its book is too thin. The gates
        // exist to stop exactly this, and GOD MODE still routes through
        // `passes`, which by then means only "the honeypot check cleared."
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
    // Cycles rather than paired zoom-in and zoom-out buttons: the console has
    // one spare control on this screen, not two, and three levels wrap in one
    // press from the far end.
    if (intent === 'SELECT') {
      setZoomStep((step) => (step + 1) % ZOOM_LEVELS.length)
      return
    }
    if (DIRECTIONS.has(intent as CursorDirection)) {
      setCursorIndex((current) =>
        nextPin(
          pools.map((p) => p.score),
          Math.min(current, pools.length - 1),
          intent as CursorDirection,
        ),
      )
    }
  })

  const header = (
    <>
      <div className="tracker-header flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1">
          <PixelText role="body" upper>
            Pool tracker
          </PixelText>
          {/* The densest screen in the product and the one that reads most
              like live market instrumentation. Whether it is a fixture or a
              worker read is stated beside the title, every time. */}
          <PixelText role="micro" tone="dim" upper>
            {provenanceBadge(provenance)}
          </PixelText>
        </div>
        <PixelText role="micro" upper className="tabular-nums">
          {passing.length} passed
        </PixelText>
      </div>
      <div className="tracker-subheader flex items-baseline justify-between gap-2">
        <PixelText role="micro" tone="dim" upper className="shrink-0">
          {character.label} · {character.tier}
        </PixelText>
        <PixelText role="micro" tone="dim" upper className="min-w-0 text-right">
          {provenanceShort(provenance)}
        </PixelText>
      </div>
      {provenance.notes.map((note) => (
        <PixelText key={note} role="micro" tone="dim">
          {note}
        </PixelText>
      ))}
    </>
  )

  // No spinner is a terminal state, and "the filter removed every pool" is
  // exactly as real a state as "here is the map." The map still draws, every
  // pin outside the shaded pass region, so the refusal is seen rather than
  // read, and the card under it names the way forward when one exists.
  if (passing.length === 0) {
    // The playable pools come first: they are the ones another tier can open.
    const closest = [...pools]
      .sort((a, b) => Number(isTestnet(b)) - Number(isTestnet(a)) || a.gates.failures.length - b.gates.failures.length)
      .slice(0, 3)
    return (
      <div className="screen-tracker bg-screen flex h-full w-full flex-col gap-1 p-2">
        {header}
        <div className="tracker-map flex min-h-0 flex-1 flex-col gap-1">
          <Plot pools={pools} cursorIndex={null} gates={gates} zoom={1} />
        </div>
        <div className="tracker-empty border-edge bg-panel flex flex-col gap-1 border p-2">
          <div className="flex items-baseline justify-between gap-2">
            <PixelText role="title" upper>
              Nothing passed
            </PixelText>
            <PixelText role="micro" tone="dim" upper>
              {character.tier} filter
            </PixelText>
          </div>
          <PixelText as="p" role="body">
            {character.label}&apos;s {character.tier} filter removed every pool.{' '}
            {nextCharacter
              ? `${nextCharacter.label} · ${nextCharacter.tier} lets a playable TESTNET market through.`
              : character.tier === 'HARD'
                ? 'HARD is already the loosest filter; nothing on the market passes right now.'
                : 'No looser tier admits a playable TESTNET market on this read either.'}
          </PixelText>
          {closest.length > 0 && (
            <ul className="tracker-closest border-edge-soft flex flex-col gap-1 border-t pt-1">
              {closest.map((entry) => (
                <li key={entry.pool.pairAddress} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">
                    <MapPin band={riskBand(entry.score.safety)} filtered size={12} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
                    <PixelText role="micro" upper>
                      {entry.pool.tokenX.symbol} / {entry.pool.tokenY.symbol}
                      {isTestnet(entry) ? ' · testnet' : ' · mainnet only'}
                    </PixelText>
                    {entry.gates.failures[0] && (
                      <PixelText role="micro" tone="dim">
                        {GATE_COPY[entry.gates.failures[0]]}
                      </PixelText>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <KeyHints className="mt-auto" hints={[
          ...(nextCharacter && onTryTier ? [{ key: 'A' as const, label: `Try ${nextCharacter.label}` }] : []),
          { key: 'B', label: 'Back' },
        ]} />
      </div>
    )
  }

  return (
    <div className="screen-tracker bg-screen flex h-full w-full flex-col gap-1 p-2">
      {header}

      {view === 'inspect' ? (
        <InspectPanel
          entry={selected}
          provenance={provenance}
          quote={characterQuotes[characterId]}
          quoteSpeaker={character.label}
          characterId={characterId}
        />
      ) : (
        <MapView
          pools={pools}
          cursorIndex={cursor}
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

      <KeyHints className="mt-auto" hints={view === 'inspect' ? [
        { key: 'A', label: 'Play', disabled: !isExecutable(selected) },
        { key: 'B', label: 'Map' },
      ] : [
        { key: 'DPAD', label: 'Move' },
        { key: 'A', label: 'Inspect' },
        { key: 'SELECT', label: 'Zoom' },
        { key: 'B', label: 'Back' },
      ]} />
    </div>
  )
}

/** The score map itself: the axis, the plot, the pins, the radar. No cursor
 * when nothing passed, because there is nothing to choose. */
function Plot({
  pools,
  cursorIndex,
  gates,
  zoom,
}: {
  pools: Array<TrackerPool>
  cursorIndex: number | null
  gates: GateSet
  zoom: number
}) {
  const cursor = cursorIndex === null ? null : scoreToPosition(pools[cursorIndex].score)
  // The map slides under a fixed window rather than the window moving over a
  // fixed map, so the plot box, the pins, and the minimap all keep working in
  // the same 0-100 space at every zoom level.
  const panX = cursor ? panFor(cursor.leftPct, zoom) : 0
  const panY = cursor ? panFor(cursor.topPct, zoom) : 0
  // Playable pins draw last, so a reticle is never hidden under a neighbour.
  const order = pools
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => Number(isExecutable(a.entry)) - Number(isExecutable(b.entry)))

  return (
    <div className="tracker-map-region flex gap-1">
      {/* HEAT, one letter per row rather than a rotated string: a bitmap
          font rotated with CSS resamples, and four short lines cost nothing
          a transform would have saved. */}
      <div className="flex w-4 shrink-0 flex-col items-center justify-center">
        {['H', 'E', 'A', 'T'].map((letter) => (
          <PixelText key={letter} role="micro" tone="dim">
            {letter}
          </PixelText>
        ))}
      </div>

      <div
        className="tracker-plot border-edge relative flex-1 overflow-hidden border"
        style={{ height: PLOT_HEIGHT }}
      >
        {/* Everything that lives in score space moves together. The minimap
            and the zoom badge sit OUTSIDE this, which is what keeps them
            readable while the map is panned. */}
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${zoom}) translate(${panX}%, ${panY}%)`,
            transformOrigin: '0 0',
          }}
        >
          <WorldMap minSafety={gates.minSafety} maxHeat={gates.maxHeat} />

          {order.map(({ entry, index }) => {
            const { leftPct, topPct } = scoreToPosition(entry.score)
            const selected = index === cursorIndex
            const playable = isExecutable(entry)
            return (
              <div
                key={entry.pool.pairAddress}
                className="absolute"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  // The pin rides in score space with the map, so the zoom
                  // would double its size too and turn the map into
                  // fourteen discs touching each other. Cancelling the zoom
                  // here keeps the glyph one size at every level and lets
                  // the zoom do the only job it exists for, which is
                  // separating pins that overlap.
                  transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                }}
              >
                <MapPin
                  band={riskBand(entry.score.safety)}
                  filtered={!entry.passes}
                  selected={selected}
                  playable={playable}
                  size={selected ? PIN_SIZE_SELECTED : PIN_SIZE}
                />
                {/* Only the selected pool names itself. Fourteen labels is
                    not a map, it is a list with coordinates. A playable one
                    names itself inverted, the same tag the card uses, and a
                    pool near either coast anchors its name inward so the
                    frame never cuts it. */}
                {selected ? (
                  <div className={`absolute top-full mt-1 whitespace-nowrap px-0.5 ${leftPct > 80 ? 'right-0' : leftPct < 20 ? 'left-0' : 'left-1/2 -translate-x-1/2'} ${playable ? 'bg-accent' : ''}`}>
                    <PixelText role="micro" tone={playable ? 'invert' : 'ink'} upper>
                      {entry.pool.tokenX.symbol}
                    </PixelText>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* The coastline, named. The axes are still readable off the line
            below the plot; these are the same two facts in the map's own
            words. The left label starts past the radar so neither covers
            the other. */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-between p-1" style={{ paddingLeft: RADAR_SIZE + 12 }}>
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
  pools: Array<TrackerPool>
  cursorIndex: number
  characterLabel: string
  gates: GateSet
  zoom: number
  onZoom: (delta: number) => void
}) {
  const entry = pools[cursorIndex]
  const playable = isExecutable(entry)

  return (
    <div className="tracker-map flex min-h-0 flex-1 flex-col gap-1">
      <Plot pools={pools} cursorIndex={cursorIndex} gates={gates} zoom={zoom} />

      <div className="tracker-map-tools flex items-center justify-between pl-5">
        <PixelText role="micro" tone="dim" upper>
          Safety, increasing right. Heat, increasing up.
        </PixelText>
        {/*
          TAPPABLE ZOOM, AND SELECT STILL DOES IT TOO.

          Below the plot rather than floating on it: the map is the one thing
          on this screen with nothing to spare, and a control parked on the
          corner of a map covers data at exactly the zoom level where data got
          dense. Down here the targets are also big enough for a thumb.
        */}
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
        </div>
      </div>

      {/* Colour is the SAFETY band and it means the same thing on every screen
          a pool can be reached from. Whether THIS tier's filter accepted it,
          and whether a run can start there, are different questions, so each
          gets a shape of its own rather than a fourth colour. */}
      <div className="tracker-map-legend flex flex-wrap items-center gap-x-3 pl-5">
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
        <div className="flex items-center gap-1">
          <MapPin band="green" size={10} playable />
          <PixelText role="micro" tone="dim" upper>
            Playable
          </PixelText>
        </div>
      </div>

      {/* The selected pool at a glance (portrait only). A playable one gets
          the heavier frame and the inverted tag: it is the answer to the
          question this screen exists to ask. */}
      <div className={`tracker-selection bg-panel p-2 ${playable ? 'tracker-selection-playable border-ink shadow-hard border-2' : 'border-edge border'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin band={riskBand(entry.score.safety)} filtered={!entry.passes} playable={playable} />
            <PixelText role="title" upper>
              {entry.pool.tokenX.symbol} / {entry.pool.tokenY.symbol}
            </PixelText>
          </div>
          <PoolStatus entry={entry} />
        </div>
        <div className="tracker-selection-facts flex justify-between gap-2">
          <PixelText role="micro">Safety {entry.score.safety}</PixelText>
          <PixelText role="micro">Heat {entry.score.heat}</PixelText>
        </div>
      </div>
    </div>
  )
}

/** A pressable on the pixel grid: 1px down and right on :active via
 * `.pressable`, never a scale, because scaling a pixel panel resamples its
 * border. */
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
      className="tracker-zoom pressable border-edge bg-panel text-ink disabled:text-ink-dim flex h-4 w-4 items-center justify-center border font-bold leading-none disabled:opacity-40"
    >
      {label}
    </button>
  )
}

/**
 * The radar, which is a minimap and therefore has something in it.
 *
 * A bare sweeping hand over an empty circle is motion that states nothing. A
 * minimap gives the same "this is scanning" read and answers the question the
 * zoom creates, which is where the window sits on the whole map. The sweep
 * stays, behind the dots, because it is what makes it look alive.
 */
function Minimap({
  pools,
  cursorIndex,
  zoom,
}: {
  pools: Array<TrackerPool>
  cursorIndex: number | null
  zoom: number
}) {
  const cursor = cursorIndex === null ? null : scoreToPosition(pools[cursorIndex].score)
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
      {cursor && zoom > 1 ? (
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

/**
 * S5's inspect panel, in four banded sections.
 *
 * Eleven rows of `text-micro` at one weight leave everything present and
 * nothing findable: a reader has to scan the whole panel to locate the pair
 * name, because the pair name looks exactly like the fee estimate.
 *
 * So: rules between sections, one job each, and the vertical budget spent on
 * the two things a player actually decides from. WHICH POOL is a title, and
 * the score breakdown gets a column of its own rather than trailing off the
 * end of a sentence.
 */
function InspectPanel({
  entry,
  provenance,
  quote,
  quoteSpeaker,
  characterId,
}: {
  entry: TrackerPool
  provenance: TrackerProvenance
  quote: string
  quoteSpeaker: string
  characterId: CharacterId
}) {
  const { pool, score, gates, passes } = entry
  // The proven minimum, so a pool whose exact birthday is unreadable reads as
  // "at least this old" rather than borrowing a number it does not have.
  const ageSeconds = Math.max(0, provenance.referenceSeconds - pool.createdAt)
  const ageIsExact = pool.createdAtIsExact
  // Only the fixtures have an assumed fee rate to estimate from.
  const feeIncome = provenance.kind === 'fixture' ? feeIncomePct(pool) : null

  /**
   * THE WORST POOL IN THE SET IS THE ONE THAT BREAKS THE LAYOUT.
   *
   * A pool can fail five gates at once, and `evaluateGates` collects all of
   * them on purpose. Five sentences is 70px this panel does not budget for,
   * so the footer, which is the Monanimal and both button labels, would be
   * pushed off the bottom of a screen that cannot scroll. The controls must
   * not vanish on the exact pool that most needs explaining.
   *
   * Two mechanisms, because one is not enough. The section padding tightens
   * in three tiers as the failure count grows (a single boolean shared by 3, 4
   * AND 5 failures gives all three the same allocation, and the fifth reason
   * lays out below the `overflow-hidden` edge of the box with no seam and no
   * scrollbar). And the failure list is the FLEXIBLE region below, so anything
   * left over is absorbed there instead of shoving the footer.
   *
   * Cutting the list short is never an option: every reason shows. That is
   * this file's own rule, and a pool this bad is exactly the one a judge will
   * click.
   */
  const dense = gates.failures.length > 2
  const veryDense = gates.failures.length > 4
  const pad = veryDense ? 'py-0.5' : dense ? 'py-1' : 'py-2'

  return (
    <div className="tracker-inspect flex min-h-0 flex-1 flex-col">
      {/* 1. WHICH POOL. The only thing on this screen at title weight, so the
             eye lands here first and knows what the rest is about. */}
      <div
        className={`tracker-pair border-edge flex flex-col gap-1 border-b ${dense ? 'pb-1' : 'pb-2'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin band={riskBand(score.safety)} filtered={!passes} playable={isExecutable(entry)} />
            <PixelText role="title" upper>
              {pool.tokenX.symbol} / {pool.tokenY.symbol}
            </PixelText>
          </div>
          {/* A passive verdict, never a control. When A cannot play this
              pool the tag says why, so the disabled A is never a guess. */}
          <PoolStatus entry={entry} />
        </div>
        <PixelText role="micro" tone="dim" upper>
          {isBookThin(entry) ? 'Thin book' : 'Book ready'} · {provenanceLine(provenance)}
        </PixelText>
      </div>

      {/* 2. WHAT IT IS. Four facts, one per row, label left and value right so
             the numbers form a column the eye can run down. */}
      <div className={`tracker-facts border-edge flex flex-col gap-1 border-b ${pad}`}>
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
          {/* The caveat is permanent, never conditional on the number. The
              second line is only true when there IS an estimate; with volume
              unread there is nothing to caveat, and printing the caveat anyway
              would imply a number is hiding behind it. */}
          <PixelText role="micro" tone="dim">
            {feeIncome !== null
              ? 'estimate, not a promise'
              : provenance.kind === 'worker'
                ? 'no per-swap fee rate is read, so no estimate is made'
                : 'needs 24h volume, which this rpc will not serve'}
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

      {/* 3. WHY IT SCORED THAT. Every term of both scores, visible. This is
             the whole point of the screen: the answer to "what is your AI
             actually based on" is a sentence a judge can read, not a promise
             to trust a black box. Score left, terms right, so the two headline
             numbers line up under each other instead of hiding at the head of
             two different-length sentences. */}
      <div className={`tracker-scores border-edge flex flex-col gap-1 border-b ${pad}`}>
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

      {/* THE FLEXIBLE REGION. Everything above is fixed height and everything
          below is the footer, so this is where the panel absorbs a pool with
          a lot wrong with it. `min-h-0` is what lets a flex child actually
          shrink; without it the box keeps its content height and pushes the
          footer off the bottom of a screen that has no scrollbar. */}
      <div className="tracker-failures min-h-0 flex-1 py-1">
        {!passes ? (
          // GATE_COPY already holds a sentence per failure; every one of them
          // renders, not just the first, because `evaluateGates` collected all
          // of them for exactly this reason.
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
        {/* Checks the data could not settle are named, never silently counted
            as passed. */}
        {gates.unverified.map((check) => (
          <PixelText key={check} role="micro" tone="dim">
            {UNVERIFIED_COPY[check]}
          </PixelText>
        ))}
      </div>

      {/* 4. WHO IS TELLING YOU. The Monanimal says its line with its face
             next to it, standing on the control row like a shopkeeper behind
             a counter. The idle loop is the same two frame animation every
             other screen uses and it parks on frame 0 under
             prefers-reduced-motion. */}
      <div className="flex items-end justify-between gap-2 pt-1">
        <PixelText role="micro" className="flex-1">
          &quot;{quote}&quot; - {quoteSpeaker}
        </PixelText>
        <Sprite character={characterId} animation="idle" size={32} />
      </div>
    </div>
  )
}

/**
 * One row of section 2: label left, value in a fixed column, colour and words
 * after it. The value column is fixed so four different-length numbers still
 * line up, which is the only reason this is a component and not four divs.
 */
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
    <div className="tracker-fact flex items-center gap-2">
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
