/** Stepped SAFETY/HEAT terrain; tier borders use the scoring thresholds. */
import type { RiskBand } from './map'




const COAST: ReadonlyArray<number> = [
  36, 33, 38, 44, 41, 48, 54, 51, 58, 65, 62,
]


function coastPath(): string {
  const step = 100 / (COAST.length - 1)
  // Start at the bottom right corner, run up the right edge, then walk the
  // coast back down. Screen y is inverted because heat increases upward.
  const parts = [`M 100 100`, `L 100 0`]
  COAST.forEach((safety, i) => {
    const heat = 100 - i * step
    const y = 100 - heat
    parts.push(`L ${safety} ${y}`)
    if (i < COAST.length - 1) {
      parts.push(`L ${safety} ${100 - (heat - step)}`)
    }
  })
  parts.push('Z')
  return parts.join(' ')
}

const LAND = coastPath()


const ISLETS: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = [
  { x: 8, y: 22, w: 5, h: 4 },
  { x: 18, y: 62, w: 4, h: 3 },
  { x: 12, y: 78, w: 6, h: 4 },
  { x: 24, y: 12, w: 4, h: 3 },
]

export const BAND_FILL: Record<RiskBand, string> = {
  green: 'var(--color-gain)',
  amber: 'var(--color-warn)',
  red: 'var(--color-loss)',
}


export const BAND_GLYPH: Record<RiskBand, string> = {
  green: 'var(--color-ink-invert)',
  amber: 'var(--color-ink)',
  red: 'var(--color-ink-invert)',
}

export function WorldMap({
  minSafety,
  maxHeat,
}: {
  minSafety: number
  maxHeat: number
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      
      <rect x={0} y={0} width={100} height={100} fill="var(--color-sunk)" />
      <rect
        x={0}
        y={0}
        width={20}
        height={100}
        fill="var(--color-edge-soft)"
        opacity={0.35}
      />

      
      <rect
        x={0}
        y={0}
        width={100}
        height={12}
        fill="var(--color-warn)"
        opacity={0.3}
      />

      {ISLETS.map((i) => (
        <rect
          key={`${i.x}-${i.y}`}
          x={i.x}
          y={i.y}
          width={i.w}
          height={i.h}
          fill="var(--color-edge-soft)"
          opacity={0.5}
        />
      ))}

      <path d={LAND} fill="var(--color-panel)" />
      <path
        d={LAND}
        fill="none"
        stroke="var(--color-edge)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />

      
      <rect
        x={minSafety}
        y={100 - maxHeat}
        width={100 - minSafety}
        height={maxHeat}
        fill="var(--color-accent)"
        opacity={0.1}
      />
      <rect
        x={minSafety}
        y={100 - maxHeat}
        width={100 - minSafety}
        height={maxHeat}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
