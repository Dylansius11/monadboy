import { verifyMessage } from 'viem'
import type { Address, Hex } from 'viem'
import { z } from 'zod'
import type { RouteModule } from '../app'
import { mirrorDemandMessage } from '@monadboy/sdk'
import { bodyLimit } from 'hono/body-limit'

const LEASE_MS = 45000
const MAX_ACTIVE = 256
const input = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  at: z.number().int().nonnegative(),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict()

export type Demand = ReturnType<typeof createDemand>
export function createDemand({ market, savedDisk, now = Date.now }: {
  market: string
  savedDisk: (owner: Address) => Promise<boolean>
  now?: () => number
}) {
  const leases = new Map<string, number>()
  const active = () => {
    const at = now()
    for (const [owner, expiry] of leases) if (expiry <= at) leases.delete(owner)
    return leases.size
  }
  return {
    active,
    async admit(body: unknown) {
      const value = input.parse(body)
      const at = now()
      if (value.at > at + 5000 || value.at + LEASE_MS <= at)
        throw new Error('Demand signature expired or future dated')
      const owner = value.owner.toLowerCase()
      active()
      if (!leases.has(owner) && leases.size >= MAX_ACTIVE)
        throw new Error('Active demo capacity reached')
      if (!await verifyMessage({
        address: value.owner as Address,
        message: mirrorDemandMessage(market, owner, value.at),
        signature: value.signature as Hex,
      })) throw new Error('Invalid demand signature')
      if (!await savedDisk(value.owner as Address)) throw new Error('A saved disk is required')
      // Verification can await past the deadline. Never revive an expired lease.
      const expiresAt = value.at + LEASE_MS
      if (expiresAt <= now()) throw new Error('Demand signature expired')
      active()
      if (!leases.has(owner) && leases.size >= MAX_ACTIVE)
        throw new Error('Active demo capacity reached')
      leases.set(owner, Math.max(leases.get(owner) ?? 0, expiresAt))
      return { expiresAt, active: active() }
    },
  }
}

export function demandRoute(demand: Demand, origin: string): RouteModule {
  return (app) => {
    app.use('/v1/mirror/demand', bodyLimit({
      maxSize: 1024,
      onError: (c) => c.json({ error: 'request-too-large' }, 413),
    }))
    app.post('/v1/mirror/demand', async (c) => {
      if (c.req.header('origin') !== origin) return c.json({ error: 'origin-refused' }, 403)
      if (Number(c.req.header('content-length') ?? 0) > 1024)
        return c.json({ error: 'request-too-large' }, 413)
      try {
        const body = await c.req.text()
        if (body.length > 1024) return c.json({ error: 'request-too-large' }, 413)
        return c.json(await demand.admit(JSON.parse(body)))
      } catch {
        return c.json({ error: 'demand-refused' }, 403)
      }
    })
  }
}
