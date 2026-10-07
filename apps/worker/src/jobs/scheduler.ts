import { describeError, log } from '../logger'
import type { Logger } from '../logger'

export type JobStatus = {
  runs: number
  failures: number
  running: boolean
  lastStartedAt: number | null
  lastFinishedAt: number | null
  lastError: string | null
}
export type JobSpec = {
  name: string
  intervalMs: number
  timeoutMs: number
  run: () => Promise<void>
}

// Sequential per-job loop: the next run is scheduled after the previous one
// settles, so a slow RPC can never stack overlapping runs of the same job.
// A run that exceeds timeoutMs is reported as failed immediately; the job
// stays `running` until the underlying promise settles.
export function createScheduler({
  now = Date.now,
  logger = log,
}: { now?: () => number; logger?: Logger } = {}) {
  const status: Record<string, JobStatus> = {}
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false

  async function runOnce(job: JobSpec): Promise<void> {
    if (stopped) return
    const entry = (status[job.name] ??= {
      runs: 0,
      failures: 0,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastError: null,
    })
    if (entry.running) return
    entry.running = true
    entry.runs++
    entry.lastStartedAt = now()
    const work = job.run()
    const settled = work.then(
      () => null,
      (error: unknown) => describeError(error),
    )
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<string>((resolve) => {
      timer = setTimeout(
        () => resolve(`TimeoutError: ${job.name} exceeded ${job.timeoutMs} ms`),
        job.timeoutMs,
      )
    })
    const error = await Promise.race([settled, timeout])
    clearTimeout(timer)
    entry.lastFinishedAt = now()
    entry.lastError = error
    if (error !== null) {
      entry.failures++
      logger('job.failed', { job: job.name, error })
    }
    // After a timeout keep the busy flag until the stuck run really ends.
    if (error?.startsWith('TimeoutError'))
      void settled.then(() => {
        entry.running = false
      })
    else entry.running = false
  }

  return {
    status,
    runOnce,
    start(jobs: readonly JobSpec[]) {
      for (const job of jobs) {
        const loop = async () => {
          await runOnce(job)
          if (stopped) return
          const timer = setTimeout(() => {
            timers.delete(timer)
            void loop()
          }, job.intervalMs)
          timers.add(timer)
        }
        void loop()
      }
    },
    stop() {
      stopped = true
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    },
  }
}
