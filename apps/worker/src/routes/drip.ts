import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { getConnInfo } from 'hono/bun'
import type { Database } from 'bun:sqlite'
import type { Address, Hex } from 'viem'
import type { RouteModule } from '../app'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'

export type DripStatus =
  | 'sent'
  | 'invalid-address'
  | 'supply-unavailable'
  | 'supply-low'
  | 'not-fresh'
  | 'balance-above-threshold'
  | 'chain-unavailable'
  | 'already-funded'
  | 'ip-limit'
  | 'daily-limit'
  | 'partial'
  | 'send-failed'
export type DripResult = { status: DripStatus; monTx?: Hex; ausdTx?: Hex }
// Sends are spaced, nonce-managed and confirmed inside the treasury; the hash returned is mined.
export type DripChain = {
  nonce: (address: Address) => Promise<number>
  balance: (address: Address) => Promise<bigint>
  supply: () => Promise<{ mon: bigint; ausd: bigint }>
  sendMon: (to: Address, amount: bigint) => Promise<Hex>
  sendAusd: (to: Address, amount: bigint) => Promise<Hex>
}
export type DripConfig = {
  monWei: bigint
  ausdUnits: bigint
  thresholdWei: bigint
  dailyCap: number
  perIpDaily: number
  salt: string
}
export type DripService = {
  request: (address: unknown, ip: string) => Promise<DripResult>
}

const DAY_MS = 86_400_000
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
// pending rows count: a crash between broadcast and confirmation must not free the slot.
const COUNTED = "status IN ('pending', 'sent', 'partial')"

export function createDripService({
  db,
  config,
  chain,
  now = Date.now,
  logger = log,
}: {
  db: Database
  config: DripConfig
  chain?: DripChain
  now?: () => number
  logger?: Logger
}): DripService {
  const hashIp = (ip: string) =>
    createHmac('sha256', config.salt).update(ip).digest('hex')
  const count = (sql: string, ...params: (string | number)[]) =>
    db.query<{ n: number }, (string | number)[]>(sql).get(...params)?.n ?? 0
  let tail: Promise<unknown> = Promise.resolve()

  async function handle(input: unknown, ip: string): Promise<DripResult> {
    const at = now()
    const ipHash = hashIp(ip)
    const parsed = addressSchema.safeParse(input)
    const address = parsed.success
      ? (parsed.data.toLowerCase() as Address)
      : null
    let status: DripStatus | null = null
    if (address === null) status = 'invalid-address'
    else if (!chain) status = 'supply-unavailable'
    else if (
      count(
        `SELECT COUNT(*) AS n FROM drips WHERE address = ? AND (mon_tx IS NOT NULL OR status = 'pending')`,
        address,
      ) > 0
    )
      status = 'already-funded'
    else if (
      count(
        `SELECT COUNT(*) AS n FROM drips WHERE ip_hash = ? AND at >= ? AND ${COUNTED}`,
        ipHash,
        at - DAY_MS,
      ) >= config.perIpDaily
    )
      status = 'ip-limit'
    else if (
      count(
        `SELECT COUNT(*) AS n FROM drips WHERE at >= ? AND ${COUNTED}`,
        at - DAY_MS,
      ) >= config.dailyCap
    )
      status = 'daily-limit'
    if (status === null && address !== null && chain) {
      try {
        if ((await chain.nonce(address)) !== 0) status = 'not-fresh'
        else if ((await chain.balance(address)) >= config.thresholdWei)
          status = 'balance-above-threshold'
        else {
          const supply = await chain.supply()
          if (supply.mon < config.monWei || supply.ausd < config.ausdUnits)
            status = 'supply-low'
        }
      } catch (error) {
        logger('drip.chain-check-failed', { error: describeError(error) })
        status = 'chain-unavailable'
      }
    }
    const row = db
      .query(
        'INSERT INTO drips (at, address, ip_hash, mon_wei, ausd_units, status) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        at,
        address ?? '',
        ipHash,
        config.monWei.toString(),
        config.ausdUnits.toString(),
        status ?? 'pending',
      )
    if (status !== null || address === null || !chain)
      return { status: status ?? 'invalid-address' }

    let monTx: Hex | undefined
    let ausdTx: Hex | undefined
    let result: DripStatus = 'sent'
    try {
      monTx = await chain.sendMon(address, config.monWei)
      db.query('UPDATE drips SET mon_tx = ? WHERE id = ?').run(
        monTx,
        row.lastInsertRowid,
      )
      ausdTx = await chain.sendAusd(address, config.ausdUnits)
      db.query('UPDATE drips SET ausd_tx = ? WHERE id = ?').run(
        ausdTx,
        row.lastInsertRowid,
      )
    } catch (error) {
      logger('drip.send-failed', {
        stage: monTx ? 'ausd' : 'mon',
        error: describeError(error),
      })
      result = monTx ? 'partial' : 'send-failed'
    }
    db.query('UPDATE drips SET status = ? WHERE id = ?').run(
      result,
      row.lastInsertRowid,
    )
    return { status: result, monTx, ausdTx }
  }

  // One request at a time keeps the quota counts and the sender nonce race-free.
  return {
    request: (address, ip) => {
      const result = tail.then(() => handle(address, ip))
      tail = result.catch(() => undefined)
      return result
    },
  }
}

const HTTP_STATUS: Record<DripStatus, 200 | 400 | 409 | 429 | 502 | 503> = {
  sent: 200,
  'invalid-address': 400,
  'already-funded': 409,
  'not-fresh': 409,
  'balance-above-threshold': 409,
  'ip-limit': 429,
  'daily-limit': 429,
  'supply-unavailable': 503,
  'supply-low': 503,
  'chain-unavailable': 503,
  partial: 502,
  'send-failed': 502,
}

// Host Caddy uses loopback; container Caddy must match one configured IPv4 peer.
// Neither other bridge peers nor arbitrary clients may supply their own quota IP.
export function clientIp(
  peer: string | undefined,
  forwarded: string | undefined,
  trustedProxyIp: string | undefined,
): string {
  if (
    peer === '127.0.0.1' ||
    peer === '::1' ||
    (trustedProxyIp !== undefined && peer === trustedProxyIp)
  )
    return forwarded?.split(',').at(-1)?.trim() || peer
  return peer ?? 'unknown'
}

export function dripRoute(
  drip: DripService | undefined,
  trustedProxyIp: string | undefined,
): RouteModule {
  return (app) => {
    app.post('/v1/drip', async (c) => {
      const text = await c.req.text()
      if (text.length > 1024) return c.json({ status: 'invalid-request' }, 413)
      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        return c.json({ status: 'invalid-request' }, 400)
      }
      const parsed = z
        .object({ address: z.string().max(128) })
        .strict()
        .safeParse(body)
      if (!parsed.success) return c.json({ status: 'invalid-request' }, 400)
      if (!drip) return c.json({ status: 'supply-unavailable' }, 503)
      let peer: string | undefined
      try {
        peer = getConnInfo(c).remote.address
      } catch {
        peer = undefined
      }
      const result = await drip.request(
        parsed.data.address,
        clientIp(peer, c.req.header('X-Forwarded-For'), trustedProxyIp),
      )
      return c.json(result, HTTP_STATUS[result.status])
    })
  }
}
