import { expect, test } from 'bun:test'
import {
  decideMirrorAction,
  createMirrorJob,
  createMirrorState,
  mirrorSection,
} from '../src/jobs/mirror'
import type { MirrorExecutor, MirrorInput, MirrorOutcome } from '../src/jobs/mirror'
import { createMidState } from '../src/jobs/mid-sampler'
import { memoryDb, quiet, tx } from './helpers'

const base: MirrorInput = {
  targetMid: 0.03,
  sourceAgeMs: 1000,
  sourcePaused: false,
  testnetObserved: true,
}
const held: MirrorOutcome = { kind: 'hold', reason: 'ladder-current', notional: 0, hashes: [] }

test('a fresh source and an observed book hand the ladder to the executor', () => {
  expect(decideMirrorAction(base)).toEqual({ kind: 'reconcile', reason: 'source-fresh' })
  expect(decideMirrorAction({ ...base, sourceAgeMs: 30_000 }).kind).toBe('reconcile')
})

test('a missing, stale or paused source never signs', () => {
  for (const bad of [
    { targetMid: null },
    { targetMid: 0 },
    { sourceAgeMs: null },
    { sourceAgeMs: 30_001 },
    { sourcePaused: true },
  ])
    expect(decideMirrorAction({ ...base, ...bad })).toEqual({ kind: 'paused', reason: 'source-unavailable' })
})

test('an unread testnet book is never treated as empty: no quotes are seeded', () => {
  expect(decideMirrorAction({ ...base, testnetObserved: false })).toEqual({
    kind: 'hold', reason: 'testnet-unavailable',
  })
})

function harness(
  executor: MirrorExecutor,
  testnetMid: number | null,
  sourceAt: number | null = 9000,
) {
  const db = memoryDb()
  const mid = createMidState()
  Object.assign(mid, { status: 'running', targetMid: 0.03, at: sourceAt })
  Object.assign(mid.testnet, {
    status: testnetMid === null ? 'empty' : 'live',
    mid: testnetMid,
    at: 9000,
  })
  const state = createMirrorState()
  const job = createMirrorJob({ db, mid, state, executor, now: () => 10_000, logger: quiet })
  return { db, mid, state, job }
}

test('idle demand avoids chain reads and transactions; renewed demand obeys the check cadence', async () => {
  let at = 10000
  let players = 0
  let checks = 0
  const db = memoryDb()
  const mid = createMidState()
  Object.assign(mid, { status: 'running', targetMid: 0.03, at: 10000 })
  Object.assign(mid.testnet, { status: 'live', mid: 0.029, at: 10000 })
  const job = createMirrorJob({
    db, mid, state: createMirrorState(),
    executor: { execute: async () => { checks++; return held } },
    active: () => players, intervalMs: 15000, now: () => at, logger: quiet,
  })
  await job()
  expect(checks).toBe(0)
  players = 1
  await job()
  expect(checks).toBe(1)
  at += 5000
  await job()
  expect(checks).toBe(1)
  at += 10000
  mid.at = at
  mid.testnet.at = at
  await job()
  expect(checks).toBe(2)
  db.close()
})

test('every tick is a row: the executed action, price context, hashes and no error on success', async () => {
  const calls: number[] = []
  const { db, state, job } = harness({
    execute: async (target) => {
      calls.push(target)
      return { kind: 'buy', reason: 'below-target', notional: 0.4, hashes: [tx('a'), tx('b')] }
    },
  }, 0.029)
  await job()
  expect(calls).toEqual([0.03])
  expect(
    db.query('SELECT at, source_mid, testnet_mid_before, action, notional, tx_hash, error FROM mirror_ticks').all(),
  ).toEqual([{
    at: 10_000,
    source_mid: 0.03,
    testnet_mid_before: 0.029,
    action: 'buy',
    notional: 0.4,
    tx_hash: `${tx('a')},${tx('b')}`,
    error: null,
  }])
  expect(state).toMatchObject({ attempted: 1, lastAction: 'buy', lastError: null })
})

