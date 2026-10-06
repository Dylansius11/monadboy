import { expect, test } from 'bun:test'
import {
  createNonceManager,
  createTransactionQueue,
} from '../src/chain/treasury'

function chain(initial: bigint, lastSender: bigint | null) {
  const state = { head: initial, scans: 0, lastSender }
  return {
    state,
    queue: createTransactionQueue({
      head: async () => state.head,
      senderBlock: async () => {
        state.scans++
        return state.lastSender
      },
      pause: async () => {
        state.head++
      },
    }),
  }
}

test('a first send after a prior sender transaction waits for three blocks, and so does every later send', async () => {
  const { state, queue } = chain(10n, 9n)
  const sent: bigint[] = []
  for (let i = 0; i < 2; i++)
    await queue.run(async () => {
      sent.push(state.head)
      return { blockNumber: state.head }
    })
  expect(sent).toEqual([12n, 15n])
})

test('no prior sender activity means no wait; the chain is scanned once, not per send', async () => {
  const { state, queue } = chain(10n, null)
  const sent: bigint[] = []
  for (let i = 0; i < 2; i++)
    await queue.run(async () => {
      sent.push(state.head)
      return { blockNumber: state.head }
    })
  expect(sent).toEqual([10n, 13n])
  expect(state.scans).toBe(1)
})

test('a send that fails before a receipt forces a rescan, because the sender may have a transaction in flight', async () => {
  const { state, queue } = chain(10n, null)
  await queue.run(async () => ({ blockNumber: 10n }))
  await expect(
    queue.run(async () => {
      throw new Error('rpc dropped')
    }),
  ).rejects.toThrow('rpc dropped')
  state.lastSender = 11n
  const at = state.head
  await queue.run(async () => ({ blockNumber: state.head }))
  expect(state.scans).toBe(2)
  expect(state.head).toBeGreaterThanOrEqual(at)
  expect(state.head).toBeGreaterThanOrEqual(14n)
})

test('sends never overlap even when started together', async () => {
  const { queue } = chain(10n, null)
  const order: string[] = []
  const slow = queue.run(async () => {
    order.push('a-start')
    await Bun.sleep(10)
    order.push('a-end')
    return { blockNumber: 10n }
  })
  const fast = queue.run(async () => {
    order.push('b-start')
    return { blockNumber: 14n }
  })
  await Promise.all([slow, fast])
  expect(order).toEqual(['a-start', 'a-end', 'b-start'])
})

test('nonces follow the chain, never reuse a local reservation, and reset after a failure', async () => {
  let pending = 5
  const nonces = createNonceManager(async () => pending)
  expect(await nonces.next()).toBe(5)
  expect(await nonces.next()).toBe(6)
  pending = 9
  expect(await nonces.next()).toBe(9)
  nonces.reset()
  pending = 7
  expect(await nonces.next()).toBe(7)
})
