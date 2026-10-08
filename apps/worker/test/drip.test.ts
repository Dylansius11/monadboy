import { expect, test } from 'bun:test'
import { createApp } from '../src/app'
import { clientIp, createDripService, dripRoute } from '../src/routes/drip'
import type { DripChain, DripConfig, DripService } from '../src/routes/drip'
import { parseEnv } from '../src/env'
import { address, memoryDb, quiet, tx } from './helpers'

const disk = address('1')
const config: DripConfig = {
  monWei: 100n,
  ausdUnits: 200n,
  thresholdWei: 10n,
  dailyCap: 50,
  perIpDaily: 3,
  salt: 'unit-test-salt',
}
const chain = (overrides: Partial<DripChain> = {}): DripChain => ({
  nonce: async () => 0,
  balance: async () => 0n,
  supply: async () => ({ mon: 10_000n, ausd: 10_000n }),
  sendMon: async () => tx('1'),
  sendAusd: async () => tx('2'),
  ...overrides,
})
function setup(
  overrides: Partial<DripChain> = {},
  cfg = config,
  clock = { now: 1_000_000 },
) {
  const db = memoryDb()
  const calls: string[] = []
  const service = createDripService({
    db,
    config: cfg,
    now: () => clock.now,
    logger: quiet,
    chain: chain({
      ...overrides,
      sendMon:
        overrides.sendMon ??
        (async () => {
          calls.push('mon')
          return tx('1')
        }),
      sendAusd:
        overrides.sendAusd ??
        (async () => {
          calls.push('ausd')
          return tx('2')
        }),
    }),
  })
  return { db, service, calls, clock }
}
const ledger = (db: ReturnType<typeof memoryDb>) =>
  db
    .query<{ status: string }, []>('SELECT status FROM drips ORDER BY id')
    .all()
    .map((row) => row.status)

test('a fresh disk gets MON then AUSD, and the ledger keeps hashes, exact amounts and only a hashed IP', async () => {
  const { db, service, calls } = setup()
  expect(
    await service.request(
      disk.toUpperCase().replace('0X', '0x'),
      '203.0.113.7',
    ),
  ).toEqual({ status: 'sent', monTx: tx('1'), ausdTx: tx('2') })
  expect(calls).toEqual(['mon', 'ausd'])
  const row = db.query<Record<string, string>, []>('SELECT * FROM drips').get()!
  expect(row).toMatchObject({
    address: disk,
    mon_wei: '100',
    ausd_units: '200',
    mon_tx: tx('1'),
    ausd_tx: tx('2'),
    status: 'sent',
  })
  expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/)
  expect(JSON.stringify(row)).not.toContain('203.0.113.7')
})

test('malformed addresses are refused before any chain access and still recorded', async () => {
  const { db, service, calls } = setup({
    nonce: async () => {
      throw new Error('must not be reached')
    },
  })
  for (const input of [
    'invalid',
    '0x123',
    `0x${'g'.repeat(40)}`,
    `${disk}00`,
    42,
    null,
    undefined,
  ]) {
    expect((await service.request(input, 'ip')).status).toBe('invalid-address')
  }
  expect(calls).toEqual([])
  expect(ledger(db)).toHaveLength(7)
})

test('without a funded treasury configured every request is refused as supply-unavailable', async () => {
  const db = memoryDb()
  expect(
    (
      await createDripService({
        db,
        config,
        now: () => 1,
        logger: quiet,
      }).request(disk, 'ip')
    ).status,
  ).toBe('supply-unavailable')
  expect(ledger(db)).toEqual(['supply-unavailable'])
})

test('an address already funded, mid-funding or half-funded is never funded again; a failed attempt may retry', async () => {
  const { db, service } = setup()
  expect((await service.request(disk, 'a')).status).toBe('sent')
  expect((await service.request(disk, 'b')).status).toBe('already-funded')
  const pending = address('2')
  db.query(
    "INSERT INTO drips (at, address, ip_hash, mon_wei, ausd_units, status) VALUES (1, ?, 'x', '1', '1', 'pending')",
  ).run(pending)
  expect((await service.request(pending, 'c')).status).toBe('already-funded')
  const failing = setup({
    sendMon: async () => {
      throw new Error('rpc')
    },
  })
  expect((await failing.service.request(disk, 'a')).status).toBe('send-failed')
  const retry = createDripService({
    db: failing.db,
    config,
    now: () => 1_000_000,
    logger: quiet,
    chain: chain(),
  })
  expect((await retry.request(disk, 'a')).status).toBe('sent')
})

