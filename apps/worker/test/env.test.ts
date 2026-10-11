import { expect, test } from 'bun:test'
import { parseEnv } from '../src/env'

test('an empty environment is a valid read-only configuration with no signing keys', () => {
  const env = parseEnv({})
  expect(env.ENABLE_TRANSACTIONS).toBe(false)
  expect(env.BOT_PRIVATE_KEY).toBeUndefined()
  expect(env.TESTNET_START_BLOCK).toBe(68940637n)
})

test('custom market history needs an explicit start rather than inheriting the default deployment', () => {
  expect(
    parseEnv({ MARKETS_JSON: 'custom-market.json' }).TESTNET_START_BLOCK,
  ).toBeUndefined()
  expect(
    parseEnv({ MARKETS_JSON: 'custom-market.json', TESTNET_START_BLOCK: '42' })
      .TESTNET_START_BLOCK,
  ).toBe(42n)
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

test('proxy trust requires one exact IP, not a network or hostname', () => {
  for (const peer of ['172.18.0.0/16', 'caddy', '*', '999.18.0.4'])
    expect(() => parseEnv({ TRUSTED_PROXY_IP: peer })).toThrow()
})

test('mirror pacing and DEMO amplification default to 60 s, 1% and 50x, and are range checked', () => {
  const env = parseEnv({})
  expect([env.MIRROR_INTERVAL_MS, env.MIRROR_DEADBAND, env.DEMO_MULTIPLIER]).toEqual([60_000, 0.01, 50])
  expect(env.MIRROR_DAILY_GAS_MON).toBe(10n * 10n ** 18n)
  expect(parseEnv({ DEMO_MULTIPLIER: '20' }).DEMO_MULTIPLIER).toBe(20)
  for (const bad of [{ DEMO_MULTIPLIER: '51' }, { DEMO_MULTIPLIER: '0' }, { DEMO_MULTIPLIER: '2.5' },
    { MIRROR_INTERVAL_MS: '1000' }, { MIRROR_DEADBAND: '0.2' }])
    expect(() => parseEnv(bad)).toThrow()
})
