import { expect, test } from 'bun:test'
import {
  decideMirrorAction,
  createMirrorJob,
  createMirrorState,
} from '../src/jobs/mirror'
import type { MirrorExecutor, MirrorInput } from '../src/jobs/mirror'
import { createMidState } from '../src/jobs/mid-sampler'
import { memoryDb, quiet, tx } from './helpers'

const base: MirrorInput = {
  targetMid: 0.03,
  sourceAgeMs: 1000,
  sourcePaused: false,
  testnetMid: 0.03,
  testnetObserved: true,
  deviationThreshold: 0.0005,
  maxStepNotional: 2,
  inventory: { base: 1000, quote: 100 },
}

test('does nothing inside the deviation threshold, including exactly on it', () => {
  expect(decideMirrorAction(base)).toMatchObject({
    kind: 'hold',
    notional: 0,
    reason: 'within-threshold',
  })
  expect(
    decideMirrorAction({ ...base, testnetMid: 0.03 * 1.0005 }),
  ).toMatchObject({ kind: 'hold' })
  expect(
    decideMirrorAction({ ...base, testnetMid: 0.03 * 0.9995 }),
  ).toMatchObject({ kind: 'hold' })
  expect(
    decideMirrorAction({ ...base, testnetMid: 0.03 * 1.0006 }),
  ).toMatchObject({ kind: 'sell' })
})

test('trades toward the target: buy when the testnet is cheap, sell when it is dear', () => {
  expect(decideMirrorAction({ ...base, testnetMid: 0.029 })).toMatchObject({
    kind: 'buy',
    reason: 'below-target',
  })
  expect(decideMirrorAction({ ...base, testnetMid: 0.031 })).toMatchObject({
    kind: 'sell',
    reason: 'above-target',
  })
})

test('notional is capped by the step cap and by the inventory that funds that side', () => {
  expect(decideMirrorAction({ ...base, testnetMid: 0.029 }).notional).toBe(2)
  expect(
    decideMirrorAction({
      ...base,
      testnetMid: 0.029,
      inventory: { base: 1000, quote: 0.25 },
    }).notional,
  ).toBe(0.25)
  // base inventory is valued at the target: 10 base * 0.03 = 0.3 quote units
  expect(
    decideMirrorAction({
      ...base,
      testnetMid: 0.031,
      inventory: { base: 10, quote: 100 },
    }).notional,
  ).toBeCloseTo(0.3, 12)
  expect(
    decideMirrorAction({
      ...base,
      testnetMid: 0.029,
      inventory: { base: 1000, quote: 0 },
    }),
  ).toMatchObject({ kind: 'hold', reason: 'no-inventory' })
  expect(
    decideMirrorAction({
      ...base,
      testnetMid: 0.031,
      inventory: { base: 0, quote: 100 },
    }),
  ).toMatchObject({ kind: 'hold', reason: 'no-inventory' })
})

test('a missing, stale or paused source never trades, whatever the testnet price is', () => {
  const far = { ...base, testnetMid: 0.01 }
  for (const bad of [
    { targetMid: null },
    { targetMid: 0 },
    { sourceAgeMs: null },
    { sourceAgeMs: 30_001 },
    { sourcePaused: true },
  ]) {
    expect(decideMirrorAction({ ...far, ...bad })).toEqual({
      kind: 'paused',
      notional: 0,
      quoteNotional: 0,
      reason: 'source-unavailable',
    })
  }
  expect(decideMirrorAction({ ...far, sourceAgeMs: 30_000 }).kind).toBe('buy')
})

test('an empty testnet book seeds resting quotes sized by the smaller side of the inventory', () => {
  expect(decideMirrorAction({ ...base, testnetMid: null })).toMatchObject({
    kind: 'quote',
    notional: 0,
    quoteNotional: 2,
  })
  expect(
    decideMirrorAction({
      ...base,
      testnetMid: null,
      inventory: { base: 10, quote: 100 },
    }).quoteNotional,
  ).toBeCloseTo(0.3, 12)
  expect(
    decideMirrorAction({
      ...base,
      testnetMid: null,
      inventory: { base: 0, quote: 100 },
    }),
  ).toMatchObject({ kind: 'hold', reason: 'no-inventory' })
})

