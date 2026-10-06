import { useEffect, useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { skyline, stars } from '../../scenery/skyline'
import type { Building, CityWindow, LayerName } from '../../scenery/skyline'

/**
 * The night city, drawn once per resize at art resolution and then only
 * translated. Scroll parallax is three transforms; no frame redraws the
 * buildings. The one per-frame cost is a window lighting up on a fill.
 */

const SCALE_DESKTOP = 4
const SCALE_PHONE = 3
/** Spare art pixels on each side so parallax never reveals an edge. */
const BLEED = 24

const SKY: ReadonlyArray<readonly [number, string]> = [
  // [share of height from the top, colour]: hard bands, the pixel-art sky,
  // each one step lighter toward the glow the city throws on the horizon
  [0, '#0e091c'],
  [0.4, '#100a20'],
  [0.5, '#120b24'],
  [0.58, '#140d29'],
  [0.65, '#170f2f'],
  [0.71, '#1a1134'],
  [0.77, '#1d1339'],
  [0.83, '#20153f'],
]

const INK: Record<LayerName, { body: string; window: string; lit: string }> = {
  far: { body: '#251b5e', window: '#251b5e', lit: '#251b5e' },
  mid: { body: '#1a1246', window: '#271d63', lit: '#7d6ae6' },
  near: { body: '#110a28', window: '#1e1647', lit: '#a898f2' },
}

const FILL_LIGHT = '#85e6ff'
const FILL_LIGHT_MS = 2200

const PARALLAX: Record<LayerName, number> = { far: 40, mid: 110, near: 200 }

interface Drawn {
  scale: number
  near: Array<CityWindow>
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, base: number, ink: (typeof INK)[LayerName]) {
  const top = base - b.h
  ctx.fillStyle = ink.body
  ctx.fillRect(b.x, top, b.w, b.h)
  const { kind, size } = b.roof
  const mid = b.x + Math.floor(b.w / 2)
  if (kind === 'stepped') {
    const inset = Math.max(2, Math.floor(b.w * 0.2))
    ctx.fillRect(b.x + inset, top - size, b.w - 2 * inset, size)
  } else if (kind === 'spire') {
    ctx.fillRect(mid - 1, top - 3, 3, 3)
    ctx.fillRect(mid, top - 3 - size * 2, 1, size * 2)
  } else if (kind === 'antenna') {
    const ax = b.x + Math.floor(b.w * 0.3)
    ctx.fillRect(ax, top - size, 1, size)
    ctx.fillStyle = ink.lit
    ctx.fillRect(ax, top - size, 1, 1)
  } else if (kind === 'tank') {
    ctx.fillRect(b.x + 2, top - 3, 4, 3)
    ctx.fillRect(b.x + 3, top - 4, 2, 1)
  }
  for (const w of b.windows) {
    ctx.fillStyle = w.lit ? ink.lit : ink.window
    ctx.fillRect(w.x, top + w.y, w.size, w.size)
  }
}

function prepare(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return ctx
}

export function CityCanvas({
  seed = 20261013,
  fillSignal = 0,
  className,
}: {
  seed?: number
  /** Increment once per fill; each step lights one window for a moment. */
  fillSignal?: number
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const sky = useRef<HTMLCanvasElement>(null)
  const layers = {
    far: useRef<HTMLCanvasElement>(null),
    mid: useRef<HTMLCanvasElement>(null),
    near: useRef<HTMLCanvasElement>(null),
  }
  const lights = useRef<HTMLCanvasElement>(null)
  const drawn = useRef<Drawn | null>(null)
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({ target: root, offset: ['start start', 'end start'] })
  const farY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : PARALLAX.far])
  const midY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : PARALLAX.mid])
  const nearY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : PARALLAX.near])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const paint = () => {
      const scale = el.clientWidth < 640 ? SCALE_PHONE : SCALE_DESKTOP
      const width = Math.ceil(el.clientWidth / scale) + 2 * BLEED
      const height = Math.ceil(el.clientHeight / scale)

      const s = prepare(sky.current!, width, height)
      SKY.forEach(([from, colour], i) => {
        const y = Math.floor(from * height)
        const to = i + 1 < SKY.length ? Math.floor(SKY[i + 1][0] * height) : height
        s.fillStyle = colour
        s.fillRect(0, y, width, to - y)
      })
      for (const star of stars({ seed, width, height: Math.floor(height * 0.6), count: Math.floor(width / 5) })) {
        s.fillStyle = star.bright ? '#e4dfff' : '#4a3d8a'
        s.fillRect(star.x, star.y, 1, 1)
      }

      let near: Array<CityWindow> = []
      for (const name of ['far', 'mid', 'near'] as const) {
        const ctx = prepare(layers[name].current!, width, height)
        const { buildings } = skyline({ seed, width, layer: name })
        for (const b of buildings) drawBuilding(ctx, b, height, INK[name])
        if (name === 'near') {
          // store windows with absolute y so a fill can light one in place
          near = buildings.flatMap((b) => b.windows.map((w) => ({ ...w, y: height - b.h + w.y })))
        }
      }
      prepare(lights.current!, width, height)
      drawn.current = { scale, near }
      for (const c of [sky, layers.far, layers.mid, layers.near, lights]) {
        c.current!.style.width = `${width * scale}px`
        c.current!.style.height = `${height * scale}px`
        c.current!.style.left = `${-BLEED * scale}px`
      }
    }
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(el)
    return () => observer.disconnect()
    // layers are stable refs; seed is the only input that redraws the city
  }, [seed])

  const timers = useRef(new Set<number>())
  useEffect(() => {
    const d = drawn.current
    const ctx = lights.current?.getContext('2d')
    if (!fillSignal || !d || !ctx || d.near.length === 0) return
    const w = d.near[Math.floor(Math.random() * d.near.length)]
    ctx.fillStyle = FILL_LIGHT
    ctx.fillRect(w.x, w.y, w.size, w.size)
    // not cleaned up per fill: a fast burst must not leave earlier windows lit
    const off = window.setTimeout(() => {
      ctx.clearRect(w.x, w.y, w.size, w.size)
      timers.current.delete(off)
    }, FILL_LIGHT_MS)
    timers.current.add(off)
  }, [fillSignal])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  return (
    <div ref={root} className={`city ${className ?? ''}`} aria-hidden="true">
      <canvas ref={sky} className="city-layer" />
      <motion.canvas ref={layers.far} className="city-layer" style={{ y: farY }} />
      <motion.canvas ref={layers.mid} className="city-layer" style={{ y: midY }} />
      <motion.div className="city-layer-group" style={{ y: nearY }}>
        <canvas ref={layers.near} className="city-layer" />
        <canvas ref={lights} className="city-layer" />
      </motion.div>
    </div>
  )
}
