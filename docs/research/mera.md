# Mera research

Evidence checked 2026-10-05. **[V]** cites fetched documentation; **[I]** is a product/design inference; **[U]** remains subject to its named spike.

## Account model and API

[V] [Monad's Mera guide](https://docs.monad.xyz/guides/mera) defines Mera as passkey PRF material deriving regular EVM EOAs. No account contract, bundler or custody backend is needed. The same passkey reproduces the same accounts.

| API | Boundary | Evidence |
|---|---|---|
| `createPasskeyWithPrfOutput` | New passkey ceremony; returns 32 secret PRF bytes and credential metadata | [V] [Guide](https://docs.monad.xyz/guides/mera) |
| `getPasskeyPrfOutput` | Returning ceremony; `rpId`, optional `credential` | [V] [Guide](https://docs.monad.xyz/guides/mera) |
| `createSecp256k1SigningSession` | Keeps a derived private key available for signing | [V] [Guide](https://docs.monad.xyz/guides/mera) |
| `toViemAccount` | `@category-labs/mera/viem`; wraps a session as a viem LocalAccount | [V] [Guide](https://docs.monad.xyz/guides/mera) |
| `session.end()` | Zeroes the key; the ended session cannot sign again | [V] [Guide](https://docs.monad.xyz/guides/mera) |
| `isMeraError` | Detect typed errors; branch on `code`, not message wording | [V] [Guide](https://docs.monad.xyz/guides/mera) |

[V] Exact derivation: `entropyToMnemonic(prfOutput, wordlist)` then `mnemonicToSeedSync`, `HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/{i}")`, using `@scure/bip39` and `@scure/bip32`. Incrementing `i` yields more accounts. Source: [Guide](https://docs.monad.xyz/guides/mera).

[I] MONADBOY index 0 is the card serial identity; save disks use indices 1, 2 and 3. `diskAddresses` derives all four addresses. A shortened card serial is display copy, never a configuration address.

## Session lifetime

[V] The guide describes two models: **hold the session** after one ceremony for high-frequency trading, or **prompt per transaction** and immediately end each session. Holding increases the duration of key exposure to page scripts; prompt-per-transaction increases ceremony friction. Source: [Guide](https://docs.monad.xyz/guides/mera).

[I] MONADBOY holds per-disk signing sessions while the console is on. Eject, explicit EJECT CARD, or a hidden tab exceeding ten minutes ends the sessions. Every subsequent signing attempt needs a fresh live session. The worker never signs for a player.

[V] Credential metadata `{credentialId, transports}` contains no key material and may be kept in localStorage. With no stored credential, `getPasskeyPrfOutput` can use discoverable mode on a fresh device. Source: [Guide](https://docs.monad.xyz/guides/mera).

[I] Restore never depends on localStorage: recover PRF, derive disk addresses, read `DiskRegistry.diskOf` for each, and `openDisk` the non-empty ciphertext. This is the stateless memory-card proof, not a server identity lookup.

## Secure context, rpId and authenticators

[V] Mera needs HTTPS or localhost, a PRF-supporting passkey provider, discoverable credentials and user verification. Sources: [Guide](https://docs.monad.xyz/guides/mera), [authenticator support](https://mera.category.xyz/authenticator-support/).

[V] A passkey is tied to its `rpId`; changing the domain prevents the normal derivation ceremony. Source: [Guide](https://docs.monad.xyz/guides/mera).

[I] Fix the production hostname and `VITE_RP_ID` before creating the first real card. An HTTPS development tunnel gets throwaway cards, never production cards. Set the relying-party name to MONADBOY.

[V] Desktop Chrome local-profile passkeys lack PRF and can fail with `PRF_UNAVAILABLE` after credential creation. Google Password Manager, iCloud and 1Password are documented alternatives. Sources: [Guide](https://docs.monad.xyz/guides/mera), [support matrix](https://mera.category.xyz/authenticator-support/).

[V] The current support matrix also lists Windows Password Manager on supported Windows/browser versions and compatible hardware keys; the guide's general desktop warning is not an exhaustive browser/version compatibility table. Consult the matrix rather than promising every security key works. Source: [Authenticator support](https://mera.category.xyz/authenticator-support/).

## Error handling

| Code | Documented meaning | MONADBOY response |
|---|---|---|
| `PRF_UNAVAILABLE` | [V] Unsupported passkey provider | [I] Explain compatible card readers; suggest phone or a supported password manager |
| `PASSKEY_OPERATION_FAILED` | [V] Prompt dismissed or failed | [I] Return to INSERT CARD; offer retry |
| `CRYPTO_UNAVAILABLE` | [V] Not a secure context | [I] Explain that the secure card reader is unavailable; fix HTTPS |
| `SESSION_ENDED` | [V] Signing after `end()` | [I] Require INSERT CARD again; do not silently create a session |

[V] Error-code meanings come from [Monad's Mera guide](https://docs.monad.xyz/guides/mera). [I] Player-facing failure copy contains no em-dashes and does not pretend a failed ceremony is a recovered card.

## Save-disk seal: non-wallet PRF use

[I] Approved seal design: `deriveSealKey(prfOutput, k)` uses HKDF-SHA256 with salt `utf8("monadboy/v1")`, info `utf8("disk:" + k + ":seal")`, and imports a **non-extractable AES-GCM-256** WebCrypto key. Account derivation and seal derivation are separate domains.

[I] Additional authenticated data is `abi.encodePacked(chainId, registryAddress, diskAddress)`. Each encrypted save has a fresh 12-byte IV and format `0x01 || iv || ciphertext || tag`. Wrong disk, registry or chain must fail authenticated decryption.

[I] Plaintext is JSON `{v:1, name, characterId, palette, difficulty, godMode, notes, createdAt, runs}`. Keep the last ten runs, each `{market, openedAt, closedAt, score, damage, fills}`; cap plaintext at 1,536 bytes and drop oldest runs first. DiskRegistry v2 stores only sealed bytes and public metadata, not the AES key or private notes.

[I] `sealDisk` writes ciphertext onchain; `openDisk` restores it after the passkey ceremony. SAVED TO CARD appears only after confirmation. OPEN exposes the ciphertext hash and explorer link so the player can inspect persistence without disclosing plaintext.

## Findings

[V: local runtime, 2026-10-06 UTC] Native WebAuthn with a virtual PRF-capable authenticator created and rediscovered the same three disk addresses, recovered a disk-1 signature and round-tripped a non-extractable AES-GCM seal. An isolated Anvil DiskRegistry accepted three encrypted saves. Eject, clear local/session storage, reload and discoverable INSERT restored the disks and NORMAL preferences; a separate fresh virtual card also restored HARD with GOD MODE enabled. Evidence: external `screens/phase2b/resume/local-registry-*.png` and `local-registry-proof.json`.

This settles local integration logic only, not physical authenticator compatibility, measured Monad gas or a testnet deployment. The dev-only `/dev/passkey` surface returned HTTP 404 in the production preview. Only credential metadata remained in localStorage; no PRF material or plaintext disk was persisted there.

[U] **S4 pending:** actual iPhone Safari and Android Chrome create/restore cycles, fresh-device recovery, and supported authenticator combinations must be exercised by the user over an HTTPS development tunnel. A documentation support entry is not proof our app works on those devices.

[U] **S4** must also record hold/end/reinsert behavior and the clear-site-data restore demonstration. Production rpId is fixed before real cards; deployment does not depend on a development-tunnel hostname.
