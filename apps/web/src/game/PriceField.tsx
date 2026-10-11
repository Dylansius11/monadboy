import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { PixelText, Sprite } from '../ui'
import { price as fmt } from '../lib/format'
import { yDomain } from './domain'
import type { SpriteAnimation } from '../ui'
import './price-field.css'

/**
 * The screen. Everything else on S7 is a label around this.
 *
 * A stepped price line, the two edges of your range drawn across it, and your
 * Monanimal standing on the price. The whole product in one picture: the
 * character is where the price is, the lines are where you are still earning,
 * and the job is to stay between them.
 *
 * It is a line and two edges rather than a strip of identical tiles. Tiles
 * say "there is liquidity here" but cannot say "you are here and the edge is
 * there", which is the only question the player has. The ladder underneath
 * still produces the range, and it is exactly what the two lines are drawn
 * from.
 *
 * SVG for the geometry, DOM for the text. The bitmap font renders crisply as
 * DOM and resamples as SVG <text>, so the labels are positioned absolutely
 * over the plot rather than drawn into it.
 */

/** Room on the right for half the character, so it never leaves the field. */
const CHARACTER_GUTTER = 20
/** Headroom for the 32px character standing on the highest price. */
const TOP_INSET = 24
const BOTTOM_INSET = 4
/** An edge label is one micro line tall; it sits outside the band it names. */
const LABEL_HEIGHT = 16

export interface PriceFieldProps {
  /** Oldest to newest. The last sample is where the character stands. */
  series: ReadonlyArray<number>
  lowerPrice: number
  upperPrice: number
  width: number
  height: number
  character: string
  animation: SpriteAnimation
  jumping: boolean
  /** Drives the greyed treatment. Nothing is earning while price is outside. */
  earning: boolean
  /**
   * Live sampling. With both set, the field is a fixed window of `capacity`
   * samples that scrolls left in whole pixels while the newest price is held
   * up to now, so the line moves between samples without inventing a price.
   */
  sampling?: { capacity: number; intervalMs: number; newestAt: number }
}

