import { duration } from '../../lib/format'
import { FIXTURE_NOW } from '../fixtures'
import type { TrackerProvenance } from './types'

/** The worker refreshes the tracker every 15 minutes; three missed refreshes is stale (the worker's own health rule). */
export const TRACKER_STALE_MS = 45 * 60_000

export const FIXTURE_PROVENANCE: TrackerProvenance = {
  kind: 'fixture',
  source: 'Development market fixtures',
  takenAtMs: FIXTURE_NOW * 1000,
  ageMs: null,
  referenceSeconds: FIXTURE_NOW,
  stale: false,
  partial: false,
  notes: [],
}

/** `2026-10-05 14:30 UTC`. Fixed locale and zone so server and client agree. */
export function utcStamp(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/** The single line a screen prints under its title to say where the facts came from. */
export function provenanceLine(p: TrackerProvenance): string {
  if (p.kind === 'fixture') {
    return `FIXTURE source · fallback · Not live. Snapshot ${utcStamp(FIXTURE_NOW * 1000).slice(0, 10)}.`
  }
  const taken = p.takenAtMs === null ? 'no snapshot time' : `taken ${utcStamp(p.takenAtMs)}`
  const age = p.ageMs === null ? 'age unknown' : `${duration(p.ageMs / 1000)} old`
  const flags = [p.stale ? 'STALE' : null, p.partial ? 'PARTIAL' : null].filter(Boolean)
  return [`${p.source} (mainnet, read only)`, taken, age, ...flags].join(' · ')
}

/** The short badge beside the screen title. */
export function provenanceBadge(p: TrackerProvenance): string {
  if (p.kind === 'fixture') return 'Fixture'
  if (p.stale) return 'Stale'
  if (p.partial) return 'Partial'
  return 'Worker read'
}

/** The map's one-line version: what was read and how old it is. Read only
 * and the snapshot time stay in the full line the inspect panel prints. */
export function provenanceShort(p: TrackerProvenance): string {
  if (p.kind === 'fixture') return 'Sample data · not live'
  const age = p.ageMs === null ? 'age unknown' : `${duration(p.ageMs / 1000)} old`
  const flags = [p.stale ? 'STALE' : null, p.partial ? 'PARTIAL' : null].filter(Boolean)
  return [p.source, age, ...flags].join(' · ')
}
