import { expect, it } from 'vitest'
import { outcomeOf } from './FundedResults'

const run = { score: 0.004, net: 0.002, fills: 3, complete: true }

it('states NET against holding and the fills, from the measured numbers only', () => {
  expect(outcomeOf(run)).toEqual({
    tone: 'gain', title: 'Ahead of hold',
    line: '3 maker fills observed. NET beat simply holding the deposit.',
  })
  expect(outcomeOf({ score: 0, net: -0.00189, fills: 0, complete: true })).toEqual({
    tone: 'loss', title: 'Behind hold',
    line: 'No maker fills, so SCORE stayed at zero. NET is behind simply holding the deposit.',
  })
  expect(outcomeOf({ ...run, net: 0, fills: 1 })).toMatchObject({ tone: 'ink', title: 'Level with hold' })
})

it('says nothing when a total is unavailable or the history had gaps', () => {
  expect(outcomeOf({ ...run, net: null })).toBeNull()
  expect(outcomeOf({ ...run, fills: null })).toBeNull()
  expect(outcomeOf({ ...run, complete: false })).toBeNull()
})
