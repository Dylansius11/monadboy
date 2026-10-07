// Read-only S5 observer. Start before a real fill; no signing or synthetic events.
import { writeFileSync } from 'node:fs'

const endpoint =
  process.env.ENVIO_GRAPHQL_URL ?? 'http://localhost:18880/v1/graphql'
const output =
  process.env.INDEXER_OBSERVATION_PATH ??
  '../handoff/monadboy/indexer-live-observations.json'
const duration = Number(process.env.INDEXER_OBSERVATION_MS ?? 180000)
if (!Number.isFinite(duration) || duration <= 0)
  throw new Error('Positive observation duration required')
const query =
  '{ _meta { chainId startBlock progressBlock sourceBlock isReady readyAt } Fill(limit: 30, order_by: [{block: desc}, {id: desc}]) { id block tx at maker taker originKnown realizedSpread } }'
type Row = {
  id: string
  block: string
  tx: string
  at: string
  maker: string
  taker: string
  originKnown: boolean
  realizedSpread: string | null
}
const seen = new Set<string>()
const observed: {
  firstSeenAt: string
  elapsedFromBlockTimestampMs: number
  fill: Row
  meta: unknown
}[] = []
const started = Date.now()
let baseline = true
let failures = 0
while (Date.now() - started < duration) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(5000),
  })
  const body = (await response.json()) as {
    data?: { Fill: Row[]; _meta: unknown }
    errors?: unknown
  }
  if (!response.ok || body.errors || !body.data) {
    failures++
    console.error(`GraphQL observation failed: HTTP ${response.status}`)
  } else {
    const now = Date.now()
    for (const fill of body.data.Fill) {
      if (seen.has(fill.id)) continue
      seen.add(fill.id)
      if (baseline) continue
      const sample = {
        firstSeenAt: new Date(now).toISOString(),
        elapsedFromBlockTimestampMs: now - Number(fill.at) * 1000,
        fill,
        meta: body.data._meta,
      }
      observed.push(sample)
      console.log(JSON.stringify(sample))
    }
    baseline = false
  }
  const delay = Promise.withResolvers<void>()
  setTimeout(delay.resolve, 300)
  await delay.promise
}
writeFileSync(
  output,
  JSON.stringify(
    {
      startedAt: new Date(started).toISOString(),
      endedAt: new Date().toISOString(),
      endpoint,
      failures,
      observed,
      timingBasis:
        'First public GraphQL appearance minus chain block timestamp rounded to seconds; compare receipt-observed UTC separately. No preexisting row counts as a fresh observation.',
    },
    null,
    2,
  ) + '\n',
)
console.log(JSON.stringify({ observations: observed.length, failures, output }))
