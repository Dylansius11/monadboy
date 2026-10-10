import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { CityCanvas } from '../city/CityCanvas'
import { HeldConsole } from '../HeldConsole'
import { Boot } from '../../game/screens/Boot'
import { brand } from '../../config/brand'

/** The console sits dark for a beat before the LED comes on. */
const POWER_ON_MS = 700
/** City windows light at a calm, irregular rate: one every 1.2 to 3.6 s. */
const LIGHT_MIN_MS = 1200
const LIGHT_SPREAD_MS = 2400

/**
 * First viewport. A night city, a console that powers itself on, and one
 * sentence that says what the game is. The windows lighting up are the
 * city's own rhythm, not data; the data lives on the console.
 */
export function Hero({ onStart }: { onStart: () => void }) {
  const reduced = useReducedMotion() ?? false
  const [powered, setPowered] = useState(false)
  const [lights, setLights] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => setPowered(true), reduced ? 0 : POWER_ON_MS)
    return () => window.clearTimeout(t)
  }, [reduced])

  useEffect(() => {
    if (reduced) return
    let t = 0
    const next = () => {
      t = window.setTimeout(() => {
        setLights((n) => n + 1)
        next()
      }, LIGHT_MIN_MS + Math.random() * LIGHT_SPREAD_MS)
    }
    next()
    return () => window.clearTimeout(t)
  }, [reduced])

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <CityCanvas fillSignal={lights} className="hero-city" />

      <div className="hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title" className="display">
            Stay
            <br />
            in range.
          </h1>
          <p className="lead">
            A pocket game where your range is a real Kuru flip-order ladder on
            Monad testnet.
          </p>
          <div className="hero-actions">
            <button type="button" className="start" onClick={onStart}>
              <span className="start-pill" aria-hidden="true" />
              Press start
              <kbd>Enter</kbd>
            </button>
            <a className="quiet-link" href="#how">
              How it plays
            </a>
          </div>
        </div>

        <div className="hero-console">
          <HeldConsole maxWidth={520} powered={powered} style={{ viewTransitionName: 'console' }}>
            {powered ? (
              <Boot instant={reduced} onStart={onStart} />
            ) : (
              <div className="screen-off" aria-hidden="true" />
            )}
          </HeldConsole>
          <div className="street-shadow" aria-hidden="true" />
        </div>
      </div>

      <Billboard />
    </section>
  )
}

/** What the console is built from, said once, the way a street sign says it. */
const SIGN = [
  brand.CARTRIDGE_01,
  'Kuru flip orders on Monad testnet',
  `Passkey ${brand.WALLET_UNIT.toLowerCase()}s by Mera`,
  'Envio-indexed leaderboard',
  'Test tokens only',
]

/**
 * An LED crawl on the street below the console. It moves in whole pixels:
 * the animation has one step per pixel of travel, so the letters never land
 * between columns and blur.
 */
function Billboard() {
  const first = useRef<HTMLDivElement>(null)
  const [travel, setTravel] = useState(0)

  useLayoutEffect(() => {
    const el = first.current
    if (!el) return
    const measure = () => setTravel(Math.round(el.offsetWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const line = SIGN.map((s) => (
    <span key={s}>
      {s}
      <i aria-hidden="true" />
    </span>
  ))
  return (
    <div className="billboard" role="marquee" aria-label={SIGN.join('. ')}>
      <div
        className="billboard-crawl"
        aria-hidden="true"
        style={{
          ['--travel' as string]: `${travel}px`,
          ['--steps' as string]: travel || 1,
          // 48 px a second: slow enough to read while walking past
          ['--crawl-ms' as string]: `${Math.max(1, travel) * 21}ms`,
        }}
      >
        <div ref={first} className="billboard-line">{line}</div>
        <div className="billboard-line">{line}</div>
      </div>
    </div>
  )
}
