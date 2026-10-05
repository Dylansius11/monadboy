import { planLadder } from '@monadboy/sdk'
import type { Ladder, MarketParams } from '@monadboy/sdk'
import type { RangePlanner } from './plan'

/** Keep SDK funding and clamp metadata available to setup and live screens. */
export const ladderPlanner: RangePlanner<{
  budgetQuote: number
  sigmaDaily: number
  params: MarketParams
}, Ladder> = {
  plan: planLadder,
}
