import { z } from 'zod'
import type { RouteModule } from '../app'
import {
  SOURCE_FRESH_MS,
  SOURCE_NAME,
  isSourcePaused,
  sourceAgeMs,
  testnetObservation,
} from '../jobs/mid-sampler'
import type { MidState } from '../jobs/mid-sampler'

// Both names resolve to the same payload: the testnet MON market mirrors the
// mainnet MON_USDC price, so one source answers either question.
const query = z
  .object({ market: z.enum(['MON_USDC', 'MON_AUSD']).optional() })
  .strict()

export function midRoute(state: MidState, now: () => number): RouteModule {
  return (app) => {
    app.get('/v1/mid', (c) => {
      if (!query.safeParse(c.req.query()).success)
        return c.json({ error: 'invalid-market' }, 400)
      const at = now()
      const ageMs = sourceAgeMs(state, at)
      const paused = isSourcePaused(state, at)
      const testnet = testnetObservation(state, at)
      return c.json({
        targetMid: state.targetMid,
        testnetMid: testnet.mid,
        source: SOURCE_NAME,
        at: state.at,
        ageMs,
        fresh: !paused && ageMs !== null && ageMs <= SOURCE_FRESH_MS,
        state: paused ? 'paused' : 'running',
        testnet: {
          status: testnet.status,
          market: testnet.market,
          at: testnet.at,
          ageMs: testnet.at === null ? null : at - testnet.at,
        },
      })
    })
  }
}
