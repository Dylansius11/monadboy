import { HDKey } from '@scure/bip32'
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { bytesToHex } from 'viem'
import type { Address } from 'viem'
import { privateKeyToAddress } from 'viem/accounts'

function rootFromPrf(prfOutput: Uint8Array): HDKey {
  return HDKey.fromMasterSeed(mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist)))
}

function keyAtIndex(root: HDKey, index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index >= 2 ** 31) {
    throw new RangeError('Disk index must be a non-hardened BIP-32 index')
  }
  const node = root.derive(`m/44'/60'/0'/0/${index}`)
  if (node.privateKey === null) throw new Error('Derivation produced no private key')
  return node.privateKey
}

export function deriveDiskKey(prfOutput: Uint8Array, index: number): Uint8Array {
  return keyAtIndex(rootFromPrf(prfOutput), index)
}

export async function diskAddresses(prfOutput: Uint8Array): Promise<Record<0 | 1 | 2 | 3, Address>> {
  const root = rootFromPrf(prfOutput)
  const address = (index: number) => privateKeyToAddress(bytesToHex(keyAtIndex(root, index)))
  return { 0: address(0), 1: address(1), 2: address(2), 3: address(3) }
}
