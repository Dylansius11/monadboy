import { describe, expect, it } from 'vitest'
import {
  FIXTURE_MARKETS,
  FIXTURE_NOW,
  diskNetUsd,
  findDisk,
  findPool,
  passingCount,
  saveDisks,
  scoredPools,
} from './fixtures'

describe('fixture screening', () => {
  it('keeps an empty MON_AUSD book visible but filtered at every difficulty', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const empty = scoredPools(difficulty).find(
        ({ pool }) => pool.tokenX.symbol === 'MON' && pool.tokenY.symbol === 'AUSD',
      )!
      expect(empty.book).toEqual({ bid: null, ask: null })
      expect(empty.pool.tvlUsd).toBe(0)
      expect(empty.passes).toBe(false)
      expect(empty.score.liquidityDepth).toBe(0)
    }
  })

  it('loosens the filter without hiding failed markets', () => {
    const easy = scoredPools('easy')
    const hard = scoredPools('hard')
    expect(easy.map(({ pool }) => pool.pairAddress)).toEqual(
      hard.map(({ pool }) => pool.pairAddress),
    )
    expect(passingCount('hard')).toBeGreaterThanOrEqual(passingCount('normal'))
    expect(passingCount('normal')).toBeGreaterThanOrEqual(passingCount('easy'))
    expect(easy.some(({ passes }) => !passes)).toBe(true)
  })

  it('GOD MODE bypasses comfort gates but never the unsellable check', () => {
    const markets = scoredPools('hard', true)
    const clean = markets.find(({ score }) => score.honeypotClean)!
    const blocked = markets.find(({ score }) => !score.honeypotClean)!
    expect(clean.passes).toBe(true)
    expect(blocked.passes).toBe(false)
    expect(passingCount('hard', true)).toBeGreaterThan(passingCount('easy'))
  })

  it('uses the frozen fixture clock and neutral momentum', () => {
    const first = scoredPools('hard')
    expect(scoredPools('hard')).toEqual(first)
    for (const { score, pool } of first) {
      expect(pool.createdAt).toBeLessThanOrEqual(FIXTURE_NOW)
      expect(score.momentum).toBe(50)
      expect(score.momentumDegraded).toBe(true)
      expect(score.safety).toBeGreaterThanOrEqual(0)
      expect(score.safety).toBeLessThanOrEqual(100)
      expect(score.heat).toBeGreaterThanOrEqual(0)
      expect(score.heat).toBeLessThanOrEqual(100)
    }
  })
})

describe('fixture lookup', () => {
  it('matches market identity regardless of casing', () => {
    const first = FIXTURE_MARKETS[0].pool.pairAddress
    expect(findPool(first.toUpperCase().replace('0X', '0x'))?.pool.pairAddress).toBe(first)
  })

  it('represents missing markets and disks as absence', () => {
    expect(findPool(null)).toBeUndefined()
    expect(findPool('0x' + '9'.repeat(40))).toBeUndefined()
    expect(findDisk(null)).toBeUndefined()
    expect(findDisk(99)).toBeUndefined()
  })

  it('returns isolated disk state and includes negative net results', () => {
    const disks = saveDisks()
    const negative = disks.find((disk) => diskNetUsd(disk) < 0)!
    expect(diskNetUsd(negative)).toBeCloseTo(-3.1)
    disks[0].name = 'changed'
    expect(findDisk(disks[0].diskId)?.name).not.toBe('changed')
  })
})
