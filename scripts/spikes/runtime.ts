import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Abi, Address } from 'viem'
import { monadTestnet, rpcUrl } from '../../packages/sdk/src/chains'
import { erc20Abi } from '../../packages/sdk/src/abi/erc20'
import { kuruMarginAccountAbi } from '../../packages/sdk/src/abi/kuru-margin-account'
import { kuruOrderbookAbi } from '../../packages/sdk/src/abi/kuru-orderbook'
import { kuruRouterAbi } from '../../packages/sdk/src/abi/kuru-router'
import { ausdFaucetAbi } from '../../packages/sdk/src/abi/ausd-faucet'
const requireSdk = createRequire(
  new URL('../../packages/sdk/package.json', import.meta.url),
)
// viem belongs to the SDK workspace, not the root scripts package; resolve its installed path at runtime.
export const viem = await import(pathToFileURL(requireSdk.resolve('viem')).href)
const {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  http,
  parseEther,
} = viem
const { privateKeyToAccount } = await import(
  pathToFileURL(requireSdk.resolve('viem/accounts')).href
)

export const addresses = {
  router: '0x7EFbE105Ca7415dE98F96622173458ac1c054630',
  margin: '0xd029C2D98ff85D8F64799017fE00a59B1159CE02',
  ausd: '0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC',
  faucet: '0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C',
} as const
export const evidenceDir = resolve('../handoff/monadboy')
// Serialize RPC fetch starts below the public endpoint's 15 requests/second cap.
let rpcQueue = Promise.resolve()
const transport = http(rpcUrl('testnet'), {
  retryCount: 2,
  fetchFn: async (input, init) => {
    const previous = rpcQueue
    const gate = Promise.withResolvers<void>()
    rpcQueue = gate.promise
    await previous
    try {
      const response = await fetch(input, init)
      const delay = Promise.withResolvers<void>()
      setTimeout(delay.resolve, 150)
      await delay.promise
      return response
    } finally {
      gate.resolve()
    }
  },
})
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport,
})
export const broadcast = process.argv.includes('--broadcast')
export const json = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v),
    2,
  )
