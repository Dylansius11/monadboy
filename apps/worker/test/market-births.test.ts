import { expect, test } from 'bun:test'
import { createBirthResolver, findBirth } from '../src/chain/market-births'
import { address, memoryDb, quiet } from './helpers'

// Code appears at `deployed`; state older than `servedFrom` is no longer served (errors).
const history = (deployed: bigint, servedFrom = 0n) => ({
  getCode: async ({ blockNumber }: { blockNumber: bigint }) => {
    if (blockNumber < servedFrom) throw new Error('state pruned')
    return blockNumber >= deployed ? '0x6080' : '0x'
  },
})

test('finds the exact deployment block when older state is still served', async () => {
  expect(await findBirth(history(700n), address('1'), 5000n)).toEqual({
    block: 700n,
    exact: true,
  })
  expect(await findBirth(history(0n), address('1'), 50n)).toEqual({
    block: 0n,
    exact: true,
  })
})

test('when older state is pruned the answer is a bound, flagged inexact, never an invented birthday', async () => {
  expect(await findBirth(history(50n, 300n), address('1'), 5000n)).toEqual({
    block: 300n,
    exact: false,
  })
})

test('a market with no bytecode at the head cannot be dated', async () => {
  await expect(findBirth(history(9000n), address('1'), 5000n)).rejects.toThrow(
    'no bytecode',
  )
})

test('the resolver stores each market once, keeps what it resolved, and retries only what failed', async () => {
  const db = memoryDb()
  let broken = true
  const queried = new Set<string>()
  const client = {
    getBlockNumber: async () => 5000n,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({
      timestamp: blockNumber * 2n,
    }),
    getCode: async ({
      address: target,
      blockNumber,
    }: {
      address: string
      blockNumber: bigint
    }) => {
      queried.add(target)
      if (broken && target.endsWith('9c394')) throw new Error('rpc down')
      return blockNumber >= 700n ? '0x6080' : '0x'
    },
  }
  const resolver = createBirthResolver({ db, client, logger: quiet })
  await resolver.resolve()
  const first = resolver.births()
  expect(first.size).toBe(6)
  expect(first.get('AUSD_USDC')).toEqual({
    market: 'AUSD_USDC',
    block: 700,
    at: 1_400_000,
    exact: true,
  })
  expect(first.has('MON_USDC')).toBe(false)
  broken = false
  queried.clear()
  await resolver.resolve()
  expect(resolver.births().size).toBe(7)
  expect([...queried].every((target) => target.endsWith('9c394'))).toBe(true)
})
