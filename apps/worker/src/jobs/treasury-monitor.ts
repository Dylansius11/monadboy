import { formatEther, formatUnits } from 'viem'
import type { Address } from 'viem'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'
import type { HealthSection } from '../app'

export type TreasuryRole = 'bot' | 'drip'
export type TreasuryBalance = {
  role: TreasuryRole
  address: Address
  mon: bigint | null
  ausd: bigint | null
  at: number | null
  error: string | null
}

// Polls the operations wallets so health can raise "testnet supply low" (SPEC 5.2 inventory alarms).
export function createTreasuryMonitor({
  wallets,
  read,
  now = Date.now,
  logger = log,
}: {
  wallets: readonly { role: TreasuryRole; address: Address }[]
  read: (address: Address) => Promise<{ mon: bigint; ausd: bigint }>
  now?: () => number
  logger?: Logger
}) {
  const state: TreasuryBalance[] = wallets.map((wallet) => ({
    ...wallet,
    mon: null,
    ausd: null,
    at: null,
    error: null,
  }))
  async function tick() {
    for (const entry of state) {
      try {
        const balances = await read(entry.address)
        Object.assign(entry, { ...balances, at: now(), error: null })
      } catch (error) {
        entry.error = describeError(error)
        logger('treasury.read-failed', { role: entry.role })
      }
    }
  }
  return { state, tick }
}

export function treasurySection(
  monitor: { state: readonly TreasuryBalance[] } | null,
  minimum: { mon: bigint; ausd: bigint },
  now: () => number,
): () => HealthSection {
  return () => {
    if (!monitor || monitor.state.length === 0)
      return { value: { status: 'not-configured', wallets: [] } }
    const low = monitor.state
      .filter(
        (entry) =>
          entry.mon !== null &&
          entry.ausd !== null &&
          (entry.mon < minimum.mon || entry.ausd < minimum.ausd),
      )
      .map((entry) => entry.role)
    const unread = monitor.state
      .filter((entry) => entry.at === null)
      .map((entry) => entry.role)
    return {
      value: {
        status: low.length ? 'low' : unread.length ? 'unread' : 'ok',
        wallets: monitor.state.map((entry) => ({
          role: entry.role,
          address: entry.address,
          mon: entry.mon === null ? null : formatEther(entry.mon),
          ausd: entry.ausd === null ? null : formatUnits(entry.ausd, 6),
          ageMs: entry.at === null ? null : now() - entry.at,
          error: entry.error,
        })),
      },
      amber: low.length ? `testnet-supply-low:${low.join(',')}` : undefined,
    }
  }
}
