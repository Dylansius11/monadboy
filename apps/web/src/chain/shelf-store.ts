import { getCardManager } from './card-store'
import { readChainEnv, resolveRegistryAddress, resolveRpcUrl, resolveWorkerUrl } from './config'
import { createViemChain } from './registry'
import { createShelfController } from './shelf'
import type { ShelfController } from './shelf'

let controller: ShelfController | null = null

/** Browser-only lazy ownership; eject and expiry discard decrypted data immediately. */
export function getShelfController(): ShelfController {
  if (controller) return controller
  const card = getCardManager()
  const created = createShelfController({
    card,
    registryAddress: () => resolveRegistryAddress(readChainEnv()),
    chain: () => createViemChain(resolveRpcUrl(readChainEnv())),
    workerUrl: () => resolveWorkerUrl(readChainEnv()),
    fetch: (input, init) => fetch(input, init),
    now: Date.now,
  })
  let serial = card.getState().serial
  card.subscribe(() => {
    const next = card.getState()
    if (next.serial !== serial || next.phase === 'ejected') created.clear()
    serial = next.serial
  })
  controller = created
  return created
}
