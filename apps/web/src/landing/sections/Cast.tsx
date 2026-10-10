import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { gatesFor, mainnetProfile } from '@monadboy/sdk'
import { Sprite } from '../../ui'
import { characterQuotes, characters } from '../../config/brand'
import { ageInDays, compactUsd } from '../../lib/format'
import type { CharacterId } from '../../config/brand'
import type { Difficulty } from '../../types/domain'
import './cast.css'

/**
 * The cast as a character select. The Monanimal is the difficulty, and the
 * difficulty is only a market filter: every number in the panel is read from
 * the same SDK gates the S4 screen reads, so the page cannot drift from the
 * game. The ladder math takes no difficulty input at all.
 */
const ORDER: ReadonlyArray<CharacterId> = ['molandak', 'moyaki', 'mouch']

/** The PRD binds each Monanimal to one tier; S4 keeps the same fixed table. */
const TIER: Record<CharacterId, Difficulty> = {
  molandak: 'easy',
  moyaki: 'normal',
  mouch: 'hard',
}

/** One frame of the jump per 120ms step, then a beat of joy before idling. */
const JUMP_MS = 360
const HAPPY_MS = 1400
const TYPE_MS = 45
const AUTO_MS = 6000
const SEGMENTS = 10

type Pose = 'jump' | 'happy' | 'idle'

