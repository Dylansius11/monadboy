import { findPool } from './fixtures'
import type { ScoredPool } from './fixtures'
import type { TrackerPool } from './data/types'
import type { Difficulty } from '../types/domain'

/** Only markets with a testnet mirror can hold a position; the rest are read-only. */
export const isTestnet = ({ network }: TrackerPool): boolean => network === 'testnet'

/** A missing bid or ask, or a book the worker reports thin, has nothing to fill against. */
export const isBookThin = ({ book }: TrackerPool): boolean =>
  'state' in book ? book.state === 'thin' : book.bid === null || book.ask === null

/**
 * The single rule for starting a run: the tracker's A key and every play route
 * ask this, so a pool cannot be played by URL that the tracker would refuse.
 * A snapshot the worker could not refresh is read only, whatever it passes.
 */
export const isExecutable = (entry: TrackerPool): boolean =>
  entry.passes && isTestnet(entry) && !isBookThin(entry) && !entry.stale

/** The pool behind a play URL, or undefined so the screen shows its missing state. */
export function executablePool(
  pairAddress: string | null,
  difficulty: Difficulty,
  godMode: boolean,
): ScoredPool | undefined {
  const entry = findPool(pairAddress, difficulty, godMode)
  return entry && isExecutable(entry) ? entry : undefined
}
