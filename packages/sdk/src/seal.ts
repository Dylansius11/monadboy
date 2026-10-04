import { bytesToHex, encodePacked, hexToBytes } from 'viem'
import type { Address, Hex } from 'viem'

export type RunRecord = {
  market: Address
  openedAt: number
  closedAt: number
  score: number
  damage: number
  fills: number
}

export type DiskPlaintext = {
  v: 1
  name: string
  characterId: string
  palette: string
  difficulty: 0 | 1 | 2
  godMode: boolean
  notes: string
  createdAt: number
  runs: RunRecord[]
}

type DiskAad = { chainId: number; registry: Address; disk: Address }
const utf8 = new TextEncoder()

// uint256 is the chainId width in the persisted v1 authenticated-data contract.
function packedAad(aad: DiskAad): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hexToBytes(encodePacked(['uint256', 'address', 'address'],
    [BigInt(aad.chainId), aad.registry, aad.disk])))
}

export async function deriveSealKey(prfOutput: Uint8Array, slot: 1 | 2 | 3): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', Uint8Array.from(prfOutput), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey({
    name: 'HKDF', hash: 'SHA-256', salt: utf8.encode('monadboy/v1'), info: utf8.encode(`disk:${slot}:seal`),
  }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function sealDisk(key: CryptoKey, plaintext: DiskPlaintext, aad: DiskAad): Promise<Hex> {
  const bounded = { ...plaintext, runs: plaintext.runs.slice(-10) }
  let encoded = utf8.encode(JSON.stringify(bounded))
  while (encoded.length > 1536 && bounded.runs.length > 0) {
    bounded.runs.shift()
    encoded = utf8.encode(JSON.stringify(bounded))
  }
  if (encoded.length > 1536) throw new RangeError('Disk plaintext exceeds 1536 bytes without runs')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({
    name: 'AES-GCM', iv, additionalData: packedAad(aad),
  }, key, encoded)
  const blob = new Uint8Array(1 + iv.length + encrypted.byteLength)
  blob[0] = 1
  blob.set(iv, 1)
  blob.set(new Uint8Array(encrypted), 13)
  return bytesToHex(blob)
}

export async function openDisk(key: CryptoKey, blob: Hex, aad: DiskAad): Promise<DiskPlaintext> {
  const bytes = Uint8Array.from(hexToBytes(blob))
  if (bytes.length < 29 || bytes[0] !== 1) throw new Error('Invalid sealed disk version or length')
  const decrypted = await crypto.subtle.decrypt({
    name: 'AES-GCM', iv: bytes.subarray(1, 13), additionalData: packedAad(aad),
  }, key, bytes.subarray(13))
  return JSON.parse(new TextDecoder().decode(decrypted)) as DiskPlaintext
}