test('the fourth request from one IP inside 24h is refused, refusals do not use quota, and the window rolls', async () => {
  const { db, service, clock } = setup()
  for (const digit of ['1', '2', '3'])
    expect((await service.request(address(digit), '198.51.100.1')).status).toBe(
      'sent',
    )
  expect((await service.request(address('4'), '198.51.100.1')).status).toBe(
    'ip-limit',
  )
  expect((await service.request(address('5'), '198.51.100.2')).status).toBe(
    'sent',
  )
  clock.now += 86_400_000 + 1
  expect((await service.request(address('4'), '198.51.100.1')).status).toBe(
    'sent',
  )
  expect(ledger(db).filter((status) => status === 'ip-limit')).toHaveLength(1)
})

test('the global daily cap counts every sent or in-flight grant and refuses the next', async () => {
  const { service } = setup({}, { ...config, dailyCap: 2, perIpDaily: 10 })
  expect((await service.request(address('1'), 'a')).status).toBe('sent')
  expect((await service.request(address('2'), 'b')).status).toBe('sent')
  expect((await service.request(address('3'), 'c')).status).toBe('daily-limit')
})

test('a disk that has ever sent a transaction is not fresh', async () => {
  const { service, calls } = setup({ nonce: async () => 1 })
  expect((await service.request(disk, 'ip')).status).toBe('not-fresh')
  expect(calls).toEqual([])
})

test('a balance at or above the threshold is refused; just below it is funded', async () => {
  expect(
    (await setup({ balance: async () => 10n }).service.request(disk, 'ip'))
      .status,
  ).toBe('balance-above-threshold')
  expect(
    (await setup({ balance: async () => 9n }).service.request(disk, 'ip'))
      .status,
  ).toBe('sent')
})

test('chain read failures are refusals, not crashes and not guesses', async () => {
  expect(
    (
      await setup({
        nonce: async () => {
          throw new Error('offline')
        },
      }).service.request(disk, 'ip')
    ).status,
  ).toBe('chain-unavailable')
  expect(
    (
      await setup({
        balance: async () => {
          throw new Error('offline')
        },
      }).service.request(disk, 'ip')
    ).status,
  ).toBe('chain-unavailable')
  expect(
    (
      await setup({
        supply: async () => {
          throw new Error('offline')
        },
      }).service.request(disk, 'ip')
    ).status,
  ).toBe('chain-unavailable')
})

test('an underfunded treasury refuses before sending anything', async () => {
  for (const supply of [
    { mon: 99n, ausd: 500n },
    { mon: 500n, ausd: 199n },
  ]) {
    const { service, calls } = setup({ supply: async () => supply })
    expect((await service.request(disk, 'ip')).status).toBe('supply-low')
    expect(calls).toEqual([])
  }
})

test('a failed AUSD leg after a confirmed MON leg is partial, keeps the MON hash, and blocks a second MON grant', async () => {
  const { db, service } = setup({
    sendAusd: async () => {
      throw new Error('reverted')
    },
  })
  expect(await service.request(disk, 'ip')).toEqual({
    status: 'partial',
    monTx: tx('1'),
    ausdTx: undefined,
  })
  expect(db.query('SELECT status, mon_tx, ausd_tx FROM drips').get()).toEqual({
    status: 'partial',
    mon_tx: tx('1'),
    ausd_tx: null,
  })
  expect((await service.request(disk, 'ip')).status).toBe('already-funded')
})

test('simultaneous requests for one address send once', async () => {
  let sends = 0
  const { service } = setup({
    sendMon: async () => {
      sends++
      await Bun.sleep(5)
      return tx('1')
    },
  })
  const results = await Promise.all([
    service.request(disk, 'a'),
    service.request(disk, 'b'),
    service.request(disk, 'c'),
  ])
  expect(results.map((r) => r.status).sort()).toEqual([
    'already-funded',
    'already-funded',
    'sent',
  ])
  expect(sends).toBe(1)
})

test('the peer address is only replaced by X-Forwarded-For when the peer is the local proxy', () => {
  expect(clientIp('127.0.0.1', '203.0.113.9', undefined)).toBe('203.0.113.9')
  expect(clientIp('::1', '198.51.100.1, 203.0.113.9', undefined)).toBe(
    '203.0.113.9',
  )
  expect(clientIp('127.0.0.1', undefined, undefined)).toBe('127.0.0.1')
  expect(clientIp('198.51.100.5', '203.0.113.9', undefined)).toBe(
    '198.51.100.5',
  )
  expect(clientIp(undefined, '203.0.113.9', undefined)).toBe('unknown')
})

