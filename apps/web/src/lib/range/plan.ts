/** Shared precedence for setup and live range planning. */

export type RangeWidth = 'wide' | 'tight'
export interface ManualRange {
  lowerPct: number
  upperPct: number
}

/** The part of an SDK ladder needed to draw a range. */
export interface RangePlan {
  low: number
  high: number
  step: number
  levels: number
}

export type RangeRequest<TInputs> = TInputs & {
  mid: number
  mode: 'WIDE' | 'TIGHT'
  manual?: { low: number; high: number }
}

/**
 * A width source supplied by the caller, with no production fallback.
 * `planLadder` can implement this method: its extra order and funding fields
 * are compatible with RangePlan, and TInputs carries its budget, vol and params.
 */
export interface RangePlanner<TInputs, TPlan extends RangePlan = RangePlan> {
  plan: (input: RangeRequest<TInputs>) => TPlan
}

export interface PlannedRange<TPlan extends RangePlan = RangePlan> {
  plan: TPlan
  /** Mean half-width in percent; manual edits retain the requested width. */
  requestedWidthPct: number
}

/** Manual edits win over WIDE/TIGHT. Clearing the edit restores the mode. */
export function planForSession<TInputs, TPlan extends RangePlan = RangePlan>(
  mid: number,
  width: RangeWidth,
  manual: ManualRange | null,
  planner: RangePlanner<TInputs, TPlan>,
  inputs: TInputs,
): PlannedRange<TPlan> {
  return manual
    ? planForOffsets(mid, manual, planner, inputs, width)
    : planForWidth(mid, width, planner, inputs)
}

/** A manual range's edges are percentages away from the current mid. */
export function planForOffsets<TInputs, TPlan extends RangePlan = RangePlan>(
  mid: number,
  manual: ManualRange,
  planner: RangePlanner<TInputs, TPlan>,
  inputs: TInputs,
  width: RangeWidth = 'wide',
): PlannedRange<TPlan> {
  const plan = planner.plan({
    ...inputs,
    mid,
    mode: width === 'wide' ? 'WIDE' : 'TIGHT',
    manual: {
      low: mid * (1 + manual.lowerPct / 100),
      high: mid * (1 + manual.upperPct / 100),
    },
  })
  return {
    plan,
    requestedWidthPct: (-manual.lowerPct + manual.upperPct) / 2,
  }
}

export function planForWidth<TInputs, TPlan extends RangePlan = RangePlan>(
  mid: number,
  width: RangeWidth,
  planner: RangePlanner<TInputs, TPlan>,
  inputs: TInputs,
): PlannedRange<TPlan> {
  const plan = planner.plan({
    ...inputs,
    mid,
    mode: width === 'wide' ? 'WIDE' : 'TIGHT',
    manual: undefined,
  })
  return { plan, requestedWidthPct: ((plan.high - plan.low) / mid) * 50 }
}
