import { skyline, stars } from './skyline'
import type { Building } from './skyline'

const SKY = ['#100b21', '#130e29', '#181132', '#1d153d', '#231b48', '#2a2051']
const PALETTE = [
  { body: '#34285d', edge: '#433570', glass: '#4f3b7d', light: '#7563a4' },
  { body: '#221a42', edge: '#352854', glass: '#392959', light: '#9b87ce' },
  { body: '#15102c', edge: '#2b2147', glass: '#30224c', light: '#b3a6ec' },
]

function building(ctx: CanvasRenderingContext2D, b: Building, floor: number, layer: number) {
  const ink = PALETTE[layer]
  const top = floor - b.h
  ctx.fillStyle = ink.body
  ctx.fillRect(b.x, top, b.w, b.h)
  ctx.fillStyle = ink.edge
  ctx.fillRect(b.x, top, b.w, 1)
  ctx.fillRect(b.x, top, 1, b.h)
  const middle = b.x + Math.floor(b.w / 2)
  if (b.roof.kind === 'stepped') {
    ctx.fillRect(b.x + 3, top - b.roof.size, b.w - 6, b.roof.size)
    ctx.fillStyle = ink.body
    ctx.fillRect(b.x + 4, top - b.roof.size + 1, b.w - 8, b.roof.size - 1)
  } else if (b.roof.kind === 'spire' || b.roof.kind === 'antenna') {
    ctx.fillRect(middle - 1, top - 3, 3, 3)
    ctx.fillRect(middle, top - b.roof.size - 5, 1, b.roof.size + 5)
    ctx.fillStyle = '#85e6ff'
    ctx.fillRect(middle, top - b.roof.size - 5, 1, 1)
  } else if (b.roof.kind === 'tank') {
    ctx.fillRect(b.x + 3, top - 5, 7, 3)
    ctx.fillRect(b.x + 4, top - 2, 1, 2)
    ctx.fillRect(b.x + 8, top - 2, 1, 2)
  }
  for (const window of b.windows) {
    ctx.fillStyle = window.lit ? ink.light : ink.glass
    ctx.fillRect(window.x, top + window.y, window.size, window.size)
  }
  if (layer === 2) {
    // Cornices, a service door and narrow balcony rails distinguish the
    // street-facing facades from the repetitive windows in the distance.
    ctx.fillStyle = ink.edge
    for (let y = top + 10; y < floor - 6; y += 14) ctx.fillRect(b.x + 2, y, b.w - 4, 1)
    ctx.fillRect(middle - 3, floor - 8, 6, 8)
    ctx.fillStyle = ink.body
    ctx.fillRect(middle - 2, floor - 7, 4, 7)
    ctx.fillStyle = '#756399'
    ctx.fillRect(middle + 1, floor - 4, 1, 1)
  }
}

function moon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Rasterised scanlines, not a smooth vector circle: even the crescent's
  // silhouette belongs to the city's art grid.
  for (let row = -13; row <= 13; row++) {
    const half = Math.floor(Math.sqrt(169 - row * row))
    ctx.fillStyle = '#8273ad'
    ctx.fillRect(x - half, y + row, half * 2 + 1, 1)
    const inner = Math.floor(Math.sqrt(Math.max(0, 100 - (row + 2) ** 2)))
    if (inner) {
      ctx.fillStyle = '#130e29'
      ctx.fillRect(x - inner + 6, y + row, inner * 2, 1)
    }
  }
  ctx.fillStyle = '#a99bc8'
  ctx.fillRect(x - 8, y - 6, 2, 3)
  ctx.fillRect(x - 5, y + 8, 3, 1)
}

function tower(ctx: CanvasRenderingContext2D, x: number, floor: number, height: number) {
  const top = floor - height
  ctx.fillStyle = '#1f183b'
  ctx.fillRect(x - 9, top + 16, 18, height - 16)
  ctx.fillRect(x - 13, top + 8, 26, 8)
  ctx.fillRect(x - 10, top + 2, 20, 6)
  ctx.fillRect(x - 6, top, 12, 2)
  ctx.fillRect(x, top - 16, 1, 16)
  ctx.fillStyle = '#4d3c75'
  ctx.fillRect(x - 8, top + 18, 2, height - 18)
  ctx.fillRect(x + 6, top + 18, 2, height - 18)
  ctx.fillStyle = '#85e6ff'
  ctx.fillRect(x, top - 16, 1, 1)
  for (let y = top + 4; y < top + 12; y += 3) ctx.fillRect(x - 8, y, 16, 1)
}

