import { expect, test } from 'bun:test'
import { createApp } from '../src/app'
import type { HealthSection } from '../src/app'

const idle = {
  runs: 1,
  failures: 0,
  running: false,
  lastStartedAt: 1,
  lastFinishedAt: 2,
  lastError: null,
}
const build = (sections: Record<string, HealthSection>, jobs = {}) =>
  createApp({
    origin: 'http://localhost:3000',
    version: '9.9.9',
    sections: Object.fromEntries(
      Object.entries(sections).map(([name, section]) => [name, () => section]),
    ),
    jobs: () => jobs,
    routes: [],
    now: () => 5000,
  })

test('health reports version, section values and a green status when nothing is wrong', async () => {
  const body = await (
    await build({ source: { value: { mid: 0.033 } } }, { mid: idle }).request(
      '/v1/health',
    )
  ).json()
  expect(body).toMatchObject({
    status: 'green',
    reasons: [],
    version: '9.9.9',
    at: 5000,
    source: { mid: 0.033 },
    jobs: { mid: { runs: 1 } },
  })
})

test('a red reason wins over amber, and a failing job alone makes it amber', async () => {
  const both = await (
    await build({
      a: { value: 1, red: 'price-feed-paused' },
      b: { value: 2, amber: 'supply-low' },
    }).request('/v1/health')
  ).json()
  expect(both).toMatchObject({
    status: 'red',
    reasons: ['price-feed-paused', 'supply-low'],
  })
  const job = await (
    await build(
      {},
      { tracker: { ...idle, lastError: 'TimeoutError: x' } },
    ).request('/v1/health')
  ).json()
  expect(job).toMatchObject({
    status: 'amber',
    reasons: ['jobs-failing:tracker'],
  })
})

test('CORS allows the configured application origin only', async () => {
  const app = build({})
  const allowed = await app.request('/v1/health', {
    headers: { Origin: 'http://localhost:3000' },
  })
  const denied = await app.request('/v1/health', {
    headers: { Origin: 'https://other.example' },
  })
  expect(allowed.headers.get('access-control-allow-origin')).toBe(
    'http://localhost:3000',
  )
  expect(denied.headers.get('access-control-allow-origin')).toBeNull()
})
