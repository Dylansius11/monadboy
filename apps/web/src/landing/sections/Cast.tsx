import { useState } from 'react'
import { Sprite } from '../../ui'
import { characterQuotes, characters } from '../../config/brand'
import type { CharacterId } from '../../config/brand'

/**
 * The cast as a character select. Difficulty picks the Monanimal; the
 * Monanimal never changes the arithmetic, so each one is introduced by the
 * markets it likes, in its own words.
 */
const ORDER: ReadonlyArray<CharacterId> = ['molandak', 'moyaki', 'mouch']

export function Cast() {
  const [focus, setFocus] = useState<CharacterId | null>(null)
  return (
    <section className="cast" aria-labelledby="cast-title">
      <h2 id="cast-title" className="heading">
        Pick who rides with you
      </h2>
      <ul className="cast-row">
        {ORDER.map((id) => (
          <li
            key={id}
            className="cast-member"
            tabIndex={0}
            onMouseEnter={() => setFocus(id)}
            onMouseLeave={() => setFocus(null)}
            onFocus={() => setFocus(id)}
            onBlur={() => setFocus(null)}
          >
            <div className="cast-stage">
              <Sprite character={id} animation={focus === id ? 'happy' : 'idle'} scale={3} />
            </div>
            <p className="cast-name">{characters[id].label}</p>
            <p className="cast-tier">{characters[id].tier}</p>
            <p className="cast-quote">“{characterQuotes[id]}”</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
