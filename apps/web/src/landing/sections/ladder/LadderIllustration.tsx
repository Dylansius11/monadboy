import { useEffect, useRef, useState } from 'react'
import { Sprite } from '../../../ui'
import {
  HALF,
  ROWS,
  formatFigure,
  inRange,
  orders,
  readout,
  swapCost,
} from './ladder-model'
import type { LadderState } from './ladder-model'

/** Left gutter: price pointer and rung ticks. */
const GUTTER = 44
const AXIS = 40
/** The PRICE label after the marker: a 6px lead, 42px of text, 2px spare. */
const PRICE_LABEL = 50
/** Plot size before the first measurement, so the server render has a shape. */
const FALLBACK = { w: 480, h: 480 }

/**
 * The flip-order ladder, drawn as a pixel diagram. Every coordinate is a
 * whole CSS pixel derived from one integer cell, and the SVG is never scaled
 * by a viewBox, so blocks and rules land on the pixel grid at any width.
 */
export function LadderIllustration({ state, id }: { state: LadderState; id: string }) {
  const plot = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(FALLBACK)

  useEffect(() => {
    const el = plot.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      const h = Math.floor(entry.contentRect.height)
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { w, h } = size
  const sprite = w >= 420 && h >= 420 ? 64 : 32
  const cell = Math.max(12, Math.floor((h - (sprite - 8)) / ROWS))
  const top = h - cell * ROWS
  const rowTop = (level: number) => top + (ROWS - 1 - level) * cell
  const rowMid = (level: number) => rowTop(level) + Math.floor(cell / 2)

  const blockX = GUTTER
  // Narrow plots give up block width first, so the PRICE label ends inside.
  const blockW = Math.min(
    220,
    Math.round(w * (sprite === 64 ? 0.48 : 0.42)),
    w - GUTTER - 14 - 46 - sprite - PRICE_LABEL,
  )
  const arrowX = blockX + blockW + 14
  // Room for the FLIP label between the arrow and the marker.
  const spriteX = arrowX + 46
  const lineY = rowMid(state.price) - 1

  const live = inRange(state)
  const book = orders(state)
  const { fill } = state
  const bandTop = rowTop(state.center + HALF) - 4
  const bandBottom = rowTop(state.center - HALF) + cell + 4
  const bandLeft = blockX - 8
  const bandRight = blockX + blockW + 8
  // The label tab sits on the side of the band away from the price.
  const tabY = state.price <= state.center ? bandTop - 16 : bandBottom

  const r = readout(state)
  const swapping = state.phase === 'recenter'
  const swapped = swapping && state.target !== null
  const cost = swapped ? state.paid : swapCost(state)

  // The flip arrow runs from the filled level to where the order re-armed.
  const flipFrom = fill ? rowMid(fill.level) : 0
  const flipTo = fill ? rowMid(fill.flippedTo) : 0
  const flipDir = flipTo > flipFrom ? -1 : 1
  const flipTip = flipTo > flipFrom ? flipTo : flipTo - 2
  const flipY = Math.min(flipFrom, flipTo)
  const flipH = Math.abs(flipTo - flipFrom)

  const corners: Array<[number, number, number, number]> = []
  for (const [x, dx] of [[bandLeft, 1], [bandRight - 2, -1]] as const) {
    for (const [y, dy] of [[bandTop, 1], [bandBottom - 2, -1]] as const) {
      corners.push([dx > 0 ? x : x - 10, y, 12, 2])
      corners.push([x, dy > 0 ? y : y - 10, 2, 12])
    }
  }

  return (
    <figure
      id={id}
      className={`ladder${live ? '' : ' is-out'}`}
      data-phase={state.phase}
      aria-label="Illustration of a flip-order ladder. Units are illustrative, not market data."
    >
      <figcaption className="ladder-head">
        <span>ILLUSTRATION · NOT MARKET DATA</span>
        <span className="ladder-light">{live ? 'IN RANGE' : 'OUT OF RANGE'}</span>
      </figcaption>

      <div ref={plot} className="ladder-plot">
        <svg className="ladder-svg" width={w} height={h} aria-hidden="true">
          {Array.from({ length: ROWS + 1 }, (_, i) => {
            const y = top + i * cell
            const inBand = y >= bandTop && y <= bandBottom
            return (
              <g key={i} className={inBand ? 'ladder-tick is-band' : 'ladder-tick'}>
                <rect x={AXIS - 6} y={y} width={6} height={1} />
                <rect x={w - 6} y={y} width={6} height={1} />
              </g>
            )
          })}
          <rect className="ladder-axis" x={AXIS} y={top} width={1} height={h - top} />

          <rect
            className="ladder-band"
            x={bandLeft}
            y={bandTop}
            width={bandRight - bandLeft}
            height={bandBottom - bandTop}
          />
          {corners.map(([x, y, cw, ch], i) => (
            <rect key={i} className="ladder-bracket" x={x} y={y} width={cw} height={ch} />
          ))}

          {Array.from({ length: ROWS }, (_, level) => {
            if (Math.abs(level - state.center) <= HALF) return null
            const y = rowTop(level) + 2
            const bh = cell - 4
            return (
              <path
                key={`rung-${level}`}
                className="ladder-rung"
                fillRule="evenodd"
                d={`M${blockX} ${y}h${blockW}v${bh}h${-blockW}Z M${blockX + 1} ${y + 1}v${bh - 2}h${blockW - 2}v${2 - bh}Z`}
              />
            )
          })}
          <rect className="ladder-tab" x={bandLeft} y={tabY} width={92} height={16} />
          <text className="ladder-tab-text" x={bandLeft + 6} y={tabY + 12}>
            YOUR RANGE
          </text>

          {[...book].map(([level, side]) => {
            const y = rowTop(level) + 2
            const bh = cell - 4
            const armed = fill?.flippedTo === level
            return (
              <g
                key={`${level}-${side}-${armed ? state.tick : 0}`}
                className={`ladder-order is-${side}${armed ? ' is-armed' : ''}`}
              >
                {side === 'bid' ? (
                  <>
                    <rect className="o-body" x={blockX} y={y} width={blockW} height={bh} />
                    <rect className="o-hi" x={blockX} y={y} width={blockW} height={2} />
                    <rect className="o-lo" x={blockX} y={y + bh - 2} width={blockW} height={2} />
                  </>
                ) : (
                  <>
                    <path
                      className="o-edge"
                      fillRule="evenodd"
                      d={`M${blockX} ${y}h${blockW}v${bh}h${-blockW}Z M${blockX + 2} ${y + 2}v${bh - 4}h${blockW - 4}v${4 - bh}Z`}
                    />
                  </>
                )}
                {armed ? (
                  <path
                    className="o-lit"
                    fillRule="evenodd"
                    d={`M${blockX - 4} ${y - 2}h${blockW + 8}v${bh + 4}h${-blockW - 8}Z M${blockX - 2} ${y}v${bh}h${blockW + 4}v${-bh}Z`}
                  />
                ) : null}
              </g>
            )
          })}

          {fill ? (
            <g key={`fill-${state.tick}`}>
              <rect
                className="ladder-ghost"
                x={blockX}
                y={rowTop(fill.level) + 2}
                width={blockW}
                height={cell - 4}
              />
              <g className="ladder-flip">
                <rect x={arrowX} y={flipY} width={2} height={flipH} />
                <rect x={arrowX} y={flipTip} width={2} height={2} />
                <rect x={arrowX - 2} y={flipTip + 2 * flipDir} width={6} height={2} />
                <rect x={arrowX - 4} y={flipTip + 4 * flipDir} width={10} height={2} />
                <text x={arrowX + 10} y={flipY + Math.floor(flipH / 2) + 4}>
                  FLIP
                </text>
              </g>
            </g>
          ) : null}

          <g className="ladder-price">
            <rect x={AXIS} y={lineY} width={w - AXIS} height={2} />
            <rect x={AXIS - 14} y={lineY - 4} width={2} height={10} />
            <rect x={AXIS - 12} y={lineY - 2} width={4} height={6} />
            <rect x={AXIS - 8} y={lineY} width={6} height={2} />
            <text x={spriteX + sprite + 6} y={lineY - 6}>
              PRICE
            </text>
          </g>
        </svg>
        <div className="ladder-marker" style={{ left: spriteX, top: lineY + 2 - sprite }}>
          <Sprite
            character="molandak"
            animation={!live || (swapping && !swapped) ? 'alert' : fill?.completes ? 'happy' : 'idle'}
            size={32}
            scale={sprite === 64 ? 2 : 1}
          />
        </div>
      </div>

      <ul className="ladder-legend" aria-hidden="true">
        <li>
          <i className="ladder-swatch is-bid" />
          BUY ORDER
        </li>
        <li>
          <i className="ladder-swatch is-ask" />
          SELL ORDER
        </li>
        <li>
          <i className="ladder-swatch is-fill" />
          FILL
        </li>
      </ul>

      <p className="ladder-status">
        {state.phase === 'out' ? (
          'OUT OF RANGE · NOTHING FILLS'
        ) : swapping ? (
          <>
            <span className={`ladder-key${swapped ? ' is-down' : ''}`}>RE-CENTER</span>{' '}
            <span>
              {!swapped ? 'SWAP COST ' : state.center !== state.target ? 'RANGE MOVES · PAID ' : 'RANGE SET · PAID '}
              {formatFigure(-cost)}
            </span>
          </>
        ) : fill?.completes ? (
          'ROUND TRIP · SPREAD EARNED'
        ) : fill ? (
          `FILL · RE-ARMS ONE STEP ${fill.side === 'ask' ? 'DOWN' : 'UP'}`
        ) : state.phase === 'score' ? (
          'PRICE MOVES · DAMAGE COUNTED'
        ) : (
          'IN RANGE · ORDERS RESTING'
        )}
      </p>

      <dl className={`ladder-readout${state.phase === 'score' ? ' is-on' : ''}${live ? '' : ' is-frozen'}`}>
        <div className={fill?.completes ? 'is-lit' : undefined}>
          <dt>SCORE</dt>
          <dd>{formatFigure(r.score)}</dd>
        </div>
        <div>
          <dt>DAMAGE</dt>
          <dd>{formatFigure(-r.damage)}</dd>
        </div>
        <div className="ladder-net">
          <dt>NET</dt>
          <dd>{formatFigure(r.net)}</dd>
        </div>
      </dl>
    </figure>
  )
}
