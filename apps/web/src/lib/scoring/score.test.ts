import { describe, expect, it } from 'vitest'
import {
  gatesFor,
  mainnetProfile,
  selfTestnetProfile,
} from '../../config/thresholds'
import { evaluateGates } from './gates'
import {
  liquidityDepthScore,
  momentumScore,
  poolAgeScore,
  quoteQualityScore,
  realizedVolScore,
  scorePool,
  turnoverScore,
} from './score'
import type { Pool } from '../../types/domain'

const NOW = 1_785_000_000
const DAY = 86_400
const chog: Pool = {
  pairAddress: `0x${'0'.repeat(39)}1`,
  tokenX: { address: `0x${'0'.repeat(39)}2`, symbol: 'CHOG', decimals: 18 },
  tokenY: { address: `0x${'0'.repeat(39)}3`, symbol: 'USDC', decimals: 6 },
  tvlUsd: 10_000,
  volume24hUsd: 5_000,
  createdAt: NOW - 10 * DAY,
  createdAtIsExact: true,
  lpConcentration: 0.5,
  realizedVol24h: 0.8,
}
const deep: Pool = {
  ...chog,
  tvlUsd: 100_000,
  volume24hUsd: 50_000,
  createdAt: NOW - 60 * DAY,
  lpConcentration: 0.1,
  realizedVol24h: 0.4,
}
const thin: Pool = {
  ...chog,
  tvlUsd: 100,
  volume24hUsd: 0,
  createdAt: NOW - 60,
  lpConcentration: 0.9,
}
const pools = [chog, deep, thin]

function score(
  pool: Pool,
  overrides: Partial<Parameters<typeof scorePool>[0]> = {},
) {
  return scorePool(
    {
      pool,
      momentum: {
        score: 70,
      },
      momentumAgeSeconds: 3600,
      honeypotClean: true,
      nowSeconds: NOW,
      ...overrides,
    },
    mainnetProfile,
  )
}

describe('liquidity depth is log scaled', () => {
  it('is 0 at or below the floor and 100 at or above the ceiling', () => {
    expect(liquidityDepthScore(0, mainnetProfile)).toBe(0)
    expect(
      liquidityDepthScore(mainnetProfile.depthFloorUsd, mainnetProfile),
    ).toBe(0)
    expect(
      liquidityDepthScore(mainnetProfile.depthCeilingUsd * 2, mainnetProfile),
    ).toBe(100)
  })

  it('separates small pools far more than large ones', () => {
    // The whole reason for the log. Linear scaling would make every pool below
    // the largest one look identical, which is exactly the screen we are
    // trying not to build.
    const smallGap =
      liquidityDepthScore(100_000, mainnetProfile) -
      liquidityDepthScore(50_000, mainnetProfile)
    const largeGap =
      liquidityDepthScore(4_050_000, mainnetProfile) -
      liquidityDepthScore(4_000_000, mainnetProfile)
    expect(smallGap).toBeGreaterThan(largeGap * 5)
  })

  it('rises monotonically', () => {
    let previous = -1
    for (const tvl of [30_000, 60_000, 200_000, 900_000, 3_000_000]) {
      const s = liquidityDepthScore(tvl, mainnetProfile)
      expect(s).toBeGreaterThanOrEqual(previous)
      previous = s
    }
  })

  it('scores a self-seeded pool sensibly under its own profile', () => {
    // Injecting the correct profile keeps small testnet markets measurable.
    const belowMainnetFloor = mainnetProfile.depthFloorUsd - 1
    expect(liquidityDepthScore(belowMainnetFloor, mainnetProfile)).toBe(0)
    expect(
      liquidityDepthScore(belowMainnetFloor, selfTestnetProfile),
    ).toBeGreaterThan(0)
  })
})

describe('pool age saturates', () => {
  it('is 0 for a pool created now and 100 past saturation', () => {
    expect(poolAgeScore(0, mainnetProfile)).toBe(0)
    expect(poolAgeScore(-100, mainnetProfile)).toBe(0)
    expect(
      poolAgeScore(mainnetProfile.ageSaturationSeconds * 3, mainnetProfile),
    ).toBe(100)
  })
})

