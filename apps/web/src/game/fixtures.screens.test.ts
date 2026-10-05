import { mainnetMarkets } from '@monadboy/sdk'
import { describe, expect, it } from 'vitest'
import {
  gatesFor,
  mainnetProfile,
  profiles,
  selfTestnetProfile,
} from '../config/thresholds'
import { ladderPlanner } from '../lib/range/ladder-planner'
import { planForWidth } from '../lib/range/plan'
import { evaluateGates } from '../lib/scoring/gates'
import { scorePool } from '../lib/scoring/score'
import { zPool, zSaveDisk } from '../types/domain'
import { FIXTURE_MARKETS, FIXTURE_NOW, saveDisks, scoredPools } from './fixtures'

const tiers = ['easy', 'normal', 'hard'] as const

// Fixture coverage for the schema, scoring and ladder inputs used by screens.
describe('screen fixture inputs', () => {
  it('keeps every market and disk compatible with the consumer schemas', () => {
    for (const { pool } of FIXTURE_MARKETS) expect(zPool.parse(pool)).toEqual(pool)
    for (const { FIXTURE, ...disk } of saveDisks()) {
      expect(FIXTURE).toBe(true)
      expect(zSaveDisk.parse(disk)).toEqual(disk)
    }
  })

  it('exercises both six- and eighteen-decimal token amounts', () => {
    const tokens = FIXTURE_MARKETS.flatMap(({ pool }) => [pool.tokenX, pool.tokenY])
    expect(new Set(tokens.map(({ decimals }) => decimals))).toEqual(new Set([6, 18]))
  })

  it('exercises unavailable concentration and volatility without inventing zeroes', () => {
    const unknown = scoredPools('hard').find(({ pool }) => pool.realizedVol24h === null)!
    expect(unknown.pool.lpConcentration).toBeNull()
    expect(unknown.score.realizedVol).toBe(50)
    expect(unknown.score.lpConcentrationScore).toBe(50)
  })

  it('includes depth below the EASY floor and ages on both sides of saturation', () => {
    const easy = gatesFor('easy', mainnetProfile)
    expect(FIXTURE_MARKETS.some(({ pool }) => pool.tvlUsd < easy.minTvlUsd)).toBe(true)
    const ages = FIXTURE_MARKETS.map(({ pool }) => FIXTURE_NOW - pool.createdAt)
    expect(ages.some((age) => age < mainnetProfile.ageSaturationSeconds)).toBe(true)
    expect(ages.some((age) => age >= mainnetProfile.ageSaturationSeconds)).toBe(true)
  })

  it('gives different fixture volatilities distinct price-level ladders', () => {
    const plans = FIXTURE_MARKETS.filter(({ book }) => book.bid !== null).map(({ pool, book }) => {
      const symbol = `${pool.tokenX.symbol}_${pool.tokenY.symbol}`
      const params = mainnetMarkets.find((market) => market.symbol === symbol)!.params
      return planForWidth((book.bid! + book.ask!) / 2, 'wide', ladderPlanner, {
        budgetQuote: 250,
        sigmaDaily: pool.realizedVol24h! / Math.sqrt(365),
        params,
      }).plan
    })
    expect(new Set(plans.map(({ step }) => step)).size).toBeGreaterThan(1)
    for (const plan of plans) {
      expect(plan.step).toBeGreaterThan(0)
      expect(plan.levels).toBeGreaterThanOrEqual(2)
      expect(plan.levels).toBeLessThanOrEqual(8)
      expect(plan.low).toBeLessThan(plan.high)
    }
  })
})

describe('scoring profile invariants', () => {
  it('normalizes both axes to the same full weight in every profile', () => {
    for (const profile of Object.values(profiles)) {
      for (const weights of [profile.safetyWeights, profile.heatWeights]) {
        expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10)
      }
    }
  })

  it('uses identical model weights on mainnet and self-seeded testnet', () => {
    expect(selfTestnetProfile.safetyWeights).toEqual(mainnetProfile.safetyWeights)
    expect(selfTestnetProfile.heatWeights).toEqual(mainnetProfile.heatWeights)
  })

  it('scales self-seeded depth without silently applying the mainnet floor', () => {
    expect(selfTestnetProfile.depthFloorUsd).toBeLessThan(mainnetProfile.depthFloorUsd)
    expect(selfTestnetProfile.depthCeilingUsd).toBeLessThan(mainnetProfile.depthCeilingUsd)
    expect(selfTestnetProfile.depthFloorUsd + 1).toBeLessThan(mainnetProfile.depthFloorUsd)
  })

  it('keeps the ideal turnover band below the dead-volume threshold', () => {
    for (const profile of Object.values(profiles)) {
      expect(profile.turnoverIdealLow).toBeLessThan(profile.turnoverIdealHigh)
      expect(profile.turnoverIdealHigh).toBeLessThan(profile.turnoverDeadAbove)
    }
  })
})

describe('screen fixture gate invariants', () => {
  it('retains the unsellable check at every tier in both profiles', () => {
    for (const profile of Object.values(profiles)) {
      for (const tier of tiers) expect(gatesFor(tier, profile).honeypotCheck).toBe(true)
    }
  })

  it('loosens comfort gates monotonically without removing the hard check', () => {
    for (const profile of Object.values(profiles)) {
      const [easy, normal, hard] = tiers.map((tier) => gatesFor(tier, profile))
      expect(easy.minTvlUsd).toBeGreaterThan(normal.minTvlUsd)
      expect(normal.minTvlUsd).toBeGreaterThan(hard.minTvlUsd)
      expect(easy.minSafety).toBeGreaterThan(normal.minSafety)
      expect(normal.minSafety).toBeGreaterThan(hard.minSafety)
      expect(easy.maxHeat).toBeLessThan(normal.maxHeat)
      expect(normal.maxHeat).toBeLessThan(hard.maxHeat)
    }
  })

  it('restricts EASY to strong quote assets', () => {
    for (const profile of Object.values(profiles)) {
      expect(gatesFor('easy', profile).allowedQuoteSymbols).toEqual(profile.strongQuotes)
      expect(gatesFor('easy', profile).allowedQuoteSymbols).not.toContain('WETH')
    }
  })

  it('admits clean fixture markets under the self-seeded EASY profile', () => {
    const gates = gatesFor('easy', selfTestnetProfile)
    for (const { pool, honeypotClean } of FIXTURE_MARKETS.filter((market) => market.honeypotClean)) {
      const score = scorePool({ pool, honeypotClean, momentumAgeSeconds: 0, nowSeconds: FIXTURE_NOW }, selfTestnetProfile)
      expect(evaluateGates(pool, score, gates, FIXTURE_NOW).passed).toBe(true)
    }
  })
})