export function PriceField({
  series,
  lowerPrice,
  upperPrice,
  width: naturalWidth,
  height: naturalHeight,
  character,
  animation,
  jumping,
  earning,
  sampling,
}: PriceFieldProps) {
  const field = useRef<HTMLDivElement>(null)
  const line = useRef<SVGGElement>(null)
  const [size, setSize] = useState({ width: naturalWidth, height: naturalHeight })
  useLayoutEffect(() => {
    const el = field.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      if (!next.width || !next.height) return
      setSize((current) => current.width === next.width && current.height === next.height ? current : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const { width, height } = size
  const plotWidth = width - CHARACTER_GUTTER
  const plotHeight = Math.max(1, height - TOP_INSET - BOTTOM_INSET)
  const { low, high } = yDomain(series, lowerPrice, upperPrice)

  const y = (value: number) => Math.round(TOP_INSET + ((high - value) / (high - low)) * plotHeight)
  const step = plotWidth / Math.max(1, (sampling?.capacity ?? series.length) - 1)

  // Between samples the window slides left by at most one slot, written
  // straight to the transform: no React render, no layout, whole pixels only.
  useEffect(() => {
    const group = line.current
    if (!group || !sampling || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let shown = -1
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - sampling.newestAt) / sampling.intervalMs))
      const offset = Math.round(progress * step)
      if (offset !== shown) {
        group.style.transform = `translateX(${-offset}px)`
        shown = offset
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [sampling, step])

  // Stepped, not interpolated, exactly like the Chart primitive: each sample
  // holds its value until the next one. A smooth curve would invent prices
  // that never traded.
  const newest = series.length - 1
  const points: Array<string> = []
  series.forEach((value, i) => {
    const px = Math.round(plotWidth - (newest - i) * step)
    points.push(`${px},${y(value)}`)
    // The newest price is held to now; while sliding it must still reach the
    // character, so it runs one slot past the clip edge.
    const holdTo = i < newest ? plotWidth - (newest - i - 1) * step : sampling ? plotWidth + step : plotWidth
    if (holdTo > px) points.push(`${Math.round(holdTo)},${y(value)}`)
  })
  // The first observed price is held across the field; one SVG point has no
  // visible line and would leave half the character outside the left edge.
  if (series.length === 1 && !sampling) points.unshift(`0,${y(series[0])}`)

  const top = Math.max(lowerPrice, upperPrice)
  const bottom = Math.min(lowerPrice, upperPrice)
  const topY = y(top)
  const bottomY = y(bottom)
  const nowY = y(series[newest])
  const edge = earning ? 'var(--color-accent)' : 'var(--color-ink-dim)'
  // url(#…) breaks on the punctuation React puts in generated ids.
  const clip = `price-field-clip-${useId().replace(/[^\w-]/g, '')}`

  return (
    <div ref={field} className="price-field relative h-full w-full" data-earning={earning} style={{ height: naturalHeight }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Price against your range"
        className="absolute inset-0"
      >
        <defs>
          <clipPath id={clip}>
            <rect x={0} y={0} width={plotWidth} height={height} />
          </clipPath>
        </defs>
        {/* The band you are earning in. Filled, so "inside" is a place rather
            than a gap between two lines. */}
        <rect
          x={0}
          y={topY}
          width={plotWidth}
          height={Math.max(1, bottomY - topY)}
          fill={earning ? 'var(--color-sunk)' : 'transparent'}
        />

        {[topY, bottomY].map((edgeY, index) => (
          <line
            key={index}
            className="price-field-edge"
            x1={0}
            x2={plotWidth}
            y1={edgeY}
            y2={edgeY}
            stroke={edge}
            strokeWidth={2}
            strokeDasharray="4 4"
            shapeRendering="crispEdges"
          />
        ))}

        <g clipPath={`url(#${clip})`}>
          <g ref={line} className="price-field-line">
            <polyline
              points={points.join(' ')}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={2}
              shapeRendering="crispEdges"
            />
          </g>
        </g>
      </svg>

      {/* The two edge prices, stated, each on the outside of the band so a
          thin band never stacks one label on the other. */}
      <EdgeLabel top={Math.max(0, topY - LABEL_HEIGHT)} value={top} label="High" />
      <EdgeLabel top={Math.min(height - LABEL_HEIGHT, bottomY + 2)} value={bottom} label="Low" />

      {/* The character stands ON the price, so its feet are the reading. It
          hops to a new sample in four whole steps rather than gliding. */}
      <div
        className="price-field-character absolute left-0 top-0"
        style={{ transform: `translate(${plotWidth}px, ${nowY}px) translate(-50%, -100%)` }}
      >
        {/*
          TWO ELEMENTS, TWO TRANSFORMS, AND THAT IS THE WHOLE JUMP FIX.

          `transform` is one property. `sprite-jump` animates it to
          `translateY(-16px)`, which REPLACES whatever the element already had
          rather than adding to it. With both classes on the wrapper above,
          pressing A would drop the translate that puts the character's feet on
          the price line. The wrapper positions. The child jumps. Neither one
          can clobber the other.
        */}
        <div className={jumping ? 'sprite-jump' : undefined}>
          <Sprite character={character} animation={animation} size={32} />
        </div>
      </div>
    </div>
  )
}

function EdgeLabel({
  top,
  value,
  label,
}: {
  top: number
  value: number
  label: string
}) {
  return (
    <div className="price-field-label absolute left-0 flex items-center gap-1 px-1" style={{ top }}>
      <PixelText role="micro" tone="dim" upper>
        {label}
      </PixelText>
      <PixelText role="micro" className="tabular-nums">
        {fmt(value)}
      </PixelText>
    </div>
  )
}
