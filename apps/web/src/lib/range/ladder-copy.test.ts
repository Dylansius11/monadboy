import { describe, expect, it } from 'vitest'
import { LadderError } from '@monadboy/sdk'
import { NO_MARKET_RULES_COPY, ladderErrorCopy } from './ladder-copy'

const CODES: ReadonlyArray<LadderError['code']> = ['AMOUNT_TOO_SMALL', 'NO_PRICE', 'BAD_MANUAL_RANGE']

describe('ladder failures in player words', () => {
  it('gives every SDK code its own sentence and never the code itself', () => {
    const copies = CODES.map((code) => ladderErrorCopy(new LadderError(code)))
    expect(new Set(copies).size).toBe(CODES.length)
    for (const [index, copy] of copies.entries()) {
      expect(copy).not.toContain(CODES[index])
      expect(copy).not.toMatch(/_/)
    }
  })

  it('uses the SPEC sentence for an amount too small', () => {
    expect(ladderErrorCopy(new LadderError('AMOUNT_TOO_SMALL'))).toBe('AMOUNT TOO SMALL FOR THIS RANGE')
  })

  it('does not share its sentence with a missing market rule', () => {
    expect(CODES.map((code) => ladderErrorCopy(new LadderError(code)))).not.toContain(NO_MARKET_RULES_COPY)
  })
})
