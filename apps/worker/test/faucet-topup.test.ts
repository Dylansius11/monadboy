import { expect, test } from 'bun:test'
import { createFaucetTopup } from '../src/jobs/faucet-topup'
import { address, quiet } from './helpers'

const wallet = address('1')
const HOUR = 3_600_000

class RevertError extends Error {
  override name = 'ContractFunctionExecutionError'
  constructor(readonly cause: unknown) {
    super('The contract function "requestFunds" reverted.')
  }
}
const maxFrequency = () =>
  new RevertError({
    name: 'ContractFunctionRevertedError',
    data: { errorName: 'MaxFrequencyExceeded' },
    shortMessage: 'reverted with MaxFrequencyExceeded()',
  })

function setup(request: () => Promise<void>, balance = async () => 0n) {
  const clock = { now: 0 }
  const job = createFaucetTopup({
    wallets: [wallet],
    minimum: 100n,
    balance,
    request,
    now: () => clock.now,
    logger: quiet,
  })
  return { clock, job }
}

test('MaxFrequencyExceeded schedules a wait instead of retrying, and the wait doubles up to a day', async () => {
  let requests = 0
  const { clock, job } = setup(async () => {
    requests++
    throw maxFrequency()
  })
  await job.tick()
  await job.tick()
  expect(requests).toBe(1)
  expect(job.state[0]).toMatchObject({
    status: 'frequency-limited',
    lastError: 'MaxFrequencyExceeded',
    nextAt: HOUR,
  })
  clock.now = HOUR - 1
  await job.tick()
  expect(requests).toBe(1)
  clock.now = HOUR
  await job.tick()
  expect(requests).toBe(2)
  expect(job.state[0].nextAt).toBe(HOUR + 2 * HOUR)
  for (let i = 0; i < 8; i++) {
    clock.now = job.state[0].nextAt
    await job.tick()
  }
  expect(job.state[0].nextAt - clock.now).toBe(24 * HOUR)
})

test('an unrelated failure backs off on a short ladder, distinct from the frequency ladder', async () => {
  const { clock, job } = setup(async () => {
    throw new Error('insufficient funds for gas')
  })
  await job.tick()
  expect(job.state[0]).toMatchObject({
    status: 'unavailable',
    lastError: 'request-failed',
    nextAt: 60_000,
  })
  clock.now = 60_000
  await job.tick()
  expect(job.state[0].nextAt).toBe(60_000 + 120_000)
})

test('a funded wallet is not requested for, and a successful request resets the backoff', async () => {
  let requests = 0
  const rich = setup(
    async () => {
      requests++
    },
    async () => 100n,
  )
  await rich.job.tick()
  expect(requests).toBe(0)
  expect(rich.job.state[0]).toMatchObject({ status: 'funded', failures: 0 })
  let fail = true
  const flaky = setup(async () => {
    requests++
    if (fail) throw maxFrequency()
  })
  await flaky.job.tick()
  fail = false
  flaky.clock.now = HOUR
  await flaky.job.tick()
  expect(flaky.job.state[0]).toMatchObject({
    status: 'funded',
    failures: 0,
    lastError: null,
    nextAt: HOUR + 60_000,
  })
})

test('each wallet backs off independently', async () => {
  const other = address('2')
  const requested: string[] = []
  const job = createFaucetTopup({
    wallets: [wallet, other],
    minimum: 100n,
    balance: async () => 0n,
    request: async (w) => {
      requested.push(w)
      if (w === wallet) throw maxFrequency()
    },
    now: () => 0,
    logger: quiet,
  })
  await job.tick()
  await job.tick()
  expect(requested).toEqual([wallet, other])
})
