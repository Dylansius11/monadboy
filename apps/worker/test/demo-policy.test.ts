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
  it('amplifies relative movement and preserves its anchor across restart', () => {
    const db = memoryDb()
    const demo = createDemoPrice(db, market, 20)
    expect(demo.read(0.24).targetMid).toBeCloseTo(0.24)
    expect(demo.read(0.24024).targetMid! / 0.24 - 1).toBeCloseTo(0.02019114486, 8)
    const restarted = createDemoPrice(db, market, 20)
    expect(restarted.read(0.24024)).toEqual(demo.read(0.24024))
    expect(restarted.read(0.20).targetMid).toBeGreaterThan(0)
    expect(restarted.read(null).targetMid).toBeNull()
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
})
