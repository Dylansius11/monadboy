import type { Database } from 'bun:sqlite'
import type { Address, PublicClient } from 'viem'
import { ausdFaucetAbi, erc20Abi, nativeTransferGas } from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'
import type { WorkerEnv } from './env'
import type { Logger } from './logger'
import { createMirrorExecutor } from './chain/mirror-executor'
import { createTreasury } from './chain/treasury'
import type { Treasury } from './chain/treasury'
import { createFaucetTopup } from './jobs/faucet-topup'
import { createTreasuryMonitor } from './jobs/treasury-monitor'
import type { MirrorExecutor } from './jobs/mirror'
import { createDripService } from './routes/drip'
import type { DripChain, DripService } from './routes/drip'

export const TESTNET_CHAIN_ID = 10143
const PER_IP_DAILY = 3

export type Operations = {
  drip?: DripService
  dripStatus: { enabled: boolean; reason: string | null }
  executor?: MirrorExecutor
  execution: { enabled: boolean; reason: string | null }
  topup: ReturnType<typeof createFaucetTopup> | null
  monitor: ReturnType<typeof createTreasuryMonitor> | null
}

async function assertCode(client: PublicClient, addresses: readonly Address[]) {
  for (const address of addresses) {
    const code = await client.getCode({ address })
    if (!code || code === '0x')
      throw new Error(`Configured testnet contract has no code: ${address}`)
  }
}

// Wires every wallet-sending path. Nothing here signs unless ENABLE_TRANSACTIONS=true, the
// chain is Monad testnet, and each configured contract has bytecode. Keys never leave this scope.
export async function createOperations({
  db,
  env,
  client,
  markets,
  now = Date.now,
  logger,
}: {
  db: Database
  env: WorkerEnv
  client: PublicClient
  markets: readonly Market[]
  now?: () => number
  logger?: Logger
}): Promise<Operations> {
  const off = (
    reason: string,
  ): { enabled: boolean; reason: string | null } => ({ enabled: false, reason })
  if (!env.ENABLE_TRANSACTIONS)
    return {
      dripStatus: off('transactions-disabled'),
      execution: off('transactions-disabled'),
      topup: null,
      monitor: null,
    }
  if ((await client.getChainId()) !== TESTNET_CHAIN_ID)
    throw new Error('Signing requires Monad testnet (chain 10143)')
  const market = markets.find((entry) => entry.baseSymbol === 'MON')
  await assertCode(client, [
    env.TESTNET_AUSD_ADDRESS,
    env.TESTNET_MARGIN_ADDRESS,
    env.TESTNET_FAUCET_ADDRESS,
    ...markets.map((entry) => entry.address),
  ])

  const make = (key: `0x${string}` | undefined): Treasury | undefined =>
    key ? createTreasury({ key, rpc: env.TESTNET_RPC_URL, client }) : undefined
  const bot = make(env.BOT_PRIVATE_KEY)
  const dripper = make(env.DRIP_PRIVATE_KEY)
  const ausd = env.TESTNET_AUSD_ADDRESS

  let drip: DripService | undefined
  let dripStatus = off(dripper ? 'missing-drip-ip-salt' : 'no-drip-key')
  if (dripper && env.DRIP_IP_SALT) {
    const chain: DripChain = {
      nonce: (address) =>
        client.getTransactionCount({ address, blockTag: 'pending' }),
      balance: (address) => client.getBalance({ address }),
      supply: async () => ({
        mon: await client.getBalance({ address: dripper.account.address }),
        ausd: await client.readContract({
          address: ausd,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [dripper.account.address],
        }),
      }),
      sendMon: async (to, amount) =>
        (
          await dripper.send((nonce) =>
            dripper.wallet.sendTransaction({
              to,
              value: amount,
              gas: nativeTransferGas,
              nonce,
            }),
          )
        ).hash,
      sendAusd: async (to, amount) =>
        (
          await dripper.send((nonce) =>
            dripper.wallet.writeContract({
              address: ausd,
              abi: erc20Abi,
              functionName: 'transfer',
              args: [to, amount],
              gas: env.GAS_ERC20,
              nonce,
            }),
          )
        ).hash,
    }
    drip = createDripService({
      db,
      chain,
      logger,
      config: {
        monWei: env.DRIP_MON,
        ausdUnits: env.DRIP_AUSD,
        thresholdWei: env.DRIP_MON_THRESHOLD,
        dailyCap: env.DRIP_DAILY_CAP,
        perIpDaily: PER_IP_DAILY,
        salt: env.DRIP_IP_SALT,
      },
    })
    dripStatus = { enabled: true, reason: null }
  }

  let executor: MirrorExecutor | undefined
  let execution = off(bot ? 'no-testnet-market' : 'no-bot-key')
  if (bot && market) {
    executor = createMirrorExecutor({
      db,
      client,
      treasury: bot,
      market,
      margin: env.TESTNET_MARGIN_ADDRESS,
      gas: {
        marketOrder: env.GAS_MARKET_ORDER,
        batchUpdate: env.GAS_BATCH_UPDATE,
      },
    })
    execution = { enabled: true, reason: null }
  }

  const treasuries = [
    ...(bot ? [{ role: 'bot' as const, treasury: bot }] : []),
    ...(dripper ? [{ role: 'drip' as const, treasury: dripper }] : []),
  ]
  const topup = treasuries.length
    ? createFaucetTopup({
        wallets: treasuries.map(({ treasury }) => treasury.account.address),
        minimum: env.FAUCET_MIN_AUSD,
        now,
        logger,
        balance: (wallet) =>
          client.readContract({
            address: ausd,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [wallet],
          }),
        request: async (wallet) => {
          const { treasury } = treasuries.find(
            (entry) => entry.treasury.account.address === wallet,
          )!
          const args = {
            address: env.TESTNET_FAUCET_ADDRESS,
            abi: ausdFaucetAbi,
            functionName: 'requestFunds',
            args: [wallet],
            gas: env.GAS_FAUCET,
          } as const
          // Simulate first: a MaxFrequencyExceeded revert is then a refusal, not a mined failure.
          await client.simulateContract({ ...args, account: treasury.account })
          await treasury.send((nonce) =>
            treasury.wallet.writeContract({ ...args, nonce }),
          )
        },
      })
    : null
  const monitor = treasuries.length
    ? createTreasuryMonitor({
        logger,
        wallets: treasuries.map(({ role, treasury }) => ({
          role,
          address: treasury.account.address,
        })),
        read: async (address) => ({
          mon: await client.getBalance({ address }),
          ausd: await client.readContract({
            address: ausd,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }),
        }),
      })
    : null
  return { drip, dripStatus, executor, execution, topup, monitor }
}
