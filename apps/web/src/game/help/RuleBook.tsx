import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useRouterState } from '@tanstack/react-router'
import { useConsoleInputLock } from '../../console/useConsoleInput'
import { TOPICS, guideForRoute, keyMapRows } from './guides'
import './help.css'

/** H and ? toggle the book, except while the player is typing. */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
    ) !== null
  )
}

const SECTIONS = [
  ['screen', 'This screen'],
  ['play', 'How to play'],
  ['controls', 'Controls'],
] as const

type GuideSection = (typeof SECTIONS)[number][0]

/** The same query console/portrait.css switches the native phone shell on. */
const PHONE_PORTRAIT = '(max-width: 640px) and (orientation: portrait)'

/** Partial: jsdom has no matchMedia, and test stubs may omit the listeners. */
function phonePortrait(): Partial<MediaQueryList> | undefined {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(PHONE_PORTRAIT)
    : undefined
}

function subscribePhonePortrait(onChange: () => void) {
  const query = phonePortrait()
  query?.addEventListener?.('change', onChange)
  return () => query?.removeEventListener?.('change', onChange)
}

/** Native modal focus and input isolation, with viewport-sized chrome. */
export function RuleBook() {
  const routeId = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId,
  })
  const guide = guideForRoute(routeId)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  // On a phone the launcher docks in the shell's control row beside the
  // volume slider instead of taking a lane of its own above the screen.
  // Elsewhere the shell is scaled, so the launcher escapes it through the
  // portal and keeps its real size.
  const docked = useSyncExternalStore(
    subscribePhonePortrait,
    () => phonePortrait()?.matches ?? false,
    () => false,
  )
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<GuideSection>('screen')
  useConsoleInputLock(open)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const screenId = useId()
  const contentId = useId()
  const keysId = useId()

  // A portal escapes the scaled shell without losing its React input context.
  // Wait for hydration so server and first client render agree.
  useEffect(() => setPortalTarget(document.body), [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, portalTarget])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key !== '?' && e.key.toLowerCase() !== 'h') return
      if (isEditable(e.target)) return
      e.preventDefault()
      setSection('screen')
      setOpen((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!portalTarget) return null

  const trigger = (
    <button
      type="button"
      className={docked ? 'rulebook-trigger is-docked' : 'rulebook-trigger'}
      aria-label="Open the rule book"
      aria-haspopup="dialog"
      aria-keyshortcuts="? H"
      onClick={() => {
        setSection('screen')
        setOpen(true)
      }}
      // The console listens on window; opening must not also press START/A.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5C9 3 5 3 3 4V19C6 18 9 18 12 20C15 18 18 18 21 19V4C19 3 15 3 12 5ZM12 5V20" />
      </svg>
      <span className="rulebook-label-desktop">Rule book</span>
      <span className="rulebook-label-phone">Guide</span>
    </button>
  )

  const book = createPortal(
    <>
      {docked ? null : trigger}

      <dialog
        ref={dialogRef}
        className="rulebook"
        aria-labelledby={`${titleId} ${screenId}`}
        onCancel={(e) => {
          // Release the React input lock in the cancellation transition.
          e.preventDefault()
          setOpen(false)
        }}
        onClose={() => {
          setOpen(false)
          const opener = openerRef.current
          openerRef.current = null
          if (opener?.isConnected) opener.focus()
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false)
        }}
      >
        {open ? (
          <div className="rulebook-panel">
            <header className="rulebook-header">
              <div className="rulebook-heading">
                <h2 id={titleId} className="rulebook-title">
                  Rule book
                </h2>
                <p id={screenId} className="rulebook-screen">
                  {guide.title}
                </p>
              </div>
              <span className="rulebook-tag">TESTNET</span>
              <button
                type="button"
                className="rulebook-close"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </header>

            <div
              className="rulebook-sections"
              role="group"
              aria-label="Guide sections"
            >
              {SECTIONS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="rulebook-section-button"
                  aria-pressed={section === id}
                  aria-controls={contentId}
                  onClick={() => setSection(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div id={contentId} className="rulebook-body">
              {section === 'screen' ? (
                <>
                  <p>{guide.summary}</p>
                  {guide.keys.length > 0 ? (
                    <dl className="rulebook-keys">
                      {guide.keys.map(([button, effect]) => (
                        <div key={button} className="rulebook-key">
                          <dt>{button}</dt>
                          <dd>{effect}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {guide.notes.length > 0 ? (
                    <ul className="rulebook-notes">
                      {guide.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : section === 'play' ? (
                guide.topics.map((id) => (
                  <section key={id} className="rulebook-topic">
                    <h3>{TOPICS[id].heading}</h3>
                    {TOPICS[id].lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </section>
                ))
              ) : (
                <section className="rulebook-topic">
                  <h3 id={keysId}>Keyboard and gamepad</h3>
                  <table className="rulebook-map" aria-labelledby={keysId}>
                    <thead>
                      <tr>
                        <th scope="col">Button</th>
                        <th scope="col">Keyboard</th>
                        <th scope="col">Gamepad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keyMapRows().map((row) => (
                        <tr key={row.intent}>
                          <th scope="row">{row.button}</th>
                          <td>{row.keyboard.join(', ')}</td>
                          <td>{row.gamepad.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    On a phone, use the on-screen buttons. The strip along the
                    bottom of each screen names what A, B, SELECT and START do
                    there; tapping a hint presses that button. H or ? toggles
                    this guide; Escape closes it. No console input reaches the
                    game while it is open.
                  </p>
                  <p>
                    SELECT fires when Shift is released, unless it was part of a
                    combination such as Shift + / for ?.
                  </p>
                  <p>
                    M mutes or restores sound. The volume slider controls music
                    and effects together; adjusting it clears mute, and zero
                    stays silent.
                  </p>
                </section>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </>,
    portalTarget,
  )
  return docked ? (
    <>
      {trigger}
      {book}
    </>
  ) : (
    book
  )
}
