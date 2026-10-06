import { Database } from 'bun:sqlite'
import { migrate } from '../src/db/migrate'

export const quiet = () => {}
export function memoryDb(): Database {
  const db = new Database(':memory:')
  migrate(db)
  return db
}
export const tx = (digit: string) => `0x${digit.repeat(64)}` as const
export const address = (digit: string) => `0x${digit.repeat(40)}` as const
