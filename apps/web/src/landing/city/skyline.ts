/**
 * The city behind the landing page, generated rather than drawn.
 *
 * Every unit here is one art pixel. The canvas draws at that resolution and
 * CSS scales it up with `image-rendering: pixelated`, so the city stays on
 * the same pixel grid as the sprites at any viewport.
 *
 * Seeded, so the skyline is the same city on every visit and in every test.
 */

export type LayerName = 'far' | 'mid' | 'near'

interface LayerSpec {
  /** Facade height band, art pixels. */
  minH: number
  maxH: number
  minW: number
  maxW: number
  /** Window cell size and the gap between cells. 0 means a silhouette. */
  window: number
  gap: number
  /** Share of windows lit before any fill lights one. */
  lit: number
}

export const LAYERS: Record<LayerName, LayerSpec> = {
  far: { minH: 44, maxH: 96, minW: 10, maxW: 22, window: 0, gap: 0, lit: 0 },
  mid: { minH: 30, maxH: 72, minW: 14, maxW: 28, window: 1, gap: 2, lit: 0.07 },
  near: { minH: 16, maxH: 46, minW: 18, maxW: 38, window: 2, gap: 2, lit: 0.05 },
}

export type RoofKind = 'flat' | 'stepped' | 'spire' | 'antenna' | 'tank'

export interface CityWindow {
  /** Absolute x, art pixels. */
  x: number
  /** Down from the roof line of its building. */
  y: number
  size: number
  lit: boolean
}

export interface Building {
  x: number
  w: number
  /** Facade height; the roof sits above it. */
  h: number
  roof: { kind: RoofKind; size: number }
  windows: Array<CityWindow>
}

export interface Star {
  x: number
  y: number
  /** 0 is a faint single pixel, 1 a bright one that twinkles. */
  bright: 0 | 1
}

/** mulberry32: tiny, fast, and good enough for scenery. */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ROOFS: ReadonlyArray<RoofKind> = ['flat', 'flat', 'stepped', 'spire', 'antenna', 'tank']

function between(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1))
}

function windowsFor(
  next: () => number,
  spec: LayerSpec,
  x: number,
  w: number,
  h: number,
): Array<CityWindow> {
  if (spec.window === 0) return []
  const pitch = spec.window + spec.gap
  const cols = Math.floor((w - 2 * spec.gap) / pitch)
  const rows = Math.floor((h - 2 * spec.gap - 1) / pitch)
  if (cols < 1 || rows < 1) return []
  // centre the grid on the facade so narrow towers do not lean
  const left = x + Math.floor((w - cols * pitch + spec.gap) / 2)
  const out: Array<CityWindow> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: left + c * pitch,
        y: spec.gap + 1 + r * pitch,
        size: spec.window,
        lit: next() < spec.lit,
      })
    }
  }
  return out
}

export function skyline({
  seed,
  width,
  layer,
}: {
  seed: number
  width: number
  layer: LayerName
}): { buildings: Array<Building> } {
  const spec = LAYERS[layer]
  // each layer gets its own stream so changing one never reshuffles another
  const next = random(seed * 31 + layer.length * 7919)
  const buildings: Array<Building> = []
  let x = -between(next, 0, 4)
  while (x < width) {
    const w = between(next, spec.minW, spec.maxW)
    const h = between(next, spec.minH, spec.maxH)
    const kind = ROOFS[Math.floor(next() * ROOFS.length)]
    const roof = { kind, size: kind === 'flat' ? 0 : between(next, 2, 8) }
    buildings.push({ x, w, h, roof, windows: windowsFor(next, spec, x, w, h) })
    // neighbours overlap by up to 2 pixels: a real block, never a gap
    x += w - between(next, 0, 2)
  }
  return { buildings }
}

export function stars({
  seed,
  width,
  height,
  count,
}: {
  seed: number
  width: number
  height: number
  count: number
}): Array<Star> {
  const next = random(seed ^ 0x5f3759df)
  return Array.from({ length: count }, () => ({
    x: Math.floor(next() * width),
    y: Math.floor(next() * height),
    bright: next() < 0.18 ? 1 : 0,
  }))
}
