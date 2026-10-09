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

describe('price field geometry', () => {
  it('draws the first observed price across the field and keeps the character inside the plot', () => {
    const { container, getByRole } = render(
      <PriceField {...BASE} series={[100]} />,
    )
    const points = container.querySelector('polyline')!.getAttribute('points')!
      .split(' ').map((point) => point.split(',').map(Number))
    expect(points.map(([x]) => x)).toEqual([0, 408])
    expect(points[0][1]).toBe(points[1][1])
    const character = getByRole('img', { name: /molandak/i }).parentElement!.parentElement!
    expect(Number.parseFloat(character.style.left)).toBe(408)
  })

  it('holds each sampled price until the next sample instead of interpolating', () => {
    const { container } = render(<PriceField {...BASE} />)
    const points = container.querySelector('polyline')!.getAttribute('points')!
      .split(' ').map((point) => point.split(',').map(Number))
    expect(points).toHaveLength(9)
    for (let i = 0; i < points.length - 2; i += 2) {
      expect(points[i + 1][1]).toBe(points[i][1])
      expect(points[i + 1][0]).toBe(points[i + 2][0])
    }
    expect(points[0][0]).toBe(0)
    expect(points[8][0]).toBe(408)
  })

  it('shows both range edges while price is inside the earning band', () => {
    const { container, getByText } = render(<PriceField {...BASE} />)
    expect(container.querySelectorAll('line')).toHaveLength(2)
    expect(getByText('Up')).toBeInTheDocument()
    expect(getByText('Low')).toBeInTheDocument()
    const lines = [...container.querySelectorAll('line')]
    expect(Number(lines[0].getAttribute('y1'))).toBeLessThan(
      Number(lines[1].getAttribute('y1')),
    )
  })

  it('drops distant range edges while keeping the escaped price series visible', () => {
    const { container, queryByText } = render(
      <PriceField {...BASE} series={[180, 190, 200]} earning={false} />,
    )
    expect(container.querySelectorAll('line')).toHaveLength(0)
    expect(queryByText('Up')).toBeNull()
    expect(queryByText('Low')).toBeNull()
    const points = container.querySelector('polyline')!.getAttribute('points')!
      .split(' ').map((point) => Number(point.split(',')[1]))
    for (const y of points) {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(BASE.height)
    }
  })

  it('leaves the out-of-range band unfilled rather than claiming earnings', () => {
    const { container } = render(<PriceField {...BASE} earning={false} />)
    expect(container.querySelector('rect')!.getAttribute('fill')).toBe('transparent')
  })
})
