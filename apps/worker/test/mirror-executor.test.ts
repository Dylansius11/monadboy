import { expect, test } from 'bun:test'
import type { PublicClient } from 'viem'
import { testnetMarkets } from '@monadboy/sdk'
import { createMirrorExecutor } from '../src/chain/mirror-executor'
import type { Treasury } from '../src/chain/treasury'
import { decideMirrorAction } from '../src/jobs/mirror'
import { memoryDb } from './helpers'

// Isolate a preflight boundary without a signing key or a fabricated mined receipt.
test('a crossed passive refresh is refused before signing and caps ask notional', async () => {
  const db = memoryDb()
  const market = testnetMarkets.find((entry) => entry.symbol === 'MON_AUSD')!
  let request: { args: readonly unknown[] } | undefined
  let sends = 0
  let guardCalls = 0
  const client = {
    getBlockNumber: async () => 1n,
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getMarketParams')
        return [
          100000000,
          10000000000n,
          market.baseToken,
          18n,
          market.quoteToken,
          6n,
          1,
          15000000000n,
          (1n << 96n) - 1n,
          30n,
          0n,
        ]
      if (functionName === 'getBalance') return 10n ** 20n
      throw new Error(`Unexpected read: ${functionName}`)
    },
    simulateContract: async (call: { args: readonly unknown[] }) => {
      request = call
      throw new Error('PostOnlyError')
    },
  } as unknown as PublicClient
  const treasury = {
    account: { address: '0x2FBF1B1063EF5e5d0422D8c4c4357640f99F7c1F' },
    send: async () => {
      sends++
      throw new Error('Must not sign')
    },
  } as unknown as Treasury
  const executor = createMirrorExecutor({
    db,
    client,
    treasury,
    market,
    margin: '0xd029C2D98ff85D8F64799017fE00a59B1159CE02',
    gas: { marketOrder: 2000000n, batchUpdate: 2000000n },
  })
  await expect(
    executor.execute(
      { kind: 'quote', notional: 0, quoteNotional: 0.06, reason: 'book-empty' },
      0.0268,
      () => {
        guardCalls++
      },
    ),
  ).rejects.toThrow('PostOnlyError')
  expect(sends).toBe(0)
  expect(guardCalls).toBe(0)
  const ask = Number((request!.args[2] as number[])[0]) / 1e8
  const size = Number((request!.args[3] as bigint[])[0]) / 1e10
  expect(size * ask).toBeLessThanOrEqual(0.06)
  expect(db.query('SELECT * FROM mirror_quotes').all()).toEqual([])
  db.close()
})

test('source is checked after estimation and queue awaits, before a new quote signature', async () => {
  const db = memoryDb()
  const market = testnetMarkets.find((entry) => entry.symbol === 'MON_AUSD')!
  let fresh = true
  let signatures = 0
  const client = {
    getBlockNumber: async () => 1n,
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getMarketParams')
        return [
          100000000,
          10000000000n,
          market.baseToken,
          18n,
          market.quoteToken,
          6n,
          1,
          15000000000n,
          (1n << 96n) - 1n,
          30n,
          0n,
        ]
      if (functionName === 'getBalance') return 10n ** 20n
      throw new Error(`Unexpected read: ${functionName}`)
    },
    simulateContract: async () => ({}),
    estimateContractGas: async () => {
      fresh = false
      return 100000n
    },
  } as unknown as PublicClient
  const treasury = {
    account: { address: '0x2FBF1B1063EF5e5d0422D8c4c4357640f99F7c1F' },
    send: async (build: (nonce: number) => Promise<unknown>) => {
      await build(0)
      throw new Error('Must not broadcast')
    },
    wallet: {
      writeContract: async () => {
        signatures++
        throw new Error('Must not sign')
      },
    },
  } as unknown as Treasury
  const executor = createMirrorExecutor({
    db,
    client,
    treasury,
    market,
    margin: '0xd029C2D98ff85D8F64799017fE00a59B1159CE02',
    gas: { marketOrder: 2000000n, batchUpdate: 2000000n },
  })
  await expect(
    executor.execute(
      { kind: 'quote', notional: 0, quoteNotional: 0.06, reason: 'book-empty' },
      0.0268,
      () => {
        if (!fresh) throw new Error('Source became stale')
      },
    ),
  ).rejects.toThrow('Source became stale')
  expect(signatures).toBe(0)
  db.close()
})

function inventoryHarness(active = true, owned = true) {
  const db = memoryDb()
  const market = testnetMarkets.find((entry) => entry.symbol === 'MON_AUSD')!
  const bot = '0x2FBF1B1063EF5e5d0422D8c4c4357640f99F7c1F'
  const other = '0x1111111111111111111111111111111111111111'
  for (const id of [1, 2])
    db.query('INSERT INTO mirror_quotes (market,order_id) VALUES (?,?)')
      .run(market.address, String(id))
  const client = {
    getBlockNumber: async () => 90n,
    readContract: async ({
      functionName, args, blockNumber,
    }: { functionName: string; args?: readonly unknown[]; blockNumber?: bigint }) => {
      if (functionName === 'getMarketParams')
        return [
          100000000, 10000000000n, market.baseToken, 18n, market.quoteToken,
          6n, 1, 15000000000n, (1n << 96n) - 1n, 30n, 0n,
        ]
      if (functionName === 'getBalance') {
        // A newer head has credited a canceled quote; mixing heads double-counts it.
        if (args![1] === market.baseToken)
          return blockNumber === 90n ? 10n ** 18n : 44n * 10n ** 17n
        return 2500000n
      }
      if (functionName === 's_orders') {
        const buy = args![0] === 1
        return [
          owned ? bot : other, buy ? 20000000000n : 24000000000n,
          0, 0, 0, buy ? 2500000 : 2505000, 0, buy,
        ]
      }
      if (functionName === 's_buyPricePoints') return [active ? 1 : 0, 1, 0n]
      if (functionName === 's_sellPricePoints') return [active ? 2 : 0, 2, 0n]
      throw new Error(`Unexpected read: ${functionName}`)
    },
  } as unknown as PublicClient
  const executor = createMirrorExecutor({
    db, client, market,
    treasury: { account: { address: bot } } as unknown as Treasury,
    margin: '0xd029C2D98ff85D8F64799017fE00a59B1159CE02',
    gas: { marketOrder: 2000000n, batchUpdate: 2000000n },
  })
  return { db, executor }
}

test('a mirror refresh can reuse its remaining resting inventory without mixing block balances', async () => {
  const { db, executor } = inventoryHarness()
  try {
    const inventory = await executor.inventory()
    expect(inventory.base).toBeCloseTo(3.4, 12)
    expect(inventory.quote).toBeCloseTo(2.55, 12)
    const action = decideMirrorAction({
      targetMid: 0.025, sourceAgeMs: 1000, sourcePaused: false,
      testnetMid: 0.0249, testnetObserved: true,
      deviationThreshold: 0.0005, maxStepNotional: 0.06, inventory,
    })
    expect(action.kind).toBe('buy')
    expect(action.quoteNotional).toBe(0.06)
    expect(action.quoteNotional / 0.025).toBeGreaterThanOrEqual(1.5)
  } finally { db.close() }
})

test.each([
  { name: 'stale positive order storage outside the live price point', active: false, owned: true },
  { name: 'an active quote belonging to another account', active: true, owned: false },
])('mirror inventory excludes $name', async ({ active, owned }) => {
  const { db, executor } = inventoryHarness(active, owned)
  try {
    const inventory = await executor.inventory()
    expect(inventory).toEqual({ base: 1, quote: 2.5 })
  } finally { db.close() }
})
