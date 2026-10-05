import type { LadderError } from '@monadboy/sdk'

/** Shown when no market rules exist for the pair, so no ladder can be sized. */
export const NO_MARKET_RULES_COPY = 'NO MARKET RULES FOR THIS POOL YET'

const COPY_BY_CODE: Record<LadderError['code'], string> = {
  AMOUNT_TOO_SMALL: 'AMOUNT TOO SMALL FOR THIS RANGE',
  NO_PRICE: 'NO PRICE FOR THIS POOL YET',
  BAD_MANUAL_RANGE: 'YOUR RANGE MUST SIT AROUND THE CURRENT PRICE',
}

/** The one place an SDK ladder failure becomes a sentence a player reads. */
export function ladderErrorCopy(failure: LadderError): string {
  return COPY_BY_CODE[failure.code]
}
