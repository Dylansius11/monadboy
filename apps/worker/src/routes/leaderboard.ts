import { z } from 'zod'
import type { Database } from 'bun:sqlite'
import type { RouteModule } from '../app'
import { WINDOWS } from '../jobs/leaderboard'

const query = z.object({ window: z.enum(WINDOWS).default('24h') }).strict()

// Chain-derived rows only: nothing here accepts a submitted score. Until the
// first computation (or with no market configured) the answer is `unavailable`.
export function leaderboardRoute(db: Database, now: () => number): RouteModule {
  return (app) => {
    app.get('/v1/leaderboard', (c) => {
      const parsed = query.safeParse(c.req.query())
      if (!parsed.success) return c.json({ error: 'invalid-window' }, 400)
      const row = db
        .query<{ json: string; computed_at: number }, [string]>(
          'SELECT json, computed_at FROM leaderboard_cache WHERE window = ?',
        )
        .get(parsed.data.window)
      if (!row)
        return c.json({
          status: 'unavailable',
          window: parsed.data.window,
          rows: [],
          at: null,
          computedAt: null,
          ageMs: null,
        })
      return c.json({
        ...JSON.parse(row.json),
        computedAt: row.computed_at,
        ageMs: now() - row.computed_at,
      })
    })
  }
}
