---
name: mera-passkeys
description: Use before implementing INSERT MEMORY CARD, save-disk account derivation, signing sessions, stateless restore, or disk sealing. Covers Mera APIs, authenticator errors, fixed rpId, and the exact MONADBOY seal format.
---

# Mera passkeys and save disks

## Boundary and sources

MONADBOY uses Mera passkeys only for player accounts. Other embedded-wallet providers do not belong in this frontend. The worker never signs for a player. Use viem LocalAccounts and chain clients, not a custody backend. [I] Product policy: SPEC 2, 3, and 4.

[V] Mera API, error meanings, derivation, and hold-session behavior below follow the [Monad Mera guide](https://docs.monad.xyz/guides/mera). Check [authenticator support](https://mera.category.xyz/authenticator-support/) and the [demo](https://mera.category.xyz/demo/) before device work. [U, S4] iPhone Safari and Android Chrome create/restore must succeed on our fixed development hostname before support is claimed.

## Fix the hostname before creating a real card

[V] WebAuthn credentials bind to their `rpId`; moving to another hostname does not preserve this restore path. HTTPS is required except localhost development. Source: [Mera guide](https://docs.monad.xyz/guides/mera).

Set `VITE_RP_ID` to the stable production hostname **before the first real passkey is created**, and use it unchanged for creation and recovery. Set `VITE_RP_NAME=MONADBOY`. A tunnel hostname used in S4 must remain stable during that spike. Do not derive rpId from an incidental preview URL. [I] Product domain rule: SPEC 2 and 4.

## Create and recover the card

[V] Imports and call shapes from the Mera guide:

```ts
import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  createSecp256k1SigningSession,
  isMeraError,
} from '@category-labs/mera'
import { toViemAccount } from '@category-labs/mera/viem'

// NEW CARD: perform this once for the chosen card.
const created = await createPasskeyWithPrfOutput({
  rp: { id: VITE_RP_ID, name: 'MONADBOY' },
  user: { name, displayName },
})
// Persist only credential metadata, not created.prfOutput.
const credential = {
  credentialId: created.credentialId,
  transports: created.transports,
}

// INSERT CARD: credential is optional on a fresh device.
const recovered = await getPasskeyPrfOutput({
  rpId: VITE_RP_ID,
  credential: storedCredential ?? undefined,
})
```

[V] `prfOutput` is `Uint8Array(32)`. With no stored credential, recovery uses discoverable mode and lets the authenticator choose a saved passkey. LocalStorage may hold `{credentialId, transports}` only; it is convenience metadata, never the restore authority. Source: Mera guide.

NEW CARD creates a different root; returning players use INSERT CARD, never silently create another passkey. Card serial on S1/S2 is the short address of index 0, display only. [I] SPEC 4.1.

## Account derivation and held sessions

[V] Use `@scure/bip39` to turn the 32 PRF bytes into a mnemonic and then its seed; derive with `@scure/bip32`. Do not feed the PRF bytes directly into HDKey. The exact path is `m/44'/60'/0'/0/{i}`. Source: Mera guide.

```ts
import { HDKey } from '@scure/bip32'
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

function deriveEvmKey(prfOutput: Uint8Array, i = 0): Uint8Array {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist))
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${i}`)
  if (node.privateKey === null) throw new Error('derivation produced no key')
  return node.privateKey
}

