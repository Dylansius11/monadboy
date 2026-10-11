import { useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { characters } from '../../config/brand'
import { duration, pct, usd, usdFine } from '../../lib/format'
import { DAMAGE_APR, FEE_APR, REBALANCE_COST_FRACTION, STEP_SECONDS } from '../sim'
import { Dialog, KeyHints, Meter, Panel, PixelText, Sprite, Value } from '../../ui'
import type { SpriteAnimation } from '../../ui'
import type { CharacterId } from '../../config/brand'
import type { RunSummary } from '../sim'
import type { Pool } from '../../types/domain'

/**
 * Above this `timeInRangePct`, a run reads as genuinely well flown rather
 * than merely lucky. Set closer to the top than the middle on purpose: 50
 * is a coin flip, and a coin flip is exactly the run this screen has to be
 * honest is not the same thing as skill (the "scrappy" line below exists
 * for that run).
 */
const STRONG_TIME_IN_RANGE_PCT = 60

/**
 * One outcome bucket drives both the sprite's face and the line it says.
 *
 * S7's lesson was that a motion preference could make the Monanimal smile
 * while the player was losing, and the fix there was making the face a pure
 * function of the numbers. Here the face and the WORDS are a pure function of
 * the SAME three-way value, so a future edit to one cannot drift from the
 * other the way two separate ternaries could.
 */
type Outcome = 'strong' | 'scrappy' | 'negative'

function outcomeFor(run: RunSummary): Outcome {
  if (run.netUsd < 0) return 'negative'
  return run.timeInRangePct > STRONG_TIME_IN_RANGE_PCT ? 'strong' : 'scrappy'
}

const ANIMATION_BY_OUTCOME: Record<Outcome, SpriteAnimation> = {
  strong: 'happy', scrappy: 'idle', negative: 'sit',
}

/**
 * Never scolding, never congratulating luck as if it were skill. The
 * "scrappy" line says the quiet part out loud instead of pretending net
 * positive always means the player did something right.
 */
const LINE_BY_OUTCOME: Record<Outcome, string> = {
  strong: 'you stayed on your feet. that is the whole job.',
  scrappy: 'you came out ahead. you were also lucky. those are different things.',
  negative: 'price walked off your ground. that happens. the range was the bet.',
}

export interface ResultsProps {
  /** Undefined is a render state, never a throw. */
  pool: Pool | undefined
  /** The route supplies session.lastRun, never a replay of its walk. Null when
   * there is no finished run to report, which is also a render state. */
  run: RunSummary | null
  /** Current session amount; RunSummary does not carry historical deposits. */
  amount: number
  characterId: CharacterId
  /**
   * A setting is not evidence of who re-centered the range. Accepted and
   * deliberately NOT rendered: see the rebalance line below, which reports
   * the count of presses the player actually made. Kept on the props so the
   * route and the tests do not churn when autopilot becomes real and earns
   * its own counter.
   */
  autopilot: boolean
  onBackToDisks: () => void
}

/**
 * S8, the results screen. It reports marked fixture results; sealed saves are
 * wired in Phase 7.
 *
 * A component, not a route: same shape as InRange, testable with
 * `renderScreen` and a keypress instead of a router.
 */
export function Results({ pool, run, amount, characterId, onBackToDisks }: ResultsProps) {
  const [inspecting, setInspecting] = useState(false)
  useConsoleIntent((intent) => {
    // The inputs view is read-only: B or START closes it, and it never leaves
    // the screen.
    if (inspecting) {
      if (intent === 'B' || intent === 'START') setInspecting(false)
      return
    }
    // B repeats A on purpose. A back button that does nothing on the last
    // screen of a flow is a dead end, and S8 is the last screen of the flow.
    if (intent === 'A' || intent === 'B') { onBackToDisks(); return }
    // START, the same key that opens the inputs view on S6 and S7. Nothing to
    // inspect without a run and a pool to attribute it to.
    if (intent === 'START' && run && pool) setInspecting(true)
  })

  if (!run) {
    return (
      <div className="bg-screen flex h-full w-full flex-col gap-2 p-2">
        <div className="flex flex-1 items-center justify-center">
          <Panel className="flex flex-col gap-2">
            <PixelText role="title" upper>
              No session to report
            </PixelText>
            <PixelText role="body">
              Nothing has finished yet. Play a round and come back.
            </PixelText>
          </Panel>
        </div>
        <KeyHints hints={[{ key: 'A', label: 'Disks' }]} />
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="bg-screen flex h-full w-full flex-col gap-2 p-2">
        <div className="flex flex-1 items-center justify-center">
          <Panel className="flex flex-col gap-2">
            <PixelText role="title" upper>
              Pool not found
            </PixelText>
            <PixelText role="body">
              This pool is not on the current save disk. The run still happened,
              its numbers are just not shown here.
            </PixelText>
          </Panel>
        </div>
        <KeyHints hints={[{ key: 'A', label: 'Disks' }]} />
      </div>
    )
  }

  if (inspecting) {
    return (
      <div className="screen-inputs bg-screen flex h-full w-full flex-col gap-2 p-2">
        <PixelText role="title" upper>FIXTURE inputs</PixelText>
        <Panel className="flex flex-col gap-1">
          <PixelText role="micro">TESTNET simulation summary from the finished session, not chain fills.</PixelText>
          <PixelText role="micro">Session amount {usd(amount)} TESTNET quote units; quote valued at $1.</PixelText>
          <PixelText role="micro">SCORE {usdFine(run.feesEarnedUsd)}; NET {usdFine(run.netUsd)}; DAMAGE {usdFine(run.damageUsd)}</PixelText>
          <PixelText role="micro">DAMAGE = max(0, SCORE - NET)</PixelText>
          <PixelText role="micro">NET is supplied independently; surplus above SCORE is preserved.</PixelText>
          <PixelText role="micro">Time in range {pct(run.timeInRangePct, 1)}; elapsed {duration(run.elapsedSeconds)}</PixelText>
          <PixelText role="micro">Best streak {duration(run.bestStreakSeconds)}; re-centers {run.rebalances}</PixelText>
          <PixelText role="micro">{`FIXTURE SCORE: ${pct(FEE_APR * 100, 0)} annually while in range; outside damage: ${pct(DAMAGE_APR * 100, 0)} annually.`}</PixelText>
          <PixelText role="micro">{`Manual re-center damage: ${pct(REBALANCE_COST_FRACTION * 100, 2)} of the deposit. A tick represents ${duration(STEP_SECONDS)}.`}</PixelText>
        </Panel>
        <KeyHints className="mt-auto" hints={[{ key: 'B', label: 'Close' }]} />
      </div>
    )
  }

  const outcome = outcomeFor(run)
  const spriteAnimation = ANIMATION_BY_OUTCOME[outcome]

  return (
    <div className="screen-results bg-screen flex h-full w-full flex-col gap-1 p-2">
      {/* Title band. One row, not two: stacking SESSION OVER over the pair
          tag costs a whole extra title-role line height (24px) this screen
          does not have to spare, and reading them left to right loses
          nothing a beginner needs. */}
      <div className="results-header flex items-baseline justify-center gap-2">
        <PixelText role="title" upper>
          Session over
        </PixelText>
        <PixelText role="micro" tone="dim" upper>
          {pool.tokenX.symbol}/{pool.tokenY.symbol}
        </PixelText>
        <PixelText role="micro" tone="dim" upper>
          Fixture Testnet
        </PixelText>
      </div>

      {/* The Monanimal and the money block share a row. Stacked, a 64px
          sprite plus its name, the three-row money panel, the instrument
          block, and the Dialog line do not all fit full width inside a 320px
          height budget without something getting clipped by the viewport's
          overflow:hidden. Side by side is what buys the room for the block
          that actually carries the never-hide-a-loss rule. */}
      <div className="results-money grid grid-cols-[96px_1fr] items-start gap-2">
        <div className="flex flex-col items-center gap-1">
          <Sprite
            character={characterId}
            animation={spriteAnimation}
            scale={1}
            size={64}
          />
          <PixelText role="micro" tone="dim" upper>
            {characters[characterId].label}
          </PixelText>
        </div>

        <Panel flush className="flex flex-col gap-1 p-1">
          <div className="flex items-baseline justify-between">
            <PixelText role="body" upper>
              Score
            </PixelText>
            <Value
              amount={run.feesEarnedUsd}
              prefix="+$"
              decimals={2}
              tone="gain"
            />
          </div>
          <div className="flex items-baseline justify-between">
            <PixelText role="body" upper>
              Damage taken
            </PixelText>
            {/* Not `signed`, same reasoning as InRange.tsx: damageUsd is
                stored positive and is never a gain, so `signed` would render
                a green +$0.00 the moment a session ends without a loss. The
                minus and the loss tone are stated explicitly instead, which
                is the only way DAMAGE keeps SCORE's size without also losing
                the loss colour. This row is the whole reason S8 exists. */}
            <Value
              amount={run.damageUsd}
              prefix="-$"
              decimals={2}
              tone="loss"
            />
          </div>
          <div className="border-edge border-t" />
          <div className="flex items-baseline justify-between">
            <PixelText role="body" upper>
              Net
            </PixelText>
            {/* The one row on this screen allowed to be `signed`: NET can
                actually land on either side, so its glyph has to be derived
                from the amount rather than asserted by a hardcoded prefix
                like the two rows above it. `role="hero"` because
                tokens.css marks --text-hero for exactly this: "boot,
                results, score". Largest thing on the screen, on purpose. */}
            <Value
              amount={run.netUsd}
              prefix="$"
              decimals={2}
              signed
              role="hero"
            />
          </div>
        </Panel>
      </div>

      {/* Instrument block. Time in range gets a body-weight row and its own
          Meter, both bigger than the two rows under them: it is the only
          number here that measures a skill rather than a deposit size, and a
          profit-ranked leaderboard would just reward whoever put in most. */}
      <div className="results-instruments flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <PixelText role="body" upper>
            Time in range
          </PixelText>
          <PixelText role="body" className="tabular-nums">
            {pct(run.timeInRangePct, 0)}
          </PixelText>
        </div>
        <Meter value={run.timeInRangePct} />
        <PixelText role="micro" tone="dim">
          FIXTURE time in range, not a live leaderboard.
        </PixelText>
        <div className="grid grid-cols-2">
          <PixelText role="micro" upper>
            {/* Always "Rebalanced", never the autopilot name.
                `run.rebalances` is written by one function, `recordRebalance`
                in sim.ts, and that function has exactly one caller: the A
                keypress branch in InRange.tsx. Nothing fires autopilot, so
                keying the label off the autopilot SETTING would credit a
                machine for presses the player made with their own thumb.
                When autopilot is real it gets its own counter in RunSummary,
                and this line branches on that counter, not on a checkbox. */}
            Rebalanced {run.rebalances}x
          </PixelText>
          {/* There is no distance anywhere in sim.ts, only elapsed seconds and
              streak length: a metres figure belongs to a runner mini-game, not
              this one, and printing one would be inventing a number on the one
              screen whose entire job is refusing to do that. So this prints
              the longest unbroken in-range streak as a time instead. */}
          <PixelText
            role="micro"
            tone="dim"
            className="text-right tabular-nums"
            upper
          >
            Best run {duration(run.bestStreakSeconds)}
          </PixelText>
        </div>
      </div>

      {/* The line, keyed on the same `outcome` the sprite animation reads
          above, so the face and the words can never tell two different
          stories about one run. No portrait: Dialog's portrait well is a
          fixed 64px square, and the same character is already on screen at
          64px twenty pixels above it. A second copy of one Monanimal is
          redundancy, not richness, and it costs a fifth of the remaining
          height budget to say nothing new. */}
      <Dialog speaker={characters[characterId].label}>
        {LINE_BY_OUTCOME[outcome]}
      </Dialog>

      <KeyHints className="mt-auto" hints={[
        { key: 'A', label: 'Disks' },
        { key: 'START', label: 'Inputs' },
      ]} />
    </div>
  )
}
