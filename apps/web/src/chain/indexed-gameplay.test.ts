import { expect, it } from 'vitest'
import { parseIndexedProjection } from './gameplay'

const tx = `0x${'12'.repeat(32)}`
const fill = {
  id: '10143:1:0',
  order_id: '0xabc:5',
  price: '0.03299997',
  size: '1.82000182',
  isBuy: false,
  originKnown: true,
  isFlippedOrder: true,
  flipPrice: '0.032967',
  tx,
  at: '1791367980',
  block: '68941248',
}
it('actual Hasura numeric strings preserve normalized maker direction without double inversion', () => {
  const result = parseIndexedProjection(
    [fill],
    [
      {
        chainId: 10143,
        startBlock: 68939801,
        progressBlock: 68954535,
        isReady: true,
      },
    ],
    68940637n,
    68954535n,
  )
  expect(result.fills[0]).toMatchObject({
    isBuy: false,
    price: 0.03299997,
    size: 1.82000182,
    orderId: 5n,
  })
  expect(result.complete).toBe(true)
})
it('empty indexed rows need an actual ready cursor and unknown provenance never becomes an initial zero', () => {
  expect(
    parseIndexedProjection(
      [],
      [
        {
          chainId: 10143,
          startBlock: 68939801,
          progressBlock: 10,
          isReady: true,
        },
      ],
      68940637n,
      68954535n,
    ).complete,
  ).toBe(false)
  const unknown = parseIndexedProjection(
    [{ ...fill, order_id: null, originKnown: false, flipPrice: null }],
    [
      {
        chainId: 10143,
        startBlock: 68939801,
        progressBlock: 68954535,
        isReady: true,
      },
    ],
    68940637n,
    68954535n,
  )
  expect(unknown.complete).toBe(false)
  expect(unknown.missingOrigins).toHaveLength(1)
  expect(unknown.fills).toEqual([])
})
