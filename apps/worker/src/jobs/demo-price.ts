import type { Database } from 'bun:sqlite'

export const DEMO_MULTIPLIER = 20
export type DemoPrice = ReturnType<typeof createDemoPrice>

export function createDemoPrice(db: Database, market: string, multiplier = DEMO_MULTIPLIER) {
  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 20)
    throw new Error('Invalid demo movement multiplier')
  const select = db.query<{ multiplier: number; source_mid: number; target_mid: number }, [string]>(
    'SELECT multiplier, source_mid, target_mid FROM demo_anchors WHERE market = ?',
  )
  let anchor = select.get(market)
  if (anchor && anchor.multiplier !== multiplier)
    throw new Error('Demo multiplier cannot change under an existing anchor')
  return {
    read(mainnetMid: number | null) {
      const valid = mainnetMid !== null && Number.isFinite(mainnetMid) && mainnetMid > 0
      if (!anchor && valid) {
        db.query('INSERT OR IGNORE INTO demo_anchors VALUES (?, ?, ?, ?)')
          .run(market, multiplier, mainnetMid, mainnetMid)
        anchor = select.get(market)
      }
      const target = valid && anchor
        ? anchor.target_mid * (mainnetMid / anchor.source_mid) ** multiplier
        : null
      return {
        targetMid: target !== null && Number.isFinite(target) && target > 0 ? target : null,
        mainnetMid,
        multiplier,
        anchorSource: anchor?.source_mid ?? null,
        anchorTarget: anchor?.target_mid ?? null,
      }
    },
  }
}
