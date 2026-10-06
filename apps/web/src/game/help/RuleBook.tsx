import { useEffect, useId, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useConsoleInputLock } from '../../console/useConsoleInput'
import { TOPICS, guideForRoute, keyMapRows } from './guides'
import './help.css'

/**
 * The rule book: a `?` button and a native modal dialog with the guide for the
 * screen the player is on, the laptop key map, and what TESTNET, FIXTURE,
 * SCORE and DAMAGE mean.
 *
 * Self-selecting: the guide follows the deepest matched route, so a screen
 * never has to register itself. Mounted inside the console's input provider
 * (it locks input while open) and inside the router, which the console shell
 * route already is.
 *
 * While open nothing reaches the game: the console input is locked, so no
 * keyboard, touch or gamepad press can advance a run or confirm a trade
 * behind the dialog. The native dialog supplies the focus trap, Escape to
 * close, and focus restoration.
 */

/** `?` and H toggle the book, except while the player is typing. */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
    ) !== null
  )
}

export function RuleBook() {
  const routeId = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId,
  })
  const guide = guideForRoute(routeId)

  const [open, setOpen] = useState(false)
  useConsoleInputLock(open)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const screenId = useId()
  const keysId = useId()

  // Keep React's input lock in step with the native dialog. Escape announces
  // cancellation before closing, so reconcile the lock in that transition
  // rather than waiting for the queued close event.
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
  }, [open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key !== '?' && e.key.toLowerCase() !== 'h') return
      if (isEditable(e.target)) return
      e.preventDefault()
      setOpen((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <button
        type="button"
        className="rulebook-trigger"
        aria-label="Open the rule book"
        aria-haspopup="dialog"
        aria-keyshortcuts="? H"
        onClick={() => setOpen(true)}
        // Enter and Space on this button must open the book, not also press
        // START or A on the screen underneath: the console listens on window.
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
        }}
      >
        ?
      </button>

      <dialog
        ref={dialogRef}
        className="rulebook"
        aria-labelledby={`${titleId} ${screenId}`}
        onCancel={(e) => {
          e.preventDefault()
          setOpen(false)
        }}
        onClose={() => {
          setOpen(false)
          const opener = openerRef.current
          openerRef.current = null
          if (opener?.isConnected) opener.focus()
        }}
        // Only a click on the backdrop lands on the dialog itself: the panel
        // fills it edge to edge.
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

            <div className="rulebook-body">
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

              {guide.topics.map((id) => (
                <section key={id} className="rulebook-topic">
                  <h3>{TOPICS[id].heading}</h3>
                  {TOPICS[id].lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </section>
              ))}

              <section className="rulebook-topic">
                <h3 id={keysId}>Keys</h3>
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
                  On a touch screen use the on-screen buttons. H or ? opens and
                  closes this book. Escape is B, but while this book is open it
                  closes the book.
                </p>
                <p>
                  SELECT fires when Shift is released, and not at all when Shift
                  is part of a combination such as Shift and / for ?. While the
                  book is open no button reaches the game.
                </p>
              </section>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
