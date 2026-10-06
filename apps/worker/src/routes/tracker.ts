import type { Database } from 'bun:sqlite'
import type { RouteModule } from '../app'
import { TRACKER_STALE_MS } from '../jobs/tracker-snapshot'

type StoredMarket = {
  takenAt: number | null
  status: 'live' | 'stale' | 'unavailable'
  playable?: boolean
  coverage?: { complete: boolean; source: string; ageMs: number | null }
}

// Serves the newest snapshot as is. Never blocks on trade backfill: a snapshot
// taken before the 24h window is complete says so through `coverage` and `status`.
export function trackerRoute(db: Database, now: () => number): RouteModule {
  return (app) => {
    app.get('/v1/tracker', (c) => {
      if (Object.keys(c.req.query()).length)
        return c.json({ error: 'invalid-query' }, 400)
      const rows = db
        .query<{ json: string }, []>(
          'SELECT json FROM market_snapshots WHERE taken_at = (SELECT MAX(taken_at) FROM market_snapshots) ORDER BY market',
        )
        .all()
      const at = now()
      const markets = rows.map((row) => {
        const market = JSON.parse(row.json) as StoredMarket
        const stale =
          market.status === 'live' &&
          (market.takenAt === null || at - market.takenAt > TRACKER_STALE_MS)
        return {
          ...market,
          status: stale ? 'stale' : market.status,
          playable: !stale && market.status === 'live' && market.playable === true,
        }
      })
      const stamps = markets.flatMap((market) =>
        market.takenAt === null ? [] : [market.takenAt],
      )
      const takenAt = stamps.length ? Math.max(...stamps) : null
      const partial = markets.some(
        (market) => market.status !== 'live' || !market.coverage?.complete,
      )
      return c.json({
        status:
          markets.length === 0 ? 'offline' : partial ? 'partial' : 'available',
        source: 'kuru-mainnet',
        takenAt,
        ageMs: takenAt === null ? null : at - takenAt,
        coverage: markets.find((market) => market.coverage)?.coverage ?? null,
        markets,
      })
    })
  }
}
