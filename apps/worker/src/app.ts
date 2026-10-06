import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { JobStatus } from './jobs/scheduler'

export type HealthSection = { value: unknown; red?: string; amber?: string }
export type HealthSections = Record<string, () => HealthSection>
export type RouteModule = (app: Hono) => void
export type AppDependencies = {
  origin: string
  version: string
  sections: HealthSections
  jobs: () => Record<string, JobStatus>
  routes: readonly RouteModule[]
  now?: () => number
}

// Sections are contributed by the features that own the data. A red reason
// (price feed paused) turns the whole report red; amber is degraded service.
export function buildHealth({
  version,
  sections,
  jobs,
  now = Date.now,
}: Pick<AppDependencies, 'version' | 'sections' | 'jobs' | 'now'>) {
  const body: Record<string, unknown> = {}
  const red: string[] = []
  const amber: string[] = []
  for (const [name, read] of Object.entries(sections)) {
    const section = read()
    body[name] = section.value
    if (section.red) red.push(section.red)
    if (section.amber) amber.push(section.amber)
  }
  const failing = Object.entries(jobs())
    .filter(([, job]) => job.lastError !== null)
    .map(([name]) => name)
  if (failing.length) amber.push(`jobs-failing:${failing.join(',')}`)
  return {
    status: red.length ? 'red' : amber.length ? 'amber' : 'green',
    reasons: [...red, ...amber],
    version,
    at: now(),
    ...body,
    jobs: jobs(),
  }
}

export function createApp({
  origin,
  version,
  sections,
  jobs,
  routes,
  now = Date.now,
}: AppDependencies) {
  const app = new Hono()
  app.use(
    '/v1/*',
    cors({
      origin: (requestOrigin) =>
        requestOrigin === origin ? origin : undefined,
    }),
  )
  app.get('/v1/health', (c) =>
    c.json(buildHealth({ version, sections, jobs, now })),
  )
  for (const route of routes) route(app)
  return app
}