function http(
  service: DripService | undefined,
  peer = '127.0.0.1',
  trustedProxyIp?: string,
) {
  const seen: string[] = []
  const wrapped: DripService | undefined = service && {
    request: (input, ip) => {
      seen.push(ip)
      return service.request(input, ip)
    },
  }
  const app = createApp({
    origin: 'http://x',
    version: '1',
    sections: {},
    jobs: () => ({}),
    routes: [dripRoute(wrapped, trustedProxyIp)],
  })
  const post = (body: string, headers: Record<string, string> = {}) =>
    app.request(
      '/v1/drip',
      {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json', ...headers },
      },
      { requestIP: () => ({ address: peer, family: 'IPv4', port: 1 }) },
    )
  return { post, seen }
}

test('POST /v1/drip maps each outcome to a typed status code and body', async () => {
  const ok = http(setup().service)
  const sent = await ok.post(JSON.stringify({ address: disk }), {
    'X-Forwarded-For': '203.0.113.9',
  })
  expect(sent.status).toBe(200)
  expect(await sent.json()).toEqual({
    status: 'sent',
    monTx: tx('1'),
    ausdTx: tx('2'),
  })
  expect(ok.seen).toEqual(['203.0.113.9'])
  const again = await ok.post(JSON.stringify({ address: disk }))
  expect([again.status, await again.json()]).toEqual([
    409,
    { status: 'already-funded' },
  ])
  expect(
    (
      await http(setup({ nonce: async () => 3 }).service).post(
        JSON.stringify({ address: disk }),
      )
    ).status,
  ).toBe(409)
  expect(
    (
      await http(
        setup({ supply: async () => ({ mon: 0n, ausd: 0n }) }).service,
      ).post(JSON.stringify({ address: disk }))
    ).status,
  ).toBe(503)
  expect(
    (
      await http(
        setup({
          sendAusd: async () => {
            throw new Error('x')
          },
        }).service,
      ).post(JSON.stringify({ address: disk }))
    ).status,
  ).toBe(502)
  const limited = http(setup({}, { ...config, dailyCap: 0 }).service)
  expect((await limited.post(JSON.stringify({ address: disk }))).status).toBe(
    429,
  )
  expect(
    (await http(undefined).post(JSON.stringify({ address: disk }))).status,
  ).toBe(503)
})

test('POST /v1/drip rejects malformed bodies without reaching the service', async () => {
  const { post, seen } = http(setup().service)
  expect((await post('not json')).status).toBe(400)
  expect((await post(JSON.stringify({ addr: disk }))).status).toBe(400)
  expect((await post(JSON.stringify({ address: disk, extra: 1 }))).status).toBe(
    400,
  )
  expect((await post(JSON.stringify({ address: 5 }))).status).toBe(400)
  expect(
    (await post(JSON.stringify({ address: 'x'.repeat(2000) }))).status,
  ).toBe(413)
  expect((await post(JSON.stringify({ address: 'nope' }))).status).toBe(400)
  expect(seen).toEqual(['127.0.0.1'])
})

test('a configured Docker proxy keeps client quotas separate and still limits repeated requests', async () => {
  const env = parseEnv({ TRUSTED_PROXY_IP: '172.18.0.4' })
  const proxied = http(
    setup({}, { ...config, perIpDaily: 1 }).service,
    '172.18.0.4',
    env.TRUSTED_PROXY_IP,
  )
  const first = await proxied.post(JSON.stringify({ address: disk }), {
    'X-Forwarded-For': '203.0.113.9',
  })
  const second = await proxied.post(JSON.stringify({ address: address('2') }), {
    'X-Forwarded-For': '203.0.113.10',
  })
  const repeated = await proxied.post(
    JSON.stringify({ address: address('3') }),
    {
      'X-Forwarded-For': '203.0.113.9',
    },
  )
  expect([first.status, second.status, repeated.status]).toEqual([
    200, 200, 429,
  ])
})

test('another Docker peer cannot bypass a quota by spoofing forwarded clients', async () => {
  const env = parseEnv({ TRUSTED_PROXY_IP: '172.18.0.4' })
  const direct = http(
    setup({}, { ...config, perIpDaily: 1 }).service,
    '172.18.0.5',
    env.TRUSTED_PROXY_IP,
  )
  const first = await direct.post(JSON.stringify({ address: disk }), {
    'X-Forwarded-For': '203.0.113.9',
  })
  const second = await direct.post(JSON.stringify({ address: address('2') }), {
    'X-Forwarded-For': '203.0.113.10',
  })
  expect([first.status, second.status]).toEqual([200, 429])
})
