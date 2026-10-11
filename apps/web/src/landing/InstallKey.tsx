import { useEffect, useId, useState } from 'react'
import { promptInstall, useInstallOffer } from '../pwa/install'

/**
 * A small key under the hero's START: install the console as an app. Chromium
 * opens its own install dialog; iOS has none, so the key shows the two taps
 * instead. Running as the app, or once installed, the key is gone.
 *
 * It lives on the landing rather than in the console so it never takes a row
 * from the game screen on a phone.
 */
export function InstallKey() {
  const offer = useInstallOffer()
  const [hint, setHint] = useState(false)
  const hintId = useId()

  useEffect(() => {
    if (!hint) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHint(false)
    }
    const onAway = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('.install'))) setHint(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onAway)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onAway)
    }
  }, [hint])

  if (offer === 'none') return null

  return (
    <span className="install">
      <button
        type="button"
        className="install-key"
        onClick={() => (offer === 'prompt' ? void promptInstall() : setHint((open) => !open))}
        aria-expanded={offer === 'ios' ? hint : undefined}
        aria-controls={offer === 'ios' ? hintId : undefined}
      >
        <svg className="install-glyph" width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
          <rect x="4" y="0" width="2" height="6" />
          <rect x="2" y="4" width="6" height="2" />
          <rect x="4" y="6" width="2" height="2" />
          <rect x="0" y="10" width="10" height="2" />
        </svg>
        Install app
      </button>
      {offer === 'ios' ? (
        <span id={hintId} className="install-hint" role="status" hidden={!hint}>
          Tap Share, then Add to Home Screen
        </span>
      ) : null}
    </span>
  )
}
