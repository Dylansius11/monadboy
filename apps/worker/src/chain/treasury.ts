import { createWalletClient, http } from 'viem'
import type {
  Address,
  Hex,
  HttpTransport,
  PublicClient,
  WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { PrivateKeyAccount } from 'viem/accounts'
import { monadTestnet } from '@monadboy/sdk'
import { testnetRpcFetch } from './rpc-fetch'

// [V] Reserve-balance rule (docs.monad.xyz/developer-essentials/reserve-balance):
// an undelegated sender may only dip below the reserve through its first
// transaction in k=3 blocks. Spacing sends by three blocks satisfies it.
export const SPACING_BLOCKS = 3n
const MAX_SPACING_POLLS = 200

export type NonceManager = { next: () => Promise<number>; reset: () => void }

// Serialised sends confirm one by one, so the node's pending count is the
// truth; the local counter only covers the gap before a broadcast is visible.
export function createNonceManager(
  pending: () => Promise<number>,
): NonceManager {
  let local: number | undefined
  return {
    next: async () => {
      const nonce = Math.max(await pending(), local ?? 0)
      local = nonce + 1
      return nonce
    },
    reset: () => {
      local = undefined
    },
  }
}

export type Receipt = { blockNumber: bigint; status: 'success' | 'reverted' }
export type QueueDeps = {
  head: () => Promise<bigint>
  // Newest block within the spacing window that holds a tx from the sender.
  senderBlock: (head: bigint) => Promise<bigint | null>
  pause?: () => Promise<unknown>
}

export type TransactionQueue = {
  run: <T extends { blockNumber: bigint }>(send: () => Promise<T>) => Promise<T>
}

// One sender, one queue: a send starts only when the head is at least three
// blocks past the sender's previous transaction, measured in blocks. After a
// restart, or after a send whose receipt was never seen, the chain is scanned.
export function createTransactionQueue({
  head,
  senderBlock,
  pause = () => Bun.sleep(300),
}: QueueDeps): TransactionQueue {
  let tail: Promise<unknown> = Promise.resolve()
  let last: bigint | null | undefined

  async function waitSpacing() {
    last ??= await senderBlock(await head())
    if (last === null) return
    for (let polls = 0; (await head()) < last + SPACING_BLOCKS; polls++) {
      if (polls >= MAX_SPACING_POLLS)
        throw new Error('Block spacing unavailable')
      await pause()
    }
  }

  return {
    run: <T extends { blockNumber: bigint }>(send: () => Promise<T>) => {
      const result = tail.then(async () => {
        await waitSpacing()
        last = undefined
        const receipt = await send()
        last = receipt.blockNumber
        return receipt
      })
      tail = result.catch(() => undefined)
      return result
    },
  }
}

export type Treasury = {
  account: PrivateKeyAccount
  wallet: WalletClient<HttpTransport, typeof monadTestnet, PrivateKeyAccount>
  // Spaced, nonce-managed, confirmed send. `build` must pass the nonce and an explicit gas limit.
  // gasUsed x effectiveGasPrice is what the chain billed (Monad bills the declared limit).
  send: (
    build: (nonce: number) => Promise<Hex>,
  ) => Promise<{ hash: Hex; blockNumber: bigint; gasUsed: bigint; effectiveGasPrice: bigint }>
}

export function createTreasury({
  key,
  rpc,
  client,
  pause,
}: {
  key: Hex
  rpc: string
  client: PublicClient
  pause?: () => Promise<unknown>
}): Treasury {
  const account = privateKeyToAccount(key)
  const wallet = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(rpc, { timeout: 10_000, retryCount: 0, fetchFn: testnetRpcFetch }),
  })
  const nonces = createNonceManager(() =>
    client.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    }),
  )
  const queue = createTransactionQueue({
    head: () => client.getBlockNumber({ cacheTime: 0 }),
    senderBlock: (head) => scanSender(client, account.address, head),
    pause,
  })
  return {
    account,
    wallet,
    send: (build) =>
      queue.run(async () => {
        let hash: Hex
        try {
          hash = await build(await nonces.next())
        } catch (error) {
          nonces.reset()
          throw error
        }
        const receipt = await client.waitForTransactionReceipt({
          hash,
          timeout: 60_000,
        })
        if (receipt.status !== 'success') {
          nonces.reset()
          throw Object.assign(new Error(`Treasury transaction reverted: ${hash}`), {
            blockNumber: receipt.blockNumber,
          })
        }
        return {
          hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.effectiveGasPrice,
        }
      }),
  }
}

async function scanSender(
  client: PublicClient,
  sender: Address,
  head: bigint,
): Promise<bigint | null> {
  const pending = await client.getTransactionCount({
    address: sender,
    blockTag: 'pending',
  })
  const confirmed = await client.getTransactionCount({
    address: sender,
    blockTag: 'latest',
  })
  if (pending !== confirmed)
    throw new Error('Sender has an unconfirmed transaction')
  for (let n = head; n >= 0n && n + SPACING_BLOCKS > head; n--) {
    const block = await client.getBlock({
      blockNumber: n,
      includeTransactions: true,
    })
    if (
      block.transactions.some(
        (tx) => tx.from.toLowerCase() === sender.toLowerCase(),
      )
    )
      return n
  }
  return null
}
