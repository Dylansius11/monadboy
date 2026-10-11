import { BAND_FILL, BAND_GLYPH } from './WorldMap'
import type { RiskBand } from './map'

/**
 * A pool on the map: the Monad mark in a coloured disc.
 *
 * COLOUR IS THE SECOND CHANNEL, NEVER THE ONLY ONE. Every pin carries a dark
 * outline whatever its band, so the shape survives a projector, a grayscale
 * screenshot, and a colour-blind judge. The band tints the disc; whether the
 * tier's filter accepted the pool is carried separately, by a solid ring
 * against a dashed one. Two independent readings, two independent encodings.
 *
 * `--color-warn` is fill-only per tokens.css, which is exactly what it is
 * doing here. The glyph on top of it swaps to ink; see `BAND_GLYPH`.
 */

/**
 * The Monad mark, one path with an evenodd hole.
 *
 * Deliberately duplicated from `console/Console.tsx` rather than shared.
 * `src/console/` must never know this application is about money, and a
 * shared module imported by both is the first step to that boundary leaking.
 * There it is moulded plastic, here it is a datum. Same curve, two different
 * jobs.
 */
const MONAD_MARK =
  'M50 4C66 4 96 34 96 50C96 66 66 96 50 96C34 96 4 66 4 50C4 34 34 4 50 4ZM50 33C56 33 67 44 67 50C67 56 56 67 50 67C44 67 33 56 33 50C33 44 44 33 50 33Z'

/** 16 on the map, 20 when selected, 10 in the legend. Every one an even
 * number, so the mark's centre lands on a whole pixel at 1x and at 2x. */
export const PIN_SIZE = 16
export const PIN_SIZE_SELECTED = 20

/** Four corner brackets standing off the disc: the playable reticle. */
const RETICLE = 'M-3 2V-3H2M18 -3H23V2M23 18V23H18M2 23H-3V18'

export function MapPin({
  band,
  filtered = false,
  selected = false,
  playable = false,
  size = PIN_SIZE,
}: {
  band: RiskBand
  /** Failed this tier's gates. Dashed ring and dimmed, never hidden: a filter
   * you cannot see working is the same as no filter. */
  filtered?: boolean
  selected?: boolean
  /** A TESTNET market this tier can start a run on. A third shape, the
   * reticle, so "you can play here" survives a grayscale screenshot. */
  playable?: boolean
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label={`${band}${filtered ? ' filtered' : ''}${playable ? ' playable' : ''}`}
      className={filtered ? 'opacity-70' : undefined}
      overflow="visible"
    >
      {playable ? (
        <g fill="none" strokeLinecap="square">
          {/* A light halo under the accent, so the corners read on the
              shaded pass region as well as on open water. */}
          <path d={RETICLE} stroke="var(--color-panel)" strokeWidth={4} />
          <path d={RETICLE} stroke="var(--color-accent)" strokeWidth={2} />
        </g>
      ) : null}
      <circle
        cx={10}
        cy={10}
        r={8}
        fill={BAND_FILL[band]}
        stroke="var(--color-edge)"
        /* The selection IS the ring. A box standing off the pin reads at map
           density as a second object rather than as a state of the pin under
           it. */
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
