import type { Database } from 'bun:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const migrationsDirectory = fileURLToPath(
  new URL('./migrations/', import.meta.url),
)

// Applies NNN_name.sql files in numeric order, each in its own transaction,
// and records the version so a restart never re-runs it. A failing file rolls
// back completely and stops the sequence.
export function migrate(
  db: Database,
  directory = migrationsDirectory,
): number[] {
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000')
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL) STRICT',
  )
  const names = readdirSync(directory)
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort()
  const seen = new Set<number>()
  const applied: number[] = []
  for (const name of names) {
    const version = Number(name.slice(0, 3))
    if (version < 1 || seen.has(version))
      throw new Error(`Invalid or duplicate migration number in ${name}`)
    seen.add(version)
    if (
      db
        .query('SELECT version FROM schema_migrations WHERE version = ?')
        .get(version)
    )
      continue
    const sql = readFileSync(`${directory}/${name}`, 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.query(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      ).run(version, name, Date.now())
    })()
    applied.push(version)
  }
  return applied
}
