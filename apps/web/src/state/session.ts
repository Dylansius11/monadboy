/**
 * What the player has chosen so far, and nothing else.
 *
 * This store holds choices, not live pool or position data. Screens use
 * fixtures; Kuru, Mera and worker reads are wired in Phase 7 (see BUILD-PLAN).
 * Caching those reads here would create a second version of the truth.
 *
 * Everything is defaulted, so any screen can be opened directly at its URL and
 * still render. That is not a convenience: it is how eight screens get built and
 * looked at without playing the screens before them each time.
 *
 * Routes are the only writers (ARCHITECTURE.md §6). A screen reports a choice
 * through its callbacks and the route stores it. The pool being played is not
 * stored here: the URL id is its source.
 */

import { create } from 'zustand'
import type { CharacterId } from '../config/brand'
import type { RunSummary } from '../game/sim'
import type { ManualRange, RangeWidth } from '../lib/range/plan'
import type { Difficulty } from '../types/domain'

export type { ManualRange, RangeWidth } from '../lib/range/plan'

/** The character is the risk profile, never an independent choice. */
const CHARACTER_FOR: Record<Difficulty, CharacterId> = {
  easy: 'molandak',
  normal: 'moyaki',
  hard: 'mouch',
}

export interface SessionState {
  /**
   * The memory card in the slot, as an address. Null before S1 inserts one.
   *
   * A choice in the same sense `diskId` is: it is the account the player
   * signed in as, not data about that account. Mera supplies it in Phase 7
   * (see BUILD-PLAN).
   */
  cardAddress: string | null
  diskId: number | null
  difficulty: Difficulty
  /** Bound to difficulty: EASY Molandak, NORMAL Moyaki, HARD Mouch. */
  characterId: CharacterId
  /** A modifier on HARD, never a fourth tier. The honeypot check stays on. */
  godMode: boolean

  // ---- what S6 is composing ----------------------------------------------
  /** Quote-token units the player is putting in. */
  amount: number
  width: RangeWidth
  /**
   * Percentage offsets from the current mid, never venue-specific ids.
   * Replanned at funding so price changes do not silently move the chosen
   * width. Null until an edge is edited; manual range is never the default.
   */
  manualRange: ManualRange | null
  autopilot: boolean

  /**
   * Quote-token balance the player is spending from.
   *
   * FIXTURE spending ceiling for S6's MAX and over-deposit check.
   * Phase 7 replaces it with the Mera disk's chain balance (see BUILD-PLAN).
   */
  balance: number

  // ---- what S7 leaves behind for S8 --------------------------------------
  /**
   * The finished run. Null until one ends.
   *
   * This IS derived data in a store that holds choices, and it is here anyway
   * because the alternative is worse: S8 would have to re-run the simulation
   * to report on it, and a seeded walk replayed at a different tick count
   * produces different numbers from the ones the player just watched. The
   * summary is a RECORD of something that already happened, not a cache of
   * something that can be recomputed. ERD.md section 3.
   */
  lastRun: RunSummary | null

  insertCard: (cardAddress: string) => void
  chooseDifficulty: (difficulty: Difficulty, godMode?: boolean) => void
  setAmount: (amount: number) => void
  setWidth: (width: RangeWidth) => void
  setManualRange: (manual: ManualRange | null) => void
  setAutopilot: (on: boolean) => void
  openDisk: (diskId: number) => void
  finishRun: (summary: RunSummary) => void
}

export const useSession = create<SessionState>((set) => ({
  cardAddress: null,
  diskId: null,
  difficulty: 'easy',
  characterId: CHARACTER_FOR.easy,
  godMode: false,
  amount: 100,
  width: 'wide',
  manualRange: null,
  autopilot: true,
  balance: 250,
  lastRun: null,

  insertCard: (cardAddress) => set({ cardAddress }),
  chooseDifficulty: (difficulty, godMode = false) =>
    // GOD MODE is only reachable from HARD, so it cannot survive a downgrade.
    set({
      difficulty,
      characterId: CHARACTER_FOR[difficulty],
      godMode: difficulty === 'hard' ? godMode : false,
    }),
  // Clamped to the balance here rather than in S6, so no screen can put the
  // player into a deposit they cannot fund by taking a different route in.
  setAmount: (amount) =>
    set((s) => ({ amount: Math.min(Math.max(0, amount), s.balance) })),
  // Picking a width again is the player asking for the suggestion back, so it
  // drops any hand moved edges. The manual range is an edit ON TOP of a
  // width, never a second mode running beside it. plan.ts says the same.
  setWidth: (width) => set({ width, manualRange: null }),
  setManualRange: (manualRange) => set({ manualRange }),
  setAutopilot: (autopilot) => set({ autopilot }),
  openDisk: (diskId) => set({ diskId }),
  finishRun: (lastRun) => set({ lastRun }),
}))
