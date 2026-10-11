/** Pure SAFETY/HEAT geometry and directional cursor movement. */
export interface MapPin {
  
  safety: number
  
  heat: number
}


export interface PinPosition {
  leftPct: number
  topPct: number
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, n))


export function scoreToPosition(pin: MapPin): PinPosition {
  return {
    leftPct: clampPct(pin.safety),
    topPct: clampPct(100 - pin.heat),
  }
}


export type RiskBand = 'green' | 'amber' | 'red'

export function riskBand(safety: number): RiskBand {
  if (safety >= 70) return 'green'
  if (safety >= 30) return 'amber'
  return 'red'
}


export function panFor(pct: number, zoom: number): number {
  if (zoom <= 1) return 0
  const centred = 50 / zoom - pct
  const min = 100 / zoom - 100
  return Math.max(min, Math.min(0, centred))
}

/** A point in plot pixels, with the radius its mark draws to. */
export interface PinDisc {
  x: number
  y: number
  radius: number
}

export interface Size {
  width: number
  height: number
}

const clampTo = (n: number, low: number, high: number): number => Math.max(low, Math.min(high, n))

/**
 * A pin centre held far enough inside the plot that its whole mark shows.
 * SAFETY 100 sits on the right edge of score space; drawn there unclamped,
 * half the disc and its reticle fall outside the frame.
 */
export function keepInside(px: number, radius: number, size: number): number {
  if (size <= radius * 2) return size / 2
  return clampTo(px, radius, size - radius)
}

/**
 * Where the selected pin names itself, as the label's top-left in plot
 * pixels. Below, above, right, then left of the pin, each slid back inside
 * the plot; the first that covers neither the pin nor a neighbour wins, and
 * when every side is crowded the one covering the fewest neighbours does.
 */
export function placePinLabel(
  pin: PinDisc,
  label: Size,
  others: ReadonlyArray<PinDisc>,
  plot: Size,
  gap = 2,
): { x: number; y: number } {
  const fit = (x: number, y: number) => ({
    x: clampTo(x, 0, Math.max(0, plot.width - label.width)),
    y: clampTo(y, 0, Math.max(0, plot.height - label.height)),
  })
  const reach = pin.radius + gap
  const candidates = [
    fit(pin.x - label.width / 2, pin.y + reach),
    fit(pin.x - label.width / 2, pin.y - reach - label.height),
    fit(pin.x + reach, pin.y - label.height / 2),
    fit(pin.x - reach - label.width, pin.y - label.height / 2),
  ]
  const covers = (box: { x: number; y: number }, disc: PinDisc): boolean => {
    const nearX = clampTo(disc.x, box.x, box.x + label.width)
    const nearY = clampTo(disc.y, box.y, box.y + label.height)
    return Math.hypot(disc.x - nearX, disc.y - nearY) < disc.radius
  }
  // Covering its own pin is worse than covering every neighbour.
  const cost = (box: { x: number; y: number }): number =>
    (covers(box, pin) ? others.length + 1 : 0) + others.filter((other) => covers(box, other)).length
  let best = candidates[0]
  let bestCost = cost(best)
  for (const candidate of candidates.slice(1)) {
    if (bestCost === 0) break
    const next = cost(candidate)
    if (next < bestCost) {
      best = candidate
      bestCost = next
    }
  }
  return { x: Math.round(best.x), y: Math.round(best.y) }
}

export type CursorDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

const distance = (a: MapPin, b: MapPin): number =>
  Math.hypot(a.safety - b.safety, a.heat - b.heat)


export function nextPin(
  pins: ReadonlyArray<MapPin>,
  currentIndex: number,
  direction: CursorDirection,
): number {
  // Explicit bounds check rather than trusting `pins[currentIndex]` to be
  // `undefined` when out of range: this project's tsconfig does not turn on
  // `noUncheckedIndexedAccess`, so TypeScript types indexed access as always
  // present, and a truthiness check on it is dead code as far as the type
  // checker is concerned even though it is very much alive at runtime.
  if (currentIndex < 0 || currentIndex >= pins.length) return currentIndex
  const current = pins[currentIndex]

  const beyond = (pin: MapPin): boolean => {
    switch (direction) {
      case 'RIGHT':
        return pin.safety > current.safety
      case 'LEFT':
        return pin.safety < current.safety
      case 'UP':
        return pin.heat > current.heat
      case 'DOWN':
        return pin.heat < current.heat
    }
  }

  let bestIndex = currentIndex
  let bestDistance = Infinity

  pins.forEach((pin, index) => {
    if (index === currentIndex || !beyond(pin)) return
    const d = distance(current, pin)
    if (d < bestDistance) {
      bestDistance = d
      bestIndex = index
    }
  })

  return bestIndex
}
