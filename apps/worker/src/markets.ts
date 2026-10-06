import { readFileSync } from 'node:fs'
import { z } from 'zod'
import type { Address } from 'viem'
import { testnetMarkets } from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value as Address)
const units = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => BigInt(value))
const decimals = z.number().int().min(0).max(255)
const schema = z.array(
  z.object({
    chain: z.literal('testnet'),
    address,
    symbol: z.string().min(1),
    baseSymbol: z.string().min(1),
    quoteSymbol: z.string().min(1),
    baseToken: address,
    quoteToken: address,
    params: z.object({
      pricePrecision: units,
      sizePrecision: units,
      tickSize: units,
      minSize: units,
      maxSize: units,
      baseDecimals: decimals,
      quoteDecimals: decimals,
      takerFeeBps: z.number().nonnegative(),
      makerFeeBps: z.number().nonnegative(),
    }),
  }),
)

// Deployed testnet markets: the SDK manifest, or the file named by MARKETS_JSON (same shape, bigint fields as decimal strings).
export function loadTestnetMarkets(path?: string): readonly Market[] {
  return path
    ? schema.parse(JSON.parse(readFileSync(path, 'utf8')))
    : testnetMarkets
}
