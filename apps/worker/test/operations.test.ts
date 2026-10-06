import { expect, test } from 'bun:test'
import type { PublicClient } from 'viem'
import { parseEnv } from '../src/env'
import { createOperations } from '../src/operations'
import { memoryDb } from './helpers'

const key = (digit: string) => `0x${digit.repeat(64)}`
const signing = {
  ENABLE_TRANSACTIONS: 'true',
  BOT_PRIVATE_KEY: key('1'),
  DRIP_PRIVATE_KEY: key('2'),
  DRIP_IP_SALT: 's'.repeat(32),
}
const fake = (chainId: number, code: string | undefined) =>
  ({
    getChainId: async () => chainId,
    getCode: async () => code,
  }) as unknown as PublicClient

test('with transactions disabled no signer, drip, executor or top-up exists, whatever keys are present', async () => {
  const ops = await createOperations({
    db: memoryDb(),
    env: parseEnv({ ...signing, ENABLE_TRANSACTIONS: 'false' }),
    client: fake(1, undefined),
    markets: [],
  })
  expect([ops.drip, ops.executor, ops.topup, ops.monitor]).toEqual([
    undefined,
    undefined,
    null,
    null,
  ])
  expect([ops.dripStatus, ops.execution]).toEqual(
    Array(2).fill({ enabled: false, reason: 'transactions-disabled' }),
  )
})

test('signing is refused on any chain other than Monad testnet, before any key is touched', async () => {
  await expect(
    createOperations({
      db: memoryDb(),
      env: parseEnv(signing),
      client: fake(143, '0x6080'),
      markets: [],
    }),
  ).rejects.toThrow('chain 10143')
})

test('signing is refused when a configured contract has no bytecode', async () => {
  await expect(
    createOperations({
      db: memoryDb(),
      env: parseEnv(signing),
      client: fake(10143, '0x'),
      markets: [],
    }),
  ).rejects.toThrow('no code')
})
