import { useEffect, useState } from 'react'
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
    <section className="hero" aria-labelledby="hero-title">
      <CityCanvas fillSignal={lights} className="hero-city" />

      <header className="topbar">
        <span className="topbar-mark">{brand.CONSOLE_NAME}</span>
        <nav className="topbar-nav" aria-label="Page">
          <a href="#how">How it plays</a>
          <a href="#real">What is real</a>
          <span className="tag">Testnet</span>
        </nav>
      </header>

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
    </section>
  )
}
