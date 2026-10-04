import { describe, expect, it } from 'vitest'
import { createSim, nudge, recordRebalance, step, summarize } from './sim'
import type { RangePlan } from '../lib/range/plan'
import type { Pool } from '../types/domain'


const POOL: Pool = {
  pairAddress: '0x1111111111111111111111111111111111111111',
  tokenX: {
    address: '0x1111111111111111111111111111111111111111',
    symbol: 'MON',
    decimals: 18,
  },
  tokenY: {
    address: '0x2222222222222222222222222222222222222222',
    symbol: 'USDC',
    decimals: 6,
  },
  tvlUsd: 100_000,
  volume24hUsd: 20_000,
  createdAt: 0,
  createdAtIsExact: true,
  lpConcentration: 0.1,
  realizedVol24h: 0.4,
}

const AMOUNT = 100
const MID = 1
const RANGE: RangePlan = { low: 0.95, high: 1.05, step: 0.0025, levels: 8 }

describe('createSim + step, determinism', () => {
  it('the same pool produces the same opening state every time', () => {
    const a = createSim(POOL, MID)
    const b = createSim(POOL, MID)
    expect(a).toEqual(b)
  })

  it('the same seed produces the same sequence, every call', () => {
    // Two independent trajectories from the same starting point. If step()
    // read the clock or Math.random(), these would diverge; they must not,
    // because the out-of-range moment has to be reproducible on stage.

    let a = createSim(POOL, MID)
    let b = createSim(POOL, MID)

    for (let i = 0; i < 25; i += 1) {
      a = step(a, POOL, RANGE, AMOUNT)
      b = step(b, POOL, RANGE, AMOUNT)
    }

    expect(a).toEqual(b)
  })
})

describe('fees and damage, mutually exclusive', () => {
  // A distant price range keeps this walk outside without depending on its draw.
  const outside: RangePlan = { low: 2, high: 3, step: 0.0025, levels: 8 }

  it('fees do not accrue by even a fraction while out of range', () => {
    let state = createSim(POOL, MID)
    expect(state.feesEarnedUsd).toBe(0)

    for (let i = 0; i < 10; i += 1) {
      state = step(state, POOL, outside, AMOUNT)
      expect(state.feesEarnedUsd).toBe(0)
    }
  })

  it('damage accrues while out of range and is stored positive', () => {
    let state = createSim(POOL, MID)
    expect(state.damageUsd).toBe(0)

    for (let i = 0; i < 10; i += 1) {
      const previous = state.damageUsd
      state = step(state, POOL, outside, AMOUNT)
      expect(state.damageUsd).toBeGreaterThan(previous)
    }
    expect(state.damageUsd).toBeGreaterThan(0)
  })
})

describe('ladder price boundaries', () => {
  const quiet = { ...POOL, realizedVol24h: 0 }

  it('earns at either inclusive edge and damages only strictly outside', () => {
    for (const mid of [RANGE.low, RANGE.high]) {
      const next = step(createSim(quiet, mid), quiet, RANGE, AMOUNT)
      expect(next.feesEarnedUsd).toBeGreaterThan(0)
      expect(next.damageUsd).toBe(0)
      expect(next.ticksInRange).toBe(1)
    }
    for (const mid of [RANGE.low - 0.0001, RANGE.high + 0.0001]) {
      const next = step(createSim(quiet, mid), quiet, RANGE, AMOUNT)
      expect(next.feesEarnedUsd).toBe(0)
      expect(next.damageUsd).toBeGreaterThan(0)
      expect(next.ticksInRange).toBe(0)
    }
  })

  it('moves both directions in the ladder step rather than a token-specific unit', () => {
    const start = createSim(POOL, MID)
    expect(nudge(start, 1, 2, 0.01).mid).toBeCloseTo(1.0201)
    expect(nudge(start, -1, 2, 0.01).mid).toBeCloseTo(0.9802960494)
  })

  it('records a nudged price on the next tick without changing the clock pace', () => {
    const moved = nudge(createSim(quiet, MID), 1, 2, RANGE.step)
    const next = step(moved, quiet, RANGE, AMOUNT)
    expect(next.history.at(-1)).toBeCloseTo(1.00500625)
    expect(next.mid).toBe(next.history.at(-1))
    expect(next.elapsedSeconds).toBe(3_600)
  })
})

