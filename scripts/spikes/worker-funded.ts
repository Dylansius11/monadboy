import { Database } from 'bun:sqlite'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  balances,
  evidenceDir,
  json,
  publicClient,
  roles,
  save,
  kuruOrderbookAbi,
  viem,
} from './runtime'
import { mainnetMarkets } from '../../packages/sdk/src/markets.mainnet'
import { testnetMarkets } from '../../packages/sdk/src/markets'
import { monad } from '../../packages/sdk/src/chains'
import { decodeL2Book } from '../../apps/worker/src/chain/l2-book'
import { bestBidAsk1e18 } from '../../packages/sdk/src/kuru/encoding'
import { parseEnv } from '../../apps/worker/src/env'
import { createOperations } from '../../apps/worker/src/operations'
import { decideMirrorAction } from '../../apps/worker/src/jobs/mirror'
import { describeError } from '../../apps/worker/src/logger'
import type { Hex, PublicClient } from 'viem'

const envPath = join(process.env.TEMP ?? '/tmp', 'monadboy-funded-worker.env')
const sqlitePath = join(
  process.env.TEMP ?? '/tmp',
  'monadboy-funded-worker.sqlite',
)
const command = process.argv[2]
const market = '0xD9F66B3bdBb1741f33e01fA3Acb514623e0a60Bc'
if (
  command === 'serve' ||
  command === 'readonly' ||
  command === 'drip-preview'
) {
  const entries: Record<string, string> = {}
  for (const line of (await readFile(envPath, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\s#]+)["']?\s*$/)
    if (match) entries[match[1]] = match[2]
  }
  await roles() // Validate every external role key/address pair without printing keys.
  Object.assign(process.env, entries, {
    WORKER_PORT: '18788',
    SQLITE_PATH: sqlitePath,
    ENABLE_TRANSACTIONS: command === 'readonly' ? 'false' : 'true',
    BOT_PRIVATE_KEY: command === 'serve' ? await privateRoleKey('BOT') : '',
    DRIP_PRIVATE_KEY:
      command !== 'readonly' ? await privateRoleKey('DRIP') : '',
    MIRROR_MAX_STEP_NOTIONAL: '0.06',
    TESTNET_START_BLOCK: '68940637',
    TESTNET_REGISTRY_ADDRESS: '0xbfc885C572Cb1121FC4e4e82434279c4B4302714',
    GAS_MARKET_ORDER: '2000000',
    GAS_BATCH_UPDATE: '2000000',
    GAS_ERC20: '87502',
    GAS_FAUCET: '156720',
    FAUCET_MIN_AUSD: '100',
  })
  // Keep the pre-existing private worker salt and ledger. HyperSync credentials stay private.
  for (const line of (await readFile('apps/worker/.env', 'utf8')).split(
    /\r?\n/,
  )) {
    const match = line.match(
      /^\s*(HYPERSYNC_API_TOKEN)\s*=\s*["']?([^"'\s#]+)["']?\s*$/,
    )
    if (match) process.env[match[1]] = match[2]
  }
  // Startup reads Bun.env at module evaluation, so load only after the private environment is installed.
  await import('../../apps/worker/src/index')
  // A smoke launcher must not leave an unbounded mainnet-following signer behind.
  if (command !== 'readonly') setTimeout(() => process.emit('SIGINT'), 650_000)
} else if (command === 'transition') {
  if (!process.argv.includes('--broadcast'))
    throw new Error(
      'One bounded transition requires explicit --broadcast and exclusive BOT lease',
    )
  const accounts = await roles()
  const pending = await publicClient.getTransactionCount({
    address: accounts.BOT!.address,
    blockTag: 'pending',
  })
  const confirmed = await publicClient.getTransactionCount({
    address: accounts.BOT!.address,
    blockTag: 'latest',
  })
  if (pending !== confirmed)
    throw new Error('BOT has an unconfirmed transaction')
  const db = new Database(sqlitePath)
  const configured = testnetMarkets.find(
    (entry) => entry.address.toLowerCase() === market.toLowerCase(),
  )!
  const env = parseEnv({
    ENABLE_TRANSACTIONS: 'true',
    BOT_PRIVATE_KEY: await privateRoleKey('BOT'),
    GAS_MARKET_ORDER: '2000000',
    GAS_BATCH_UPDATE: '2000000',
    MIRROR_MAX_STEP_NOTIONAL: '0.06',
  })
  const ops = await createOperations({
    db,
    env,
    client: publicClient as PublicClient,
    markets: [configured],
  })
  if (!ops.executor) throw new Error('No actual BOT executor')
  const before = await balances()
  const sourceChecks: unknown[] = []
  const readSource = async () => {
    const response = await fetch('http://localhost:18788/v1/mid')
    if (!response.ok) throw new Error('Readonly source HTTP unavailable')
    const body = (await response.json()) as {
      state: string
      fresh: boolean
      targetMid: number | null
      ageMs: number | null
      at: number | null
    }
    sourceChecks.push({ checkedAt: Date.now(), ...body })
    if (
      body.state !== 'running' ||
      !body.fresh ||
      body.targetMid === null ||
      body.targetMid <= 0
    )
      throw new Error('Source unavailable before mirror signing')
    return body
  }
  const source = await readSource()
  const best = await publicClient.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 'bestBidAsk',
  })
  const { bid, ask } = bestBidAsk1e18(best)
  const testnetMid = bid !== null && ask !== null ? (bid + ask) / 2 : null
  const action = decideMirrorAction({
    targetMid: source.targetMid,
    sourceAgeMs: source.ageMs,
    sourcePaused: false,
    testnetMid,
    testnetObserved: true,
    deviationThreshold: env.MIRROR_DEVIATION_THRESHOLD,
    maxStepNotional: env.MIRROR_MAX_STEP_NOTIONAL,
    inventory: await ops.executor.inventory(),
  })
  const at = Date.now()
  let hashes: Hex[] = []
  let error: string | null = null
  try {
    if (action.kind !== 'paused' && action.kind !== 'hold')
      hashes = await ops.executor.execute(
        action,
        source.targetMid!,
        async () => {
          await readSource()
        },
      )
  } catch (cause) {
    error = describeError(cause)
    if (
      cause instanceof Error &&
      'hashes' in cause &&
      Array.isArray(cause.hashes)
    )
      hashes = cause.hashes as Hex[]
  }
  db.query(
    'INSERT INTO mirror_ticks (at,source_mid,testnet_mid_before,action,notional,tx_hash,error) VALUES (?,?,?,?,?,?,?)',
  ).run(
    at,
    source.targetMid,
    testnetMid,
    action.kind,
    action.notional,
    hashes.join(',') || null,
    error,
  )
  const transactions = []
  for (const hash of hashes) {
    const receipt = await publicClient.getTransactionReceipt({ hash })
    const transaction = await publicClient.getTransaction({ hash })
    const decoded = viem.decodeFunctionData({
      abi: kuruOrderbookAbi,
      data: transaction.input,
    })
    const events = receipt.logs.flatMap((entry) => {
      try {
        return [
          viem.decodeEventLog({
            abi: kuruOrderbookAbi,
            topics: entry.topics,
            data: entry.data,
          }),
        ]
      } catch {
        return []
      }
    })
    transactions.push({ transaction, receipt, decoded, events })
  }
  const ownQuotes = db.query('SELECT * FROM mirror_quotes').all()
  await save('worker-funded-corrected-transition', {
    at: new Date().toISOString(),
    chainId: 10143,
    pendingNonceBefore: pending,
    pendingNonceAfter: await publicClient.getTransactionCount({
      address: accounts.BOT!.address,
      blockTag: 'pending',
    }),
    latestNonceAfter: await publicClient.getTransactionCount({
      address: accounts.BOT!.address,
      blockTag: 'latest',
    }),
    action,
    sourceChecks,
    testnetBestBefore: best,
    before,
    after: await balances(),
    hashes,
    error,
    transactions,
    ownQuotes,
  })
  console.log(
    json({
      action,
      hashes,
      error,
      transactions: transactions.map((entry) => ({
        hash: entry.transaction.hash,
        functionName: entry.decoded.functionName,
        status: entry.receipt.status,
        gas: entry.transaction.gas,
      })),
    }),
  )
  db.close()
} else if (command === 'drip-spacing-budget') {
  const drip = '0x41D8f26C1C517Fa8d2Adb527996b1220a206f6F6'
  const head = await publicClient.getBlockNumber({ cacheTime: 0 })
  const blocks = []
  const code = []
  const authorizations = []
  const senderTransactions = []
  for (let blockNumber = head - 3n; blockNumber <= head; blockNumber++) {
    const bytecode = await publicClient.getCode({ address: drip, blockNumber })
    code.push({ blockNumber, bytecode: bytecode ?? '0x' })
    const block = await publicClient.getBlock({
      blockNumber,
      includeTransactions: true,
    })
    blocks.push({
      blockNumber,
      hash: block.hash,
      timestamp: block.timestamp,
      transactions: block.transactions.length,
    })
    for (const transaction of block.transactions) {
      if (transaction.from.toLowerCase() === drip.toLowerCase())
        senderTransactions.push({
          hash: transaction.hash,
          blockNumber,
          type: transaction.type,
        })
      for (const authorization of transaction.authorizationList ?? []) {
        // EIP-7702 authorization digest: keccak256(0x05 || rlp(chainId,address,nonce)).
        // Recover every authority, including sponsored changes whose transaction sender differs.
        const values = [
          BigInt(authorization.chainId),
          authorization.address,
          BigInt(authorization.nonce),
        ]
        const rlp = viem.toRlp(
          values.map((value) =>
            typeof value === 'bigint'
              ? value === 0n
                ? '0x'
                : viem.toHex(value)
              : value,
          ),
        )
        const authority = await viem.recoverAddress({
          hash: viem.keccak256(viem.concatHex(['0x05', rlp])),
          signature: {
            r: authorization.r!,
            s: authorization.s!,
            yParity: authorization.yParity!,
          },
        })
        authorizations.push({
          transactionHash: transaction.hash,
          blockNumber,
          authority,
          authorization,
        })
      }
    }
  }
  const balance = await publicClient.getBalance({
    address: drip,
    blockNumber: head,
  })
  const related = authorizations.filter(
    (entry) => entry.authority.toLowerCase() === drip.toLowerCase(),
  )
  await save('worker-funded-drip-spacing-budget', {
    at: new Date().toISOString(),
    chainId: 10143,
    drip,
    head,
    code,
    blocks,
    allWindowAuthorizations: authorizations,
    dripWindowAuthorizations: related,
    senderTransactions,
    currentlyUndelegated: code.at(-1)!.bytecode === '0x',
    undelegatedThroughoutWindow: code.every((entry) => entry.bytecode === '0x'),
    noRecentDripAuthorization: related.length === 0,
    balance,
    gasPerPlayerWei: 11_067_204_000_000_000n,
    remainingPlayersToTotalTwenty: 17,
    remainingPayoutAndGasWei: 17n * 511_067_204_000_000_000n,
    endingBalanceAfterRemainingWei: balance - 17n * 511_067_204_000_000_000n,
    reservePreservingTwentyInitialWei: 20_221_344_080_000_000_000n,
    nominalTwentyInitialWei: 20_000_000_000_000_000_000n,
    note: 'Unsigned eligibility snapshot only. Existing Treasury spaces ALL sender transactions by >=3 actual blocks; undelegated emptying exception permits falling below10MON. Recheck delegation/no recent authorizations at future sends; no20drips broadcast.',
  })
  console.log(
    json({
      head,
      code,
      authorizationCount: authorizations.length,
      dripAuthorizationCount: related.length,
      senderTransactions,
      balance,
      endingBalanceAfterRemainingWei: balance - 17n * 511_067_204_000_000_000n,
    }),
  )
} else if (command === 'diagnose') {
  const accounts = await roles()
  const known = await publicClient.getTransactionReceipt({
    hash: '0x7b6d9f4e6e2cec5f943e8343045f43b7eee83b290aedf5801383618430a67ccc',
  })
  const transactions = []
  for (
    let blockNumber = known.blockNumber - 40n;
    blockNumber <= known.blockNumber;
    blockNumber++
  ) {
    const block = await publicClient.getBlock({
      blockNumber,
      includeTransactions: true,
    })
    for (const tx of block.transactions) {
      if (
        ![accounts.BOT!.address, accounts.DRIP!.address].some(
          (address) => address.toLowerCase() === tx.from.toLowerCase(),
        )
      )
        continue
      const receipt = await publicClient.getTransactionReceipt({
        hash: tx.hash,
      })
      let decoded
      try {
        decoded = viem.decodeFunctionData({
          abi: kuruOrderbookAbi,
          data: tx.input,
        })
      } catch {
        decoded = null
      }
      let trace
      if (receipt.status === 'reverted')
        trace = await publicClient.request({
          method: 'debug_traceTransaction',
          params: [tx.hash, { tracer: 'callTracer' }],
        } as never)
      transactions.push({ transaction: tx, receipt, decoded, trace })
    }
  }
  await save('worker-funded-boundary-transactions', { transactions })
  console.log(
    json(
      transactions.map(({ transaction, receipt, decoded, trace }) => ({
        hash: transaction.hash,
        gas: transaction.gas,
        status: receipt.status,
        decoded,
        trace,
      })),
    ),
  )
} else if (command === 'budget') {
  const blockNumber = await publicClient.getBlockNumber()
  const configured = testnetMarkets.find(
    (entry) => entry.address.toLowerCase() === market.toLowerCase(),
  )!
  const raw = await publicClient.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 'getL2Book',
    blockNumber,
  })
  const best = await publicClient.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 'bestBidAsk',
    blockNumber,
  })
  const book = decodeL2Book(raw, configured.params)
  const mid = (Number(best[0]) + Number(best[1])) / 2e18
  const bids = book.bids.filter(
    (level) => Math.abs(level.price / mid - 1) <= 0.03,
  )
  const asks = book.asks.filter(
    (level) => Math.abs(level.price / mid - 1) <= 0.03,
  )
  const sellBase = bids.reduce((sum, level) => sum + level.size, 0)
  const buyQuote = asks.reduce(
    (sum, level) => sum + level.price * level.size,
    0,
  )
  const drip = JSON.parse(
    await readFile(join(evidenceDir, 'funded-drip-proof.json'), 'utf8'),
  )
  const perDripGasWei = drip.receipts.reduce(
    (sum: bigint, receipt: { gasLimit: string; effectiveGasPrice: string }) =>
      sum + BigInt(receipt.gasLimit) * BigInt(receipt.effectiveGasPrice),
    0n,
  )
  const mainnet = viem.createPublicClient({
    chain: monad,
    transport: viem.http('https://rpc.monad.xyz', { retryCount: 0 }),
  })
  const source = mainnetMarkets.find((entry) => entry.symbol === 'MON_USDC')!
  const sourceBlock = await mainnet.getBlockNumber()
  const sourceBest = await mainnet.readContract({
    address: source.address,
    abi: kuruOrderbookAbi,
    functionName: 'bestBidAsk',
    blockNumber: sourceBlock,
  })
  const sourceRaw = await mainnet.readContract({
    address: source.address,
    abi: kuruOrderbookAbi,
    functionName: 'getL2Book',
    blockNumber: sourceBlock,
  })
  await save(process.argv[3] ?? 'worker-funded-s3-budget', {
    at: new Date().toISOString(),
    chainId: 10143,
    blockNumber,
    raw,
    best,
    book,
    mid,
    band: 0.03,
    bidsWithinBand: bids,
    asksWithinBand: asks,
    inventoryToSweepBand: {
      sellBase,
      buyQuote,
      buyQuoteWithTakerFee:
        buyQuote / (1 - configured.params.takerFeeBps / 10000),
    },
    notes: [
      'Actual resting L2 depth, not a signed +/-3% price manipulation or future worst case.',
      'Sweeping clears present levels; sparse next levels can jump farther than3%. Exact3% landing is not guaranteed.',
      'Depth includes BOT resting quotes; free margin excludes those locks. Never add locked inventory twice.',
      '20-player budget multiplies one actual0.5MON+10AUSD HTTP receipt pair; no20 repeated drips.',
      'Reserve-inclusive budget retains10MON. Current DRIP funding must cover payouts+gas+reserve.',
    ],
    balances: await balances(),
    twentyPlayerDrips: {
      players: 20,
      payoutMonWei: 20n * 500_000_000_000_000_000n,
      payoutAusdRaw: 20n * 10_000_000n,
      perDripGasWei,
      gasWei: 20n * perDripGasWei,
      totalMonWei: 20n * (500_000_000_000_000_000n + perDripGasWei),
      reserveInclusiveMonWei:
        10_000_000_000_000_000_000n +
        20n * (500_000_000_000_000_000n + perDripGasWei),
      receipts: drip.receipts,
    },
    source: {
      address: source.address,
      blockNumber: sourceBlock,
      best: sourceBest,
      raw: sourceRaw,
    },
  })
  console.log(
    json({ blockNumber, mid, sellBase, buyQuote, perDripGasWei, sourceBest }),
  )
} else if (command === 'source-policy') {
  const mainnet = viem.createPublicClient({
    chain: monad,
    transport: viem.http('https://rpc.monad.xyz', { retryCount: 0 }),
  })
  const source = mainnetMarkets.find((entry) => entry.symbol === 'MON_USDC')!
  const samples = []
  for (const blockNumber of [111300365n, 111300385n, 111300405n]) {
    const block = await mainnet.getBlock({ blockNumber })
    const best = await mainnet.readContract({
      address: source.address,
      abi: kuruOrderbookAbi,
      functionName: 'bestBidAsk',
      blockNumber,
    })
    const raw = await mainnet.readContract({
      address: source.address,
      abi: kuruOrderbookAbi,
      functionName: 'getL2Book',
      blockNumber,
    })
    samples.push({ blockNumber, timestamp: block.timestamp, best, raw })
    await Bun.sleep(150)
  }
  await save('worker-funded-source-policy', {
    address: source.address,
    policySpreadFraction: 0.02,
    samples,
  })
  console.log(
    json(
      samples.map(({ blockNumber, timestamp, best }) => ({
        blockNumber,
        timestamp,
        best,
      })),
    ),
  )
} else if (command === 'receipts') {
  const db = new Database(sqlitePath, { readonly: true })
  const hashes = new Set<string>()
  for (const row of db
    .query<{ tx_hash: string | null }, []>('SELECT tx_hash FROM mirror_ticks')
    .all())
    for (const hash of row.tx_hash?.split(',') ?? []) hashes.add(hash)
  for (const hash of [
    '0xb0c7c4575d48a6892fd261d08d59b4031a849128739e21ee6c3fe79c3f52f8b6',
    '0x64d48a668528f293e29fc421491bbdad0d0bc2e6b1350209a8a8cd2ce1ebeb7d',
    '0xc3849d522ea973d2a17638059b2000273f04ea38285a679d129f9e8789fa68a4',
  ])
    hashes.add(hash)
  const transactions = []
  for (const hash of hashes) {
    const receipt = await publicClient.getTransactionReceipt({
      hash: hash as `0x${string}`,
    })
    const transaction = await publicClient.getTransaction({
      hash: hash as `0x${string}`,
    })
    let decoded
    try {
      decoded = viem.decodeFunctionData({
        abi: kuruOrderbookAbi,
        data: transaction.input,
      })
    } catch {
      decoded = null
    }
    const events = receipt.logs.map((entry) => {
      try {
        return viem.decodeEventLog({
          abi: kuruOrderbookAbi,
          topics: entry.topics,
          data: entry.data,
        })
      } catch {
        return {
          address: entry.address,
          topics: entry.topics,
          data: entry.data,
        }
      }
    })
    transactions.push({ transaction, receipt, decoded, events })
  }
  await save('worker-funded-receipts', {
    at: new Date().toISOString(),
    chainId: 10143,
    transactions,
  })
  console.log(
    json({
      count: transactions.length,
      reverted: transactions.filter(
        (entry) => entry.receipt.status !== 'success',
      ).length,
      chargedWei: transactions.reduce(
        (sum, entry) =>
          sum + entry.receipt.gasUsed * entry.receipt.effectiveGasPrice,
        0n,
      ),
    }),
  )
  db.close()
} else if (command === 'snapshot') {
  const db = new Database(sqlitePath, { readonly: true })
  const name = process.argv[3] ?? 'worker-funded-snapshot'
  const health = await (await fetch('http://localhost:18788/v1/health')).json()
  const bot = (await roles()).BOT!.address
  const quotes = []
  for (const row of db
    .query<{ order_id: string }, []>('SELECT order_id FROM mirror_quotes')
    .all()) {
    const order = await publicClient.readContract({
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 's_orders',
      args: [Number(row.order_id)],
    })
    const point = await publicClient.readContract({
      address: market,
      abi: kuruOrderbookAbi,
      functionName: order[7] ? 's_buyPricePoints' : 's_sellPricePoints',
      args: [BigInt(order[5])],
    })
    quotes.push({ id: row.order_id, order, point })
  }
  await save(name, {
    at: new Date().toISOString(),
    health,
    balances: await balances(),
    quotes,
    bot,
    ticks: db.query('SELECT * FROM mirror_ticks ORDER BY at').all(),
    drips: db
      .query(
        'SELECT id,at,address,mon_wei,ausd_units,status,mon_tx,ausd_tx FROM drips ORDER BY id',
      )
      .all(),
    book: await publicClient.readContract({
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 'getL2Book',
    }),
  })
  console.log(json({ name, quotes, health }))
  db.close()
} else if (command === 'observe') {
  const duration = Number(process.argv[3] ?? 600_000)
  const startedAt = Date.now()
  const samples = []
  while (Date.now() - startedAt < duration) {
    const at = Date.now()
    const sample: Record<string, unknown> = { at }
    for (const route of ['/v1/health', '/v1/mid', '/v1/tracker']) {
      try {
        const response = await fetch(`http://localhost:18788${route}`)
        sample[route] = { http: response.status, body: await response.json() }
      } catch (error) {
        sample[route] = { error: String(error) }
      }
    }
    samples.push(sample)
    await save('worker-funded-observation', {
      startedAt,
      endedAt: Date.now(),
      elapsedMs: Date.now() - startedAt,
      samples,
    })
    await Bun.sleep(5000)
  }
  const endedAt = Date.now()
  await save('worker-funded-observation', {
    startedAt,
    endedAt,
    elapsedMs: endedAt - startedAt,
    samples,
  })
  console.log(json({ samples: samples.length, elapsedMs: endedAt - startedAt }))
} else if (command === 'http') {
  const prior = JSON.parse(
    await readFile(join(evidenceDir, 'funded-drip-proof.json'), 'utf8'),
  )
  const accounts = await roles()
  const cases = [
    { name: 'repeat-after-restart', body: { address: prior.address } },
    { name: 'invalid-address', body: { address: 'not-an-address' } },
    { name: 'nonfresh-bot', body: { address: accounts.BOT!.address } },
    {
      name: 'strict-extra-field',
      body: { address: prior.address, extra: true },
    },
  ]
  const results = []
  for (const probe of cases) {
    const response = await fetch('http://localhost:18788/v1/drip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(probe.body),
    })
    results.push({
      ...probe,
      http: response.status,
      response: await response.json(),
    })
  }
  await save(process.argv[3] ?? 'worker-funded-http', {
    at: new Date().toISOString(),
    results,
  })
  console.log(json(results))
} else {
  throw new Error(
    'Use serve|readonly|drip-preview|transition --broadcast|diagnose|budget [artifact-name]|source-policy|receipts|snapshot [artifact-name]|observe [milliseconds]|http [artifact-name]',
  )
}

async function privateRoleKey(role: string) {
  const source = await readFile(
    process.env.OPS_ENV_PATH ?? '../handoff/monadboy/wallets.testnet.env',
    'utf8',
  )
  const match = source.match(
    new RegExp(`^${role}_PRIVATE_KEY\\s*=\\s*["']?([^"'\\s#]+)`, 'm'),
  )
  const key = process.env[`${role}_PRIVATE_KEY`] ?? match?.[1]
  if (!key) throw new Error(`Missing ${role} key`)
  return key
}
