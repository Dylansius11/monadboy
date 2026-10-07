import { diskRegistryAbi, sealDisk } from '@monadboy/sdk'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  keccak256,
  parseEventLogs,
  stringToHex,
} from 'viem'
import { CHAIN } from './config'
import { CardError, meraCodeOf } from './errors'
import { browserTransport, rememberSenderBlock, waitForSender, withSenderLock } from './sender'
import { bufferedGas } from './gameplay'
import type { DiskPlaintext } from '@monadboy/sdk'
import type { Address, Hex, Log, LocalAccount, TransactionReceipt } from 'viem'
import type { DiskLease } from './card'

/** What the registry returns for one disk account. */
export interface RegistryRecord {
  createdAt: bigint
  updatedAt: bigint
  difficulty: number
  godMode: boolean
  tag: Hex
  sealedData: Hex
}

export interface ChainReceipt {
  status: 'success' | 'reverted'
  blockNumber: bigint
  logs: readonly Log[]
}

export type SaveArgs = readonly [sealedData: Hex, difficulty: number, godMode: boolean, tag: Hex]

/**
 * Every chain call the card and the shelf make, behind one seam.
 *
 * It is narrow on purpose: the real implementation is five viem calls, and
 * tests substitute a small fake instead of mocking a client's internals.
 */
export interface RegistryChain {
  chainId: () => Promise<number>
  code: (address: Address) => Promise<Hex | undefined>
  balance: (address: Address, blockNumber?: bigint) => Promise<bigint>
  diskOf: (registry: Address, disk: Address) => Promise<RegistryRecord>
  estimateSave: (registry: Address, from: Address, args: SaveArgs) => Promise<bigint>
  /** Signs with the disk's own account and broadcasts with the explicit `gas`. Returns the hash. */
  save: (registry: Address, account: LocalAccount, args: SaveArgs, gas: bigint, lease?: DiskLease) => Promise<Hex>
  receipt: (hash: Hex) => Promise<ChainReceipt>
}

export function createViemChain(rpcUrl: string): RegistryChain {
  const client = createPublicClient({ chain: CHAIN, transport: browserTransport(rpcUrl) })
  const confirmed = new Map<Hex, TransactionReceipt>()
  return {
    chainId: () => client.getChainId(),
    code: (address) => client.getCode({ address }),
    balance: (address, blockNumber) => client.getBalance(blockNumber === undefined ? { address } : { address, blockNumber }),
    diskOf: (registry, disk) =>
      client.readContract({ address: registry, abi: diskRegistryAbi, functionName: 'diskOf', args: [disk] }),
    estimateSave: (registry, from, args) =>
      client.estimateContractGas({
        address: registry,
        abi: diskRegistryAbi,
        functionName: 'save',
        args,
        account: from,
        gas: 2_000_000n,
      }),
    async save(registry, account, args, gas, lease) {
      return withSenderLock(account.address, async () => {
      await waitForSender(client, account.address, lease)
      lease?.assertLive()
      const wallet = createWalletClient({ account, chain: CHAIN, transport: browserTransport(rpcUrl) })
      const request = await wallet.prepareTransactionRequest({
        account, to: registry, data: encodeFunctionData({ abi: diskRegistryAbi, functionName: 'save', args }), gas,
      })
      lease?.assertLive()
      const signed = await wallet.signTransaction(request)
      lease?.assertLive()
      const hash = await client.sendRawTransaction({ serializedTransaction: signed })
      const receipt = await client.waitForTransactionReceipt({ hash })
      rememberSenderBlock(account.address, receipt.blockNumber)
      confirmed.set(hash, receipt)
      return hash
      })
    },
    async receipt(hash) {
      const receipt = confirmed.get(hash) ?? await client.waitForTransactionReceipt({ hash })
      confirmed.delete(hash)
      return receipt
    },
  }
}

export interface VerifiedRegistry {
  address: Address
  chainId: number
}

/**
 * An address is only a registry once the right chain says it has code.
 *
 * Checked at runtime, every time the address is first used in a page, because
 * a configured address can be stale, mistyped or from another network. A read
 * that fails is REGISTRY_READ_FAILED, never "no registry".
 */
export async function verifyRegistry(chain: RegistryChain, address: Address): Promise<VerifiedRegistry> {
  let chainId: number
  let code: Hex | undefined
  try {
    chainId = await chain.chainId()
    if (chainId !== CHAIN.id) throw new CardError('WRONG_CHAIN', String(chainId))
    code = await chain.code(address)
  } catch (error) {
    if (error instanceof CardError) throw error
    throw new CardError('REGISTRY_READ_FAILED', undefined, { cause: error })
  }
  if (code === undefined || code === '0x') throw new CardError('REGISTRY_NO_CODE')
  return { address, chainId }
}

/** Funded integration uses bounded estimates with ceil(estimate * 1.2), not unbounded native-payout estimates. */
export const GAS_HEADROOM_PERCENT = 20n

export interface SaveRequest {
  lease: DiskLease
  registry: VerifiedRegistry
  plaintext: DiskPlaintext
  /** Public bytes12 label. Never the private name. */
  tag?: string
}

export interface SavedDisk {
  txHash: Hex
  sealedHash: Hex
  blockNumber: bigint
  gas: bigint
}

