import { monadTestnet, rpcUrl } from '@monadboy/sdk'
import deployments from '../../../../packages/sdk/src/deployments.testnet.json'
import { getAddress, isAddress, zeroAddress } from 'viem'
import { brand } from '../config/brand'
import { CardError } from './errors'
import type { Address } from 'viem'

/**
 * Browser configuration for the card and the save disks.
 *
 * Every value is a `VITE_` public value; nothing here is a secret. Nothing is
 * defaulted to something that merely works: a missing relying party or registry
 * is an explicit error the screen prints, because a passkey created under a
 * guessed hostname can never be restored under the real one.
 */
export const CHAIN = monadTestnet

export interface ChainEnv {
  VITE_RP_ID?: string
  VITE_RP_NAME?: string
  VITE_REGISTRY_ADDRESS?: string
  VITE_TESTNET_RPC_URL?: string
  VITE_WORKER_URL?: string
}

export function readChainEnv(): ChainEnv {
  const env = import.meta.env
  return {
    VITE_RP_ID: env.VITE_RP_ID,
    VITE_RP_NAME: env.VITE_RP_NAME,
    VITE_REGISTRY_ADDRESS: env.VITE_REGISTRY_ADDRESS,
    VITE_TESTNET_RPC_URL: env.VITE_TESTNET_RPC_URL,
    VITE_WORKER_URL: env.VITE_WORKER_URL,
  }
}

export interface RelyingParty {
  id: string
  name: string
}

/** A bare DNS name or `localhost`. No scheme, port or path, and never an IP literal. */
const HOST = /^(?:localhost|(?=.*[a-z])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)$/

/**
 * The fixed relying party for real cards. The hostname is NOT read from
 * `location`: a card is bound to the id it was created under, so an incidental
 * preview URL must never become one.
 */
export function resolveRelyingParty(env: ChainEnv): RelyingParty {
  const id = env.VITE_RP_ID?.trim()
  if (!id) throw new CardError('RP_ID_MISSING')
  if (!HOST.test(id) || /^\d+(?:\.\d+){3}$/.test(id)) throw new CardError('RP_ID_INVALID')
  return { id, name: env.VITE_RP_NAME?.trim() || brand.CONSOLE_NAME }
}

/**
 * WebAuthn needs a secure context and an rpId that is the page's hostname or a
 * parent domain of it. Checking here turns two opaque browser SecurityErrors
 * into named, printable failures before any prompt is shown.
 */
export function assertOrigin(rpId: string, location: { protocol: string; hostname: string }): void {
  const local = location.hostname === 'localhost'
  if (location.protocol !== 'https:' && !local) throw new CardError('INSECURE_ORIGIN')
  if (location.hostname !== rpId && !location.hostname.endsWith(`.${rpId}`)) {
    throw new CardError('RP_ID_MISMATCH')
  }
}

/** Public receipt-backed TESTNET deployment, with an explicit override for isolated runtime checks. */
export function resolveRegistryAddress(env: ChainEnv): Address {
  const raw = env.VITE_REGISTRY_ADDRESS?.trim() ?? (deployments.chainId === CHAIN.id ? deployments.diskRegistry.address : undefined)
  if (!raw) throw new CardError('REGISTRY_UNCONFIGURED')
  if (!isAddress(raw) || getAddress(raw) === zeroAddress) throw new CardError('REGISTRY_INVALID')
  return getAddress(raw)
}

export function resolveWorkerUrl(env: ChainEnv): string {
  const raw = env.VITE_WORKER_URL?.trim()
  if (!raw) throw new CardError('WORKER_UNCONFIGURED')
  return raw.replace(/\/+$/, '')
}

export function resolveRpcUrl(env: ChainEnv): string {
  return rpcUrl('testnet', { VITE_TESTNET_RPC_URL: env.VITE_TESTNET_RPC_URL })
}

/** What the authenticator shows in its passkey picker, so two cards can be told apart. */
export function cardUser(now: Date): { name: string; displayName: string } {
  return {
    name: `${brand.CONSOLE_NAME} card ${now.toISOString().slice(0, 10)}`,
    displayName: `${brand.CONSOLE_NAME} ${brand.WALLET_UNIT}`,
  }
}

export function explorerAddressUrl(address: Address): string {
  return `${CHAIN.blockExplorers.default.url}/address/${address}`
}

export function explorerTxUrl(hash: string): string {
  return `${CHAIN.blockExplorers.default.url}/tx/${hash}`
}