describe('nudge', () => {
  it('walks the mid toward the edge and, applied enough times, exits the range', () => {
    let state = createSim(POOL, MID)

    expect(state.mid).toBeGreaterThanOrEqual(RANGE.low)
    expect(state.mid).toBeLessThanOrEqual(RANGE.high)

    // Walk toward the upper edge, decisively, the way SELECT does on stage.
    for (let i = 0; i < 8; i += 1) {
      state = nudge(state, 1, 3, RANGE.step)
    }

    expect(state.mid).toBeGreaterThan(RANGE.high)
  })

  it('does not touch fees, damage, elapsed time, or history', () => {
    const before = createSim(POOL, MID)
    const after = nudge(before, 1, 3, RANGE.step)

    expect(after.feesEarnedUsd).toBe(before.feesEarnedUsd)
    expect(after.damageUsd).toBe(before.damageUsd)
    expect(after.elapsedSeconds).toBe(before.elapsedSeconds)
    expect(after.history).toEqual(before.history)
    expect(after.seed).toBe(before.seed)
  })
})

describe('history', () => {
  it('stays capped', () => {
    let state = createSim(POOL, MID)

    for (let i = 0; i < 60; i += 1) {
      state = step(state, POOL, RANGE, AMOUNT)
      expect(state.history.length).toBeLessThanOrEqual(30)
    }
    expect(state.history.length).toBe(30)
  })
})

describe('the run summary S8 reports on', () => {

  it('a run that never ticked reports 0%, not NaN', () => {
    // Gate 2.4: the zero-tick state is a real render, so it must be a real
    // number. 0/0 would put NaN% on the results screen.
    expect(summarize(createSim(POOL, MID)).timeInRangePct).toBe(0)
  })

  it('counts every tick, and counts the in-range ones separately', () => {
    let sim = createSim(POOL, MID)
    for (let i = 0; i < 10; i += 1) sim = step(sim, POOL, RANGE, AMOUNT)

    expect(sim.totalTicks).toBe(10)
    expect(sim.ticksInRange).toBeLessThanOrEqual(sim.totalTicks)
    expect(summarize(sim).timeInRangePct).toBeCloseTo(
      (sim.ticksInRange / 10) * 100,
    )
  })

  it('a streak broken by going out of range does not carry into the next one', () => {
    // Walked out of range by hand rather than waiting for the RNG to do it,
    // so the assertion is about the counter and not about the walk.
    let sim = createSim(POOL, MID)
    sim = step(sim, POOL, RANGE, AMOUNT)
    const afterOne = sim.streakSeconds

    sim = nudge(sim, 1, 100, RANGE.step)
    sim = step(sim, POOL, RANGE, AMOUNT)

    expect(sim.streakSeconds).toBe(0)
    expect(sim.bestStreakSeconds).toBe(afterOne)
  })

  it('net is fees less damage, and damage stays positive in the summary', () => {
    let sim = createSim(POOL, MID)
    sim = nudge(sim, 1, 100, RANGE.step)
    for (let i = 0; i < 5; i += 1) sim = step(sim, POOL, RANGE, AMOUNT)

    const run = summarize(sim)
    expect(run.damageUsd).toBeGreaterThan(0)
    expect(run.netUsd).toBeCloseTo(run.feesEarnedUsd - run.damageUsd)
  })

  it('recordRebalance counts, and charges for the swap it just did', () => {
    const before = createSim(POOL, MID)
    const after = recordRebalance(before, AMOUNT)

    expect(after.rebalances).toBe(1)
    // PRD.md 8.5 point 2: a rebalance is never free. A count without a cost
    // would teach a beginner that churning out of trouble is free, which is
    // the exact belief that makes autopilot lose money in a choppy market.
    expect(after.damageUsd).toBeGreaterThan(before.damageUsd)
    // And nothing else moves. The price did not change because the player
    // pressed a button; only the position around it did.
    expect({ ...after, rebalances: 0, damageUsd: before.damageUsd }).toEqual(
      before,
    )
  })

  it('makes repeated rebalancing cost more than doing it once', () => {
    // The honest shape of the lesson: each rescue is cheap, a habit is not.
    let churned = createSim(POOL, MID)
    for (let i = 0; i < 6; i += 1) churned = recordRebalance(churned, AMOUNT)
    const once = recordRebalance(createSim(POOL, MID), AMOUNT)

    expect(churned.damageUsd).toBeGreaterThan(once.damageUsd * 5)
  })
})
