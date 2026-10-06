/**
 * The one place the web app talks to the worker over HTTP.
 *
 * Everything that comes back is untrusted until a schema accepts it, and every
 * way a read can fail has its own kind so a screen can say which one it was.
 * Nothing in here substitutes data for a failure: a failed read throws.
 */

export type WorkerReadErrorKind =
  | 'unconfigured'
  | 'network'
  | 'timeout'
  | 'http'
  | 'invalid-response'

export class WorkerReadError extends Error {
  readonly kind: WorkerReadErrorKind
  readonly status: number | null

  constructor(
    kind: WorkerReadErrorKind,
    message: string,
    status: number | null = null,
  ) {
    super(message)
    this.name = 'WorkerReadError'
    this.kind = kind
    this.status = status
  }
}

/** Reads that can plausibly succeed on the next try. A bad schema or a 4xx will not. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof WorkerReadError)) return false
  if (error.kind === 'network' || error.kind === 'timeout') return true
  return error.kind === 'http' && (error.status ?? 0) >= 500
}

/**
 * The worker's base URL, or null when this build has none.
 *
 * A missing or malformed address is a configuration fact the screens report,
 * never a reason to guess `localhost`.
 */
export function resolveWorkerUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

/** `VITE_WORKER_URL` is public by design: it is the worker's REST base address. */
export function workerBaseUrl(): string | null {
  return resolveWorkerUrl(import.meta.env.VITE_WORKER_URL)
}

export const READ_TIMEOUT_MS = 10_000
export type WorkerFetch = (input: string, init?: RequestInit) => Promise<Response>

export interface FetchWorkerOptions {
  baseUrl: string
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: WorkerFetch
}

/**
 * GET a worker path and return its parsed JSON, unvalidated.
 *
 * `cache: 'no-store'` is deliberate: chain and account facts are never served
 * from an HTTP cache, and there is no service worker to hold a second copy.
 */
export async function fetchWorkerJson(
  path: string,
  { baseUrl, signal, timeoutMs = READ_TIMEOUT_MS, fetchImpl = fetch }: FetchWorkerOptions,
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  const forward = () => controller.abort()
  signal?.addEventListener('abort', forward, { once: true })

  try {
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
    } catch (error) {
      // A caller-initiated abort is not a failure to report.
      if (signal?.aborted) throw error
      if (controller.signal.aborted) {
        throw new WorkerReadError(
          'timeout',
          `The worker did not answer within ${Math.round(timeoutMs / 1000)} seconds.`,
        )
      }
      throw new WorkerReadError(
        'network',
        'The worker could not be reached. Check the connection.',
      )
    }

    if (!response.ok) {
      throw new WorkerReadError(
        'http',
        `The worker answered ${response.status}${await errorCode(response)}.`,
        response.status,
      )
    }

    try {
      return await response.json()
    } catch (error) {
      if (signal?.aborted) throw error
      if (controller.signal.aborted) {
        throw new WorkerReadError(
          'timeout',
          `The worker did not finish answering within ${Math.round(timeoutMs / 1000)} seconds.`,
        )
      }
      throw new WorkerReadError(
        'invalid-response',
        'The worker answered something that is not JSON.',
      )
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forward)
  }
}

/** The worker's `{ error }` code, when the body has one. Never throws. */
async function errorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string' &&
      /^[a-z0-9-]{1,40}$/.test(body.error)
    ) {
      return ` (${body.error})`
    }
  } catch {
    // No readable body: the status alone is the message.
  }
  return ''
}
