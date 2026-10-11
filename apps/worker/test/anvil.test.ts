import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { parseEther, zeroAddress } from 'viem'
import type { Address } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  erc20Abi,
  testnetMarkets,
} from '@monadboy/sdk'
import type { Market } from '@monadboy/sdk'
import { createTransferProbe } from '../src/chain/transfer-check'
import { parseEnv } from '../src/env'
import { createMidState } from '../src/jobs/mid-sampler'
import { createMirrorJob, createMirrorState } from '../src/jobs/mirror'
import { createOperations } from '../src/operations'
import type { Operations } from '../src/operations'
import { hasAnvil, startAnvil } from './anvil'
import { memoryDb, quiet } from './helpers'

// Local evidence only: a throwaway anvil chain with stand-in contracts (see fixtures/LocalChain.sol).
// It proves the worker's signing, nonce, spacing, explicit-gas and ledger paths; it says nothing
// about Kuru matching semantics or Monad behaviour. Skipped when anvil is not installed.
type Local = Awaited<ReturnType<typeof startAnvil>>
describe.skipIf(!hasAnvil)(
  'worker transaction paths on a local anvil chain',
  () => {
    let chain: Local
    let ops: Operations
    let ausd: Address, faucet: Address, margin: Address, book: Address
    let market: Market
    let clock = 0
    const db = memoryDb()
    const botKey = generatePrivateKey()
    const dripKey = generatePrivateKey()
    const bot = privateKeyToAccount(botKey)
    const dripper = privateKeyToAccount(dripKey)

    const balanceOf = (token: Address, owner: Address) =>
      chain.client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [owner],
      })
    const nonceOf = (owner: Address) =>
      chain.client.getTransactionCount({ address: owner })
    const read = <T>(
      address: Address,
      name: string,
      functionName: string,
      args: unknown[] = [],
    ) =>
      chain.client.readContract({
        address,
        abi: chain.abi(name),
        functionName,
        args,
      }) as Promise<T>

    beforeAll(async () => {
      chain = await startAnvil()
      ausd = await chain.deploy('MockToken', [false])
      faucet = await chain.deploy('MockFaucet', [ausd])
      margin = await chain.deploy('MockMargin')
      book = await chain.deploy('MockBook')
      await chain.write(ausd, 'MockToken', 'transfer', [
        faucet,
        500_000n * 10n ** 6n,
      ])
      await chain.write(ausd, 'MockToken', 'transfer', [
        dripper.address,
        1000n * 10n ** 6n,
      ])
      for (const account of [bot, dripper])
        await chain.setBalance(account.address, parseEther('100'))
      market = {
        ...testnetMarkets.find((m) => m.symbol === 'MON_AUSD')!,
        chain: 'testnet',
        symbol: 'MON_AUSD',
        quoteSymbol: 'AUSD',
        address: book,
        quoteToken: ausd,
        params: {
          ...testnetMarkets.find((m) => m.symbol === 'MON_AUSD')!.params,
          minSize: 1_000_000n, maxSize: 10n ** 22n, takerFeeBps: 0,
        },
      }
      const env = parseEnv({
        ENABLE_TRANSACTIONS: 'true',
        TESTNET_RPC_URL: chain.url,
        BOT_PRIVATE_KEY: botKey,
        DRIP_PRIVATE_KEY: dripKey,
        DRIP_IP_SALT: 'local-anvil-only-salt-32-characters!!',
        TESTNET_AUSD_ADDRESS: ausd,
        TESTNET_MARGIN_ADDRESS: margin,
        TESTNET_FAUCET_ADDRESS: faucet,
        FAUCET_MIN_AUSD: '20000',
        DRIP_MON: '0.5',
        DRIP_AUSD: '10',
      })
      ops = await createOperations({
        db,
        env,
        client: chain.client,
        markets: [market],
        now: () => clock,
        logger: quiet,
      })
    }, 60_000)
    afterAll(() => chain.stop())

    test('drip sends MON then AUSD at least three blocks apart, records both receipts, and refuses a repeat', async () => {
      const disk = privateKeyToAccount(generatePrivateKey()).address
      const result = await ops.drip!.request(disk, '203.0.113.7')
      expect(result.status).toBe('sent')
      const [mon, usd] = await Promise.all([
        chain.client.getTransactionReceipt({ hash: result.monTx! }),
        chain.client.getTransactionReceipt({ hash: result.ausdTx! }),
      ])
      expect([mon.status, usd.status]).toEqual(['success', 'success'])
      expect(usd.blockNumber - mon.blockNumber).toBeGreaterThanOrEqual(3n)
      expect(await chain.client.getBalance({ address: disk })).toBe(
        parseEther('0.5'),
      )
      expect(await balanceOf(ausd, disk)).toBe(10_000_000n)
      expect(await ops.drip!.request(disk, '203.0.113.7')).toEqual({
        status: 'already-funded',
      })
      expect(
        db
          .query(
            'SELECT status, mon_tx, ausd_tx FROM drips WHERE address = ? ORDER BY id',
          )
          .all(disk.toLowerCase()),
      ).toEqual([
        { status: 'sent', mon_tx: result.monTx, ausd_tx: result.ausdTx },
        { status: 'already-funded', mon_tx: null, ausd_tx: null },
      ])
      expect(await nonceOf(disk)).toBe(0)
    }, 60_000)

    test('drip refuses an address that has transacted or already holds MON, sending nothing', async () => {
      const before = await nonceOf(dripper.address)
      expect(
        (await ops.drip!.request(chain.deployer.address, '198.51.100.1'))
          .status,
      ).toBe('not-fresh')
      const funded = privateKeyToAccount(generatePrivateKey()).address
      await chain.setBalance(funded, parseEther('1'))
      expect((await ops.drip!.request(funded, '198.51.100.2')).status).toBe(
        'balance-above-threshold',
      )
      expect(await nonceOf(dripper.address)).toBe(before)
    }, 60_000)

    test('faucet top-up broadcasts once, then MaxFrequencyExceeded is a scheduled wait with no further transactions', async () => {
      const wallets = [bot.address, dripper.address]
      const nonces = async () => Promise.all(wallets.map(nonceOf))
      const requests = () => read<bigint>(faucet, 'MockFaucet', 'requests')
      const beforeNonces = await nonces()
      clock = 0
      await ops.topup!.tick()
      expect(await requests()).toBe(2n)
      expect(ops.topup!.state.map((entry) => entry.status)).toEqual([
        'funded',
        'funded',
      ])
      const afterFirst = await nonces()
      expect(afterFirst.map((n, i) => n - beforeNonces[i])).toEqual([1, 1])
      clock = 61_000
      await ops.topup!.tick()
      expect(await requests()).toBe(2n)
      expect(await nonces()).toEqual(afterFirst)
      expect(
        ops.topup!.state.map((entry) => [
          entry.status,
          entry.lastError,
          entry.nextAt,
        ]),
      ).toEqual([
        ['frequency-limited', 'MaxFrequencyExceeded', 61_000 + 3_600_000],
        ['frequency-limited', 'MaxFrequencyExceeded', 61_000 + 3_600_000],
      ])
      clock = 120_000
      await ops.topup!.tick()
      expect(await nonces()).toEqual(afterFirst)
    }, 60_000)

    test('mirror seeds a two-sided ladder, takes a player ask in the way between two atomic batches, holds without sending, and spaces every send', async () => {
      await chain.write(margin, 'MockMargin', 'setBalance', [bot.address, zeroAddress, parseEther('100')])
      await chain.write(margin, 'MockMargin', 'setBalance', [bot.address, ausd, 1000n * 10n ** 6n])
      const mid = createMidState()
      const state = createMirrorState()
      let target = 0.03
      const job = createMirrorJob({ db, mid, state, executor: ops.executor!, target: () => target, logger: quiet })
      const feed = (at = Date.now()) =>
        Object.assign(mid, {
          status: 'running',
          targetMid: target,
          at,
          testnet: { ...mid.testnet, status: 'live', mid: target, at: Date.now() },
        })
      const ticks = () =>
        db.query<{ action: string; notional: number; tx_hash: string | null; error: string | null }, []>(
          'SELECT action, notional, tx_hash, error FROM mirror_ticks ORDER BY id',
        ).all()
      const counts = async () => ({
        buys: await read<bigint>(book, 'MockBook', 'buys'),
        sells: await read<bigint>(book, 'MockBook', 'sells'),
      })
      const quoteRows = () => db.query('SELECT order_id FROM mirror_quotes').all().length

      // No external liquidity: one batch seeds six rungs a side.
      await chain.write(book, 'MockBook', 'setBook', [(1n << 256n) - 1n, 0n])
      feed()
      await job()
      expect(ticks().at(-1)).toMatchObject({ action: 'quote', error: null })
      expect(ticks().at(-1)!.tx_hash!.split(',')).toHaveLength(1)
      expect(quoteRows()).toBe(12)

      // Unchanged target: the ladder fits, nothing is signed.
      const before = await nonceOf(bot.address)
      feed()
      await job()
      expect(ticks().at(-1)).toMatchObject({ action: 'hold', tx_hash: null, error: null })
      expect(await nonceOf(bot.address)).toBe(before)

      // A player's ask rests between the old and new target: batch, take, batch.
      await chain.write(book, 'MockBook', 'setBook', [(1n << 256n) - 1n, parseEther('0.0302')])
      target = 0.0306
      feed()
      await job()
      expect(ticks().at(-1)).toMatchObject({ action: 'buy', error: null })
      expect(await counts()).toEqual({ buys: 1n, sells: 0n })
      const hashes = ticks().at(-1)!.tx_hash!.split(',') as `0x${string}`[]
      expect(hashes).toHaveLength(3)
      const receipts = await Promise.all(hashes.map((hash) => chain.client.getTransactionReceipt({ hash })))
      expect(receipts.every((receipt) => receipt.status === 'success')).toBe(true)
      for (let i = 1; i < receipts.length; i++)
        expect(receipts[i].blockNumber - receipts[i - 1].blockNumber).toBeGreaterThanOrEqual(3n)
      const gasLimits = await Promise.all(hashes.map(async (hash) => (await chain.client.getTransaction({ hash })).gas))
      expect(gasLimits.every((gas) => gas > 0n && gas <= 4_000_000n)).toBe(true)
      const own = await Promise.all(
        db.query<{ order_id: string }, []>('SELECT order_id FROM mirror_quotes').all()
          .map((row) => read<readonly [string, bigint, number, number, number, number, number, boolean]>(book, 'MockBook', 's_orders', [Number(row.order_id)])),
      )
      expect(own.filter((order) => order[7]).length).toBeGreaterThanOrEqual(6)
      expect(own.filter((order) => !order[7]).length).toBeGreaterThanOrEqual(6)
      expect(own.every((order) => order[7] ? order[5] / 1e8 < 0.0306 : order[5] / 1e8 > 0.0306)).toBe(true)

      // A stale source pauses without touching the chain.
      const sent = await nonceOf(bot.address)
      feed(Date.now() - 60_000)
      await job()
      expect(ticks().at(-1)).toMatchObject({ action: 'paused', tx_hash: null })
      expect(await nonceOf(bot.address)).toBe(sent)
    }, 90_000)

    test('sellability probe: clean tokens pass, a token returning false or reverting is refused, an empty holder is unusable', async () => {
      const probe = createTransferProbe(chain.client, chain.deployer.address)
      expect(await probe(ausd)).toBe('ok')
      const refusing = await chain.deploy('MockToken', [true])
      expect(await probe(refusing)).toBe('refused')
      const reverting = await chain.deploy('MockRevertToken')
      expect(
        await createTransferProbe(
          chain.client,
          chain.deployer.address,
        )(reverting),
      ).toBe('refused')
      expect(
        await createTransferProbe(
          chain.client,
          privateKeyToAccount(generatePrivateKey()).address,
        )(ausd),
      ).toBe('no-balance')
    }, 60_000)
  },
)
