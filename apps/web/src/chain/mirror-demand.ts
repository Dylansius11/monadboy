import { mirrorDemandMessage } from '@monadboy/sdk'
import type { Address } from 'viem'
import type { DiskLease } from './card'

// Memory-only lease: closing, hiding or ejecting never leaves a recurring signer.
export function createMirrorDemand(lease: DiskLease, market: Address, worker: string) {
  let lastAt = Number.NEGATIVE_INFINITY
  let pending = false
  let stopped = false
  const abort = new AbortController()
  const available = () => !stopped && !document.hidden && lease.isLive()
  return {
    async pulse() {
      if (!available() || pending || Date.now() - lastAt < 15000) return
      pending = true
      try {
        const at = Date.now()
        const signature = await lease.account.signMessage({ message: mirrorDemandMessage(market, lease.address, at) })
        lease.assertLive()
        if (!available()) return
        const response = await fetch(`${worker}/v1/mirror/demand`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ owner: lease.address, at, signature }),
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(4000)]),
        })
        if (!response.ok) throw new Error('DEMO mirror activation unavailable. Existing funds remain withdrawable.')
        lastAt = at
      } finally {
        pending = false
      }
    },
    stop() { stopped = true; abort.abort() },
  }
}
