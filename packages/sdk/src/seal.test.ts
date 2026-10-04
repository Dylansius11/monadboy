import { describe, expect, it } from 'vitest'
import { bytesToHex, encodePacked, hexToBytes, zeroAddress } from 'viem'
import { deriveSealKey, openDisk, sealDisk } from './seal'
import type { DiskPlaintext, RunRecord } from './seal'

const prf = Uint8Array.from({ length: 32 }, (_, i) => i)
// Synthetic addresses for authenticated-data tests, not deployed contracts.
const aad = { chainId: 10143, registry: zeroAddress, disk: bytesToHex(new Uint8Array(20).fill(1)) }
const disk: DiskPlaintext = {
  v: 1, name: 'MY DISK', characterId: 'molandak', palette: 'daylight',
  difficulty: 0, godMode: false, notes: 'private', createdAt: 1, runs: [],
}
const runs: RunRecord[] = Array.from({ length: 12 }, (_, i) => ({
  market: zeroAddress, openedAt: i, closedAt: i + 1, score: i / 10, damage: 0, fills: i,
}))
const utf8 = new TextEncoder()

describe('sealed save disks', () => {
  it('round trips every private field using a fresh IV on each save', async () => {
    const key = await deriveSealKey(prf, 1)
    const plaintext = { ...disk, runs: runs.slice(0, 2), difficulty: 2 as const, godMode: true }
    const first = await sealDisk(key, plaintext, aad)
    const second = await sealDisk(key, plaintext, aad)
    expect(await openDisk(key, first, aad)).toEqual(plaintext)
    expect(await openDisk(key, second, aad)).toEqual(plaintext)
    expect(first).not.toBe(second)
    expect(first.slice(0, 4)).toBe('0x01')
    expect(hexToBytes(first).length).toBe(1 + 12 + utf8.encode(JSON.stringify(plaintext)).length + 16)
  })

  it('matches independent HKDF-SHA256 and uint256 packed AAD derivation', async () => {
    const key = await deriveSealKey(prf, 2)
    const blob = hexToBytes(await sealDisk(key, disk, aad))
    const material = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey'])
    const independentKey = await crypto.subtle.deriveKey({
      name: 'HKDF', hash: 'SHA-256', salt: utf8.encode('monadboy/v1'), info: utf8.encode('disk:2:seal'),
    }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const decrypted = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: blob.slice(1, 13),
      additionalData: Uint8Array.from(hexToBytes(encodePacked(['uint256', 'address', 'address'],
        [BigInt(aad.chainId), aad.registry, aad.disk]))),
    }, independentKey, blob.slice(13))
    expect(JSON.parse(new TextDecoder().decode(decrypted))).toEqual(disk)
  })

  it('derives non-extractable AES-GCM-256 keys', async () => {
    const key = await deriveSealKey(prf, 1)
    expect(key.extractable).toBe(false)
    expect(key.algorithm).toEqual({ name: 'AES-GCM', length: 256 })
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })

  it.each([2, 3] as const)('rejects opening slot 1 with slot %s', async (slot) => {
    const blob = await sealDisk(await deriveSealKey(prf, 1), disk, aad)
    await expect(openDisk(await deriveSealKey(prf, slot), blob, aad)).rejects.toThrow()
  })

  it.each([
    { ...aad, chainId: 143 }, { ...aad, registry: aad.disk }, { ...aad, disk: zeroAddress },
  ])('rejects replay with changed chain, registry or disk: %j', async (wrongAad) => {
    const key = await deriveSealKey(prf, 1)
    await expect(openDisk(key, await sealDisk(key, disk, aad), wrongAad)).rejects.toThrow()
  })

  it.each([1, 13, -1])('rejects a tampered IV, ciphertext or tag byte at %s', async (offset) => {
    const key = await deriveSealKey(prf, 1)
    const blob = hexToBytes(await sealDisk(key, disk, aad))
    const index = offset < 0 ? blob.length - 1 : offset
    blob[index] ^= 1
    await expect(openDisk(key, bytesToHex(blob), aad)).rejects.toThrow()
  })

  it.each(['0x', '0x01', `0x02${'00'.repeat(28)}`] as const)('rejects malformed or unknown-version blob %s', async (blob) => {
    await expect(openDisk(await deriveSealKey(prf, 1), blob, aad)).rejects.toThrow()
  })

  it('retains only the ten newest runs without mutating the original', async () => {
    const key = await deriveSealKey(prf, 1)
    const plaintext = { ...disk, runs }
    const opened = await openDisk(key, await sealDisk(key, plaintext, aad), aad)
    expect(opened.runs).toEqual(runs.slice(2))
    expect(plaintext.runs).toEqual(runs)
  })

  it('drops oldest runs to fit the UTF-8 byte cap and preserves identity', async () => {
    const key = await deriveSealKey(prf, 1)
    const plaintext = { ...disk, name: '猫'.repeat(40), notes: '猫'.repeat(170), runs }
    const opened = await openDisk(key, await sealDisk(key, plaintext, aad), aad)
    expect(opened.name).toBe(plaintext.name)
    expect(opened.characterId).toBe(plaintext.characterId)
    expect(utf8.encode(JSON.stringify(opened)).length).toBeLessThanOrEqual(1536)
    expect(opened.runs).toEqual(runs.slice(runs.length - opened.runs.length))
    expect(opened.runs.length).toBeLessThan(10)
    const previous = { ...opened, runs: runs.slice(runs.length - opened.runs.length - 1) }
    expect(utf8.encode(JSON.stringify(previous)).length).toBeGreaterThan(1536)
  })

  it('accepts exactly 1536 plaintext bytes, but never truncates non-run fields', async () => {
    const key = await deriveSealKey(prf, 1)
    const fixedBytes = utf8.encode(JSON.stringify({ ...disk, notes: '' })).length
    const exact = { ...disk, notes: 'x'.repeat(1536 - fixedBytes) }
    expect(await openDisk(key, await sealDisk(key, exact, aad), aad)).toEqual(exact)
    await expect(sealDisk(key, { ...exact, notes: `${exact.notes}x`, runs }, aad)).rejects.toThrow(RangeError)
    await expect(sealDisk(key, { ...disk, name: 'x'.repeat(1536) }, aad)).rejects.toThrow(RangeError)
  })
})
