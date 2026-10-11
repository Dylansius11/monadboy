import { Link } from '@tanstack/react-router'
import { brand } from '../../config/brand'
import { CityCanvas } from '../city/CityCanvas'

/**
 * What each piece of the console is made of. Every row is a dependency the
 * build actually runs on, linked to the page that documents it.
 */
const PARTS = [
  {
    name: 'Monad',
    role: 'testnet chain',
    line: `Every order and every ${brand.SAVE_UNIT.toLowerCase()} lives on Monad testnet.`,
    href: 'https://docs.monad.xyz',
  },
  {
    name: 'Kuru',
    role: 'flip orders',
    line: 'Your range is a ladder of Kuru flip orders that re-arm after each fill.',
    href: 'https://docs.kuru.io/concepts/flip-orders',
  },
  {
    name: 'Mera',
    role: 'passkey card',
    line: `A passkey becomes your ${brand.WALLET_UNIT.toLowerCase()}. No extension, no seed phrase.`,
    href: 'https://docs.monad.xyz/guides/mera',
  },
  {
    name: 'Envio',
    role: 'indexed fills',
    line: 'Fills are indexed so the leaderboard reads what really happened.',
    href: 'https://docs.envio.dev/docs/HyperIndex/overview',
  },
] as const

/**
 * The page ends where it began: the same city, now at street level, and the
 * same START key.
 */
export function Closing({ onStart }: { onStart: () => void }) {
  return (
    <footer className="closing">
      <div className="closing-parts">
        <h2 className="heading">What it runs on</h2>
        <ul className="parts">
          {PARTS.map((p) => (
            <li key={p.name} className="part">
              <a href={p.href} target="_blank" rel="noreferrer">
                <span className="part-name">{p.name}</span>
                <span className="part-role">{p.role}</span>
                <span className="part-line">{p.line}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="closing-stage">
        <CityCanvas seed={20261014} className="closing-city" />
        <div className="closing-cta">
          <h2 className="display closing-title">
            Your console
            <br />
            is on.
          </h2>
          <button type="button" className="start" onClick={onStart}>
            <span className="start-pill" aria-hidden="true" />
            Press start
            <kbd>Enter</kbd>
          </button>
        </div>
      </div>

      <div className="closing-meta">
        <img
          className="brand-wordmark"
          src="/brand/monadboy-wordmark-light.png"
          width={112}
          height={16}
          alt={brand.CONSOLE_NAME}
        />
        <span>Built for Monad Metropolis · Track 01</span>
        <span>Monad testnet · test tokens only</span>
        <Link to="/play">Open the console</Link>
      </div>
    </footer>
  )
}
