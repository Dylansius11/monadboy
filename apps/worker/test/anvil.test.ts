import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { parseEther, zeroAddress } from 'viem'
import type { Address } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  erc20Abi,
  mainnetMarkets,
  priceToUnits,
  sizeToUnits,
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
        ...mainnetMarkets.find((m) => m.symbol === 'MON_USDC')!,
        chain: 'testnet',
        symbol: 'MON_AUSD',
        quoteSymbol: 'AUSD',
        address: book,
        quoteToken: ausd,
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

    test('mirror takes liquidity toward the target with explicit gas, refreshes quotes, cancels the old ones, and spaces every send', async () => {
      await chain.write(margin, 'MockMargin', 'setBalance', [
        bot.address,
        zeroAddress,
        parseEther('100'),
      ])
      await chain.write(margin, 'MockMargin', 'setBalance', [
        bot.address,
        ausd,
        1000n * 10n ** 6n,
      ])
      const mid = createMidState()
      const state = createMirrorState()
      const job = createMirrorJob({
        db,
        mid,
        state,
        executor: ops.executor!,
        maxStepNotional: 1,
        deviationThreshold: 0.0005,
        logger: quiet,
      })
      const feed = (target: number, testnet: number | null, at = Date.now()) =>
        Object.assign(mid, {
          status: 'running',
          targetMid: target,
          at,
          testnet: {
            ...mid.testnet,
            status: testnet === null ? 'empty' : 'live',
            mid: testnet,
            at: Date.now(),
          },
        })
      const ticks = () =>
        db
          .query<
            {
              action: string
              notional: number
              tx_hash: string | null
              error: string | null
            },
            []
          >(
            'SELECT action, notional, tx_hash, error FROM mirror_ticks ORDER BY id',
          )
          .all()
      const counts = async () => ({
        buys: await read<bigint>(book, 'MockBook', 'buys'),
        sells: await read<bigint>(book, 'MockBook', 'sells'),
      })
      const order = (id: number) =>
        read<
          readonly [
            Address,
            bigint,
            number,
            number,
            number,
            number,
            number,
            boolean,
          ]
        >(book, 'MockBook', 's_orders', [id])

      feed(0.033, 0.03)
      await job()
      expect(ticks().at(-1)).toMatchObject({
        action: 'buy',
        notional: 1,
        error: null,
      })
      expect(await counts()).toEqual({ buys: 1n, sells: 0n })
      expect(await read<bigint>(book, 'MockBook', 'lastBuyQuote')).toBe(
        1_000_000n,
      )
      const [bid, ask] = [await order(1), await order(2)]
      expect([bid[0], bid[5], bid[7]]).toEqual([
        bot.address,
        priceToUnits(0.033 * 0.999, market.params, 'down'),
        true,
      ])
      expect([ask[0], ask[5], ask[7]]).toEqual([
        bot.address,
        priceToUnits(0.033 * 1.001, market.params, 'up'),
        false,
      ])
      expect(
        db
          .query(
            'SELECT order_id FROM mirror_quotes ORDER BY CAST(order_id AS INTEGER)',
          )
          .all(),
      ).toEqual([{ order_id: '1' }, { order_id: '2' }])

      feed(0.033, 0.036)
      await job()
      expect(ticks().at(-1)).toMatchObject({ action: 'sell', error: null })
      expect(await counts()).toEqual({ buys: 1n, sells: 1n })
      expect(await read<bigint>(book, 'MockBook', 'lastSellSize')).toBe(
        sizeToUnits(1 / 0.033, market.params),
      )
      expect((await order(1))[0]).toBe(zeroAddress)
      expect(
        db
          .query(
            'SELECT order_id FROM mirror_quotes ORDER BY CAST(order_id AS INTEGER)',
          )
          .all(),
      ).toEqual([{ order_id: '3' }, { order_id: '4' }])

      const before = await counts()
      const sent = db
        .query<{ n: number }, []>('SELECT COUNT(*) AS n FROM mirror_ticks')
        .get()!.n
      feed(0.033, 0.033)
      await job()
      feed(0.033, 0.01, Date.now() - 60_000)
      await job()
      expect(
        ticks()
          .slice(sent)
          .map((tick) => [tick.action, tick.tx_hash]),
      ).toEqual([
        ['hold', null],
        ['paused', null],
      ])
      expect(await counts()).toEqual(before)

      const hashes = ticks().flatMap((tick) =>
        tick.tx_hash ? tick.tx_hash.split(',') : [],
      ) as `0x${string}`[]
      expect(hashes).toHaveLength(4)
      const receipts = await Promise.all(
        hashes.map((hash) => chain.client.getTransactionReceipt({ hash })),
      )
      expect(receipts.every((receipt) => receipt.status === 'success')).toBe(
        true,
      )
      const blocks = receipts.map((receipt) => receipt.blockNumber)
      for (let i = 1; i < blocks.length; i++)
        expect(blocks[i] - blocks[i - 1]).toBeGreaterThanOrEqual(3n)
      const gasLimits = await Promise.all(
        hashes.map(
          async (hash) => (await chain.client.getTransaction({ hash })).gas,
        ),
      )
      expect(gasLimits).toEqual([
        1_000_000n,
        1_000_000n,
        1_000_000n,
        1_000_000n,
      ])
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