test('a ladder that still fits the target is a hold row without hashes', async () => {
  const { db, job } = harness({ execute: async () => held }, 0.03)
  await job()
  expect(db.query('SELECT action, tx_hash FROM mirror_ticks').all()).toEqual([{ action: 'hold', tx_hash: null }])
})

test('tick context remains the evaluated price when the sampler advances during signing', async () => {
  const run = harness({
    execute: async () => {
      run.mid.targetMid = 0.04
      run.mid.testnet.mid = 0.039
      return { kind: 'quote', reason: 'ladder-reconciled', notional: 0, hashes: [tx('a')] }
    },
  }, 0.029)
  await run.job()
  expect(run.db.query('SELECT source_mid, testnet_mid_before FROM mirror_ticks').get()).toEqual({
    source_mid: 0.03, testnet_mid_before: 0.029,
  })
})

test('the signing guard refuses a source paused or gone stale while the executor reads', async () => {
  for (const spoil of [
    (run: ReturnType<typeof harness>) => { run.mid.status = 'paused' },
    (run: ReturnType<typeof harness>) => { run.mid.at = 10_000 - 15_001 },
  ]) {
    const run = harness({
      execute: async (_target, assertSource) => {
        spoil(run)
        await assertSource()
        throw new Error('Must not reach signing')
      },
    }, 0.029)
    await run.job()
    expect(run.db.query('SELECT tx_hash, error FROM mirror_ticks').get()).toEqual({
      tx_hash: null, error: 'Error: Source unavailable before mirror signing',
    })
  }
})

test('paused and unobserved ticks are recorded without calling the executor', async () => {
  let executed = 0
  const executor = { execute: async () => { executed++; return held } }
  const paused = harness(executor, 0.029, -30_000)
  await paused.job()
  const failed = harness(executor, null)
  failed.mid.testnet.status = 'unavailable'
  await failed.job()
  const stale = harness(executor, null)
  stale.mid.testnet.at = 9000 - 31_000
  await stale.job()
  expect(executed).toBe(0)
  expect(paused.db.query('SELECT action, tx_hash FROM mirror_ticks').all()).toEqual([{ action: 'paused', tx_hash: null }])
  for (const { db } of [failed, stale])
    expect(db.query('SELECT action FROM mirror_ticks').all()).toEqual([{ action: 'hold' }])
})

test('an executor failure is stored on the tick row with the URL stripped, and the job survives', async () => {
  const { db, state, job } = harness({
    execute: async () => {
      throw new Error('POST https://rpc.example/?apikey=s3cret refused')
    },
  }, 0.029)
  await job()
  expect(db.query('SELECT action, tx_hash, error FROM mirror_ticks').all()).toEqual([
    { action: 'hold', tx_hash: null, error: 'Error: POST <url> refused' },
  ])
  expect(state.lastError).toBe('Error: POST <url> refused')
})

test('a confirmed send survives a later failure in the SQL ledger', async () => {
  const hash = tx('a')
  const { db, job } = harness({
    execute: async () => {
      throw Object.assign(new Error('Quote preflight refused'), { hashes: [hash] })
    },
  }, 0.029)
  await job()
  expect(db.query('SELECT tx_hash, error FROM mirror_ticks').get()).toEqual({
    tx_hash: hash, error: 'Error: Quote preflight refused',
  })
})

test('health calls an exhausted gas budget degraded, not an unknown mirror error', () => {
  const state = createMirrorState()
  state.lastError = 'Error: Mirror daily gas budget exhausted'
  const gas = { capWei: '10', reservedWei: '10', exhausted: true, dayUTC: '2026-10-11' }
  const section = mirrorSection(state, { enabled: true, reason: null }, () => 0, () => gas)()
  expect(section.amber).toBe('mirror-gas-exhausted')
  expect(section.value).toMatchObject({ gas })
  state.lastError = 'Error: other'
  expect(mirrorSection(state, { enabled: true, reason: null }, () => 0, () => null)().amber).toBe('mirror-error')
})
