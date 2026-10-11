import type { Database } from 'bun:sqlite'

export const DEMO_MULTIPLIER = 50
// e-folding time of the DEMO target's log gap to the mainnet price. Amplified relative
// movement alone is a random walk with 50x mainnet's volatility: the measured 4.6% mainnet
// range over 24h (2026-10-11) would swing it about 9.5x in a day. Decaying the gap with a
// one-hour constant keeps it to tens of percent (from measured 1h mainnet moves, p50 0.38%)
// while a three-minute run sees well under 1% of drift next to its 50x moves.
export const DEMO_REVERSION_MS = 3_600_000
// Anchor writes are throttled to the mainnet sampler cadence; reads in between agree.
const PERSIST_MS = 5_000

export type DemoReading = {
  targetMid: number | null
  mainnetMid: number | null
  multiplier: number
  reversionMs: number
  anchorSource: number | null
  anchorTarget: number | null
}
export type DemoPrice = { read: (mainnetMid: number | null) => DemoReading }
type Anchor = { multiplier: number; source_mid: number; target_mid: number; anchored_at: number }

export function createDemoPrice(
  db: Database,
  market: string,
  multiplier = DEMO_MULTIPLIER,
  { reversionMs = DEMO_REVERSION_MS, now = Date.now }: { reversionMs?: number; now?: () => number } = {},
): DemoPrice {
  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 50)
    throw new Error('Invalid demo movement multiplier')
  if (!(reversionMs > 0)) throw new Error('Invalid demo reversion time')
  const select = db.query<Anchor, [string]>(
    'SELECT multiplier, source_mid, target_mid, anchored_at FROM demo_anchors WHERE market = ?',
  )
  const save = db.query(
    `INSERT INTO demo_anchors (market, multiplier, source_mid, target_mid, anchored_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (market) DO UPDATE SET multiplier = excluded.multiplier, source_mid = excluded.source_mid,
       target_mid = excluded.target_mid, anchored_at = excluded.anchored_at`,
  )
  let anchor = select.get(market)
  return {
    read(mainnetMid: number | null) {
      const result = (targetMid: number | null) => ({
        targetMid,
        mainnetMid,
        multiplier,
        reversionMs,
        anchorSource: anchor?.source_mid ?? null,
        anchorTarget: anchor?.target_mid ?? null,
      })
      if (mainnetMid === null || !Number.isFinite(mainnetMid) || mainnetMid <= 0) return result(null)
      const at = now()
      let target = mainnetMid
      if (anchor) {
        // The anchor's own multiplier: a policy change carries the current target forward
        // instead of jumping every open range. A pre-reversion anchor (time 0) starts now.
        const moved = anchor.target_mid * (mainnetMid / anchor.source_mid) ** anchor.multiplier
        const elapsed = anchor.anchored_at > 0 ? Math.max(0, at - anchor.anchored_at) : 0
        target = mainnetMid * Math.exp(Math.log(moved / mainnetMid) * Math.exp(-elapsed / reversionMs))
      }
      if (!Number.isFinite(target) || target <= 0) return result(null)
      if (!anchor || anchor.multiplier !== multiplier || anchor.anchored_at === 0 || at - anchor.anchored_at >= PERSIST_MS) {
        save.run(market, multiplier, mainnetMid, target, at)
        anchor = select.get(market)
      }
      return result(target)
    },
  }
}
