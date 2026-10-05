import { describe, expect, it } from 'vitest'
import { FIXTURE_MARKETS, scoredPools } from './fixtures'
import { executablePool, isExecutable } from './eligibility'
import type { ScoredPool } from './fixtures'

const TESTNET = FIXTURE_MARKETS.find(({ network }) => network === 'testnet')
const MAINNET_PASSING = scoredPools('easy').find(
  ({ network, passes }) => network === 'mainnet' && passes,
)

function testnetEntry(): ScoredPool {
  const entry = scoredPools('easy').find(({ network }) => network === 'testnet')
  if (!entry) throw new Error('missing testnet fixture')
  return entry
}

describe('what a player may execute', () => {
  it('needs a testnet market that passes the gates and has a two-sided book', () => {
    const entry = testnetEntry()
    expect(isExecutable(entry)).toBe(true)
    expect(isExecutable({ ...entry, passes: false })).toBe(false)
    expect(isExecutable({ ...entry, network: 'mainnet' })).toBe(false)
    expect(isExecutable({ ...entry, book: { bid: null, ask: 1 } })).toBe(false)
    expect(isExecutable({ ...entry, book: { bid: 1, ask: null } })).toBe(false)
  })

  it('resolves the testnet pool by id regardless of address casing', () => {
    const id = TESTNET?.pool.pairAddress ?? ''
    expect(executablePool(id, 'easy', false)?.pool.pairAddress).toBe(id)
    expect(executablePool(id.toUpperCase().replace('0X', '0x'), 'easy', false)).toBeDefined()
  })

  it('treats a passing mainnet pool reached by URL as missing', () => {
    if (!MAINNET_PASSING) throw new Error('missing passing mainnet fixture')
    expect(executablePool(MAINNET_PASSING.pool.pairAddress, 'easy', false)).toBeUndefined()
  })

  it('treats a failing mainnet pool as missing, GOD MODE included', () => {
    for (const entry of scoredPools('hard', true)) {
      if (entry.network === 'mainnet') {
        expect(executablePool(entry.pool.pairAddress, 'hard', true)).toBeUndefined()
      }
    }
  })

  it('treats an unknown or null id as missing', () => {
    expect(executablePool('0xdead', 'easy', false)).toBeUndefined()
    expect(executablePool(null, 'easy', false)).toBeUndefined()
  })
})
