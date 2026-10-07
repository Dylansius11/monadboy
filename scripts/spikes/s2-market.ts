import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Address } from 'viem'
import { readMarketParams } from '../../packages/sdk/src/kuru/encoding'
import {
  batchProvisionArgs,
  planLadder,
} from '../../packages/sdk/src/kuru/ladder'
import {
  addresses,
  assertChain,
  balances,
  broadcast,
  code,
  erc20Abi,
  json,
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  kuruRouterAbi,
  operation,
  priorEvidence,
  publicClient,
  roles,
  save,
  viem,
} from './runtime'

const { zeroAddress, parseEther } = viem
const command = process.argv[2] ?? 'status'
const accounts = await roles()
await assertChain()
for (const address of Object.values(addresses)) await code(address)
const manifestPath = resolve('packages/sdk/src/markets.testnet.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
let market: Address | undefined = manifest[0]?.address
if (command === 'deploy') {
  // Repeatable public artifacts and deterministic factory address prevent duplicate deployment.
  const artifacts = await priorEvidence()
  const args = [
    1,
    zeroAddress,
    addresses.ausd,
    10_000_000_000n,
    100_000_000,
    1,
    15_000_000_000n,
    (1n << 96n) - 1n,
    30n,
    0n,
    30n,
  ] as const
  const implementation = await publicClient.readContract({
    address: addresses.router,
    abi: kuruRouterAbi,
    functionName: 'orderBookImplementation',
  })
  await code(implementation)
  const predicted = await publicClient.readContract({
    address: addresses.router,
    abi: kuruRouterAbi,
    functionName: 'computeAddress',
    args: [...args.slice(1), implementation, false],
  })
  const pendingNonce = await publicClient.getTransactionCount({
    address: accounts.DEPLOYER.address,
    blockTag: 'pending',
  })
  await save('s2-prior-deployment-check', {
    artifacts,
    manifest,
    predicted,
    pendingNonce,
    bytecode: await publicClient.getCode({ address: predicted }),
  })
  if (market) {
    await code(market)
    if (market.toLowerCase() !== predicted.toLowerCase())
      throw new Error('Manifest market differs from approved parameters')
    console.log(json({ reused: market }))
  } else {
    if (
      (await publicClient.getCode({ address: predicted })) !== undefined &&
      (await publicClient.getCode({ address: predicted })) !== '0x'
    )
      throw new Error(
        'Existing deterministic market requires original public receipt; refusing duplicate',
      )
    const record = await operation('s2-deploy', {
      role: 'DEPLOYER',
      address: addresses.router,
      abi: kuruRouterAbi,
      functionName: 'deployProxy',
      args,
    })
    if (broadcast) {
      const event = (
        record.events as { eventName?: string; args?: { market: Address } }[]
      ).find((e) => e.eventName === 'MarketRegistered')
      if (
        !event?.args ||
        event.args.market.toLowerCase() !== predicted.toLowerCase()
      )
        throw new Error('Deployment receipt missing matching MarketRegistered')
      market = event.args.market
      const codeBytes = await code(market)
      const params = await readMarketParams(publicClient, market)
      const rawParams = await publicClient.readContract({
        address: market,
        abi: kuruOrderbookAbi,
        functionName: 'getMarketParams',
      })
      if (
        rawParams[2] !== zeroAddress ||
        rawParams[4].toLowerCase() !== addresses.ausd.toLowerCase()
      )
        throw new Error('Deployed market token mismatch')
      await save('s2-market', {
        chainId: 10143,
        address: market,
        codeBytes,
        params,
        rawParams,
        deployment: record,
      })
      await writeFile(
        manifestPath,
        json([
          {
            chain: 'testnet',
            address: market,
            symbol: 'MON_AUSD',
            baseSymbol: 'MON',
            quoteSymbol: 'AUSD',
            baseToken: zeroAddress,
            quoteToken: addresses.ausd,
            params,
          },
        ]) + '\n',
      )
    }
  }
} else {
  if (!market) throw new Error('Deploy the approved market first')
  await code(market)
  const params = await readMarketParams(publicClient, market)
  const ladder = planLadder({
    mid: 0.033,
    mode: 'WIDE',
    sigmaDaily: 0.001,
    budgetQuote: 0.24,
    params,
    manual: { low: 0.032835, high: 0.033165 },
  })
  if (command === 'fund') {
    await operation('s2-maker-approve', {
      role: 'DEPLOYER',
      address: addresses.ausd,
      abi: erc20Abi,
      functionName: 'approve',
      args: [addresses.margin, 1_000_000n],
    })
    await operation('s2-maker-deposit-ausd', {
      role: 'DEPLOYER',
      address: addresses.margin,
      abi: kuruMarginAccountAbi,
      functionName: 'deposit',
      args: [accounts.DEPLOYER.address, addresses.ausd, 1_000_000n],
    })
    await operation('s2-maker-deposit-mon', {
      role: 'DEPLOYER',
      address: addresses.margin,
      abi: kuruMarginAccountAbi,
      functionName: 'deposit',
      args: [accounts.DEPLOYER.address, zeroAddress, parseEther('5')],
      value: parseEther('5'),
    })
  } else if (command === 'provision') {
    await save('s2-ladder-plan', ladder)
    await operation('s2-provision-2x2', {
      role: 'DEPLOYER',
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 'batchProvisionLiquidity',
      args: batchProvisionArgs(ladder),
    })
  } else if (command === 'call') {
    // Public JSON call specification supports isolated probes without changing the script.
    const file = process.argv[3]
    if (!file || file.startsWith('--'))
      throw new Error('call requires a public JSON specification')
    const input = JSON.parse(await readFile(file, 'utf8'), (_, value) =>
      typeof value === 'string' && /^\d+n$/.test(value)
        ? BigInt(value.slice(0, -1))
        : value,
    )
    const abis = {
      market: kuruOrderbookAbi,
      margin: kuruMarginAccountAbi,
      ausd: erc20Abi,
    }
    const targets = { market, margin: addresses.margin, ausd: addresses.ausd }
    const target = input.target as keyof typeof abis
    if (
      !abis[target] ||
      !targets[target] ||
      !['BOT', 'DEPLOYER'].includes(input.role)
    )
      throw new Error('Invalid role or target')
    await operation(
      input.label,
      {
        role: input.role,
        address: targets[target],
        abi: abis[target],
        functionName: input.functionName,
        args: input.args,
        value: input.value ?? 0n,
        estimateCap: input.estimateCap,
      },
      input.simulateOnly === true,
    )
  } else if (command === 'max16') {
    const maxLadder = planLadder({
      mid: 0.033,
      mode: 'WIDE',
      sigmaDaily: 0.01,
      budgetQuote: 0.96,
      params,
      manual: { low: 0.0327525, high: 0.0332475 },
    })
    if (maxLadder.orders.length !== 16)
      throw new Error('Max ladder must contain16 orders')
    await save('s2-max16-plan', maxLadder)
    await operation('s2-provision-max16', {
      role: 'DEPLOYER',
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 'batchProvisionLiquidity',
      args: batchProvisionArgs(maxLadder),
    })
  } else if (command === 'status') {
    const counter = await publicClient.readContract({
      address: market,
      abi: kuruOrderbookAbi,
      functionName: 's_orderIdCounter',
    })
    const activeOrders = []
    for (let id = 1n; id <= BigInt(counter); id++) {
      const order = await publicClient.readContract({
        address: market,
        abi: kuruOrderbookAbi,
        functionName: 's_orders',
        args: [id],
      })
      if (order[1] > 0n)
        activeOrders.push({
          id,
          owner: order[0],
          size: order[1],
          flippedId: order[4],
          price: order[5],
          flippedPrice: order[6],
          isBuy: order[7],
        })
    }
    const result = {
      chainId: 10143,
      market,
      params,
      activeOrders,
      bestBidAsk: await publicClient.readContract({
        address: market,
        abi: kuruOrderbookAbi,
        functionName: 'bestBidAsk',
      }),
      l2Book: await publicClient.readContract({
        address: market,
        abi: kuruOrderbookAbi,
        functionName: 'getL2Book',
      }),
      balances: await balances(),
      blockNumber: await publicClient.getBlockNumber(),
    }
    await save('s2-current-state', result)
    console.log(json(result))
  } else
    throw new Error(
      `Unknown command ${command}; deploy, fund, provision, call, max16, status`,
    )
}
