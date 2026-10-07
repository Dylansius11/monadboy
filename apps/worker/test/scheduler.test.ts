import { expect, test } from 'bun:test'
import { createScheduler } from '../src/jobs/scheduler'

const quiet = { logger: () => {} }

test('a failing run is recorded with a sanitized reason and the next run still happens', async () => {
  const scheduler = createScheduler(quiet)
  let calls = 0
  const job = {
    name: 'j',
    intervalMs: 1,
    timeoutMs: 1000,
    run: async () => {
      if (calls++ === 0)
        throw new Error('GET https://rpc.example/?key=secret failed')
    },
  }
  await scheduler.runOnce(job)
  expect(scheduler.status.j).toMatchObject({
    runs: 1,
    failures: 1,
    running: false,
  })
  expect(scheduler.status.j.lastError).toBe('Error: GET <url> failed')
  await scheduler.runOnce(job)
  expect(scheduler.status.j).toMatchObject({
    runs: 2,
    failures: 1,
    lastError: null,
  })
})

test('a run past its timeout fails immediately and blocks overlap until the stuck run ends', async () => {
  const scheduler = createScheduler(quiet)
  let release = () => {}
  let started = 0
  const job = {
    name: 'slow',
    intervalMs: 1,
    timeoutMs: 10,
    run: () => {
      started++
      return new Promise<void>((resolve) => {
        release = resolve
      })
    },
  }
  await scheduler.runOnce(job)
  expect(scheduler.status.slow).toMatchObject({ failures: 1, running: true })
  expect(scheduler.status.slow.lastError).toContain('TimeoutError')
  await scheduler.runOnce(job)
  expect(started).toBe(1)
  release()
  await Bun.sleep(5)
  expect(scheduler.status.slow.running).toBe(false)
  await scheduler.runOnce({
    ...job,
    timeoutMs: 1000,
    run: async () => {
      started++
    },
  })
  expect(started).toBe(2)
})

test('stop prevents further scheduled runs', async () => {
  const scheduler = createScheduler(quiet)
  let runs = 0
  scheduler.start([
    {
      name: 'tick',
      intervalMs: 5,
      timeoutMs: 1000,
      run: async () => {
        runs++
      },
    },
  ])
  await Bun.sleep(30)
  scheduler.stop()
  const seen = runs
  await Bun.sleep(30)
  expect(seen).toBeGreaterThan(1)
  expect(runs).toBe(seen)
})

test('stop also refuses refresh-triggered one-shot work while allowing an in-flight run to settle', async () => {
  const scheduler = createScheduler(quiet)
  let finish = () => {}
  let runs = 0
  const work = scheduler.runOnce({
    name: 'in-flight', intervalMs: 5, timeoutMs: 1000,
    run: () => new Promise<void>((resolve) => { finish = resolve }),
  })
  scheduler.stop()
  await scheduler.runOnce({
    name: 'late-refresh', intervalMs: 5, timeoutMs: 1000,
    run: async () => { runs++ },
  })
  expect(runs).toBe(0)
  expect(scheduler.status['in-flight'].running).toBe(true)
  finish()
  await work
  expect(scheduler.status['in-flight'].running).toBe(false)
})
