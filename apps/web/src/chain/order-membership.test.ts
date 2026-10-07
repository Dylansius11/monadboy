import { expect, it } from 'vitest'
import { reachableOrderIds } from './gameplay'

it('a detached fully-filled order cannot double count holdings or become a cancel input merely because stale storage retains size', () => {
  const orders = new Map([
    [96, { next: 0 }],
    [97, { next: 0 }],
    [103, { next: 104 }],
    [104, { next: 0 }],
  ])
  expect([...reachableOrderIds(103, orders)]).toEqual([103, 104])
  expect(reachableOrderIds(0, orders).has(97)).toBe(false)
  expect(() =>
    reachableOrderIds(
      103,
      new Map([
        [103, { next: 104 }],
        [104, { next: 103 }],
      ]),
    ),
  ).toThrow()
})