/** Static scenery. Called only after a resize; no animation frame repaints. */
export function paintCity(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const horizon = Math.floor(height * 0.7)
  const water = Math.floor(height * 0.82)
  for (let i = 0; i < SKY.length; i++) {
    const from = Math.floor(horizon * i / SKY.length)
    ctx.fillStyle = SKY[i]
    ctx.fillRect(0, from, width, horizon - from)
  }
  for (const star of stars({ seed: 10143, width, height: Math.floor(horizon * 0.72), count: Math.floor(width / 4) })) {
    ctx.fillStyle = star.bright ? '#a89cc7' : '#4b3c70'
    ctx.fillRect(star.x, star.y, 1, 1)
    if (star.bright && star.x % 7 === 0) {
      ctx.fillStyle = '#514271'
      ctx.fillRect(star.x - 1, star.y, 3, 1)
      ctx.fillRect(star.x, star.y - 1, 1, 3)
    }
  }
  moon(ctx, Math.floor(width * 0.81), Math.floor(height * 0.17))

  // Long stepped clouds. Low contrast; the night sky stays quieter than the LCD.
  ctx.fillStyle = '#241b42'
  for (const [x, y, w] of [[width * 0.07, height * 0.3, width * 0.2], [width * 0.66, height * 0.36, width * 0.28]]) {
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), 2)
    ctx.fillRect(Math.floor(x + w * 0.15), Math.floor(y) - 2, Math.floor(w * 0.65), 2)
  }
  for (const [index, layer] of (['far', 'mid', 'near'] as const).entries()) {
    const floor = horizon + index * 12
    ctx.fillStyle = PALETTE[index].body
    ctx.fillRect(0, floor, width, water - floor)
    for (const b of skyline({ seed: 20261013 + index * 13, width, layer }).buildings) {
      building(ctx, b, floor, index)
    }
    if (index === 1) tower(ctx, Math.floor(width * 0.16), floor, Math.min(120, Math.floor(height * 0.5)))
  }

  // The elevated railway: rails, sleepers, service lights, concrete supports.
  const rail = Math.floor(height * 0.76)
  ctx.fillStyle = '#594678'
  ctx.fillRect(0, rail, width, 1)
  ctx.fillStyle = '#130f24'
  ctx.fillRect(0, rail + 2, width, 5)
  ctx.fillStyle = '#2d2245'
  for (let x = 6; x < width; x += 8) ctx.fillRect(x, rail + 3, 2, 2)
  for (let x = 16; x < width; x += 52) {
    ctx.fillRect(x, rail + 7, 5, water - rail)
    ctx.fillStyle = '#a493c3'
    ctx.fillRect(x + 2, rail - 3, 1, 2)
    ctx.fillStyle = '#2d2245'
  }

  // Harbour and broken reflections, drawn as small strips rather than blur.
  ctx.fillStyle = '#120d25'
  ctx.fillRect(0, water, width, height - water)
  for (let row = 0; row < 9; row++) {
    const y = water + row * 4
    for (let x = (row * 17) % 31; x < width; x += 31) {
      ctx.fillStyle = row % 3 === 0 ? '#3d2d56' : '#231a39'
      ctx.fillRect(x, y, 4 + (x + row) % 11, 1)
    }
  }
  // Foreground balcony. It gives the console a place in the city, not a
  // floating background illustration with no viewpoint.
  const ledge = height - 12
  ctx.fillStyle = '#3e2d59'
  ctx.fillRect(0, ledge, width, 2)
  ctx.fillStyle = '#0e091c'
  ctx.fillRect(0, ledge + 2, width, 10)
  for (let x = 12; x < width; x += 60) {
    ctx.fillRect(x, ledge - 18, 2, 18)
    ctx.fillStyle = '#4a3663'
    ctx.fillRect(x, ledge - 18, 2, 1)
    ctx.fillStyle = '#0e091c'
  }
  ctx.fillRect(0, ledge - 18, width, 2)
}
