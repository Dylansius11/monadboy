import type { Database } from 'bun:sqlite'
import type { Address } from 'viem'
import { mainnetMarkets } from '@monadboy/sdk'
import { describeError, log } from '../logger'
import type { Logger } from '../logger'

export type Birth = {
  market: string
  block: number
  at: number
  exact: boolean
}
export type BirthClient = {
  getBlockNumber: () => Promise<bigint>
  getCode: (request: {
    address: Address
    blockNumber: bigint
  }) => Promise<string | undefined>
  getBlock: (request: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>
}

// A block "has code" only when the node serves that state and it shows bytecode.
// A node that no longer serves old state answers with an error; treating that as
// "no code" makes the search land on the oldest block we can prove, and `exact`
// records whether the block just before it was served and empty.
export async function findBirth(
  client: Pick<BirthClient, 'getCode'>,
  address: Address,
  head: bigint,
): Promise<{ block: bigint; exact: boolean }> {
  const served = async (
    blockNumber: bigint,
  ): Promise<'code' | 'empty' | 'unserved'> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const code = await client.getCode({ address, blockNumber })
        return code && code !== '0x' ? 'code' : 'empty'
      } catch {
        continue
      }
    }
    return 'unserved'
  }
  if ((await served(head)) !== 'code')
    throw new Error('Market has no bytecode at the head')
  let low = 0n
  let high = head
  while (low < high) {
    const middle = (low + high) / 2n
    if ((await served(middle)) === 'code') high = middle
    else low = middle + 1n
  }
  return {
    block: low,
    exact: low === 0n ? true : (await served(low - 1n)) === 'empty',
  }
}

// Resolves each market once and persists it; failures leave the market unresolved for the next run.
export function createBirthResolver({
  db,
  client,
  now = Date.now,
  logger = log,
}: {
  db: Database
  client: BirthClient
  now?: () => number
  logger?: Logger
}) {
  const read = () =>
    new Map(
      db
        .query<Omit<Birth, 'exact'> & { exact: number }, []>(
          'SELECT market, block, at, exact FROM market_births',
        )
        .all()
        .map((row): [string, Birth] => [
          row.market,
          { ...row, exact: row.exact === 1 },
        ]),
    )
  return {
    births: (): Map<string, Birth> => read(),
    resolve: async () => {
      const known = read()
      const head = await client.getBlockNumber()
      for (const market of mainnetMarkets) {
        if (known.has(market.symbol)) continue
        try {
          const { block, exact } = await findBirth(client, market.address, head)
          const stamp =
            Number((await client.getBlock({ blockNumber: block })).timestamp) *
            1000
          db.query(
            'INSERT OR REPLACE INTO market_births (market, block, at, exact) VALUES (?, ?, ?, ?)',
          ).run(market.symbol, Number(block), stamp, exact ? 1 : 0)
          logger('tracker.birth-resolved', {
            market: market.symbol,
            block: Number(block),
            exact,
            at: now(),
          })
        } catch (error) {
          logger('tracker.birth-failed', {
            market: market.symbol,
            error: describeError(error),
          })
        }
      }
    },
  }
}
