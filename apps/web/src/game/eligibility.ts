import { findPool } from './fixtures'
import type { ScoredPool } from './fixtures'
import type { Difficulty } from '../types/domain'

/** Only markets with a testnet mirror can hold a position; the rest are read-only. */
export const isTestnet = ({ network }: ScoredPool): boolean => network === 'testnet'

/** A missing bid or ask means there is nothing to fill against. */
export const isBookThin = (entry: ScoredPool): boolean =>
  entry.book.bid === null || entry.book.ask === null

/**
 * The single rule for starting a run: the tracker's A key and every play route
 * ask this, so a pool cannot be played by URL that the tracker would refuse.
 */
export const isExecutable = (entry: ScoredPool): boolean =>
  entry.passes && isTestnet(entry) && !isBookThin(entry)

/** The pool behind a play URL, or undefined so the screen shows its missing state. */
export function executablePool(
  pairAddress: string | null,
  difficulty: Difficulty,
  godMode: boolean,
): ScoredPool | undefined {
  const entry = findPool(pairAddress, difficulty, godMode)
  return entry && isExecutable(entry) ? entry : undefined
}
