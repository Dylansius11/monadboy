import { isAddress } from 'viem'
import { z } from 'zod'
import type { DiskPlaintext } from '@monadboy/sdk'
import type { Address } from 'viem'
import type { Difficulty, SaveDisk } from '../types/domain'

/**
 * A decrypted disk is still untrusted bytes: AES-GCM proves the card sealed it,
 * not that it has the shape this build expects. Parse before anything reads it.
 */
const zMarket = z.custom<Address>((value) => typeof value === 'string' && isAddress(value, { strict: false }))
const zReceipt = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
export const zPositionBasis = z.object({
  market: zMarket, openedAt: z.number().finite(), startBlock: z.string().regex(/^\d+$/),
  base0: z.number().finite().nonnegative(), quote0: z.number().finite().nonnegative(),
  low: z.number().finite().positive(), high: z.number().finite().positive(), step: z.number().finite().positive(),
})
export const zActualExit = z.object({
  market: zMarket, openedAt: z.number().nullable(), closedAt: z.number().finite(),
  score: z.number().finite().nullable(), damage: z.number().finite().nullable(), net: z.number().finite().nullable(),
  fills: z.number().int().nonnegative().nullable(), receipts: z.array(zReceipt), complete: z.boolean(),
  /** Whether the exit had orders to cancel. Absent on saves written before it existed. */
  onBook: z.boolean().optional(),
})

const zRun = z.object({
  market: zMarket,
  openedAt: z.number(),
  closedAt: z.number(),
  score: z.number(),
  damage: z.number(),
  fills: z.number(),
  net: z.number().finite().optional(),
  receipts: z.array(zReceipt).optional(),
})

export const zDiskPlaintext = z.object({
  v: z.literal(1),
  name: z.string(),
  characterId: z.string(),
  palette: z.string(),
  difficulty: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  godMode: z.boolean(),
  notes: z.string(),
  createdAt: z.number(),
  runs: z.array(zRun),
  position: zPositionBasis.optional(),
  lastExit: zActualExit.optional(),
})

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']
const NEW_DISK_NAME = 'new game'

/** A blank disk for an empty slot: EASY, no GOD MODE, no runs. Nothing is chosen for the player. */
export function newDiskPlaintext(nowSeconds: number): DiskPlaintext {
  return {
    v: 1,
    name: NEW_DISK_NAME,
    characterId: 'molandak',
    palette: 'default',
    difficulty: 0,
    godMode: false,
    notes: '',
    createdAt: nowSeconds,
    runs: [],
  }
}

/**
 * The shelf row for a decrypted disk.
 *
 * `runs` is the count of sealed runs. The best figures come from the run with
 * the highest SCORE minus DAMAGE, the same rule the fixtures use, and are
 * USD like every other figure on the shelf. [INFERENCE] The sealed run's score
 * and damage units are not yet written by any screen (S6/S8), so this mapping
 * is unexercised against real runs until they are.
 */
export function toSaveDisk(slot: number, owner: Address, plaintext: DiskPlaintext): SaveDisk {
  let best = { score: 0, damage: 0 }
  let bestNet = Number.NEGATIVE_INFINITY
  for (const run of plaintext.runs) {
    const net = run.score - run.damage
    if (net > bestNet) {
      bestNet = net
      best = { score: Math.max(0, run.score), damage: Math.max(0, run.damage) }
    }
  }
  return {
    diskId: slot,
    owner,
    // The shelf row holds at most twelve characters; the full name stays sealed.
    name: plaintext.name.slice(0, 12) || NEW_DISK_NAME,
    difficulty: DIFFICULTIES[plaintext.difficulty],
    godMode: plaintext.difficulty === 2 && plaintext.godMode,
    createdAt: Math.max(0, Math.trunc(plaintext.createdAt)),
    runs: plaintext.runs.length,
    bestScore: best.score,
    bestDamage: best.damage,
    attested: false,
  }
}
