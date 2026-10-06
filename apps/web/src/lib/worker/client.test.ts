import { describe, expect, it, vi } from 'vitest'
import { WorkerReadError, fetchWorkerJson, isRetryable, resolveWorkerUrl } from './client'
import type { WorkerFetch } from './client'

const BASE = 'https://worker.example'

describe('the worker address', () => {
  it('is absent, not guessed, when unset or malformed', () => {
    expect(resolveWorkerUrl(undefined)).toBeNull()
    expect(resolveWorkerUrl('  ')).toBeNull()
    expect(resolveWorkerUrl('worker.example')).toBeNull()
    expect(resolveWorkerUrl('ftp://worker.example')).toBeNull()
  })

  it('drops trailing slashes so paths join exactly once', () => {
    expect(resolveWorkerUrl('https://worker.example//')).toBe('https://worker.example')
    expect(resolveWorkerUrl('http://127.0.0.1:8787/api/')).toBe('http://127.0.0.1:8787/api')
  })
})

async function failure(fetchImpl: WorkerFetch, timeoutMs?: number): Promise<WorkerReadError> {
  const error = await fetchWorkerJson('/v1/tracker', { baseUrl: BASE, fetchImpl, timeoutMs }).catch(
    (e: unknown) => e,
  )
  if (!(error instanceof WorkerReadError)) throw new Error('expected a WorkerReadError')
  return error
}

describe('a failed worker read says which way it failed', () => {
  it('network failure', async () => {
    const error = await failure(vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    expect(error.kind).toBe('network')
    expect(isRetryable(error)).toBe(true)
  })

  it('a hung worker times out', async () => {
    const hang: WorkerFetch = (_url, init) => {
      const { promise, reject } = Promise.withResolvers<Response>()
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      return promise
    }
    const error = await failure(hang, 20)
    expect(error.kind).toBe('timeout')
  })

  it('an error status keeps its code, and only a server fault is retried', async () => {
    const bad = await failure(
      vi.fn().mockResolvedValue(Response.json({ error: 'invalid-window' }, { status: 400 })),
    )
    expect(bad.kind).toBe('http')
    expect(bad.message).toContain('400 (invalid-window)')
    expect(isRetryable(bad)).toBe(false)

    const down = await failure(vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    expect(isRetryable(down)).toBe(true)
  })

  it('a 200 that is not JSON is an invalid answer, not an empty one', async () => {
    const error = await failure(vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })))
    expect(error.kind).toBe('invalid-response')
    expect(isRetryable(error)).toBe(false)
  })
})

