/**
 * The flip-order ladder behind the landing illustration.
 *
 * Pure and deterministic: a seed fixes every tick, so the picture a visitor
 * watches can be reproduced in a test. Units are illustrative. One price level
 * is one spread, and the readout converts levels into game-style figures with
 * VALUE_PER_LEVEL. Nothing here is market data.
 *
 * Accounting mirrors the game's score card: NET is the position's value
 * against simply holding the deposit, SCORE is the spread captured by
 * completed round trips, and DAMAGE is max(0, SCORE - NET).
 */

/** Resting orders on each side of the band centre. */
export const HALF = 4
/** Price levels the illustration shows. Level 0 is the bottom row. */
export const ROWS = 16
/** Band centre at the start. Exits alternate, so the band swings between here and here + HALF + 1. */
export const START_LEVEL = 5
/** What one spread is worth in the readout. */
export const VALUE_PER_LEVEL = 0.06
/** Swap cost, in spreads, for each unit of inventory a re-center rebalances. */
export const SWAP_FEE_PER_UNIT = 0.25

/** Calm walk inside the band: fills and flips. */
const LADDER_TICKS = 10
/** Ticks the price holds outside the band before RE-CENTER is offered. */
const OUT_TICKS = 5
/** Ticks the swap cost is on screen before the band moves. */
const COST_TICKS = 3
/** Chance a drift tick moves toward the exit. */
const DRIFT_BIAS = 0.7
/** A drift that has not left the band by now walks straight out. */
const DRIFT_PATIENCE = 14

export type LadderPhase = 'ladder' | 'score' | 'out' | 'recenter'
export type OrderSide = 'bid' | 'ask'

export interface LadderFill {
  /** Level the resting order sat on. */
  level: number
  side: OrderSide
  /** Level the order re-armed on, on the other side, one spread away. */
  flippedTo: number
  /** This fill closed a round trip and earned one spread. */
  completes: boolean
}

export interface LadderState {
  /** mulberry32 state. */
  rng: number
  tick: number
  phase: LadderPhase
  phaseTick: number
  price: number
  /** Band centre. The band covers center - HALF to center + HALF. */
  center: number
  /** Where a re-center is moving the band, once the swap is confirmed. */
  target: number | null
  /** Swap cost of the last re-center, in readout units. */
  paid: number
  exitDirection: 1 | -1
  base: number
  quote: number
  deposit: { base: number; quote: number }
  /** First leg of an unfinished round trip, indexed by the lower level of each gap. */
  open: ReadonlyArray<OrderSide | null>
  trips: number
  /** The fill this tick produced, if any. */
  fill: LadderFill | null
}

export interface LadderReadout {
  score: number
  damage: number
  net: number
}