export function Cast() {
  const reduced = useReducedMotion() ?? false
  const section = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<CharacterId>('molandak')
  const [pose, setPose] = useState<Pose>('idle')
  const [hop, setHop] = useState(0)
  const [typed, setTyped] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [touched, setTouched] = useState(false)
  const [inView, setInView] = useState(false)

  const quote = characterQuotes[selected]
  const gates = gatesFor(TIER[selected], mainnetProfile)
  const doneTyping = typed >= quote.length
  const index = ORDER.indexOf(selected)
  const prev = ORDER[(index + ORDER.length - 1) % ORDER.length]
  const next = ORDER[(index + 1) % ORDER.length]

  function choose(id: CharacterId, byPlayer: boolean) {
    setSelected(id)
    setHop((n) => n + 1)
    setTyped(reduced ? characterQuotes[id].length : 0)
    setPose(reduced ? 'happy' : 'jump')
    if (byPlayer) setTouched(true)
  }

  // Arrows belong to this section only while the player is in it: focus
  // inside, or the pointer over it. Enter stays with the page's PRESS START.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const root = section.current
      if (!root) return
      const owner = document.activeElement
      const inside = owner !== null && root.contains(owner)
      if (!inside && !hovering) return
      if (!inside && owner?.matches('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      const target = event.key === 'ArrowRight' ? next : prev
      choose(target, true)
      if (owner instanceof HTMLElement && owner.dataset.cast) {
        root.querySelector<HTMLElement>(`[data-cast="${target}"]`)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hovering, selected, reduced])

  useEffect(() => {
    const root = section.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.45,
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (pose === 'idle') return
    const t = window.setTimeout(() => setPose(pose === 'jump' ? 'happy' : 'idle'), pose === 'jump' ? JUMP_MS : HAPPY_MS)
    return () => window.clearTimeout(t)
  }, [pose, hop])

  // Reduced motion prints the line whole. Set after mount rather than at
  // render so the server markup and the first client render agree.
  useEffect(() => {
    if (reduced) setTyped(Number.MAX_SAFE_INTEGER)
  }, [reduced])

  useEffect(() => {
    if (doneTyping || !inView) return
    const t = window.setInterval(() => setTyped((n) => n + 1), TYPE_MS)
    return () => window.clearInterval(t)
  }, [doneTyping, inView, hop])

  // The attract loop: it rotates the roster for a visitor who only scrolls,
  // pauses under the pointer or focus, and ends for good at the first choice.
  useEffect(() => {
    if (reduced || touched || !inView || hovering || engaged) return
    const t = window.setTimeout(() => choose(next, false), AUTO_MS)
    return () => window.clearTimeout(t)
  }, [reduced, touched, inView, hovering, engaged, selected])

  // SAFETY and HEAT are both scored 0 to 100, so each meter lights the band a
  // pool's score must land in: a floor fills to the right, a ceiling from the
  // left. Depth, age and pairs have no shared scale, so they stay plain rows.
  const rows: Array<{ label: string; value: string; band?: [number, number] }> = [
    { label: 'Pools deeper than', value: compactUsd(gates.minTvlUsd) },
    { label: 'Older than', value: ageInDays(gates.minAgeSeconds) },
    { label: 'Paired with', value: gates.allowedQuoteSymbols.join(', ') },
    { label: 'Safety at least', value: `${gates.minSafety}`, band: [gates.minSafety, 100] },
    { label: 'Calmer than', value: `${gates.maxHeat} heat`, band: [gates.minHeat, gates.maxHeat] },
    { label: 'Honeypot check', value: 'always on' },
  ]

  return (
    <section
      ref={section}
      id="cast"
      className="cast-select"
      aria-labelledby="cast-title"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={() => setEngaged(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setEngaged(false)
      }}
    >
      <h2 id="cast-title" className="heading">
        Pick who rides with you
      </h2>
      <p className="cast-lede">
        Same math for all three. Your Monanimal only decides which markets you may play.
      </p>

      <div className="cast-body">
        <div className="cast-arena">
          <button
            type="button"
            className="cast-step cast-step-prev"
            aria-label={`Previous: ${characters[prev].label}`}
            onClick={() => choose(prev, true)}
          >
            <span className="cast-step-glyph" aria-hidden="true" />
          </button>

          <div className="cast-solo" aria-hidden="true">
            <span key={`solo-${hop}`} className={`cast-hop ${pose === 'jump' ? 'is-jumping' : ''}`}>
              <Sprite character={selected} animation={pose} scale={3} />
            </span>
            <span className="cast-cursor">
              <span className="cast-cursor-tag">1P</span>
              <span />
              <span />
              <span />
              <span />
            </span>
            <span className="cast-plinth is-selected">
              <span className="cast-plate">{characters[selected].label}</span>
            </span>
          </div>

          <button
            type="button"
            className="cast-step cast-step-next"
            aria-label={`Next: ${characters[next].label}`}
            onClick={() => choose(next, true)}
          >
            <span className="cast-step-glyph" aria-hidden="true" />
          </button>

          <div className="cast-lineup" role="group" aria-label="Monanimals">
            {ORDER.map((id) => {
              const on = id === selected
              const slot = on ? 'is-centre' : id === prev ? 'is-left' : 'is-right'
              return (
                <button
                  key={id}
                  type="button"
                  data-cast={id}
                  className={`cast-pick ${slot} ${on ? 'is-selected' : ''}`}
                  aria-pressed={on}
                  aria-label={`${characters[id].label}, ${characters[id].tier}`}
                  onClick={() => choose(id, true)}
                >
                  <span className="cast-figure" aria-hidden="true">
                    {on ? <span className="cast-light" /> : null}
                    <span key={on ? `pick-${hop}` : 'rest'} className={`cast-hop ${on && pose === 'jump' ? 'is-jumping' : ''}`}>
                      <Sprite character={id} animation={on ? pose : 'idle'} scale={on ? 3 : 2} className="cast-big" />
                      <Sprite character={id} size={32} className="cast-mini" />
                    </span>
                    {on ? (
                      <span className="cast-cursor">
                        <span className="cast-cursor-tag">1P</span>
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : null}
                  </span>
                  <span className={`cast-plinth ${on ? 'is-selected' : ''}`} aria-hidden="true">
                    <span className="cast-plate">{characters[id].label}</span>
                  </span>
                  <span className="cast-pick-tier" aria-hidden="true">
                    {characters[id].tier}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="cast-hint" aria-hidden="true">
            {'◄ ►'} choose
          </p>
        </div>

        <div className="cast-bezel">
          <div className="cast-lcd" data-testid="cast-panel">
            <div className="cast-lcd-head">
              <p className="cast-lcd-name">{characters[selected].label}</p>
              <p className="cast-chip">{characters[selected].tier}</p>
            </div>

            <div className="cast-bubble">
              <span className="cast-portrait" aria-hidden="true">
                <Sprite character={selected} animation="happy" size={32} />
              </span>
              <p className="cast-bubble-line">
                <span className="cast-sr">{quote}</span>
                <span className="cast-bubble-text" aria-hidden="true">
                  <span className="cast-bubble-ghost">{quote}</span>
                  <span className="cast-bubble-typed">
                    {doneTyping ? quote : quote.slice(0, typed)}
                    {doneTyping ? null : <span className="cast-caret" />}
                  </span>
                </span>
              </p>
            </div>

            <p className="cast-lcd-label">Markets it lets you play</p>
            <dl className="cast-rows">
              {rows.map((row) => (
                <div key={row.label} className="cast-row-item">
                  <dt>{row.label}</dt>
                  <dd>
                    {row.band === undefined ? null : (
                      <span className="cast-meter" aria-hidden="true">
                        {Array.from({ length: SEGMENTS }, (_, i) => {
                          const [low, high] = row.band ?? [0, 0]
                          const lit = i >= Math.round((low / 100) * SEGMENTS) && i < Math.round((high / 100) * SEGMENTS)
                          return <span key={i} className={lit ? 'is-on' : ''} />
                        })}
                      </span>
                    )}
                    <span className="cast-value">{row.value}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <p className={`cast-god ${TIER[selected] === 'hard' ? 'is-open' : ''}`}>
              {TIER[selected] === 'hard'
                ? 'GOD MODE unlocks here: it drops every filter above except the honeypot check.'
                : 'GOD MODE: HARD only.'}
            </p>
            <p className="cast-source">Read from the game's own SDK gates, mainnet profile. Testnet play only.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