describe('quote quality is a lookup', () => {
  it.each(['USDC', 'AUSD', 'MON'])('rewards the strong quote %s', (symbol) => {
    expect(quoteQualityScore(symbol, mainnetProfile)).toBe(100)
  })

  it.each(['WETH', 'WBTC', 'cbBTC', 'XAUT'])(
    'gives the mid quote %s intermediate quality',
    (symbol) => {
      expect(quoteQualityScore(symbol, mainnetProfile)).toBe(60)
    },
  )

  it('gives unknown quotes the lowest quality', () => {
    expect(quoteQualityScore('SOMERANDOMTOKEN', mainnetProfile)).toBe(20)
  })
})

describe('turnover is banded, not monotonic', () => {
  const tvl = 100_000

  it('peaks throughout the specified 0.5x to 3x band, inclusively', () => {
    for (const turnover of [0.5, 1, 2, 3]) {
      expect(turnoverScore(tvl * turnover, tvl, mainnetProfile)).toBe(100)
    }
    expect(turnoverScore(tvl * 0.49, tvl, mainnetProfile)).toBeLessThan(100)
    expect(turnoverScore(tvl * 3.1, tvl, mainnetProfile)).toBeLessThan(100)
  })

  it('falls off on BOTH sides', () => {
    // A monotonic score would rank the most dangerous pool in the list as the
    // best one, which is the opposite of what this product is for.
    const dead = turnoverScore(tvl * 0.01, tvl, mainnetProfile)
    const frantic = turnoverScore(tvl * 8, tvl, mainnetProfile)
    const ideal = turnoverScore(tvl * 0.5, tvl, mainnetProfile)

    expect(dead).toBeLessThan(ideal)
    expect(frantic).toBeLessThan(ideal)
    expect(frantic).toBe(0)
  })

  it('is not monotonic across the whole range, provably', () => {
    const samples = [0.01, 0.1, 0.5, 1.0, 2, 4, 8].map((t) =>
      turnoverScore(tvl * t, tvl, mainnetProfile),
    )
    const rising = samples.some((s, i) => i > 0 && s > samples[i - 1])
    const falling = samples.some((s, i) => i > 0 && s < samples[i - 1])
    expect(rising && falling).toBe(true)
  })

  it('returns 0 rather than dividing by zero on an empty pool', () => {
    expect(turnoverScore(1000, 0, mainnetProfile)).toBe(0)
  })
})

describe('volatility', () => {
  it('returns neutral when history is too short to measure', () => {
    expect(realizedVolScore(null, mainnetProfile)).toBe(50)
  })

  it('clamps at both ends', () => {
    expect(realizedVolScore(0, mainnetProfile)).toBe(0)
    expect(realizedVolScore(99, mainnetProfile)).toBe(100)
  })
})

describe('momentum degrades to neutral, never to zero', () => {
  it('is neutral when the token has no entry', () => {
    // Missing trade-count history is not evidence of zero activity.
    const result = momentumScore(undefined, 0, mainnetProfile)
    expect(result.score).toBe(50)
    expect(result.degraded).toBe(true)
  })

  it('is neutral when the snapshot is stale', () => {
    const entry = { score: 95 }
    const fresh = momentumScore(entry, 3600, mainnetProfile)
    const stale = momentumScore(
      entry,
      mainnetProfile.momentumStaleAfterSeconds + 1,
      mainnetProfile,
    )

    expect(fresh.score).toBe(95)
    expect(fresh.degraded).toBe(false)
    expect(stale.score).toBe(50)
    expect(stale.degraded).toBe(true)
  })

  it('flags degradation so the UI can say so', () => {
    const scored = score(chog, { momentum: undefined })
    expect(scored.momentumDegraded).toBe(true)
  })
})

