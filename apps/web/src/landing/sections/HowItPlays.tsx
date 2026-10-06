import { useMemo, useRef, useState } from 'react'
import { useMotionValueEvent, useScroll } from 'motion/react'
import { HeldConsole } from '../HeldConsole'
import { PoolTracker } from '../../game/screens/PoolTracker'
import { SetRange } from '../../game/screens/SetRange'
import { InRange } from '../../game/screens/InRange'
import { fixtureGates, scoredPools } from '../../game/fixtures'
import { FIXTURE_PROVENANCE } from '../../game/data/provenance'
import { isExecutable } from '../../game/eligibility'

/**
 * The page's one authored moment. The console pins while three beats scroll
 * past, and its screen is the real screen for each beat, running on the
 * development fixtures: what a visitor reads about is what they will play.
 */

const BEATS = [
  {
    title: 'Pick a market.',
    body: 'Only books deep enough to play light up. Thin and mainnet-only books stay on the map, locked.',
  },
  {
    title: 'Set your range.',
    body: 'WIDE earns less often and survives bigger moves. TIGHT earns more often and leaves sooner. The cost to start is on the screen before you confirm.',
  },
  {
    title: 'Watch it work.',
    body: 'Every fill re-arms on its own. SCORE is the spread you actually earned; DAMAGE is what price movement cost you. Leave the range and you stop earning.',
  },
] as const

const noop = () => undefined

export function HowItPlays() {
  const section = useRef<HTMLElement>(null)
  const [beat, setBeat] = useState(0)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    setBeat(Math.min(BEATS.length - 1, Math.floor(p * BEATS.length)))
  })

  const pools = useMemo(() => scoredPools('easy'), [])
  const playable = pools.find(isExecutable)?.pool

  return (
    <section id="how" ref={section} className="how" aria-labelledby="how-title">
      <div className="how-pin">
        <div className="how-copy">
          <h2 id="how-title" className="heading">
            How it plays
          </h2>
          <ol className="beats">
            {BEATS.map((b, i) => (
              <li key={b.title} className={i === beat ? 'beat is-on' : 'beat'} aria-current={i === beat ? 'step' : undefined}>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="how-console">
          <HeldConsole maxWidth={560}>
            {beat === 0 && (
              <PoolTracker
                pools={pools}
                characterId="molandak"
                gates={fixtureGates('easy')}
                provenance={FIXTURE_PROVENANCE}
                onPlayPool={noop}
                onBack={noop}
              />
            )}
            {beat === 1 && (
              <SetRange
                pool={playable}
                balance={250}
                amount={100}
                width="wide"
                manualRange={null}
                autopilot
                onChangeAmount={noop}
                onChangeWidth={noop}
                onChangeManualRange={noop}
                onToggleAutopilot={noop}
                onConfirm={noop}
                onBack={noop}
              />
            )}
            {beat === 2 && (
              <InRange
                pool={playable}
                amount={100}
                width="wide"
                manualRange={null}
                autopilot
                characterId="molandak"
                onWithdraw={noop}
                onRebalance={noop}
                onBack={noop}
              />
            )}
          </HeldConsole>
          <p className="fixture-note">Screens shown with development fixtures.</p>
        </div>
      </div>
    </section>
  )
}