const session = createSecp256k1SigningSession({
  privateKey: deriveEvmKey(recovered.prfOutput, slot),
})
const account = toViemAccount(session)
```

Disk slots 1, 2, and 3 use account indices 1, 2, and 3, each with its own session and EOA. Index 0 is the card identity, not a playable disk. Use `diskAddresses` to derive all three, read `DiskRegistry.diskOf(address)` for each, and `openDisk` for each non-empty sealed blob. No server or localStorage is required for restore. [I] SPEC 4.2.

[V] `toViemAccount` is exported by `@category-labs/mera/viem`. `session.end()` zeroes its key and cannot be undone; signing after end fails with `SESSION_ENDED`. Source: Mera guide.

Hold disk sessions while the console is on so trading does not prompt per transaction. End every live session on eject, explicit EJECT CARD, or tab hide lasting **more than 10 minutes**. Resuming after expiry requires INSERT CARD again. Never hand a signing session, PRF output, private key, mnemonic, or seal key to the worker or logs. [I] SPEC 4.1 session and privacy policy.

[V] Every transaction uses explicit `gas`, because Monad charges the gas limit. Source: [gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing). Observe the three-block reserve-balance spacing rule from `kuru-flip-orders` for low-balance value-spending accounts.

## Errors become console copy

[V] Branch on `isMeraError(error)` and `error.code`, not unstable message text. Error meanings are from the Mera guide. Console text is product copy [I]; the first row is exact SPEC 4.1 copy.

| Code | Meaning [V] | Console copy [I] |
|---|---|---|
| `PRF_UNAVAILABLE` | Authenticator cannot return PRF | "This card reader can't read your card. Try your phone, or save the passkey to Google Password Manager / iCloud." |
| `PASSKEY_OPERATION_FAILED` | Ceremony dismissed or failed | "CARD NOT READ. TRY AGAIN." |
| `CRYPTO_UNAVAILABLE` | Secure context unavailable | "CARD READER NEEDS A SECURE CONNECTION." |
| `SESSION_ENDED` | Signing attempted after session ended | "CARD EJECTED. INSERT CARD AGAIN." |

[V] Desktop Chrome local-profile passkeys can be created but throw `PRF_UNAVAILABLE` when PRF is needed; Google Password Manager is the guide's tested Chrome path. iCloud / 1Password support depends on the browser/device combination. Do not claim every local-profile authenticator works. Source: Mera guide and authenticator-support page. [U, S4] Confirm the actual combinations used in the demo.

Player copy says INSERT CARD, NEW CARD, SAVE DISK, EJECT CARD. Never expose implementation vocabulary such as gas, wallet, connect, or seed phrase on S1. No user-facing em-dashes. Names are tokens in `src/config/brand.ts`. [I] SPEC 1.2 and 10.

## Exact disk seal pattern

This is the non-wallet "One Passkey, Many Keys" use. It is a product cryptographic contract [I], fixed by SPEC 4.3, not a Mera API. Implement it through `deriveSealKey`, `sealDisk`, and `openDisk` in `packages/sdk` using WebCrypto only.

```text
sealKey_k = HKDF-SHA256(
  ikm = prfOutput,
  salt = utf8("monadboy/v1"),
  info = utf8("disk:" + k + ":seal")
)
```

Import the derived key as a **non-extractable AES-GCM-256 WebCrypto key**. Slots are `k in {1,2,3}`. AAD is exactly `abi.encodePacked(chainId, registryAddress, diskAddress)`, so ciphertext is bound to its chain, registry, and disk account. Encryption and decryption must use identical packed types and bytes; never JSON-encode AAD.

Blob is exactly `0x01 || iv(12) || ciphertext||tag`. Generate a fresh 12-byte IV per save. Plaintext is JSON with this shape:

```text
{
  v: 1, name, characterId, palette, difficulty, godMode, notes, createdAt,
  runs: last 10 [{market, openedAt, closedAt, score, damage, fills}]
}
```

Cap the encoded plaintext at **1,536 bytes**, not characters; drop oldest runs first. Never change the slot's HKDF info or salt for a rename. Do not store plaintext, PRF output, or exported seal keys in localStorage or the server.

Call DiskRegistry v2 `save(bytes sealed, uint8 difficulty, bool godMode, bytes12 tag)` from the disk account. Show "SAVED TO CARD" only after confirmation. S2 OPEN shows the ciphertext hash and explorer link; it does not reveal private fields. After an exit, append the run and seal again. [I] SPEC 4.3 and 9.

## Prove the restore path

S4 exercises create, sign, save, eject, and restore on both required phone/browser combinations. For the demo, wipe site data or switch phone, INSERT CARD, authenticate, derive slots, read the registry, decrypt, and show the same disks. No worker response or local cache may substitute for this proof. [U, S4] Device evidence is added after the spike; [I] stateless demo requirement: SPEC 4.3.
