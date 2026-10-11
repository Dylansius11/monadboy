/**
 * What slice of price the field shows.
 *
 * PURE, and separate from the drawing because it is the one decision on S7
 * that is easy to get subtly wrong and impossible to see in a screenshot until
 * it is very wrong.
 *
 * The rule: both range edges and the whole sampled series are always inside
 * the window, with padding. The player's only question is "where am I against
 * my edges", and a window that drops an edge cannot answer it. That is exactly
 * when it matters most: price has left the range and the player needs to see
 * how far away the band is and in which direction.
 *
 * The cost is a thinner band while price is far outside. That is the honest
 * picture: the band IS small next to the distance price has travelled. The
 * field keeps the band readable with its own minimum-gap edge labels rather
 * than by cutting an edge out of the domain.
 */

/** Breathing room so the line and edges never run along the box border. */
const PAD_FRACTION = 0.12

export function yDomain(
  series: ReadonlyArray<number>,
  lowerPrice: number,
  upperPrice: number,
): { low: number; high: number } {
  const edgeLow = Math.min(lowerPrice, upperPrice)
  const edgeHigh = Math.max(lowerPrice, upperPrice)
  const low = series.length ? Math.min(edgeLow, ...series) : edgeLow
  const high = series.length ? Math.max(edgeHigh, ...series) : edgeHigh

  // A flat series inside a zero-width range has zero span and would divide by
  // zero downstream.
  const span = high - low || Math.abs(high) * 0.01 || 1
  const pad = span * PAD_FRACTION

  return { low: low - pad, high: high + pad }
}
