import { z } from 'zod'
import { parseUnits } from 'viem'
import type { Address, Hex } from 'viem'
import { rpcUrl } from '@monadboy/sdk'

const optional = <T extends z.ZodType>(schema: T) => schema.optional()
const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value as Address)
const key = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .transform((value) => value as Hex)
const gas = (fallback: bigint) => z.coerce.bigint().positive().default(fallback)
const decimal = (decimals: number, fallback: string) =>
  z
    .string()
    .regex(new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`))
    .default(fallback)
    .transform((value) => parseUnits(value, decimals))

// [V] Testnet addresses below each have non-empty code (cast code, 2026-10-05); see docs/technical/SMART-CONTRACTS.md.
const schema = z
  .object({
    WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    WORKER_BIND: z.string().min(1).default('127.0.0.1'),
    APP_ORIGIN: z.url().default('http://localhost:3000'),
    TESTNET_RPC_URL: z.url().default(rpcUrl('testnet', {})),
    MAINNET_RPC_URL: z.url().default(rpcUrl('mainnet', {})),
    BOT_PRIVATE_KEY: optional(key),
    DRIP_PRIVATE_KEY: optional(key),
    SQLITE_PATH: z.string().min(1).default('worker.sqlite'),
    ENVIO_GRAPHQL_URL: optional(z.url()),
    MARKETS_JSON: optional(z.string().min(1)),
    HYPERSYNC_API_TOKEN: optional(z.string().min(1)),
    HYPERSYNC_URL: z.url().default('https://monad.hypersync.xyz'),
    TRACKER_LOG_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
    ENABLE_TRANSACTIONS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // Notional is quote units (USD) per mirror tick; deviation is a fraction of the target mid.
    MIRROR_MAX_STEP_NOTIONAL: z.coerce.number().positive().default(1),
    MIRROR_DEVIATION_THRESHOLD: z.coerce.number().positive().default(0.0005),
    // [U, S2] Conservative explicit gas limits until spike S2 measures receipts. Monad charges the limit.
    GAS_MARKET_ORDER: gas(1_000_000n),
    GAS_BATCH_UPDATE: gas(1_000_000n),
    GAS_ERC20: gas(100_000n),
    GAS_FAUCET: gas(200_000n),
    DRIP_MON: decimal(18, '0.5'),
    DRIP_AUSD: decimal(6, '10'),
    DRIP_MON_THRESHOLD: decimal(18, '0.01'),
    DRIP_DAILY_CAP: z.coerce.number().int().positive().default(20),
    DRIP_IP_SALT: optional(z.string().min(32)),
    FAUCET_MIN_AUSD: decimal(6, '100'),
    TREASURY_MIN_MON: decimal(18, '1'),
    TREASURY_MIN_AUSD: decimal(6, '10'),
    TESTNET_START_BLOCK: optional(z.coerce.bigint().nonnegative()),
    TESTNET_MARGIN_ADDRESS: address.default(
      '0xd029C2D98ff85D8F64799017fE00a59B1159CE02',
    ),
    TESTNET_AUSD_ADDRESS: address.default(
      '0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC',
    ),
    TESTNET_FAUCET_ADDRESS: address.default(
      '0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C',
    ),
    TESTNET_REGISTRY_ADDRESS: optional(address),
  })
  .refine(
    (value) =>
      !value.BOT_PRIVATE_KEY ||
      !value.DRIP_PRIVATE_KEY ||
      value.BOT_PRIVATE_KEY.toLowerCase() !==
        value.DRIP_PRIVATE_KEY.toLowerCase(),
    {
      message: 'BOT_PRIVATE_KEY and DRIP_PRIVATE_KEY must differ',
    },
  )

export type WorkerEnv = z.infer<typeof schema>

export function parseEnv(input: Record<string, string | undefined>): WorkerEnv {
  // A blank line in .env (copied from .env.example) means unset, for every variable.
  return schema.parse(
    Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== ''),
    ),
  )
}
