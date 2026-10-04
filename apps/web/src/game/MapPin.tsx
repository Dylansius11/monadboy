/** Risk colour and independent selection/filter rings on the Monad mark. */
import { BAND_FILL, BAND_GLYPH } from './WorldMap'
import type { RiskBand } from './map'




const MONAD_MARK =
  'M50 4C66 4 96 34 96 50C96 66 66 96 50 96C34 96 4 66 4 50C4 34 34 4 50 4ZM50 33C56 33 67 44 67 50C67 56 56 67 50 67C44 67 33 56 33 50C33 44 44 33 50 33Z'


export const PIN_SIZE = 16
export const PIN_SIZE_SELECTED = 20

export function MapPin({
  band,
  filtered = false,
  selected = false,
  size = PIN_SIZE,
}: {
  band: RiskBand
  
  filtered?: boolean
  selected?: boolean
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label={`${band}${filtered ? ' filtered' : ''}`}
      className={filtered ? 'opacity-70' : undefined}
    >
      <circle
        cx={10}
        cy={10}
        r={8}
        fill={BAND_FILL[band]}
        stroke="var(--color-edge)"
        
        strokeWidth={selected ? 3 : 1}
        strokeDasharray={filtered ? '3 2' : undefined}
      />
      {selected ? (
        <circle
          cx={10}
          cy={10}
          r={9}
          fill="none"
          stroke="var(--color-ink-invert)"
          strokeWidth={1}
        />
      ) : null}
      <g transform="translate(5.5 5.5) scale(0.09)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={MONAD_MARK}
          fill={BAND_GLYPH[band]}
        />
      </g>
    </svg>
  )
}
