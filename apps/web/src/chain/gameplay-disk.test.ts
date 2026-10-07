import { expect, it } from 'vitest'
import { appendActualRun, basisFromDisk } from './gameplay-disk'
import { newDiskPlaintext, zDiskPlaintext } from './disk-plaintext'

const market = '0x1111111111111111111111111111111111111111' as const
const tx = `0x${'12'.repeat(32)}` as const

it('seals actual exit receipts and independent NET without destroying private preferences or pending recovery data', () => {
  const original = {
    ...newDiskPlaintext(1),
    name: 'private',
    notes: 'keep this',
    position: {
      market,
      openedAt: 2,
      startBlock: '10',
      base0: 4,
      quote0: 1,
      low: 0.02,
      high: 0.03,
      step: 0.001,
    },
  }
  expect(
    basisFromDisk(zDiskPlaintext.parse(original), market)?.startBlock,
  ).toBe(10n)
  const sealed = appendActualRun(original, {
    market,
    openedAt: 2,
    closedAt: 3,
    score: 0.01,
    damage: 0,
    net: 0.02,
    fills: 2,
    receipts: [tx],
    complete: true,
  })
  const restored = zDiskPlaintext.parse(sealed)
  expect(restored.notes).toBe('keep this')
  expect(restored.position).toBeUndefined()
  expect(restored.runs[0]).toMatchObject({
    score: 0.01,
    damage: 0,
    net: 0.02,
    receipts: [tx],
  })
})

it('an incomplete recovered run preserves unavailable totals instead of writing fabricated zero results', () => {
  const sealed = appendActualRun(newDiskPlaintext(1), {
    market,
    openedAt: null,
    closedAt: 3,
    score: null,
    damage: null,
    net: null,
    fills: 0,
    receipts: [tx],
    complete: false,
  })
  expect(sealed.runs).toEqual([])
  expect(sealed.lastExit).toMatchObject({
    score: null,
    damage: null,
    receipts: [tx],
    complete: false,
  })
})
