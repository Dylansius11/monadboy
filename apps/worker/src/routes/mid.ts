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
import type { DemoPrice } from '../jobs/demo-price'

// Mainnet stays raw. The playable TESTNET route explicitly exposes its DEMO target.
const query = z
  .object({ market: z.enum(['MON_USDC', 'MON_AUSD']).optional() })
  .strict()

export function midRoute(state: MidState, now: () => number, demo?: DemoPrice): RouteModule {
  return (app) => {
    app.get('/v1/mid', (c) => {
      if (!query.safeParse(c.req.query()).success)
        return c.json({ error: 'invalid-market' }, 400)
      const at = now()
      const ageMs = sourceAgeMs(state, at)
      const paused = isSourcePaused(state, at)
      const testnet = testnetObservation(state, at)
      const amplified = c.req.query('market') !== 'MON_USDC' && demo
        ? demo.read(state.targetMid) : null
      return c.json({
        targetMid: amplified ? amplified.targetMid : state.targetMid,
        mainnetMid: state.targetMid,
        demo: amplified,
        testnetMid: testnet.mid,
        source: amplified ? `demo-${amplified.multiplier}x:${SOURCE_NAME}` : SOURCE_NAME,
        at: state.at,
        ageMs,
        fresh: !paused && ageMs !== null && ageMs <= SOURCE_FRESH_MS &&
          (!amplified || amplified.targetMid !== null),
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
