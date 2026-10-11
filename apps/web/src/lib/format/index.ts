/**
 * Numbers, as a beginner reads them.
 *
 * PURE. Intl does the arithmetic; this file only fixes the locale so the
 * server render and the client render produce the same string. A number that
 * hydrates differently than it rendered is a flash of wrong money on the one
 * screen that must never look wrong.
 *
 * The Value primitive owns SIGNED numbers, colour, and tabular alignment. These
 * are for the strings around them: labels, axis ticks, and prices.
 */

const LOCALE = 'en-US'

const USD = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const USD_COMPACT = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 0,
})

const USD_FINE = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

/** `$412.00`. For amounts a user typed or will hold. */
export function usd(amount: number): string {
  return USD.format(amount)
}

/** `$0.0205`. Cents, plus up to two more places for a per-tick accrual. */
export function usdFine(amount: number): string {
  return USD_FINE.format(amount)
}

/** Most places a tiny score or damage may show; wider would not fit a half-width cell. */
const TINY_MAX_DECIMALS = 5

/**
 * Decimals for a group of money figures shown side by side (SCORE, DAMAGE,
 * NET). One count for the whole group, so the figures always read at the same
 * precision.
 *
 * A testnet run earns fractions of a cent, so two decimals would read as $0.00
 * for a real, nonzero amount. The rule: cents at or above one dollar, otherwise
 * two significant digits of the smallest nonzero figure, never more than
 * `TINY_MAX_DECIMALS`. Zero and dust below that precision stay at cents, so a
 * figure never prints a string of zeros that implies a measurement.
 */
export function usdDecimals(...amounts: ReadonlyArray<number>): number {
  let decimals = 2
  for (const amount of amounts) {
    const size = Math.abs(amount)
    if (!Number.isFinite(size) || size < 0.5 * 10 ** -TINY_MAX_DECIMALS || size >= 0.1) continue
    const needed = -Math.floor(Math.log10(size)) + 1
    decimals = Math.max(decimals, Math.min(TINY_MAX_DECIMALS, needed))
  }
  return decimals
}

/** `$412K`. For pool-sized numbers, which never need the cents. */
export function compactUsd(amount: number): string {
  return USD_COMPACT.format(amount)
}

/** `18.2%`. Takes a percentage, not a fraction. */
export function pct(percentage: number, decimals = 1): string {
  return `${percentage.toFixed(decimals)}%`
}

/**
 * `0.0412`. Four significant figures, trailing zeros dropped.
 *
 * A pair price can be 0.00004123 or 4123, and a fixed decimal count is
 * unreadable at one end and wrong at the other.
 */
export function price(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(Number(value.toPrecision(4)))
}

/**
 * `3h 12m`, `12m 04s`, `41d`.
 *
 * Two units, never three. Anything more is a stopwatch, and this is a label.
 */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const days = Math.floor(s / 86_400)
  const hours = Math.floor((s % 86_400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m ${String(s % 60).padStart(2, '0')}s`
}

/**
 * `41 days`, and below one day it falls through to hours.
 *
 * Sub-day thresholds fall through to hours and minutes rather than displaying
 * "0 days". The name stays day-oriented for market-age labels.
 */
export function ageInDays(seconds: number): string {
  const s = Math.max(0, seconds)
  const days = Math.floor(s / 86_400)
  if (days > 0) return days === 1 ? '1 day' : `${days} days`

  const hours = Math.floor(s / 3_600)
  if (hours > 0) return hours === 1 ? '1 hour' : `${hours} hours`

  const minutes = Math.floor(s / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