/**
 * Seal the disk and write it to the registry from the disk's own account.
 *
 * Resolves only for a successful receipt that carries this registry's DiskSaved
 * event for this disk with the hash of exactly what was sealed, so the caller
 * may show SAVED TO CARD. Anything else rejects and nothing is claimed.
 *
 * The gas limit is `estimateContractGas` for this exact call plus
 * `GAS_HEADROOM_PERCENT`: never a constant and never a market figure.
 */
export async function saveDisk(chain: RegistryChain, request: SaveRequest): Promise<SavedDisk> {
  const { lease, registry, plaintext } = request
  lease.assertLive()

  let funded: bigint
  try {
    funded = await chain.balance(lease.address)
    lease.assertLive()
  } catch (error) {
    throw new CardError('REGISTRY_READ_FAILED', undefined, { cause: error })
  }
  if (funded === 0n) throw new CardError('NOT_FUNDED')

  const sealed = await sealDisk(lease.sealKey, plaintext, {
    chainId: registry.chainId,
    registry: registry.address,
    disk: lease.address,
  })
  lease.assertLive()
  const sealedHash = keccak256(sealed)
  const tag = stringToHex(request.tag ?? `DISK ${lease.slot}`, { size: 12 })
  const args: SaveArgs = [sealed, plaintext.difficulty, plaintext.godMode, tag]

  let gas: bigint
  try {
    const estimate = await chain.estimateSave(registry.address, lease.address, args)
    lease.assertLive()
    gas = bufferedGas(estimate, 2_000_000n)
  } catch (error) {
    throw new CardError('SAVE_COST_FAILED', undefined, { cause: error })
  }

  // The card may have left while the cost was being checked.
  lease.assertLive()
  const chainId = await chain.chainId()
  lease.assertLive()
  if (chainId !== CHAIN.id) throw new CardError('WRONG_CHAIN', String(chainId))
  let txHash: Hex
  try {
    txHash = await chain.save(registry.address, lease.account, args, gas, lease)
  } catch (error) {
    if (meraCodeOf(error)) throw error
    throw new CardError('SAVE_FAILED', undefined, { cause: error })
  }

  let receipt: ChainReceipt
  try {
    receipt = await chain.receipt(txHash)
  } catch (error) {
    throw new CardError('SAVE_UNCONFIRMED', txHash, { cause: error })
  }
  if (receipt.status !== 'success') throw new CardError('SAVE_REVERTED')

  const events = parseEventLogs({ abi: diskRegistryAbi, eventName: 'DiskSaved', logs: [...receipt.logs] })
  const confirmed = events.some(
    (event) =>
      event.address.toLowerCase() === registry.address.toLowerCase() &&
      event.args.disk.toLowerCase() === lease.address.toLowerCase() &&
      event.args.sealedHash === sealedHash,
  )
  if (!confirmed) throw new CardError('SAVE_UNCONFIRMED', txHash)

  return { txHash, sealedHash, blockNumber: receipt.blockNumber, gas }
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Ask the worker to fund a fresh disk (SPEC 4.4). The worker is the only party
 * that signs here, and only with its own drip wallet: it never signs for the
 * player. Resolves with the MON transfer hash, which the worker has already
 * waited on, so the balance can be read at that block.
 */
export async function requestDrip(workerUrl: string, address: Address, fetchImpl: Fetch): Promise<Hex | undefined> {
  let response: Response
  try {
    response = await fetchImpl(`${workerUrl}/v1/drip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    })
  } catch (error) {
    throw new CardError('DRIP_REFUSED', 'unreachable', { cause: error })
  }
  let body: { status?: unknown; monTx?: unknown } = {}
  try {
    body = await response.json()
  } catch {
    // A non-JSON answer is a refusal below.
  }
  const status = typeof body.status === 'string' ? body.status : `http-${response.status}`
  // `partial` means the MON leg landed and the AUSD leg did not. A disk can save with MON alone.
  if (status !== 'sent' && status !== 'partial') throw new CardError('DRIP_REFUSED', status)
  return typeof body.monTx === 'string' ? (body.monTx as Hex) : undefined
}

/**
 * Make sure a disk can pay for its first save.
 *
 * A disk that already holds MON is left alone: the worker only funds fresh
 * accounts, and asking it again would be refused. After a drip the balance is
 * read at the transfer's block, so there is no fixed delay and no polling.
 */
export async function ensureFunded(
  chain: RegistryChain,
  lease: DiskLease,
  drip: () => Promise<Hex | undefined>,
): Promise<bigint> {
  let balance: bigint
  try {
    balance = await chain.balance(lease.address)
  } catch (error) {
    throw new CardError('REGISTRY_READ_FAILED', undefined, { cause: error })
  }
  lease.assertLive()
  if (balance > 0n) return balance
  const monTx = await drip()
  lease.assertLive()
  try {
    const block = monTx ? (await chain.receipt(monTx)).blockNumber : undefined
    balance = await chain.balance(lease.address, block)
  } catch (error) {
    throw new CardError('REGISTRY_READ_FAILED', undefined, { cause: error })
  }
  if (balance === 0n) throw new CardError('NOT_FUNDED')
  return balance
}
