import { describe, expect, it } from 'vitest'
import {
  HALF,
  ROWS,
  START_LEVEL,
  VALUE_PER_LEVEL,
  advanceTo,
  applyMove,
  createLadder,
  formatFigure,
  inRange,
  orders,
  readout,
  step,
  swapCost,
} from './ladder-model'
import type { LadderState } from './ladder-model'

function run(seed: number, ticks: number): LadderState[] {
  const frames = [createLadder(seed)]
  for (let i = 0; i < ticks; i++) frames.push(step(frames[i]))
  return frames
}

describe('ladder model', () => {
  it('opens with HALF bids below the price and HALF asks above it', () => {
    const book = orders(createLadder(1))
    expect(book.size).toBe(2 * HALF)
    for (let k = 1; k <= HALF; k++) {
      expect(book.get(START_LEVEL - k)).toBe('bid')
      expect(book.get(START_LEVEL + k)).toBe('ask')
    }
    expect(book.has(START_LEVEL)).toBe(false)
  })

  it('re-arms a filled order on the other side, one spread away', () => {
    const up = applyMove(createLadder(1), START_LEVEL + 1)
    expect(up.fill).toEqual({ level: START_LEVEL + 1, side: 'ask', flippedTo: START_LEVEL, completes: false })
    expect(orders(up).get(START_LEVEL)).toBe('bid')

    const down = applyMove(createLadder(1), START_LEVEL - 1)
    expect(down.fill).toEqual({ level: START_LEVEL - 1, side: 'bid', flippedTo: START_LEVEL, completes: false })
    expect(orders(down).get(START_LEVEL)).toBe('ask')
  })

  it('keeps every fill of a long walk flipping to the adjacent level', () => {
    for (const s of run(7, 600)) {
      if (s.fill === null) continue
      expect(Math.abs(s.fill.flippedTo - s.fill.level)).toBe(1)
      expect(orders(s).get(s.fill.flippedTo)).toBe(s.fill.side === 'ask' ? 'bid' : 'ask')
      expect(orders(s).size).toBe(2 * HALF)
    }
  })

  it('earns the spread only when a round trip completes', () => {
    const sold = applyMove(createLadder(1), START_LEVEL + 1)
    expect(readout(sold).score).toBe(0)
    const soldTwice = applyMove(sold, START_LEVEL + 2)
    expect(readout(soldTwice).score).toBe(0)

    const back = applyMove(soldTwice, START_LEVEL + 1)
    expect(back.fill?.completes).toBe(true)
    expect(back.trips).toBe(1)
    expect(readout(back).score).toBe(VALUE_PER_LEVEL)
    const home = applyMove(back, START_LEVEL)
    expect(readout(home)).toEqual({ score: 0.12, damage: 0, net: 0.12 })
  })

  it('counts the price move against the coins held as DAMAGE, never inside SCORE', () => {
    let s = createLadder(1)
    for (let k = 1; k <= 3; k++) s = applyMove(s, START_LEVEL + k)
    const r = readout(s)
    expect(r.score).toBe(0)
    expect(r.damage).toBeGreaterThan(0)
    expect(r.net).toBeCloseTo(r.score - r.damage, 10)
  })

  it('fills nothing out of range', () => {
    let s = createLadder(1)
    for (let k = 1; k <= HALF + 1; k++) s = applyMove(s, START_LEVEL + k)
    expect(inRange(s)).toBe(false)
    expect(s.fill).toBeNull()
    const further = applyMove(s, s.price + 1)
    expect(further.fill).toBeNull()
    expect(further.trips).toBe(s.trips)
    expect(further.base).toBe(s.base)
    expect(further.quote).toBe(s.quote)

    for (const f of run(3, 600)) {
      if (!inRange(f)) expect(f.fill).toBeNull()
      if (f.phase === 'out' || f.phase === 'recenter') expect(f.fill).toBeNull()
    }
  })

  it('freezes the readout while out of range', () => {
    const frames = run(11, 200).filter((f) => f.phase === 'out')
    expect(frames.length).toBeGreaterThan(0)
    const first = frames.find((f) => f.phaseTick === 0)
    const last = frames.find((f) => f.phaseTick === 4)
    expect(first && last && readout(last)).toEqual(first && readout(first))
  })

  it('re-centers the band on the price and charges the swap cost', () => {
    const frames = run(5, 200)
    const out = frames.find((f) => f.phase === 'out')
    expect(out).toBeDefined()
    if (!out) return
    const cost = swapCost(out)
    expect(cost).toBeGreaterThan(0)

    const swapIndex = frames.findIndex((f) => f.target !== null)
    const before = frames[swapIndex - 1]
    const swapped = frames[swapIndex]
    expect(before.center).not.toBe(before.price)
    expect(readout(swapped).net).toBeCloseTo(readout(before).net - cost, 10)
    expect(swapped.paid).toBe(cost)
    expect(swapped.open.every((leg) => leg === null)).toBe(true)

    const settled = frames.slice(swapIndex).find((f) => f.phase === 'ladder')
    expect(settled?.center).toBe(swapped.price)
    expect(settled && orders(settled).size).toBe(2 * HALF)
  })

  it('leaves the band and re-centers within forty ticks of starting', () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      const frames = run(seed, 40)
      expect(frames.some((f) => f.phase === 'out')).toBe(true)
      expect(frames.some((f) => f.phase === 'recenter')).toBe(true)
    }
  })

  it('keeps the price and the band inside the drawn ladder forever', () => {
    for (const f of run(42, 3000)) {
      expect(f.price).toBeGreaterThanOrEqual(0)
      expect(f.price).toBeLessThan(ROWS)
      expect(f.center - HALF).toBeGreaterThanOrEqual(0)
      expect(f.center + HALF).toBeLessThan(ROWS)
    }
  })

  it('replays the same walk from the same seed', () => {
    expect(run(9, 300)).toEqual(run(9, 300))
    expect(run(10, 300).map((f) => f.price)).not.toEqual(run(9, 300).map((f) => f.price))
  })

  it('jumps to a frame that shows each fact', () => {
    const start = createLadder(4)
    const fill = advanceTo(start, 0)
    expect(fill.phase).toBe('ladder')
    expect(fill.fill).not.toBeNull()

    const scored = advanceTo(fill, 1)
    expect(scored.phase).toBe('score')
    expect(readout(scored).damage).toBeGreaterThan(0)

    const out = advanceTo(scored, 2)
    expect(out.phase).toBe('out')
    expect(advanceTo(out, 2)).toBe(out)
  })

  it('formats figures the way the game does', () => {
    expect(formatFigure(0.42)).toBe('+0.42')
    expect(formatFigure(-0.18)).toBe('-0.18')
    expect(formatFigure(0)).toBe('0.00')
  })
})
