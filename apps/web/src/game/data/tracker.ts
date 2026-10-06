import {
  evaluateGates,
  gatesFor,
  mainnetProfile,
  testnetMarkets,
} from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'
import type { ScoredMarket, TrackerReadout } from '../../lib/worker/schemas'
import type { Difficulty, GateSet } from '../../types/domain'
import { TRACKER_STALE_MS } from './provenance'
import type { TrackerPool, TrackerProvenance } from './types'

/** The mainnet market the worker's price mirror follows; the testnet MON market copies it. */
const MIRROR_SOURCE_SYMBOL = 'MON_USDC'

/**
 * Whether a verified testnet market mirrors this mainnet one.
 *
 * The same rule the worker applies when it sets `playable`: the same pair, or
 * the MON mirror of the MON_USDC price source. It reads the SDK's deployed
 * testnet manifest, so a market that is not in that manifest is not
 * PLAYABLE (TESTNET) however clean the worker finds its mainnet book.
 */
export function hasVerifiedMirror(
  symbol: string,
  mirrors: readonly Market[] = testnetMarkets,
): boolean {
  return mirrors.some(
    (mirror) =>
      mirror.symbol === symbol ||
      (symbol === MIRROR_SOURCE_SYMBOL && mirror.baseSymbol === 'MON'),
  )
}

export interface TrackerSnapshot {
  pools: Array<TrackerPool>
  gates: GateSet
  provenance: TrackerProvenance
}

export interface SnapshotOptions {
  difficulty: Difficulty
  godMode: boolean
  /** Age of the worker's snapshot right now, in milliseconds. */
  ageMs: number | null
  /** Extra sentences from the caller (a failed refresh, no connection). */
  notes?: ReadonlyArray<string>
  mirrors?: readonly Market[]
}

function entryFor(
  market: ScoredMarket,
  gates: GateSet,
  godMode: boolean,
  referenceSeconds: number,
  mirrors: readonly Market[],
): TrackerPool {
  const { inputs: pool, score } = market
  const result = evaluateGates(pool, score, gates, referenceSeconds)
  const live = market.status === 'live'
  return {
    network:
      live && market.playable && hasVerifiedMirror(market.market, mirrors)
        ? 'testnet'
        : 'mainnet',
    pool,
    score,
    gates: result,
    // The honeypot check is the one gate GOD MODE keeps, exactly as for fixtures.
    passes: godMode ? score.honeypotClean : result.passed,
    book: { state: market.bookState },
    stale: live ? undefined : true,
  }
}

function describeUnreadable(readout: TrackerReadout): Array<string> {
  if (readout.unreadable.length === 0) return []
  const names = readout.unreadable
    .map(({ market, reason }) =>
      `${market ?? 'an unnamed market'}${reason === 'invalid' ? ' (unreadable answer)' : ''}`,
    )
    .join(', ')
  return [`Not scored, so not on the map: ${names}.`]
}

/**
 * The worker's tracker answer, judged by the shared SDK gates for the chosen
 * difficulty. SAFETY and HEAT arrive already computed by the worker with the
 * same SDK model; this only decides which pools the tier lets through.
 */
export function toTrackerSnapshot(
  readout: TrackerReadout,
  { difficulty, godMode, ageMs, notes = [], mirrors = testnetMarkets }: SnapshotOptions,
): TrackerSnapshot {
  const gates = gatesFor(difficulty, mainnetProfile)
  const takenAt =
    readout.takenAt ?? Math.max(0, ...readout.markets.map((market) => market.takenAt))
  const referenceSeconds = Math.floor(takenAt / 1000)

  const olderReads = readout.markets
    .filter((market) => market.status === 'stale')
    .map((market) => market.market)
  const coverageNote = !readout.coverage
    ? ['Trade coverage was not reported, so volume and volatility are unread.']
    : readout.coverage.complete
      ? []
      : [
          `24h trade history is incomplete (${readout.coverage.source}). Volume, volatility and concentration are unread, not zero.`,
        ]

  return {
    gates,
    pools: readout.markets.map((market) =>
      entryFor(market, gates, godMode, referenceSeconds, mirrors),
    ),
    provenance: {
      kind: 'worker',
      source: readout.source,
      takenAtMs: readout.takenAt,
      ageMs,
      referenceSeconds,
      stale: ageMs !== null && ageMs > TRACKER_STALE_MS,
      partial: readout.status === 'partial',
      notes: [
        ...coverageNote,
        ...(olderReads.length
          ? [`Showing an older read for: ${olderReads.join(', ')}.`]
          : []),
        ...describeUnreadable(readout),
        ...notes,
      ],
    },
  }
}
