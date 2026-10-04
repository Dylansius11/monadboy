import { describe, expect, it } from 'vitest'
import { entropyToMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { bytesToHex } from 'viem'
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { deriveDiskKey, diskAddresses } from './mera'

const prf = Uint8Array.from({ length: 32 }, (_, i) => i)
const mnemonic = entropyToMnemonic(prf, wordlist)

describe('Mera-compatible disk accounts', () => {
  it.each([0, 1, 2, 3])('derives index %s at the standard BIP-44 address path', (index) => {
    const key = deriveDiskKey(prf, index)
    const expected = mnemonicToAccount(mnemonic, { addressIndex: index })
    expect(privateKeyToAccount(bytesToHex(key)).address).toBe(expected.address)
  })

  it('discovers the card identity and all three isolated disk addresses', async () => {
    const addresses = await diskAddresses(prf)
    expect(addresses).toEqual({
      0: mnemonicToAccount(mnemonic, { addressIndex: 0 }).address,
      1: mnemonicToAccount(mnemonic, { addressIndex: 1 }).address,
      2: mnemonicToAccount(mnemonic, { addressIndex: 2 }).address,
      3: mnemonicToAccount(mnemonic, { addressIndex: 3 }).address,
    })
  })

  it.each([-1, 0.5, NaN, Infinity, 2 ** 31])('rejects invalid non-hardened index %s', (index) => {
    expect(() => deriveDiskKey(prf, index)).toThrow(RangeError)
  })

  it('rejects PRF material with invalid BIP-39 entropy length', () => {
    expect(() => deriveDiskKey(new Uint8Array(31), 0)).toThrow()
  })
})
