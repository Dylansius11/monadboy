import { readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'
import { parseEnv } from '../src/env'

test('an empty environment is a valid read-only configuration with no signing keys', () => {
  const env = parseEnv({})
  expect(env.WORKER_PORT).toBe(8787)
  expect(env.WORKER_BIND).toBe('127.0.0.1')
  expect(env.ENABLE_TRANSACTIONS).toBe(false)
  expect(env.BOT_PRIVATE_KEY).toBeUndefined()
  expect(env.TESTNET_START_BLOCK).toBeUndefined()
})

test('blank values count as unset and token amounts become exact base units', () => {
  const env = parseEnv({
    BOT_PRIVATE_KEY: '',
    HYPERSYNC_API_TOKEN: '',
    DRIP_MON: '0.5',
    DRIP_AUSD: '12.345678',
    TESTNET_START_BLOCK: '42',
  })
  expect(env.BOT_PRIVATE_KEY).toBeUndefined()
  expect(env.HYPERSYNC_API_TOKEN).toBeUndefined()
  expect(env.DRIP_MON).toBe(500_000_000_000_000_000n)
  expect(env.DRIP_AUSD).toBe(12_345_678n)
  expect(env.TESTNET_START_BLOCK).toBe(42n)
})

test('rejects bad ports, over-precise amounts, malformed keys and one key used for both treasuries', () => {
  const key = `0x${'1'.repeat(64)}` as const
  expect(() => parseEnv({ WORKER_PORT: '0' })).toThrow()
  expect(() => parseEnv({ WORKER_PORT: '70000' })).toThrow()
  expect(() => parseEnv({ DRIP_AUSD: '1.0000001' })).toThrow()
  expect(() => parseEnv({ BOT_PRIVATE_KEY: '0x12' })).toThrow()
  expect(() =>
    parseEnv({
      BOT_PRIVATE_KEY: key,
      DRIP_PRIVATE_KEY: key.toUpperCase().replace('0X', '0x'),
    }),
  ).toThrow('must differ')
  expect(
    parseEnv({ BOT_PRIVATE_KEY: key, DRIP_PRIVATE_KEY: `0x${'2'.repeat(64)}` })
      .BOT_PRIVATE_KEY,
  ).toBe(key)
})

test('a .env copied from the example, with every variable blank, parses to the defaults', () => {
  const blank = Object.fromEntries(
    readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => [line.split('=')[0], '']),
  )
  expect(Object.keys(blank).length).toBeGreaterThan(20)
  expect(parseEnv(blank)).toEqual(parseEnv({}))
})