describe('scorePool', () => {
  it('returns every score inside 0 to 100', () => {
    for (const pool of pools) {
      const s = score(pool)
      for (const [key, value] of Object.entries(s)) {
        if (typeof value !== 'number') continue
        expect(value, `${pool.tokenX.symbol}.${key}`).toBeGreaterThanOrEqual(0)
        expect(value, `${pool.tokenX.symbol}.${key}`).toBeLessThanOrEqual(100)
      }
    }
  })

  it('redistributes the concentration weight when it is unreadable', () => {
    const scored = score({ ...chog, lpConcentration: null })
    const w = mainnetProfile.safetyWeights
    const expected =
      (scored.liquidityDepth * w.liquidityDepth +
        scored.poolAge * w.poolAge +
        scored.quoteQuality * w.quoteQuality) /
      (w.liquidityDepth + w.poolAge + w.quoteQuality)
    expect(scored.safety).toBe(Math.round(expected))
    expect(scored.lpConcentrationScore).toBe(50)
  })

  it('scores a deep, old, USDC-quoted pool above a thin new one', () => {
    expect(score(deep).safety).toBeGreaterThan(score(thin).safety)
  })

  it('reports the terms, not just the totals', () => {
    // The tracker explains a score by showing its parts. An opaque number is
    // exactly the intimidating artifact this product removes.
    const s = score(chog)
    expect(s.liquidityDepth).toBeGreaterThan(0)
    expect(s.poolAge).toBeGreaterThan(0)
    expect(s.quoteQuality).toBe(100)
  })

  it('has no hidden clock', () => {
    // Advancing the supplied clock ages a young market without reading time.
    const young = thin
    const beforeAging = scorePool(
      {
        pool: young,
        momentum: undefined,
        momentumAgeSeconds: 0,
        honeypotClean: true,
        nowSeconds: NOW,
      },
      mainnetProfile,
    )
    const aged = scorePool(
      {
        pool: young,
        momentum: undefined,
        momentumAgeSeconds: 0,
        honeypotClean: true,
        nowSeconds: NOW + 60 * 60 * 24 * 90,
      },
      mainnetProfile,
    )
    expect(beforeAging.poolAge).toBeLessThan(100)
    expect(aged.poolAge).toBeGreaterThan(beforeAging.poolAge)
  })
})

describe('gates run before scores and are absolute', () => {
  const easy = gatesFor('easy', mainnetProfile)
  const hard = gatesFor('hard', mainnetProfile)

  it('collects every failure, not just the first', () => {
    // "This pool is too new" when it is also a honeypot is the least useful
    // true thing a screen can say.
    const bad: Pool = { ...thin, createdAt: NOW - 60, tvlUsd: 100 }
    const result = evaluateGates(
      bad,
      { ...score(bad), honeypotClean: false },
      easy,
      NOW,
    )

    expect(result.passed).toBe(false)
    expect(result.failures).toContain('tvl-too-low')
    expect(result.failures).toContain('too-new')
    expect(result.failures).toContain('honeypot')
    expect(result.failures.length).toBeGreaterThan(2)
  })

  it('fails a honeypot at EVERY difficulty, including hard', () => {
    // CLAUDE.md rule 5. The honeypot check is never disabled, including in
    // GOD MODE, which is a modifier on hard rather than a fourth tier.
    for (const gates of [easy, gatesFor('normal', mainnetProfile), hard]) {
      const result = evaluateGates(
        chog,
        { ...score(chog), honeypotClean: false },
        gates,
        NOW,
      )
      expect(result.failures).toContain('honeypot')
      expect(result.passed).toBe(false)
    }
  })

  it('admits more pools at hard than at easy', () => {
    const atEasy = pools.filter(
      (p) => evaluateGates(p, score(p), easy, NOW).passed,
    ).length
    const atHard = pools.filter(
      (p) => evaluateGates(p, score(p), hard, NOW).passed,
    ).length
    expect(atEasy).toBe(1)
    expect(atHard).toBe(2)
  })

  it('rejects a quote token the tier does not allow', () => {
    const weird: Pool = {
      ...chog,
      tokenY: { ...chog.tokenY, symbol: 'SKETCH' },
    }
    const result = evaluateGates(weird, score(weird), easy, NOW)
    expect(result.failures).toContain('quote-not-allowed')
  })

  it('rejects a pool that is too hot for the tier', () => {
    const result = evaluateGates(chog, { ...score(chog), heat: 99 }, easy, NOW)
    expect(result.failures).toContain('heat-too-high')
  })

  it('distinguishes insufficient age evidence from a genuinely young market', () => {
    const bounded = { ...deep, createdAt: NOW - DAY, createdAtIsExact: false }
    const unknown = evaluateGates(bounded, score(bounded), easy, NOW)
    expect(unknown.unverified).toEqual(['age'])
    expect(unknown.failures).not.toContain('too-new')
    const exact = { ...bounded, createdAtIsExact: true }
    expect(evaluateGates(exact, score(exact), easy, NOW).failures).toContain(
      'too-new',
    )
  })

  it('accepts sufficient age evidence, including an inexact bound at the boundary', () => {
    const bounded = {
      ...deep,
      createdAt: NOW - easy.minAgeSeconds,
      createdAtIsExact: false,
    }
    const result = evaluateGates(bounded, score(bounded), easy, NOW)
    expect(result.unverified).toEqual([])
    expect(result.failures).not.toContain('too-new')
  })

})
