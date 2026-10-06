import { z } from 'zod'

/**
 * The only thing the browser remembers about a card: which passkey it was.
 *
 * It is convenience, not authority. Wiping it loses nothing: INSERT CARD then
 * lets the authenticator choose a saved passkey (discoverable mode) and the
 * same three disks come back. It holds no PRF output, key, address or disk
 * data, and it is bound to the relying party it was created under so a changed
 * rpId can never reuse another host's credential id.
 */
export const CREDENTIAL_KEY = 'monadboy.card.credential.v1'

const zStored = z.object({
  v: z.literal(1),
  rpId: z.string().min(1),
  credentialId: z.string().min(1),
  transports: z.array(z.string()).optional(),
})

export interface CredentialMetadata {
  credentialId: string
  transports?: readonly string[]
}

/** The slice of `Storage` used, so tests and the dev spike pass their own. */
export type MetadataStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface CredentialStore {
  load: (rpId: string) => CredentialMetadata | null
  save: (rpId: string, credential: CredentialMetadata) => void
  clear: () => void
}

export function createCredentialStore(
  storage: () => MetadataStorage | null,
  key: string = CREDENTIAL_KEY,
): CredentialStore {
  return {
    load(rpId) {
      try {
        const raw = storage()?.getItem(key)
        if (!raw) return null
        const parsed = zStored.safeParse(JSON.parse(raw))
        if (!parsed.success || parsed.data.rpId !== rpId) return null
        const { credentialId, transports } = parsed.data
        return transports ? { credentialId, transports } : { credentialId }
      } catch {
        // Storage can throw (private mode) or hold garbage. Both mean no hint.
        return null
      }
    },
    save(rpId, credential) {
      try {
        const entry: z.infer<typeof zStored> = {
          v: 1,
          rpId,
          credentialId: credential.credentialId,
          ...(credential.transports ? { transports: [...credential.transports] } : {}),
        }
        storage()?.setItem(key, JSON.stringify(entry))
      } catch {
        // A card that cannot be remembered still works: restore is stateless.
      }
    },
    clear() {
      try {
        storage()?.removeItem(key)
      } catch {
        // Nothing to clear.
      }
    },
  }
}

/** Browser localStorage, read lazily so importing this on the server never touches it. */
export function browserStorage(): MetadataStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}
