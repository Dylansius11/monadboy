import { Link } from '@tanstack/react-router'
import { brand } from '../../config/brand'

export function Closing({ onStart }: { onStart: () => void }) {
  return (
    <footer className="closing">
      <div className="closing-cta">
        <h2 className="heading">Your console is on.</h2>
        <button type="button" className="start" onClick={onStart}>
          <span className="start-pill" aria-hidden="true" />
          Press start
          <kbd>Enter</kbd>
        </button>
      </div>
      <div className="closing-meta">
        <span>{brand.CONSOLE_NAME}</span>
        <span>Built for Monad Metropolis · Track 01</span>
        <span>Monad testnet · test tokens only</span>
        <Link to="/play">Open the console</Link>
      </div>
    </footer>
  )
}