export async function save(name: string, value: unknown) {
  await writeFile(resolve(evidenceDir, `${name}.json`), json(value) + '\n')
}
export async function code(address: Address) {
  const bytecode = await publicClient.getCode({ address })
  if (!bytecode || bytecode === '0x')
    throw new Error(`No testnet bytecode at ${address}`)
  return (bytecode.length - 2) / 2
}
export async function roles() {
  const entries: Record<string, string> = {}
  const source = await readFile(
    resolve(
      process.env.OPS_ENV_PATH ?? '../handoff/monadboy/wallets.testnet.env',
    ),
    'utf8',
  )
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\s#]+)["']?\s*$/)
    if (match) entries[match[1]] = match[2]
  }
  return Object.fromEntries(
    ['DEPLOYER', 'BOT', 'DRIP'].map((role) => {
      const key =
        process.env[`${role}_PRIVATE_KEY`] ?? entries[`${role}_PRIVATE_KEY`]
      const expected =
        process.env[`${role}_ADDRESS`] ?? entries[`${role}_ADDRESS`]
      if (!key || !expected)
        throw new Error(`Missing ${role} credentials/address`)
      const account = privateKeyToAccount(key as `0x${string}`)
      if (account.address.toLowerCase() !== expected.toLowerCase())
        throw new Error(`${role} address mismatch`)
      return [role, account]
    }),
  )
}
export async function assertChain() {
  if ((await publicClient.getChainId()) !== 10143)
    throw new Error('Writes require testnet 10143')
}
export async function balances() {
  const accounts = await roles()
  const result: Record<string, unknown> = {}
  for (const [role, account] of Object.entries(accounts)) {
    const [native, ausd, marginNative, marginAusd] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.readContract({
        address: addresses.ausd,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      }),
      publicClient.readContract({
        address: addresses.margin,
        abi: kuruMarginAccountAbi,
        functionName: 'getBalance',
        args: [account.address, '0x0000000000000000000000000000000000000000'],
      }),
      publicClient.readContract({
        address: addresses.margin,
        abi: kuruMarginAccountAbi,
        functionName: 'getBalance',
        args: [account.address, addresses.ausd],
      }),
    ])
    result[role] = {
      address: account.address,
      native,
      mon: formatEther(native),
      ausd,
      marginNative,
      marginAusd,
    }
  }
  return result
}
const eventAbi = [
  ...kuruOrderbookAbi,
  ...kuruRouterAbi,
  ...kuruMarginAccountAbi,
  ...erc20Abi,
] as const
export type Call = {
  role: string
  address: Address
  abi: Abi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
  estimateCap?: bigint
}
export async function operation(
  label: string,
  call: Call,
  simulateOnly = false,
) {
  await assertChain()
  await code(call.address)
  if (
    call.role === 'DEPLOYER' &&
    broadcast &&
    !simulateOnly &&
    !process.argv.includes('--deployer-released')
  )
    throw new Error('DEPLOYER nonce ownership not released')
  const account = (await roles())[call.role]
  if (!account) throw new Error(`Unknown role ${call.role}`)
  const data = encodeFunctionData({
    abi: call.abi,
    functionName: call.functionName,
    args: call.args,
  })
  const request = { account, to: call.address, data, value: call.value ?? 0n }
  const before = await balances()
  const record: Record<string, unknown> = {
    label,
    chainId: 10143,
    timestamp: new Date().toISOString(),
    sender: account.address,
    address: call.address,
    functionName: call.functionName,
    args: call.args ?? [],
    value: request.value,
    before,
  }
  let simulation
  try {
    const abi = [
      ...call.abi,
      ...kuruMarginAccountAbi.filter((item) => item.type === 'error'),
    ]
    simulation = await publicClient.simulateContract({
      account,
      address: call.address,
      abi,
      functionName: call.functionName,
      args: call.args,
      value: request.value,
    })
    if (
      call.estimateCap !== undefined &&
      (call.estimateCap <= 0n || call.estimateCap > 30_000_000n)
    )
      throw new Error('Invalid estimation gas cap')
    record.estimateCap = call.estimateCap
    const estimate = await publicClient.estimateGas({
      ...request,
      gas: call.estimateCap,
    })
    const gasLimit = (estimate * 120n + 99n) / 100n
    if (gasLimit > 30_000_000n)
      throw new Error(`Gas limit exceeds chain transaction cap: ${gasLimit}`)
    record.simulatedResult = simulation.result
    record.estimate = estimate
    record.gasLimit = gasLimit
    if (!broadcast || simulateOnly) {
      record.status = 'simulation'
      await save(label, record)
      console.log(json(record))
      return record
    }
    const fees = await publicClient.estimateFeesPerGas()
    const balance = await publicClient.getBalance({ address: account.address })
    if (
      balance - request.value - gasLimit * fees.maxFeePerGas <
      parseEther('10')
    )
      throw new Error(
        'Operation would breach 10 MON reserve; no exception used',
      )
    await assertChain()
    const wallet = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    })
    const hash = await wallet.sendTransaction({
      ...request,
      gas: gasLimit,
      ...fees,
    })
    record.transactionHash = hash
    record.status = 'submitted'
    await save(label, record)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    record.receipt = receipt
    record.events = receipt.logs.map((log) => {
      try {
        return {
          address: log.address,
          logIndex: log.logIndex,
          ...decodeEventLog({
            abi: eventAbi,
            topics: log.topics,
            data: log.data,
          }),
        }
      } catch {
        return {
          address: log.address,
          logIndex: log.logIndex,
          topics: log.topics,
          data: log.data,
        }
      }
    })
    record.status = receipt.status
    record.after = await balances()
    await save(label, record)
    console.log(json(record))
    if (receipt.status !== 'success')
      throw new Error(`Receipt reverted: ${hash}`)
    return record
  } catch (error) {
    // viem's shortMessage/metaMessages describe public calldata, never key material.
    const e = error as {
      shortMessage?: string
      message?: string
      metaMessages?: string[]
      cause?: { data?: unknown; name?: string }
    }
    record.error = {
      message: e.shortMessage ?? e.message,
      metaMessages: e.metaMessages,
      causeName: e.cause?.name,
      data: e.cause?.data,
    }
    await save(label, record)
    console.log(json(record))
    throw new Error(`${label}: ${e.shortMessage ?? e.message}`)
  }
}
export async function priorEvidence() {
  return (await readdir(evidenceDir)).filter(
    (name) => /market|funded|deploy/i.test(name) && name.endsWith('.json'),
  )
}
export {
  erc20Abi,
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  kuruRouterAbi,
  ausdFaucetAbi,
}
