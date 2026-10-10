import { useMemo, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { HeldConsole } from '../HeldConsole'
import { MemoryCard } from '../../game/screens/MemoryCard'
import { PoolTracker } from '../../game/screens/PoolTracker'
import { SetRange } from '../../game/screens/SetRange'
import { InRange } from '../../game/screens/InRange'
import { fixtureGates, scoredPools } from '../../game/fixtures'
import { FIXTURE_PROVENANCE } from '../../game/data/provenance'
import { isExecutable } from '../../game/eligibility'
import { brand } from '../../config/brand'

/**
 * The page's one authored moment. The console pins while the loop scrolls
 * past, one beat per screen, and every screen is the real one running on the
 * development fixtures: what a visitor reads about is what they will play.
 *
 * The rail on the left is the scroll position itself, and each beat names the
 * keys it uses; those keys light on the held console so the hands learn the
 * game before the eyes finish reading.
 */

type Key = 'a' | 'b' | 'dpad' | 'select'

interface Beat {
  title: string
  body: string
  keys: ReadonlyArray<readonly [Key, string]>
}

const BEATS: ReadonlyArray<Beat> = [
  {
    title: 'Insert your card.',
    body: `A passkey is your ${brand.WALLET_UNIT.toLowerCase()}. No extension, no seed phrase. Three ${brand.SAVE_UNIT.toLowerCase()}s live on Monad testnet, sealed to it.`,
    keys: [['a', 'insert']],
  },
  {
    title: 'Pick a market.',
    body: 'Only books deep enough to play light up. Thin and mainnet-only books stay on the map, locked.',
    keys: [['dpad', 'move'], ['a', 'inspect']],
  },
  {
    title: 'Set your range.',
    body: 'WIDE earns less often and survives bigger moves. TIGHT earns more often and leaves sooner. The cost to start is on the screen before you confirm.',
    keys: [['select', 'manual'], ['a', 'confirm']],
  },
  {
    title: 'Watch it work.',
    body: `Every fill re-arms on its own. SCORE is the spread you actually earned; DAMAGE is what price movement cost you. Withdraw any time and the run goes onto your ${brand.SAVE_UNIT.toLowerCase()}.`,
    keys: [['a', 'jump'], ['b', 'withdraw']],
  },
]

const KEYCAP: Record<Key, string> = { a: 'A', b: 'B', dpad: '✚', select: 'SEL' }

const noop = () => undefined

export function HowItPlays() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion() ?? false
  const [beat, setBeat] = useState(0)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    setBeat(Math.min(BEATS.length - 1, Math.floor(p * BEATS.length)))
  })

  const pools = useMemo(() => scoredPools('easy'), [])
  const playable = pools.find(isExecutable)?.pool

  // A beat is a slice of the section's scroll; jumping lands in its middle so
  // a small nudge either way never flips to the neighbour.
  const jump = (i: number) => {
    const el = section.current
    if (!el) return
    const travel = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: el.offsetTop + (travel * (i + 0.5)) / BEATS.length, behavior: reduced ? 'auto' : 'smooth' })
  }

  const hint = BEATS[beat].keys.map(([k]) => k).join(' ')

  return (
    <section
      id="how"
      ref={section}
      className="how"
      aria-labelledby="how-title"
      style={{ ['--beats' as string]: BEATS.length }}
    >
      <div className="how-pin">
        <div className="how-copy">
          <h2 id="how-title" className="heading">
            How it plays
          </h2>
          <div className="how-rail">
            <div className="rail-track" aria-hidden="true">
              <motion.div className="rail-fill" style={{ scaleY: scrollYProgress }} />
            </div>
            <ol className="beats">
              {BEATS.map((b, i) => (
                <li
                  key={b.title}
                  className={`beat${i === beat ? ' is-on' : ''}${i < beat ? ' is-done' : ''}`}
                  aria-current={i === beat ? 'step' : undefined}
                >
                  <button type="button" className="beat-head" onClick={() => jump(i)}>
                    <span className="beat-node" aria-hidden="true" />
                    <span className="beat-title">{b.title}</span>
                  </button>
                  <div className="beat-body">
                    <div className="beat-inner">
                      <p>{b.body}</p>
                      <p className="beat-keys">
                        {b.keys.map(([k, label]) => (
                          <span key={k} className="keyhint">
                            <kbd className={`keycap keycap-${k}`}>{KEYCAP[k]}</kbd>
                            {label}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="how-console">
          <HeldConsole maxWidth={580} className="how-held" hint={hint}>
            <div key={beat} className="screen-wipe">
              {beat === 0 && <MemoryCard cardAddress={null} onInsert={noop} onBack={noop} />}
              {beat === 1 && (
                <PoolTracker
                  pools={pools}
                  characterId="molandak"
                  gates={fixtureGates('easy')}
                  provenance={FIXTURE_PROVENANCE}
                  onPlayPool={noop}
                  onBack={noop}
                />
              )}
              {beat === 2 && (
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
              {beat === 3 && (
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
            </div>
          </HeldConsole>
          <p className="fixture-note">
            <span className="beat-count" aria-hidden="true">
              {BEATS.map((b, i) => (
                <i key={b.title} className={i === beat ? 'is-on' : undefined} />
              ))}
            </span>
            Real screens on development fixtures
          </p>
        </div>
      </div>
    </section>
  )
}
