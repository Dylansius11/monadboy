import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
} from '@category-labs/mera'
import { toViemAccount } from '@category-labs/mera/viem'
import { deriveDiskKey, deriveSealKey, diskAddresses } from '@monadboy/sdk'
import { DISK_SLOTS } from './card'
import { CardError } from './errors'
import type { Secp256k1SigningSession, WebAuthnClient } from '@category-labs/mera'
import type { CardBackend, CardMaterial, DiskHandle, DiskSlot } from './card'

/**
 * The only file that touches WebAuthn, the PRF output or a private key.
 *
 * It must stay out of the server and out of the static route graph: it is
 * reached only through `mera-client.ts`, a client-only boundary that loads it
 * with a dynamic import. It never logs, never persists, and never hands a key
 * or a seed to anything but a Mera signing session and the SDK's own seal
 * derivation.
 */

/**
 * Turn one PRF output into three isolated disks, then zero it.
 *
 * Failure at any point ends every session already created, so a half built
 * card never holds a live key. Zeroing happens in `finally`, which means it
 * also runs when derivation throws.
 *
 * Residual, outside this file's control: the SDK derives through a mnemonic
 * string and its own copy of the PRF bytes before it returns, and a string or
 * a copy made inside a library cannot be zeroed from here.
 */
async function materialFrom(prf: Uint8Array): Promise<CardMaterial> {
  const sessions: Secp256k1SigningSession[] = []
  const endAll = () => {
    for (const session of sessions) session.end()
  }
  try {
    const addresses = await diskAddresses(prf)
    const disks: Partial<Record<DiskSlot, DiskHandle>> = {}
    for (const slot of DISK_SLOTS) {
      const privateKey = deriveDiskKey(prf, slot)
      let session: Secp256k1SigningSession
      try {
        // The session keeps its own copy, so the derived bytes are dead weight.
        session = createSecp256k1SigningSession({ privateKey })
      } finally {
        privateKey.fill(0)
      }
      sessions.push(session)
      const account = toViemAccount(session)
      if (account.address.toLowerCase() !== addresses[slot].toLowerCase()) {
        throw new CardError('CARD_MISMATCH')
      }
      disks[slot] = { slot, address: addresses[slot], account, sealKey: await deriveSealKey(prf, slot) }
    }
    let ended = false
    return {
      serial: addresses[0],
      disks: disks as Record<DiskSlot, DiskHandle>,
      end() {
        if (ended) return
        ended = true
        endAll()
      },
    }
  } catch (error) {
    endAll()
    throw error
  } finally {
    prf.fill(0)
  }
}

export function createMeraBackend(options: { webAuthnClient?: WebAuthnClient } = {}): CardBackend {
  const { webAuthnClient } = options
  return {
    async create({ rp, user }) {
      const created = await createPasskeyWithPrfOutput({ rp, user, webAuthnClient })
      const credential =
        created.transports === undefined
          ? { credentialId: created.credentialId }
          : { credentialId: created.credentialId, transports: created.transports }
      return { credential, material: await materialFrom(created.prfOutput) }
    },
    async recover({ rpId, credential }) {
      const recovered = await getPasskeyPrfOutput({ rpId, credential, webAuthnClient })
      const known = credential?.credentialId === recovered.credentialId ? credential : undefined
      return {
        credential: known ?? { credentialId: recovered.credentialId },
        material: await materialFrom(recovered.prfOutput),
      }
    },
  }
}
