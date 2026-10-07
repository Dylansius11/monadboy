import type { Address } from 'viem'
import { readFile } from 'node:fs/promises'
import {
  readMarketParams,
  priceToUnits,
  sizeToUnits,
} from '../../packages/sdk/src/kuru/encoding'
import {
  batchProvisionArgs,
  planLadder,
} from '../../packages/sdk/src/kuru/ladder'
import {
  addresses,
  assertChain,
  balances,
  code,
  erc20Abi,
  json,
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  operation,
  publicClient,
  roles,
  save,
  viem,
} from './runtime'

const { zeroAddress, parseEther } = viem
const stage = process.argv[2] ?? 'flags'
await assertChain()
const manifest = JSON.parse(
  await readFile('packages/sdk/src/markets.testnet.json', 'utf8'),
)
const market: Address = manifest[0]?.address
if (!market) throw new Error('Missing deployed market')
await code(market)
const params = await readMarketParams(publicClient, market)
const accounts = await roles()
const call = { role: 'BOT', address: market, abi: kuruOrderbookAbi }
if (stage === 'flags') {
  const cases = [
    {
      label: 's2-provision-cross-true',
      functionName: 'batchProvisionLiquidity',
      args: [[4_000_000], [4_000_001], [params.minSize], [true], true],
      error: 'ProvisionError',
    },
    {
      label: 's2-provision-cross-false',
      functionName: 'batchProvisionLiquidity',
      args: [[4_000_000], [4_000_001], [params.minSize], [true], false],
    },
    {
      label: 's2-sell-native-missing',
      functionName: 'placeAndExecuteMarketSell',
      args: [sizeToUnits(0.1, params), 0n, false, false],
      error: 'NativeAssetInsufficient',
    },
    {
      label: 's2-buy-minout-over',
      functionName: 'placeAndExecuteMarketBuy',
      args: [1_000_000n, parseEther('1'), false, false],
      error: 'SlippageExceeded',
    },
    {
      label: 's2-buy-wrong-token-input-units',
      functionName: 'placeAndExecuteMarketBuy',
      args: [10_000n, parseEther('0.2'), false, false],
      error: 'SlippageExceeded',
    },
  ]
  for (const entry of cases) {
    try {
      await operation(
        entry.label,
        { ...call, functionName: entry.functionName, args: entry.args },
        true,
      )
      if (entry.error)
        throw new Error(
          `${entry.label}: expected ${entry.error} refusal was absent`,
        )
    } catch (error) {
      if (!entry.error) throw error
      const evidence = JSON.parse(
        await readFile(`../handoff/monadboy/${entry.label}.json`, 'utf8'),
      )
      if (!JSON.stringify(evidence.error).includes(entry.error)) throw error
    }
  }
  const sell = {
    ...call,
    functionName: 'placeAndExecuteMarketSell',
    args: [sizeToUnits(0.1, params), 0n, false, true],
    value: parseEther('0.1'),
  }
  const result = await operation('s2-sell-minout-boundary-pass', sell, true)
  const exact = BigInt(result.simulatedResult as string)
  await operation(
    's2-sell-minout-exact',
    { ...sell, args: [sizeToUnits(0.1, params), exact, false, true] },
    true,
  )
  try {
    await operation(
      's2-sell-minout-exact-plus-one',
      { ...sell, args: [sizeToUnits(0.1, params), exact + 1n, false, true] },
      true,
    )
  } catch {
    const evidence = JSON.parse(
      await readFile(
        '../handoff/monadboy/s2-sell-minout-exact-plus-one.json',
        'utf8',
      ),
    )
    if (!JSON.stringify(evidence.error).includes('SlippageExceeded'))
      throw new Error('Unexpected minOut boundary refusal')
  }
  const buy = {
    ...call,
    functionName: 'placeAndExecuteMarketBuy',
    args: [1_000_000n, 0n, false, false],
    estimateCap: 2_000_000n,
  }
  const buyResult = await operation('s2-buy-minout-bounded-pass', buy, true)
  const buyExact = BigInt(buyResult.simulatedResult as string)
  await operation(
    's2-buy-minout-exact',
    { ...buy, args: [1_000_000n, buyExact, false, false] },
    true,
  )
  try {
    await operation(
      's2-buy-minout-exact-plus-one',
      { ...buy, args: [1_000_000n, buyExact + 1n, false, false] },
      true,
    )
  } catch {
    const evidence = JSON.parse(
      await readFile(
        '../handoff/monadboy/s2-buy-minout-exact-plus-one.json',
        'utf8',
      ),
    )
    if (!JSON.stringify(evidence.error).includes('SlippageExceeded'))
      throw new Error('Unexpected buy minOut boundary refusal')
  }
} else if (stage === 'bounded-buy') {
  await operation('s2-bot-buy-wallet-bounded', {
    ...call,
    functionName: 'placeAndExecuteMarketBuy',
    args: [1_000_000n, parseEther('0.29'), false, false],
    estimateCap: 2_000_000n,
  })
} else if (stage === 'margin') {
  await operation('s2-bot-approve-margin', {
    role: 'BOT',
    address: addresses.ausd,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.margin, 100_000n],
  })
  await operation('s2-bot-deposit-ausd', {
    role: 'BOT',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'deposit',
    args: [accounts.BOT.address, addresses.ausd, 100_000n],
  })
  await operation('s2-bot-buy-margin', {
    ...call,
    functionName: 'placeAndExecuteMarketBuy',
    args: [1_000_000n, parseEther('0.29'), true, false],
    estimateCap: 2_000_000n,
  })
  await operation('s2-bot-sell-margin', {
    ...call,
    functionName: 'placeAndExecuteMarketSell',
    args: [sizeToUnits(0.1, params), 3_200n, true, true],
  })
  await operation('s2-bot-withdraw-margin', {
    role: 'BOT',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'batchWithdrawMaxTokens',
    args: [[zeroAddress, addresses.ausd]],
  })
} else if (stage === 'cancel') {
  const counter = await publicClient.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 's_orderIdCounter',
  })
  const ids = []
  // Canceling either linked member also cancels its partner; never submit both.
  const covered = new Set<number>()
  for (let id = 1; id <= Number(counter); id++) {
    const order = await publicClient.readContract({
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 's_orders',
      args: [id],
    })
    if (
      order[1] > 0n &&
      order[0].toLowerCase() === accounts.DEPLOYER.address.toLowerCase() &&
      !covered.has(id)
    ) {
      ids.push(id)
      covered.add(id)
      if (Number(order[4]) > 0) covered.add(Number(order[4]))
    }
  }
  if (ids.length)
    await operation(`s2-cancel-flips-through-${counter}-pairs`, {
      role: 'DEPLOYER',
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 'batchCancelFlipOrders',
      args: [ids],
    })
} else if (stage === 'plain') {
  const before = await publicClient.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 's_orderIdCounter',
  })
  await operation('s2-plain-batch-update', {
    role: 'DEPLOYER',
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 'batchUpdate',
    args: [
      [priceToUnits(0.0325, params, 'down')],
      [params.minSize],
      [priceToUnits(0.0335, params, 'up')],
      [params.minSize],
      [],
      true,
    ],
  })
  const after = await publicClient.readContract({
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 's_orderIdCounter',
  })
  if (Number(after) > Number(before))
    await operation('s2-cancel-plain', {
      role: 'DEPLOYER',
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 'batchCancelOrders',
      args: [
        Array.from(
          { length: Number(after) - Number(before) },
          (_, i) => Number(before) + i + 1,
        ),
      ],
    })
} else if (stage === 'max-fund') {
  await operation('s2-maker-max16-extra-mon', {
    role: 'DEPLOYER',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'deposit',
    args: [accounts.DEPLOYER.address, zeroAddress, parseEther('11')],
    value: parseEther('11'),
  })
} else if (stage === 'withdraw') {
  await operation('s2-maker-withdraw-all', {
    role: 'DEPLOYER',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'batchWithdrawMaxTokens',
    args: [[zeroAddress, addresses.ausd]],
    estimateCap: 2_000_000n,
  })
} else if (stage === 'restore') {
  await operation('s2-maker-final-approve', {
    role: 'DEPLOYER',
    address: addresses.ausd,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.margin, 1_000_000n],
  })
  await operation('s2-maker-final-ausd', {
    role: 'DEPLOYER',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'deposit',
    args: [accounts.DEPLOYER.address, addresses.ausd, 1_000_000n],
  })
  await operation('s2-maker-final-mon', {
    role: 'DEPLOYER',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'deposit',
    args: [accounts.DEPLOYER.address, zeroAddress, parseEther('5')],
    value: parseEther('5'),
  })
  const ladder = planLadder({
    mid: 0.033,
    mode: 'WIDE',
    sigmaDaily: 0.001,
    budgetQuote: 0.24,
    params,
    manual: { low: 0.032835, high: 0.033165 },
  })
  await operation('s2-final-provision-2x2', {
    role: 'DEPLOYER',
    address: market,
    abi: kuruOrderbookAbi,
    functionName: 'batchProvisionLiquidity',
    args: batchProvisionArgs(ladder),
  })
} else if (stage === 'worker-fund') {
  await operation('s2-bot-worker-approve', {
    role: 'BOT',
    address: addresses.ausd,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.margin, 2_000_000n],
  })
  await operation('s2-bot-worker-ausd', {
    role: 'BOT',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'deposit',
    args: [accounts.BOT.address, addresses.ausd, 2_000_000n],
  })
  await operation('s2-bot-worker-mon', {
    role: 'BOT',
    address: addresses.margin,
    abi: kuruMarginAccountAbi,
    functionName: 'deposit',
    args: [accounts.BOT.address, zeroAddress, parseEther('10')],
    value: parseEther('10'),
  })
} else
  throw new Error(
    `Unknown stage ${stage}; flags, bounded-buy, margin, cancel, plain, max-fund, withdraw, restore, worker-fund`,
  )
const result = {
  stage,
  chainId: 10143,
  blockNumber: await publicClient.getBlockNumber(),
  balances: await balances(),
}
await save(`s2-probes-${stage}`, result)
console.log(json(result))
