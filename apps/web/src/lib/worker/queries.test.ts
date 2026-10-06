import { describe, expect, it, vi } from 'vitest'
import { WorkerReadError } from './client'
import { ageNowMs, toReadView } from './queries'

const snapshot = (overrides: Partial<Parameters<typeof toReadView<string>>[1]> = {}) => ({
  data: undefined,
  error: null,
  dataUpdatedAt: 0,
  refetch: vi.fn(),
  ...overrides,
})

describe('the state of a worker read', () => {
  it('is unconfigured before it is anything else', () => {
    expect(toReadView(false, snapshot({ data: 'x', dataUpdatedAt: 5 }), true)).toEqual({
      kind: 'unconfigured',
    })
  })

  it('keeps the last good data on screen, flagged, when a refresh fails', () => {
    const error = new WorkerReadError('network', 'down')
    const view = toReadView(true, snapshot({ data: 'last good', error, dataUpdatedAt: 42 }), true)
    expect(view).toMatchObject({ kind: 'ready', data: 'last good', receivedAt: 42, refreshError: error })
  })

  it('does not call a missing read loading when the device is offline', () => {
    expect(toReadView(true, snapshot(), false)).toEqual({ kind: 'offline' })
    expect(toReadView(true, snapshot(), true)).toEqual({ kind: 'loading' })
  })

  it('is a failure, with a retry, when there is an error and nothing to show', () => {
    const error = new WorkerReadError('http', 'refused', 500)
    const refetch = vi.fn()
    const view = toReadView(true, snapshot({ error, refetch }), true)
    expect(view.kind).toBe('failed')
    if (view.kind === 'failed') view.retry()
    expect(refetch).toHaveBeenCalledOnce()
  })
})

describe('the age of a read', () => {
  it('adds the time since arrival to the worker age, and ignores a clock set behind it', () => {
    expect(ageNowMs(4_000, 1_000, 6_000)).toBe(9_000)
    expect(ageNowMs(4_000, 10_000, 6_000)).toBe(4_000)
    expect(ageNowMs(null, 1_000, 6_000)).toBeNull()
  })
})
