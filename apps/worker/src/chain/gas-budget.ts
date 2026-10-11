import type { Database } from 'bun:sqlite'
import type { Hex } from 'viem'

const DAY_MS = 86400000
export function createGasBudget(db: Database, capWei: bigint, now = Date.now) {
  if (capWei <= 0n) throw new Error('Mirror daily gas cap must be positive')
  const rows = db.query<{ max_cost_wei: string }, [number, number]>(
    'SELECT max_cost_wei FROM mirror_gas_reservations WHERE at >= ? AND at < ?',
  )
  const spent = (at: number) => {
    const day = Math.floor(at / DAY_MS) * DAY_MS
    return rows.all(day, day + DAY_MS).reduce((sum, row) => sum + BigInt(row.max_cost_wei), 0n)
  }
  const assertRoom = (costWei: bigint) => {
    if (costWei < 0n || spent(now()) + costWei > capWei)
      throw new Error('Mirror daily gas budget exhausted')
  }
  return {
    assertRoom,
    reserve(gas: bigint, maxFeePerGas: bigint) {
      if (gas <= 0n || maxFeePerGas <= 0n) throw new Error('Invalid mirror gas reservation')
      return db.transaction(() => {
        const cost = gas * maxFeePerGas
        assertRoom(cost)
        return Number(db.query('INSERT INTO mirror_gas_reservations (at, max_cost_wei) VALUES (?, ?)')
          .run(now(), cost.toString()).lastInsertRowid)
      })()
    },
    record(id: number, hash: Hex) {
      db.query('UPDATE mirror_gas_reservations SET tx_hash = ? WHERE id = ?').run(hash, id)
    },
    // A confirmed receipt replaces the declared ceiling (limit x maxFee) with the billed cost,
    // which never exceeds it. Unknown or failed sends keep their full reservation.
    settle(id: number, costWei: bigint) {
      if (costWei < 0n) throw new Error('Invalid mirror gas settlement')
      db.query('UPDATE mirror_gas_reservations SET max_cost_wei = ? WHERE id = ?').run(costWei.toString(), id)
    },
    status() {
      const spentWei = spent(now())
      return {
        capWei: capWei.toString(),
        reservedWei: spentWei.toString(),
        exhausted: spentWei >= capWei,
        dayUTC: new Date(now()).toISOString().slice(0, 10),
      }
    },
  }
}
export type GasBudget = ReturnType<typeof createGasBudget>
