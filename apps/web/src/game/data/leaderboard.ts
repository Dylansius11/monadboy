import { monadTestnet } from '@monadboy/sdk'
import type { LeaderboardRow } from '../../lib/worker/schemas'

/** The worker recomputes every 60 seconds; five minutes without a recompute is stale. */
export const LEADERBOARD_STALE_MS = 5 * 60_000

/** The Monad testnet explorer's page for a transaction. Every leaderboard row is TESTNET. */
export function explorerTxUrl(hash: string): string {
  return `${monadTestnet.blockExplorers.default.url}/tx/${hash}`
}

/** `0x1234…abcd`. Display only: the full address stays in the title and the link. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * A disk's tag, as the worker read it from the registry, made safe to draw.
 *
 * Null when there is nothing printable. A tag is chain data, so it is shown
 * as it is or not at all: it is never made up and never stands in for a score.
 */
export function cleanTag(tag: string | null): string | null {
  if (tag === null) return null
  const printable = tag.replace(/[^\x20-\x7e]/g, '').trim().slice(0, 20)
  return printable.length > 0 ? printable : null
}

/**
 * Quote units, with enough places that a small fee total is not shown as
 * zero. Signed explicitly so the sign survives a grayscale screenshot.
 */
export function quoteAmount(amount: number, sign: 'plus-minus' | 'minus' | 'none'): string {
  const magnitude = Math.abs(amount).toFixed(Math.abs(amount) >= 1 ? 2 : 4)
  if (sign === 'none') return magnitude
  if (sign === 'minus') return amount === 0 ? magnitude : `-${magnitude}`
  return amount < 0 ? `-${magnitude}` : amount > 0 ? `+${magnitude}` : magnitude
}

/** Which total a row can honestly show as SCORE. */
export function rowScore(row: LeaderboardRow): { value: number; final: boolean } {
  return row.score === null
    ? { value: row.observedScore, final: false }
    : { value: row.score, final: true }
}
