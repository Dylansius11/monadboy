import { afterEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from '../src/db/migrate'

const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach((fn) => fn()))
function scratch(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), 'migrations-'))
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }))
  for (const [name, sql] of Object.entries(files))
    writeFileSync(join(directory, name), sql)
  const db = new Database(':memory:')
  cleanup.push(() => db.close())
  return { directory, db }
}

test('the shipped migrations apply to a fresh database exactly once, in order', () => {
  const db = new Database(':memory:')
  cleanup.push(() => db.close())
  const first = migrate(db)
  expect(first.length).toBeGreaterThan(0)
  expect(first).toEqual([...first].sort((a, b) => a - b))
  expect(migrate(db)).toEqual([])
  expect(
    db.query('SELECT version FROM schema_migrations ORDER BY version').all(),
  ).toEqual(first.map((version) => ({ version })))
})

test('a failing migration rolls back completely, is not recorded, and stops later ones', () => {
  const { directory, db } = scratch({
    '001_ok.sql': 'CREATE TABLE a (x INTEGER);',
    '002_bad.sql':
      'CREATE TABLE b (x INTEGER); INSERT INTO missing VALUES (1);',
    '003_never.sql': 'CREATE TABLE c (x INTEGER);',
  })
  expect(() => migrate(db, directory)).toThrow()
  expect(db.query('SELECT version FROM schema_migrations').all()).toEqual([
    { version: 1 },
  ])
  expect(
    db.query("SELECT name FROM sqlite_master WHERE name IN ('b', 'c')").all(),
  ).toEqual([])
})

test('duplicate or zero migration numbers are rejected before anything runs', () => {
  const { directory, db } = scratch({
    '001_a.sql': 'CREATE TABLE a (x INTEGER);',
    '001_b.sql': 'CREATE TABLE b (x INTEGER);',
  })
  expect(() => migrate(db, directory)).toThrow('duplicate')
  const zero = scratch({ '000_a.sql': 'CREATE TABLE a (x INTEGER);' })
  expect(() => migrate(zero.db, zero.directory)).toThrow('Invalid')
})
