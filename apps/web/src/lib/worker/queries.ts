/**
 * react-query reads of the worker, and the one view type every screen shares.
 *
 * `ReadView` has no state that is both "no data" and "nothing to say": a read
 * is not configured, loading, offline, failed, or ready with data and its
 * receipt time. Data from an earlier successful read stays on screen when a
 * refresh fails, flagged, and is never replaced by anything invented.
 */

import { queryOptions, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { WorkerReadError, fetchWorkerJson, isRetryable, workerBaseUrl } from './client'
import { parseLeaderboard, parseTracker } from './schemas'
import type { LeaderboardReadout, LeaderboardWindow, TrackerReadout } from './schemas'

export type ReadView<T> =
  | { kind: 'unconfigured' }
  | { kind: 'loading' }
  /** No data yet and the browser reports no connection. */
  | { kind: 'offline' }
  | { kind: 'failed'; error: WorkerReadError; retry: () => void }
  | {
      kind: 'ready'
      data: T
      /** Client clock at the moment this data arrived, for ageing it. */
      receivedAt: number
      /** Set when the latest refresh failed: `data` is the last good read. */
      refreshError: WorkerReadError | null
      /** The browser reports no connection: `data` cannot be refreshed. */
      offline: boolean
      retry: () => void
    }

export type NotReady = Exclude<ReadView<never>, { kind: 'ready' }>

const TRACKER_REFRESH_MS = 60_000
const LEADERBOARD_REFRESH_MS = 30_000

function retryPolicy(count: number, error: Error): boolean {
  return count < 2 && isRetryable(error)
}

const backoff = (attempt: number) => Math.min(1_000 * 2 ** attempt, 8_000)

/** A null base URL builds a disabled query; its function states why if it ever ran. */
function requireBase(baseUrl: string | null): string {
  if (baseUrl === null) {
    throw new WorkerReadError('unconfigured', 'No worker address is configured.')
  }
  return baseUrl
}

export function trackerQuery(baseUrl: string | null) {
  return queryOptions({
    queryKey: ['worker', baseUrl ?? 'unconfigured', 'tracker'] as const,
    queryFn: async ({ signal }) =>
      parseTracker(
        await fetchWorkerJson('/v1/tracker', { baseUrl: requireBase(baseUrl), signal }),
      ),
    enabled: baseUrl !== null,
    staleTime: 20_000,
    refetchInterval: TRACKER_REFRESH_MS,
    retry: retryPolicy,
    retryDelay: backoff,
  })
}

export function leaderboardQuery(baseUrl: string | null, window: LeaderboardWindow) {
  return queryOptions({
    queryKey: ['worker', baseUrl ?? 'unconfigured', 'leaderboard', window] as const,
    queryFn: async ({ signal }) =>
      parseLeaderboard(
        await fetchWorkerJson(`/v1/leaderboard?window=${window}`, {
          baseUrl: requireBase(baseUrl),
          signal,
        }),
        window,
      ),
    enabled: baseUrl !== null,
    staleTime: 10_000,
    refetchInterval: LEADERBOARD_REFRESH_MS,
    retry: retryPolicy,
    retryDelay: backoff,
  })
}

interface QuerySnapshot<T> {
  data: T | undefined
  error: Error | null
  dataUpdatedAt: number
  refetch: () => unknown
}

/**
 * Folds a query's state into a `ReadView`.
 *
 * `online` is `navigator.onLine` and only ever picks a better word for a
 * failure: a paused or failed read is still a read that did not happen.
 */
export function toReadView<T>(
  configured: boolean,
  query: QuerySnapshot<T>,
  online: boolean,
): ReadView<T> {
  if (!configured) return { kind: 'unconfigured' }
  const retry = () => void query.refetch()
  const failure =
    query.error === null
      ? null
      : query.error instanceof WorkerReadError
        ? query.error
        : new WorkerReadError('network', 'The read failed unexpectedly.')
  if (query.data !== undefined) {
    return {
      kind: 'ready',
      data: query.data,
      receivedAt: query.dataUpdatedAt,
      refreshError: failure,
      offline: !online,
      retry,
    }
  }
  if (failure) return { kind: 'failed', error: failure, retry }
  return online ? { kind: 'loading' } : { kind: 'offline' }
}

/** Re-reads the clock on an interval so ages on screen keep moving. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** `navigator.onLine`, or true where there is no navigator (the server render). */
function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  return online
}

export function useTrackerRead(): ReadView<TrackerReadout> {
  const baseUrl = workerBaseUrl()
  const online = useOnline()
  const query = useQuery(trackerQuery(baseUrl))
  return toReadView(baseUrl !== null, query, online)
}

export function useLeaderboardRead(
  window: LeaderboardWindow,
): ReadView<LeaderboardReadout> {
  const baseUrl = workerBaseUrl()
  const online = useOnline()
  const query = useQuery(leaderboardQuery(baseUrl, window))
  return toReadView(baseUrl !== null, query, online)
}

/**
 * Age of a worker read right now: the worker's own age at answer time plus
 * the time since this device received it. Uses no wall-clock comparison
 * against the worker's timestamps, so a skewed device clock cannot fake
 * freshness.
 */
export function ageNowMs(
  ageMsAtAnswer: number | null,
  receivedAt: number,
  now: number,
): number | null {
  return ageMsAtAnswer === null ? null : ageMsAtAnswer + Math.max(0, now - receivedAt)
}
