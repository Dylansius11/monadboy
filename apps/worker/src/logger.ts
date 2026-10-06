export type Logger = (event: string, fields?: Record<string, unknown>) => void

// Structured JSON, one line per event. Callers pass allowlisted operational
// fields only; use describeError for failures.
export const log: Logger = (event, fields = {}) => {
  console.log(
    JSON.stringify({ at: new Date().toISOString(), event, ...fields }),
  )
}

// RPC error messages embed the request URL, which can carry a provider key.
// Keep the error name and first line, drop anything URL-shaped, and bound it.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown-error'
  const record = error as Error & { shortMessage?: string }
  const line = (record.shortMessage ?? record.message).split('\n')[0] ?? ''
  return `${record.name}: ${line.replace(/\bhttps?:\/\/\S+/gi, '<url>')}`.slice(
    0,
    200,
  )
}

// True when the error, or anything in its cause chain, names the given
// contract error. viem wraps reverts several levels deep.
export function errorMentions(error: unknown, needle: string): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current instanceof Object && !seen.has(current)) {
    seen.add(current)
    const record = current as {
      name?: unknown
      message?: unknown
      shortMessage?: unknown
      data?: { errorName?: unknown }
      cause?: unknown
    }
    for (const value of [
      record.name,
      record.message,
      record.shortMessage,
      record.data?.errorName,
    ]) {
      if (typeof value === 'string' && value.includes(needle)) return true
    }
    current = record.cause
  }
  return false
}
