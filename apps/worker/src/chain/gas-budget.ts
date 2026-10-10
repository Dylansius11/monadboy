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
    status() {
      return { capWei: capWei.toString(), reservedWei: spent(now()).toString(), dayUTC: new Date(now()).toISOString().slice(0, 10) }
    },
  }
}
export type GasBudget = ReturnType<typeof createGasBudget>
