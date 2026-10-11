import type { Database } from 'bun:sqlite'

// Owner policy: 20x by default; 50x (the maximum) only for a live demo.
export const DEMO_MULTIPLIER = 20
// e-folding time of the DEMO target's log gap to its level (mainnet x the idle book's ratio, see
// rebase). Amplified relative
// movement alone is a random walk with up to 50x mainnet's volatility: the measured 4.6% mainnet
// range over 24h (2026-10-11) would swing it about 9.5x in a day at 50x. Decaying the gap with a
// one-hour constant keeps it to tens of percent (from measured 1h mainnet moves, p50 0.38%)
// while a three-minute run sees well under 1% of drift next to its amplified moves.
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
  // The level the target reverts to, as a ratio to mainnet (1 = mainnet itself).
  level: number
}
export type DemoPrice = {
  read: (mainnetMid: number | null) => DemoReading
  // Idle only: start the next run from where the TESTNET book really is.
  rebase: (mainnetMid: number | null, bookMid: number | null) => void
}
type Anchor = { multiplier: number; source_mid: number; target_mid: number; anchored_at: number; level: number }

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
    'SELECT multiplier, source_mid, target_mid, anchored_at, level FROM demo_anchors WHERE market = ?',
  )
  const save = db.query(
    `INSERT INTO demo_anchors (market, multiplier, source_mid, target_mid, anchored_at, level) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (market) DO UPDATE SET multiplier = excluded.multiplier, source_mid = excluded.source_mid,
       target_mid = excluded.target_mid, anchored_at = excluded.anchored_at, level = excluded.level`,
  )
  let anchor = select.get(market)
  const valid = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0
  return {
    // The DEMO target is only reachable if the mirror can trade the book there, and an idle
    // mirror trades nothing: between runs the book stays wherever the last players left it.
    // Re-anchoring at that book makes target and book agree when a run starts, so the player's
    // range (centred on the book) also holds the target; amplified mainnet moves then drive it
    // from there, reverting to this level rather than to a mainnet price the book never had.
    rebase(mainnetMid, bookMid) {
      if (!valid(mainnetMid) || !valid(bookMid)) return
      save.run(market, multiplier, mainnetMid, bookMid, now(), bookMid / mainnetMid)
      anchor = select.get(market)
    },
    read(mainnetMid: number | null) {
      const result = (targetMid: number | null) => ({
        targetMid,
        mainnetMid,
        multiplier,
        reversionMs,
        anchorSource: anchor?.source_mid ?? null,
        anchorTarget: anchor?.target_mid ?? null,
        level: anchor?.level ?? 1,
      })
      if (mainnetMid === null || !Number.isFinite(mainnetMid) || mainnetMid <= 0) return result(null)
      const at = now()
      const level = anchor?.level ?? 1
      let target = mainnetMid * level
      if (anchor) {
        // The anchor's own multiplier: a policy change carries the current target forward
        // instead of jumping every open range. A pre-reversion anchor (time 0) starts now.
        const moved = anchor.target_mid * (mainnetMid / anchor.source_mid) ** anchor.multiplier
        const elapsed = anchor.anchored_at > 0 ? Math.max(0, at - anchor.anchored_at) : 0
        target = mainnetMid * level * Math.exp(Math.log(moved / (mainnetMid * level)) * Math.exp(-elapsed / reversionMs))
      }
      if (!Number.isFinite(target) || target <= 0) return result(null)
      if (!anchor || anchor.multiplier !== multiplier || anchor.anchored_at === 0 || at - anchor.anchored_at >= PERSIST_MS) {
        save.run(market, multiplier, mainnetMid, target, at, level)
        anchor = select.get(market)
      }
      return result(target)
    },
  }
}