function random(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** The opening position: HALF bids below the price, HALF asks above it. */
export function createLadder(seed: number): LadderState {
  let quote = 0
  for (let k = 1; k <= HALF; k++) quote += START_LEVEL - k
  return {
    rng: seed >>> 0,
    tick: 0,
    phase: 'ladder',
    phaseTick: 0,
    price: START_LEVEL,
    center: START_LEVEL,
    target: null,
    paid: 0,
    exitDirection: 1,
    base: HALF,
    quote,
    deposit: { base: HALF, quote },
    open: Array.from({ length: ROWS }, () => null),
    trips: 0,
    fill: null,
  }
}

export function inRange(s: Pick<LadderState, 'price' | 'center'>): boolean {
  return Math.abs(s.price - s.center) <= HALF
}

/**
 * Resting orders by level. The band holds 2 * HALF orders around one empty
 * slot: the price while it is inside, the nearest band edge once it leaves.
 */
export function orders(s: Pick<LadderState, 'price' | 'center'>): Map<number, OrderSide> {
  const empty = Math.min(s.center + HALF, Math.max(s.center - HALF, s.price))
  const book = new Map<number, OrderSide>()
  for (let level = s.center - HALF; level <= s.center + HALF; level++) {
    if (level !== empty) book.set(level, level < empty ? 'bid' : 'ask')
  }
  return book
}

/**
 * Move the price one level. Crossing a resting order fills it and re-arms it
 * on the other side one spread away; the second fill in a gap completes a
 * round trip and only then earns the spread. Outside the band nothing fills.
 */
export function applyMove(s: LadderState, next: number): LadderState {
  const from = s.price
  const crossing = Math.abs(next - from) === 1
  const fills =
    crossing && inRange(s) && inRange({ price: next, center: s.center })
  if (!fills) return { ...s, price: next, fill: null }

  const side: OrderSide = next > from ? 'ask' : 'bid'
  const gap = Math.min(from, next)
  const open = [...s.open]
  const closes = open[gap] !== null
  open[gap] = closes ? null : side
  return {
    ...s,
    price: next,
    base: s.base + (side === 'bid' ? 1 : -1),
    quote: s.quote + (side === 'ask' ? next : -next),
    open,
    trips: s.trips + (closes ? 1 : 0),
    fill: { level: next, side, flippedTo: from, completes: closes },
  }
}

/** Inventory a re-center has to swap to rebuild HALF asks. */
export function swapCost(s: Pick<LadderState, 'base'>): number {
  return Math.abs(HALF - s.base) * SWAP_FEE_PER_UNIT * VALUE_PER_LEVEL
}

/**
 * The manual re-center: swap the inventory back to HALF base at the current
 * price, pay the fee, drop unfinished round trips, and aim the band at the
 * price. The band itself steps there on the following ticks.
 */
export function recenter(s: LadderState): LadderState {
  const swapped = HALF - s.base
  return {
    ...s,
    base: HALF,
    quote: s.quote - swapped * s.price - Math.abs(swapped) * SWAP_FEE_PER_UNIT,
    open: s.open.map(() => null),
    target: s.price,
    paid: swapCost(s),
    fill: null,
  }
}

function enter(s: LadderState, phase: LadderPhase): LadderState {
  return { ...s, phase, phaseTick: 0 }
}

/** One tick of the illustration. */
export function step(prev: LadderState): LadderState {
  const [roll, rng] = random(prev.rng)
  const s: LadderState = {
    ...prev,
    rng,
    tick: prev.tick + 1,
    phaseTick: prev.phaseTick + 1,
    fill: null,
  }

  switch (s.phase) {
    case 'ladder': {
      let dir = roll < 0.5 ? -1 : 1
      // Reflect off the band's last rung so the calm walk never leaves early.
      if (Math.abs(s.price + dir - s.center) > HALF - 1) dir = -dir
      const moved = applyMove(s, s.price + dir)
      return s.phaseTick >= LADDER_TICKS ? enter(moved, 'score') : moved
    }
    case 'score': {
      const toward = s.phaseTick >= DRIFT_PATIENCE || roll < DRIFT_BIAS
      let dir = toward ? s.exitDirection : -s.exitDirection
      if (Math.abs(s.price + dir - s.center) > HALF - 1 && dir !== s.exitDirection) dir = -dir
      const moved = applyMove(s, s.price + dir)
      return inRange(moved) ? moved : enter(moved, 'out')
    }
    case 'out':
      return s.phaseTick >= OUT_TICKS ? enter(s, 'recenter') : s
    case 'recenter': {
      if (s.phaseTick < COST_TICKS) return s
      if (s.target === null) return recenter(s)
      if (s.center !== s.target) {
        return { ...s, center: s.center + Math.sign(s.target - s.center) }
      }
      return {
        ...enter(s, 'ladder'),
        target: null,
        exitDirection: s.exitDirection === 1 ? -1 : 1,
      }
    }
  }
}

/** The readout, in game units. SCORE and DAMAGE stay separate; NET is both. */
export function readout(s: LadderState): LadderReadout {
  const value = s.base * s.price + s.quote
  const hodl = s.deposit.base * s.price + s.deposit.quote
  const net = value - hodl
  const round = (levels: number) => Math.round(levels * VALUE_PER_LEVEL * 100) / 100
  return {
    score: round(s.trips),
    damage: round(Math.max(0, s.trips - net)),
    net: round(net),
  }
}

/** Game-style signed figure: +0.42, -0.18, 0.00. */
export function formatFigure(value: number): string {
  if (value === 0) return '0.00'
  return `${value > 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}`
}

/** The facts each phase illustrates. */
export const PHASE_FACT: Record<LadderPhase, number> = {
  ladder: 0,
  score: 1,
  out: 2,
  recenter: 2,
}

/** A frame worth stopping on for each fact: a fill with its flip, a readout with damage, the price outside. */
function isKeyFrame(s: LadderState, fact: number): boolean {
  if (fact === 0) return s.phase === 'ladder' && s.fill !== null && s.trips > 0
  if (fact === 1) return s.phase === 'score' && readout(s).damage > 0
  return s.phase === 'out' && s.phaseTick === 1
}

/** Run forward to the next key frame of a fact, or stay on the current one. */
export function advanceTo(s: LadderState, fact: number): LadderState {
  if (isKeyFrame(s, fact)) return s
  let next = s
  for (let i = 0; i < 400; i++) {
    next = step(next)
    if (isKeyFrame(next, fact)) return next
  }
  return next
}
