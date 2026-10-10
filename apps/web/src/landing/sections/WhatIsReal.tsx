import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { brand } from '../../config/brand'
import { LadderIllustration } from './ladder/LadderIllustration'
import { PHASE_FACT, advanceTo, createLadder, step } from './ladder/ladder-model'
import './ladder/real.css'

/**
 * The honesty section. Every line here is a product rule from SPEC, stated
 * once, with the one external claim linked to its source. The ladder beside
 * it acts the first three rules out, and each rule can call up its own beat.
 */
const FACTS = [
  {
    term: 'Your range is a ladder',
    body: (
      <>
        A WIDE or TIGHT range becomes buy and sell orders spread around the
        price on Kuru. Each one is a flip order: when it fills, it re-arms on
        the other side by itself (
        <a href="https://docs.kuru.io/concepts/flip-orders" target="_blank" rel="noreferrer">
          Kuru docs
        </a>
        ). That is all {brand.AUTOPILOT_NAME} means.
      </>
    ),
  },
  {
    term: 'Score is earned, not projected',
    body: 'SCORE counts the spread your filled orders actually captured. DAMAGE is what the price move cost the coins you hold. NET is the two together, shown side by side and never blended into one flattering number.',
  },
  {
    term: 'Leaving the range costs something',
    body: 'Out of range, nothing fills and you stop earning. Re-centering is manual, and the screen shows its swap cost before you confirm it.',
  },
  {
    term: 'Testnet only',
    body: 'Every position runs on Monad testnet with test tokens. Nothing here is real money, and every screen says so.',
  },
] as const

/** Facts the ladder can act out; the testnet rule has no beat of its own. */
const ACTED = 3
const SEED = 2026
/** One price step. Slow enough to read a fill, quick enough to loop in ~20s. */
const TICK_MS = 520

export function WhatIsReal() {
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const [ladder, setLadder] = useState(() => advanceTo(createLadder(SEED), 0))
  const [onScreen, setOnScreen] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)

  useEffect(() => {
    const el = section.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      rootMargin: '0px 0px -10% 0px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  const playing = !reduced && onScreen && pageVisible
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setLadder(step), TICK_MS)
    return () => window.clearInterval(id)
  }, [playing])

  const active = PHASE_FACT[ladder.phase]

  return (
    <section id="real" ref={section} className="real-section" aria-labelledby="real-title">
      <h2 id="real-title" className="heading real-title">
        What is real
      </h2>
      <div className="real-stage">
        <LadderIllustration state={ladder} id="real-ladder" />
      </div>
      <ol className="real-facts">
        {FACTS.map((fact, i) => (
          <li key={fact.term} className={`real-fact${i === active ? ' is-on' : ''}`}>
            <h3 className="real-fact-term">
              {i < ACTED ? (
                <button
                  type="button"
                  className="real-fact-jump"
                  aria-controls="real-ladder"
                  aria-pressed={i === active}
                  onClick={() => setLadder((s) => (!reduced && PHASE_FACT[s.phase] === i ? s : advanceTo(s, i)))}
                >
                  {fact.term}
                </button>
              ) : (
                <span className="real-fact-plain">
                  {fact.term}
                  <span className="real-tag">TESTNET</span>
                </span>
              )}
            </h3>
            <p className="real-fact-body">{fact.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
