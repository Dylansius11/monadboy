import { useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { characters } from '../../config/brand'
import { duration, pct } from '../../lib/format'
import { Dialog, Meter, Panel, PixelText, Sprite, Value } from '../../ui'
import type { SpriteAnimation } from '../../ui'
import type { CharacterId } from '../../config/brand'
import type { RunSummary } from '../sim'
import type { Pool } from '../../types/domain'

const STRONG_TIME_IN_RANGE_PCT = 60
type Outcome = 'strong' | 'scrappy' | 'negative'

function outcomeFor(run: RunSummary): Outcome {
  if (run.netUsd < 0) return 'negative'
  return run.timeInRangePct > STRONG_TIME_IN_RANGE_PCT ? 'strong' : 'scrappy'
}

const ANIMATION_BY_OUTCOME: Record<Outcome, SpriteAnimation> = {
  strong: 'happy', scrappy: 'idle', negative: 'sit',
}
const LINE_BY_OUTCOME: Record<Outcome, string> = {
  strong: 'you stayed on your feet. that is the whole job.',
  scrappy: 'you came out ahead. you were also lucky. those are different things.',
  negative: 'price walked off your ground. that happens. the range was the bet.',
}

export interface ResultsProps {
  pool: Pool | undefined
  /** The route supplies session.lastRun, never a replay of its walk. */
  run: RunSummary | null
  /** Current session amount; RunSummary does not carry historical deposits. */
  amount: number
  characterId: CharacterId
  /** A setting is not evidence of who re-centered the range. */
  autopilot: boolean
  onBackToDisks: () => void
}

/** S8 reports marked fixture results; sealed saves are wired in Phase 7. */
export function Results({ pool, run, amount, characterId, onBackToDisks }: ResultsProps) {
  const [inspecting, setInspecting] = useState(false)
  useConsoleIntent((intent) => {
    if (inspecting) {
      if (intent === 'B' || intent === 'SELECT') setInspecting(false)
      return
    }
    if (intent === 'A' || intent === 'B') { onBackToDisks(); return }
    if (intent === 'SELECT' && run && pool) setInspecting(true)
  })

  if (!run) {
    return (
      <div className="bg-screen flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <Panel className="flex flex-col gap-2">
          <PixelText role="title" upper>
            No session to report
          </PixelText>
          <PixelText role="body">
            Nothing has finished yet. Play a round and come back.
          </PixelText>
        </Panel>
        <PixelText role="micro" tone="dim" upper>
          A back to disks
        </PixelText>
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="bg-screen flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <Panel className="flex flex-col gap-2">
          <PixelText role="title" upper>
            Pool not found
          </PixelText>
          <PixelText role="body">
            This pool is not on the current save disk. The run still happened,
            its numbers are just not shown here.
          </PixelText>
        </Panel>
        <PixelText role="micro" tone="dim" upper>
          A back to disks
        </PixelText>
      </div>
    )
  }

  if (inspecting) {
    return (
      <div className="bg-screen flex h-full w-full flex-col gap-2 p-2">
        <PixelText role="title" upper>FIXTURE inputs</PixelText>
        <Panel className="flex flex-col gap-1">
          <PixelText role="micro">TESTNET simulation summary from the finished session, not chain fills.</PixelText>
          <PixelText role="micro">Session amount {amount} TESTNET quote units; quote valued at $1.</PixelText>
          <PixelText role="micro">SCORE {run.feesEarnedUsd}; NET {run.netUsd}; DAMAGE {run.damageUsd}</PixelText>
          <PixelText role="micro">DAMAGE = max(0, SCORE - NET)</PixelText>
          <PixelText role="micro">NET is supplied independently; surplus above SCORE is preserved.</PixelText>
          <PixelText role="micro">Time in range {run.timeInRangePct}%; elapsed {run.elapsedSeconds}s</PixelText>
          <PixelText role="micro">Best streak {run.bestStreakSeconds}s; re-centers {run.rebalances}</PixelText>
          <PixelText role="micro">FIXTURE SCORE: 18% annually while in range; outside damage: 35% annually.</PixelText>
          <PixelText role="micro">Manual re-center damage: deposit x 0.0015. A tick represents 3600 seconds.</PixelText>
        </Panel>
        <PixelText role="micro" upper>B or Select close inputs</PixelText>
      </div>
    )
  }

  const outcome = outcomeFor(run)
  const spriteAnimation = ANIMATION_BY_OUTCOME[outcome]

  return (
    <div className="bg-screen flex h-full w-full flex-col gap-1 p-2">
      <div className="flex items-baseline justify-center gap-2">
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

      <div className="grid grid-cols-[96px_1fr] items-start gap-2">
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

      <div className="flex flex-col gap-1">
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
            Rebalanced {run.rebalances}x
          </PixelText>
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

      
      <Dialog speaker={characters[characterId].label}>
        {LINE_BY_OUTCOME[outcome]}
      </Dialog>

      <div className="mt-auto flex items-center justify-between">
        <PixelText role="micro" upper>
          A back to disks
        </PixelText>
        <PixelText role="micro" upper>Select inputs</PixelText>
      </div>
    </div>
  )
}