test('an unread testnet book is never treated as empty: no quotes are seeded', () => {
  expect(
    decideMirrorAction({ ...base, testnetMid: null, testnetObserved: false }),
  ).toMatchObject({ kind: 'hold', notional: 0, reason: 'testnet-unavailable' })
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
  const job = createMirrorJob({
    db,
    mid,
    state,
    executor,
    maxStepNotional: 2,
    deviationThreshold: 0.0005,
    now: () => 10_000,
    logger: quiet,
  })
  return { db, mid, state, job }
}
const funded = { inventory: async () => ({ base: 1000, quote: 100 }) }

test('every tick is a row: the action, price context, hashes and no error on success', async () => {
  const calls: string[] = []
  const { db, state, job } = harness(
    {
      ...funded,
      execute: async (action, target) => {
        calls.push(`${action.kind}@${target}`)
        return [tx('a'), tx('b')]
      },
    },
    0.029,
  )
  await job()
  expect(calls).toEqual(['buy@0.03'])
  expect(
    db
      .query(
        'SELECT at, source_mid, testnet_mid_before, action, notional, tx_hash, error FROM mirror_ticks',
      )
      .all(),
  ).toEqual([
    {
      at: 10_000,
      source_mid: 0.03,
      testnet_mid_before: 0.029,
      action: 'buy',
      notional: 2,
      tx_hash: `${tx('a')},${tx('b')}`,
      error: null,
    },
  ])
  expect(state).toMatchObject({
    attempted: 1,
    lastAction: 'buy',
    lastError: null,
  })
})

test('hold and paused ticks are recorded without calling the executor to execute', async () => {
  let executed = 0
  const executor = {
    ...funded,
    execute: async () => {
      executed++
      return []
    },
  }
  const held = harness(executor, 0.03)
  await held.job()
  const paused = harness(executor, 0.029, -30_000)
  await paused.job()
  expect(executed).toBe(0)
  expect(held.db.query('SELECT action FROM mirror_ticks').all()).toEqual([
    { action: 'hold' },
  ])
  expect(
    paused.db.query('SELECT action, tx_hash FROM mirror_ticks').all(),
  ).toEqual([{ action: 'paused', tx_hash: null }])
})

test('an executor failure is stored on the tick row with the URL stripped, and the job survives', async () => {
  const { db, state, job } = harness(
    {
      ...funded,
      execute: async () => {
        throw new Error('POST https://rpc.example/?apikey=s3cret refused')
      },
    },
    0.029,
  )
  await job()
  expect(
    db.query('SELECT action, tx_hash, error FROM mirror_ticks').all(),
  ).toEqual([
    { action: 'buy', tx_hash: null, error: 'Error: POST <url> refused' },
  ])
  expect(state.lastError).toBe('Error: POST <url> refused')
})

test('a failed or stale testnet read holds the tick instead of seeding quotes', async () => {
  let executed = 0
  const executor = {
    ...funded,
    execute: async () => {
      executed++
      return []
    },
  }
  const failed = harness(executor, null)
  failed.mid.testnet.status = 'unavailable'
  await failed.job()
  const stale = harness(executor, null)
  stale.mid.testnet.at = 9000 - 31_000
  await stale.job()
  expect(executed).toBe(0)
  for (const { db } of [failed, stale])
    expect(db.query('SELECT action FROM mirror_ticks').all()).toEqual([
      { action: 'hold' },
    ])
})

test('an inventory read that outlasts the source freshness never executes', async () => {
  const db = memoryDb()
  let at = 1000
  let executed = false
  const mid = createMidState()
  Object.assign(mid, { status: 'running', targetMid: 0.03, at })
  mid.testnet = { status: 'empty', mid: null, at, market: 'MON_AUSD' }
  const state = createMirrorState()
  try {
    await createMirrorJob({
      db, mid, state, maxStepNotional: 1, deviationThreshold: 0.0005,
      now: () => at, logger: quiet,
      executor: {
        inventory: async () => {
          at += 30_001
          return { base: 100, quote: 10 }
        },
        execute: async () => {
          executed = true
          return []
        },
      },
    })()
    expect(executed).toBe(false)
    expect(state.lastAction).toBe('paused')
    expect(db.query('SELECT action, tx_hash FROM mirror_ticks').all()).toEqual([
      { action: 'paused', tx_hash: null },
    ])
  } finally {
    db.close()
  }
})
