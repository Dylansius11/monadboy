import { createPublicClient, http, parseEther } from 'viem'
import { CHAIN } from './config'
import type { Address, PublicClient } from 'viem'
import type { DiskLease } from './card'

const lastBlocks = new Map<string, bigint>()

const queues = new Map<string, Promise<unknown>>()

/** Saves and trading share nonce ownership, including the receipt wait. */
export async function withSenderLock<T>(
  address: Address,
  work: () => Promise<T>,
): Promise<T> {
  const key = address.toLowerCase()
  const previous = queues.get(key) ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(work)
  queues.set(key, pending)
  try {
    return await pending
  } finally {
    if (queues.get(key) === pending) queues.delete(key)
  }
}

export function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}
/** Shared HTTP pacing keeps batched browser reads below the public RPC request limit. */
let nextRequestAt = 0
export function browserTransport(url: string) {
  return http(url, {
    batch: true,
    retryCount: 1,
    fetchFn: async (input, init) => {
      const now = Date.now()
      const at = Math.max(now, nextRequestAt)
      nextRequestAt = at + 200
      if (at > now) await delay(at - now)
      return fetch(input, init)
    },
  })
}

export function gameplayClient(url: string) {
  return createPublicClient({ chain: CHAIN, transport: browserTransport(url) })
}

export function rememberSenderBlock(address: Address, block: bigint) {
  const key = address.toLowerCase()
  if (block > (lastBlocks.get(key) ?? 0n)) lastBlocks.set(key, block)
}

/** Inspect actual recent blocks too: another tab/device is not represented by our in-memory receipts. */
export async function waitForSender(
  client: PublicClient,
  address: Address,
  lease?: DiskLease,
): Promise<void> {
  const check = () => lease?.assertLive()
  check()
  const chainId = await client.getChainId()
  check()
  if (chainId !== CHAIN.id)
    throw new Error('Signing is restricted to Monad TESTNET 10143.')
  const balance = await client.getBalance({ address })
  check()
  if (balance >= parseEther('10')) return
  const code = await client.getCode({ address })
  check()
  if (code && code !== '0x')
    throw new Error(
      'Low-balance delegated accounts cannot use the three-block signing exception.',
    )
  const key = address.toLowerCase()
  let head = await client.getBlockNumber({ cacheTime: 0 })
  check()
  for (let offset = 0n; offset < 3n && head >= offset; offset++) {
    const block = await client.getBlock({
      blockNumber: head - offset,
      includeTransactions: true,
    })
    check()
    const pastCode = await client.getCode({
      address,
      blockNumber: block.number,
    })
    check()
    if (pastCode && pastCode !== '0x')
      throw new Error(
        'Recent delegation changes prevent low-balance signing. Wait for three undelegated blocks.',
      )
    if (
      block.transactions.some(
        (transaction) =>
          typeof transaction !== 'string' &&
          transaction.from.toLowerCase() === key,
      )
    ) {
      rememberSenderBlock(address, block.number)
    }
  }
  const previous = lastBlocks.get(key)
  const deadline = Date.now() + 30_000
  while (previous !== undefined && head < previous + 3n) {
    if (Date.now() >= deadline)
      throw new Error(
        'Block spacing unavailable. No transaction signed. Refresh chain state before retrying.',
      )
    await delay(450)
    check()
    head = await client.getBlockNumber({ cacheTime: 0 })
    check()
  }
}
