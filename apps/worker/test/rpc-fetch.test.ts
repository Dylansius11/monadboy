import { expect, test } from 'bun:test'
import { createPacedRpcFetch } from '../src/chain/rpc-fetch'

const url = 'https://rpc.invalid/'

test('RPC starts stay bounded even when an earlier response is still pending', async () => {
  let clock = 0
  const starts: number[] = []
  let resolveFirst!: (response: Response) => void
  let firstSettled = false
  const firstResponse = new Promise<Response>(resolve => { resolveFirst = resolve })
  const fetcher = (() => {
    starts.push(clock)
    return starts.length === 1 ? firstResponse : Promise.resolve(new Response('{}'))
  })
  const rpc = createPacedRpcFetch({fetcher, now: () => clock, pause: async ms => { clock += ms }})
  const first = rpc(url).then(response => { firstSettled = true; return response })
  const second = rpc(url)
  const third = rpc(url)
  await third
  expect(starts).toEqual([0, 50, 100])
  expect(firstSettled).toBe(false)
  resolveFirst(new Response('{}'))
  await Promise.all([first, second])
})

test('a failed RPC request does not poison the dispatch queue or remove spacing', async () => {
  let clock = 0
  const starts: number[] = []
  const fetcher = (() => {
    starts.push(clock)
    return starts.length === 1 ? Promise.reject(new Error('provider refusal')) : Promise.resolve(new Response('{}'))
  })
  const rpc = createPacedRpcFetch({fetcher, now: () => clock, pause: async ms => { clock += ms }})
  const outcomes = await Promise.allSettled([rpc(url), rpc(url), rpc(url)])
  expect(outcomes.map(outcome => outcome.status)).toEqual(['rejected', 'fulfilled', 'fulfilled'])
  expect(starts).toEqual([0, 50, 100])
})

test('an RPC canceled while waiting is never dispatched or charged another start slot', async () => {
  let clock = 0
  const starts: number[] = []
  const controller = new AbortController()
  const fetcher = () => { starts.push(clock); return Promise.resolve(new Response('{}')) }
  const rpc = createPacedRpcFetch({fetcher, now: () => clock, pause: async ms => {
    clock += ms
    controller.abort()
  }})
  const outcomes = await Promise.allSettled([rpc(url), rpc(url, {signal: controller.signal}), rpc(url)])
  expect(outcomes.map(outcome => outcome.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  expect(starts).toEqual([0, 50])
})
