import type { Address } from 'viem'
import { errorMentions, log } from '../logger'
import type { Logger } from '../logger'
import type { HealthSection } from '../app'

export type FaucetEntry = {
  wallet: Address
  status: 'idle' | 'funded' | 'frequency-limited' | 'unavailable'
  nextAt: number
  failures: number
  lastError: string | null
}

const SETTLE_MS = 60_000
// [U, S1] The real MaxFrequencyExceeded window is unknown: probe hourly, doubling up to a day.
const FREQUENCY_BASE_MS = 3_600_000
const FREQUENCY_MAX_MS = 86_400_000
const ERROR_BASE_MS = 60_000
const ERROR_MAX_MS = 900_000

// Requests AUSD for a wallet only when its balance is under the minimum, and
// never before the wallet's own backoff has elapsed. `request` must simulate
// first, so a cadence refusal never reaches the chain as a transaction.
export function createFaucetTopup({
  wallets,
  minimum,
  balance,
  request,
  now = Date.now,
  logger = log,
}: {
  wallets: readonly Address[]
  minimum: bigint
  balance: (wallet: Address) => Promise<bigint>
  request: (wallet: Address) => Promise<void>
  now?: () => number
  logger?: Logger
}) {
  const state: FaucetEntry[] = wallets.map((wallet) => ({
    wallet,
    status: 'idle',
    nextAt: 0,
    failures: 0,
    lastError: null,
  }))

  async function tick() {
    for (const entry of state) {
      if (now() < entry.nextAt) continue
      try {
        if ((await balance(entry.wallet)) < minimum) await request(entry.wallet)
        Object.assign(entry, {
          status: 'funded',
          failures: 0,
          lastError: null,
          nextAt: now() + SETTLE_MS,
        })
      } catch (error) {
        const limited = errorMentions(error, 'MaxFrequencyExceeded')
        entry.failures++
        entry.status = limited ? 'frequency-limited' : 'unavailable'
        entry.lastError = limited ? 'MaxFrequencyExceeded' : 'request-failed'
        const [base, max] = limited
          ? [FREQUENCY_BASE_MS, FREQUENCY_MAX_MS]
          : [ERROR_BASE_MS, ERROR_MAX_MS]
        entry.nextAt =
          now() + Math.min(max, base * 2 ** Math.min(entry.failures - 1, 10))
      }
      logger('faucet.state', {
        wallet: entry.wallet,
        status: entry.status,
        failures: entry.failures,
        nextAt: entry.nextAt,
      })
    }
  }
  return { state, tick }
}

export function faucetSection(
  topup: { state: readonly FaucetEntry[] } | null,
  now: () => number,
): () => HealthSection {
  return () => ({
    value: topup
      ? topup.state.map((entry) => ({
          wallet: entry.wallet,
          status: entry.status,
          failures: entry.failures,
          retryInMs: Math.max(0, entry.nextAt - now()),
          lastError: entry.lastError,
        }))
      : { status: 'not-configured' },
  })
}
