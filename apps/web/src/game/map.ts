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
