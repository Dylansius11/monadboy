import { planLadder } from '@monadboy/sdk'
import type { Ladder, LadderInput } from '@monadboy/sdk'

/** How a suggested range relates to the price the player will be judged against. */
export type RangeNote = 'COVERS_TARGET' | 'PARTIAL_TARGET'

/**
 * The WIDE / TIGHT suggestion, aware of a source target that has left the book.
 *
 * The worker mirrors the book only on demand, so an idle TESTNET book lags the
 * source (the DEMO target in a x20 run). A range centred on the lagging book
 * can sit entirely off the target: the player enters OUT OF RANGE with nothing
 * they did wrong. When the target is further from the book than the suggested
 * reach, the side towards it is extended past the target by one flip step. The
 * book mid stays strictly inside, so every ladder order is still passive.
 *
 * This is arithmetic on two observed prices, not a prediction. A manual range
 * is the player's own and is never changed.
 */
export function suggestLadder(
  input: LadderInput & { target: number | null },
): { ladder: Ladder; note: RangeNote | null } {
  const { target, ...plan } = input
  const base = planLadder(plan)
  if (plan.manual || target === null || !Number.isFinite(target) || target <= 0) return { ladder: base, note: null }
  const reach = Math.max(plan.mid - base.low, base.high - plan.mid)
  if (Math.abs(target - plan.mid) <= reach) return { ladder: base, note: null }

  const margin = base.step * plan.mid
  const manual = target < plan.mid
    ? { low: Math.max(plan.mid * 0.01, target - margin), high: base.high }
    : { low: base.low, high: target + margin }
  const ladder = planLadder({ ...plan, manual })
  return { ladder, note: ladder.low <= target && target <= ladder.high ? 'COVERS_TARGET' : 'PARTIAL_TARGET' }
}
