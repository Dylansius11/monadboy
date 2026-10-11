import { describe, expect, it } from 'bun:test'
import { privateKeyToAccount } from 'viem/accounts'
import { createDemoPrice } from '../src/jobs/demo-price'
import { createDemand } from '../src/routes/demand'
import { mirrorDemandMessage } from '@monadboy/sdk'
import { createGasBudget } from '../src/chain/gas-budget'
import { memoryDb } from './helpers'

const market = '0x1111111111111111111111111111111111111111' as const
const account = privateKeyToAccount(`0x${'12'.repeat(32)}`)

describe('amplified demo price', () => {
  it('amplifies relative movement 50x and preserves its anchor across restart', () => {
    const db = memoryDb()
    const demo = createDemoPrice(db, market, 50, { now: () => 1000 })
    expect(demo.read(0.24).targetMid).toBeCloseTo(0.24)
    expect(demo.read(0.24024).targetMid! / 0.24 - 1).toBeCloseTo(1.001 ** 50 - 1, 10)
    expect(demo.read(0.24024).multiplier).toBe(50)
    const restarted = createDemoPrice(db, market, 50, { now: () => 1000 })
    expect(restarted.read(0.24024)).toEqual(demo.read(0.24024))
    expect(restarted.read(0.20).targetMid).toBeGreaterThan(0)
    expect(restarted.read(null).targetMid).toBeNull()
    expect(() => createDemoPrice(memoryDb(), market, 51)).toThrow('multiplier')
    db.close()
  })

  it('decays the gap to mainnet with the reversion time, never jumping', () => {
    const db = memoryDb()
    let at = 1000
    const demo = createDemoPrice(db, market, 50, { now: () => at, reversionMs: 3_600_000 })
    demo.read(0.24)
    const moved = demo.read(0.2424).targetMid!
    const gap = Math.log(moved / 0.2424)
    expect(moved / 0.24).toBeCloseTo(1.01 ** 50, 8)
    at += 3_600_000
    expect(Math.log(demo.read(0.2424).targetMid! / 0.2424)).toBeCloseTo(gap / Math.E, 8)
    // Reads in between are continuous: one second moves the target by about gap/3600.
    const before = demo.read(0.2424).targetMid!
    at += 1000
    expect(Math.abs(demo.read(0.2424).targetMid! / before - 1)).toBeLessThan(Math.abs(gap) / 3000)
    db.close()
  })

  it('a multiplier change carries the current target forward instead of jumping open ranges', () => {
    const db = memoryDb()
    let at = 1000
    const old = createDemoPrice(db, market, 20, { now: () => at })
    old.read(0.24)
    const before = old.read(0.2424).targetMid!
    // A pre-reversion anchor row (time 0) starts its reversion now, not at the epoch.
    db.query('UPDATE demo_anchors SET anchored_at = 0').run()
    at += 10 * 3_600_000
    const next = createDemoPrice(db, market, 50, { now: () => at })
    expect(next.read(0.2424).targetMid).toBeCloseTo(before, 12)
    expect(next.read(0.2424 * 1.001).targetMid! / before).toBeCloseTo(1.001 ** 50, 8)
    db.close()
  })
})

describe('signed gameplay demand', () => {
  it('expires at the signed deadline; replay cannot extend activity', async () => {
    let at = 100000
    const demand = createDemand({ market, now: () => at, savedDisk: async () => true })
    const signature = await account.signMessage({ message: mirrorDemandMessage(market, account.address, at) })
    const input = { owner: account.address, at, signature }
    await demand.admit(input)
    expect(demand.active()).toBe(1)
    at += 20000
    await demand.admit(input)
    at = 145001
    expect(demand.active()).toBe(0)
    await expect(demand.admit(input)).rejects.toThrow()
  })
  it('rejects a forged owner and a valid signer without a saved disk', async () => {
    const at = 100000
    const signature = await account.signMessage({ message: mirrorDemandMessage(market, account.address, at) })
    const demand = createDemand({ market, now: () => at, savedDisk: async () => false })
    await expect(demand.admit({ owner: account.address, at, signature })).rejects.toThrow('saved disk')
    await expect(demand.admit({ owner: market, at, signature })).rejects.toThrow()
    expect(demand.active()).toBe(0)
  })
  it('keeps the active-player cap when saved-disk reads finish concurrently', async () => {
    const at = 100000
    let reads = 0
    let release!: () => void
    let bothEntered!: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    const entered = new Promise<void>((resolve) => { bothEntered = resolve })
    const demand = createDemand({
      market, now: () => at,
      savedDisk: async () => {
        reads++
        if (reads <= 255) return true
        if (reads === 257) bothEntered()
        await blocked
        return true
      },
    })
    const admission = async (index: number) => {
      const signer = privateKeyToAccount(`0x${index.toString(16).padStart(64, '0')}`)
      const signature = await signer.signMessage({ message: mirrorDemandMessage(market, signer.address, at) })
      return demand.admit({ owner: signer.address, at, signature })
    }
    for (let index = 1; index <= 255; index++) await admission(index)
    const finalAdmissions = [admission(256), admission(257)]
    await entered
    release()
    const results = await Promise.allSettled(finalAdmissions)
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(demand.active()).toBe(256)
  })
})

describe('persistent mirror gas ceiling', () => {
  it('refuses a send before exceeding the UTC daily cap and survives restart', () => {
    const db = memoryDb()
    let at = 100000
    const cap = 2000000000000000000n
    const budget = createGasBudget(db, cap, () => at)
    budget.reserve(1000000n, 1000000000000n)
    budget.reserve(1000000n, 1000000000000n)
    expect(() => budget.reserve(1n, 1n)).toThrow('daily gas')
    const restarted = createGasBudget(db, cap, () => at)
    expect(() => restarted.reserve(1n, 1n)).toThrow('daily gas')
    at = 86400000
    expect(restarted.reserve(1n, 1n)).toBeGreaterThan(0)
    db.close()
  })
  it('keeps unknown broadcast costs charged instead of releasing on transport failure', () => {
    const db = memoryDb()
    const budget = createGasBudget(db, 100n, () => 100000)
    budget.reserve(10n, 10n)
    expect(() => createGasBudget(db, 100n, () => 100000).reserve(1n, 1n)).toThrow()
    db.close()
  })
  it('settles a confirmed send to its billed cost, returning unused headroom to the day', () => {
    const db = memoryDb()
    const budget = createGasBudget(db, 100n, () => 100000)
    const id = budget.reserve(10n, 10n)
    expect(() => budget.reserve(1n, 1n)).toThrow('daily gas')
    expect(budget.status()).toMatchObject({ reservedWei: '100', exhausted: true })
    budget.settle(id, 60n)
    expect(budget.status()).toMatchObject({ reservedWei: '60', exhausted: false })
    expect(budget.reserve(4n, 10n)).toBeGreaterThan(0)
    db.close()
  })
})
