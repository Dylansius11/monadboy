// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PriceField } from './PriceField'

const BASE = {
  series: [100, 101, 99, 102, 103],
  lowerPrice: 95,
  upperPrice: 110,
  width: 464,
  height: 200,
  character: 'molandak',
  animation: 'run' as const,
  earning: true,
  jumping: false,
}
/** The character's half-width gutter on the right of the plot. */
const PLOT = 444

function polyline(container: HTMLElement) {
  return container.querySelector('polyline')!.getAttribute('points')!
    .split(' ').map((point) => point.split(',').map(Number))
}

describe('price field geometry', () => {
  it('draws the first observed price across the field and keeps the character on it', () => {
    const { container, getByRole } = render(
      <PriceField {...BASE} series={[100]} />,
    )
    const points = polyline(container)
    expect(points.map(([x]) => x)).toEqual([0, PLOT])
    expect(points[0][1]).toBe(points[1][1])
    const character = getByRole('img', { name: /molandak/i }).parentElement!.parentElement!
    expect(character.style.transform).toBe(`translate(${PLOT}px, ${points[0][1]}px) translate(-50%, -100%)`)
  })

  it('holds each sampled price until the next sample instead of interpolating', () => {
    const { container } = render(<PriceField {...BASE} />)
    const points = polyline(container)
    expect(points).toHaveLength(9)
    for (let i = 0; i < points.length - 2; i += 2) {
      expect(points[i + 1][1]).toBe(points[i][1])
      expect(points[i + 1][0]).toBe(points[i + 2][0])
    }
    expect(points[0][0]).toBe(0)
    expect(points[8][0]).toBe(PLOT)
  })

  it('a live window holds the newest price past the clip edge so the slide never shows a gap', () => {
    const { container } = render(
      <PriceField {...BASE} sampling={{ capacity: 5, intervalMs: 5000, newestAt: Date.now() }} />,
    )
    const points = polyline(container)
    expect(points.at(-2)![0]).toBe(PLOT)
    expect(points.at(-1)![0]).toBe(PLOT + PLOT / 4)
    expect(points.at(-1)![1]).toBe(points.at(-2)![1])
  })

  it('shows both labelled range edges while price is inside the earning band', () => {
    const { container, getByText } = render(<PriceField {...BASE} />)
    expect(container.querySelectorAll('line')).toHaveLength(2)
    expect(getByText('High')).toBeInTheDocument()
    expect(getByText('Low')).toBeInTheDocument()
    const lines = [...container.querySelectorAll('line')]
    expect(Number(lines[0].getAttribute('y1'))).toBeLessThan(
      Number(lines[1].getAttribute('y1')),
    )
  })

  it('keeps both range edges drawn inside the field after price escapes far above them', () => {
    const { container, getByText } = render(
      <PriceField {...BASE} series={[180, 190, 200]} earning={false} />,
    )
    const edges = [...container.querySelectorAll('line')].map((line) => Number(line.getAttribute('y1')))
    expect(edges).toHaveLength(2)
    for (const y of [...edges, ...polyline(container).map(([, y]) => y)]) {
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(BASE.height)
    }
    expect(getByText('High')).toBeInTheDocument()
    expect(getByText('Low')).toBeInTheDocument()
  })

  it('leaves the out-of-range band unfilled rather than claiming earnings', () => {
    const { container } = render(<PriceField {...BASE} earning={false} />)
    expect(container.querySelector('svg > rect')!.getAttribute('fill')).toBe('transparent')
  })
})
