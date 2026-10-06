import { brand } from '../../config/brand'

/**
 * The honesty section. Every line here is a product rule from SPEC, stated
 * once, with the one external claim linked to its source.
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

export function WhatIsReal() {
  return (
    <section id="real" className="real" aria-labelledby="real-title">
      <h2 id="real-title" className="heading">
        What is real
      </h2>
      <dl className="facts">
        {FACTS.map((f) => (
          <div key={f.term} className="fact">
            <dt>{f.term}</dt>
            <dd>{f.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
