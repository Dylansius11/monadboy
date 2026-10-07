import { expect, it } from 'vitest'
import { createPublicClient, custom } from 'viem'
import { waitForSender, withSenderLock } from './sender'
import type { DiskLease } from './card'

const address = '0x1111111111111111111111111111111111111111' as const
it('low-balance signing observes actual recent sender blocks and stops immediately if the held lease is revoked during an await', async () => {
  let live = true
  let codeReads = 0
  const client = createPublicClient({
    transport: custom({
      request: async ({ method }) => {
        if (method === 'eth_chainId') return '0x279f'
        if (method === 'eth_getBalance') {
          live = false
          return '0x1'
        }
        if (method === 'eth_getCode') {
          codeReads++
          return '0x'
        }
        throw new Error(`Unexpected ${method}`)
      },
    }),
  })
  const lease = {
    assertLive: () => {
      if (!live) throw Error('CARD_EJECTED')
    },
  } as DiskLease
  await expect(waitForSender(client, address, lease)).rejects.toThrow(
    'CARD_EJECTED',
  )
  expect(codeReads).toBe(0)
})
it('registry saves and market signatures serialize per sender until the previous receipt wait finishes', async () => {
  const reached = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const actions: string[] = []
  const save = withSenderLock(address, async () => {
    actions.push('save')
    reached.resolve()
    await release.promise
    actions.push('save receipt')
  })
  await reached.promise
  const order = withSenderLock(address, async () => {
    actions.push('order')
  })
  expect(actions).toEqual(['save'])
  release.resolve()
  await Promise.all([save, order])
  expect(actions).toEqual(['save', 'save receipt', 'order'])
})
