import { describe, expect, it } from 'vitest'
import { LAYERS, skyline, stars } from './skyline'

describe('skyline', () => {
  it('draws the same city for the same seed and a different one for another', () => {
    const a = skyline({ seed: 7, width: 480, layer: 'near' })
    expect(skyline({ seed: 7, width: 480, layer: 'near' })).toEqual(a)
    expect(skyline({ seed: 8, width: 480, layer: 'near' })).not.toEqual(a)
  })

  it('covers the full width with no gaps between buildings', () => {
    for (const layer of Object.keys(LAYERS) as Array<keyof typeof LAYERS>) {
      const { buildings } = skyline({ seed: 3, width: 777, layer })
      expect(buildings[0].x).toBeLessThanOrEqual(0)
      for (let i = 1; i < buildings.length; i++) {
        expect(buildings[i].x).toBeLessThanOrEqual(
          buildings[i - 1].x + buildings[i - 1].w,
        )
      }
      const last = buildings.at(-1)!
      expect(last.x + last.w).toBeGreaterThanOrEqual(777)
    }
  })

  it('keeps every building inside its layer height band', () => {
    for (const layer of Object.keys(LAYERS) as Array<keyof typeof LAYERS>) {
      const { minH, maxH } = LAYERS[layer]
      for (const b of skyline({ seed: 11, width: 2000, layer }).buildings) {
        expect(b.h).toBeGreaterThanOrEqual(minH)
        expect(b.h).toBeLessThanOrEqual(maxH)
      }
    }
  })

  it('places every window inside the facade of its building', () => {
    const { buildings } = skyline({ seed: 5, width: 1200, layer: 'near' })
    const windows = buildings.flatMap((b) => b.windows.map((w) => ({ b, w })))
    expect(windows.length).toBeGreaterThan(0)
    for (const { b, w } of windows) {
      expect(w.x).toBeGreaterThan(b.x)
      expect(w.x + w.size).toBeLessThan(b.x + b.w)
      expect(w.y).toBeGreaterThan(0)
      expect(w.y + w.size).toBeLessThan(b.h)
    }
  })

  it('leaves the far layer as a silhouette with no windows', () => {
    const { buildings } = skyline({ seed: 2, width: 900, layer: 'far' })
    expect(buildings.every((b) => b.windows.length === 0)).toBe(true)
  })
})

describe('stars', () => {
  it('scatters a fixed count inside the sky, deterministically', () => {
    const a = stars({ seed: 4, width: 300, height: 120, count: 40 })
    expect(a).toHaveLength(40)
    expect(stars({ seed: 4, width: 300, height: 120, count: 40 })).toEqual(a)
    for (const s of a) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThan(300)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThan(120)
    }
  })
})
