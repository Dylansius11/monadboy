import type { Address, LocalAccount } from 'viem'
import type { RelyingParty } from './config'
import type { CredentialMetadata } from './credential-store'

/** Slot k is account index k. Index 0 is the card identity and is never a playable disk. */
export type DiskSlot = 1 | 2 | 3
export const DISK_SLOTS: readonly DiskSlot[] = [1, 2, 3]

/**
 * What one disk can do while the card is in the slot: sign, and seal.
 *
 * The account is a viem LocalAccount backed by its own Mera signing session,
 * so a disk can sign without a prompt and cannot sign for another disk. The
 * seal key is a non-extractable WebCrypto key: it can encrypt and decrypt but
 * its bytes can never be read back out.
 */
export interface DiskHandle {
  readonly slot: DiskSlot
  readonly address: Address
  readonly account: LocalAccount
  readonly sealKey: CryptoKey
}

/**
 * Everything derived from one passkey ceremony. The PRF output that produced
 * it is already zeroed when this exists. `end()` zeroes all three signing
 * sessions and is safe to call twice.
 */
export interface CardMaterial {
  /** Short address of index 0, shown as the card serial. Display only. */
  readonly serial: Address
  readonly disks: Readonly<Record<DiskSlot, DiskHandle>>
  end: () => void
}

export interface CardCeremony {
  credential: CredentialMetadata
  material: CardMaterial
}

/**
 * The WebAuthn and Mera side, behind one seam.
 *
 * The real implementation (`mera-backend.ts`) is loaded with a dynamic import
 * through a client-only boundary, so no authenticator code is evaluated on the
 * server. The card manager only ever sees this interface.
 */
export interface CardBackend {
  /** NEW CARD. Creates a passkey: a different root every time it runs. */
  create: (input: {
    rp: RelyingParty
    user: { name: string; displayName: string }
  }) => Promise<CardCeremony>
  /** INSERT CARD. Asserts an existing passkey and never creates one. */
  recover: (input: { rpId: string; credential?: CredentialMetadata }) => Promise<CardCeremony>
}

/** A live, revocable grip on one disk. Dead the moment its card is ejected. */
export interface DiskLease {
  readonly slot: DiskSlot
  readonly address: Address
  readonly account: LocalAccount
  readonly sealKey: CryptoKey
  isLive: () => boolean
  /** Throws CARD_EJECTED or CARD_EXPIRED when the card has left. Call after every await. */
  assertLive: () => void
}
