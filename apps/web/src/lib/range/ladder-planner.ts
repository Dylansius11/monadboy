import { planLadder } from '@monadboy/sdk'
import type { MarketParams } from '@monadboy/sdk'
import type { RangePlanner } from './plan'

/** Shared Kuru planner for setup previews and the live price field. */
export const ladderPlanner: RangePlanner<{
  budgetQuote: number
  sigmaDaily: number
  params: MarketParams
}> = {
  plan: (input) => {
    const { low, high, step, levels } = planLadder(input)
    return { low, high, step, levels }
  },
}
