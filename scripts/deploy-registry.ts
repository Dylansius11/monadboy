import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { Abi, Address, Hex } from '../packages/sdk/node_modules/viem'
import type * as Viem from '../packages/sdk/node_modules/viem'
import type * as ViemAccounts from '../packages/sdk/node_modules/viem/accounts'
import type * as ViemChains from '../packages/sdk/node_modules/viem/chains'

// Resolve the existing SDK dependency, independent of the caller's working directory.
const require = createRequire(
  new URL('../packages/sdk/package.json', import.meta.url),
)
const {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  getAddress,
  getContractAddress,
  http,
  keccak256,
  parseEther,
  size,
} = require('viem') as typeof Viem
const { privateKeyToAccount } = require('viem/accounts') as typeof ViemAccounts
const { monadTestnet } = require('viem/chains') as typeof ViemChains
const artifactPath = new URL(
  '../contracts/out/DiskRegistry.sol/DiskRegistry.json',
  import.meta.url,
)
const configPath = new URL(
  '../packages/sdk/src/deployments.testnet.json',
  import.meta.url,
)
const envPath = new URL(
  '../../handoff/monadboy/wallets.testnet.env',
  import.meta.url,
)
const evidencePath = new URL(
  '../../handoff/monadboy/registry-deployment.testnet.json',
  import.meta.url,
)
const json = (value: unknown) =>
  `${JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item), 2)}\n`

interface Deployment {
  chainId: number
  diskRegistry: {
    address: Address
    transactionHash: Hex
    blockNumber: string
    gasUsed: string
    gasLimit: string
    codeBytes: number
    gasEstimated: string
    effectiveGasPrice: string
    runtimeCodeHash: Hex
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(
      'Usage: bun scripts/deploy-registry.ts [--broadcast]\nDefault: estimate only, no signing or file writes.\nReads DEPLOYER_PRIVATE_KEY and DEPLOYER_ADDRESS from environment or approved external wallets.testnet.env.\nTESTNET_RPC_URL overrides the public testnet RPC. Existing verified deployment is reused.\nPublic receipt evidence: ../handoff/monadboy/registry-deployment.testnet.json',
    )
    return
  }
  if (args.some((arg) => arg !== '--broadcast') || args.length > 1)
    throw new Error('Use only --broadcast or --help')
  const broadcast = args.includes('--broadcast')
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as {
    abi: Abi
    bytecode: { object: Hex }
    deployedBytecode: { object: Hex }
  }
  const runtime = artifact.deployedBytecode.object
  if (
    !/^0x[0-9a-f]+$/i.test(artifact.bytecode.object) ||
    !/^0x[0-9a-f]+$/i.test(runtime) ||
    size(runtime) !== 1885
  ) {
    throw new Error(
      'Compiled DiskRegistry artifact must contain creation bytecode and 1885-byte runtime',
    )
  }
  const data = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
  })
  const transport = http(
    process.env.TESTNET_RPC_URL ?? 'https://testnet-rpc.monad.xyz',
    { retryCount: 0 },
  )
  const client = createPublicClient({
    chain: monadTestnet,
    transport,
  })
  if ((await client.getChainId()) !== 10143)
    throw new Error('Refusing non-Monad-testnet chain; expected 10143')

  async function verify(hash: Hex, expectedAddress?: Address) {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 3,
      timeout: 120_000,
    })
    if (receipt.status !== 'success' || !receipt.contractAddress)
      throw new Error(
        'Registry deployment receipt must be successful contract creation',
      )
    const address = getAddress(receipt.contractAddress)
    if (expectedAddress && address !== getAddress(expectedAddress))
      throw new Error('Deployment address mismatch')
    const [code, transaction] = await Promise.all([
      client.getCode({ address }),
      client.getTransaction({ hash }),
    ])
    if (
      !code ||
      size(code) !== 1885 ||
      code.toLowerCase() !== runtime.toLowerCase()
    )
      throw new Error(
        'Onchain registry runtime does not match the compiled 1885-byte artifact',
      )
    if (
      transaction.to !== null ||
      transaction.input.toLowerCase() !== data.toLowerCase() ||
      transaction.chainId !== 10143
    ) {
      throw new Error(
        'Receipt transaction does not deploy this artifact on chain 10143',
      )
    }
    return { receipt, address, transaction, runtimeCodeHash: keccak256(code) }
  }

  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Deployment
    if (config.chainId !== 10143)
      throw new Error('Existing deployment config has wrong chain')
    const observed = await verify(
      config.diskRegistry.transactionHash,
      config.diskRegistry.address,
    )
    if (
      config.diskRegistry.blockNumber !==
        observed.receipt.blockNumber.toString() ||
      config.diskRegistry.gasUsed !== observed.receipt.gasUsed.toString() ||
      config.diskRegistry.gasLimit !== observed.transaction.gas.toString() ||
      config.diskRegistry.codeBytes !== 1885
    )
      throw new Error(
        'Existing deployment config disagrees with chain evidence',
      )
    console.log(
      json({ mode: 'existing-deployment', broadcast: false, ...config }),
    )
    return
  }

  // Parse secrets only in memory; never log env values or viem error objects.
  const ops: Record<string, string> = {}
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(
        line,
      )
      if (match) ops[match[1]!] = match[2]!.replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  const key = process.env.DEPLOYER_PRIVATE_KEY ?? ops.DEPLOYER_PRIVATE_KEY
  const expected = process.env.DEPLOYER_ADDRESS ?? ops.DEPLOYER_ADDRESS
  if (
    !key ||
    !/^0x[0-9a-f]{64}$/i.test(key) ||
    !expected ||
    !/^0x[0-9a-f]{40}$/i.test(expected)
  ) {
    throw new Error(
      'Provide approved DEPLOYER_PRIVATE_KEY and DEPLOYER_ADDRESS',
    )
  }
  const account = privateKeyToAccount(key as Hex)
  if (account.address !== getAddress(expected))
    throw new Error('DEPLOYER key does not match approved role address')

  async function record(
    hash: Hex,
    gasEstimated: string,
    expectedAddress: Address,
    balanceBeforeWei: string,
  ) {
    const { receipt, address, transaction, runtimeCodeHash } = await verify(
      hash,
      expectedAddress,
    )
    if (getAddress(transaction.from) !== account.address)
      throw new Error('Deployment sender is not approved DEPLOYER')
    const config: Deployment = {
      chainId: 10143,
      diskRegistry: {
        address,
        transactionHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        gasLimit: transaction.gas.toString(),
        codeBytes: 1885,
        gasEstimated,
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        runtimeCodeHash,
      },
    }
    writeFileSync(
      evidencePath,
      json({
        status: 'success',
        ...config,
        deployer: account.address,
        nonce: transaction.nonce,
        balanceBeforeWei,
        balanceAfterWei: await client.getBalance({ address: account.address }),
        limitBasedFeeWei: transaction.gas * receipt.effectiveGasPrice,
        receipt,
        artifact: 'contracts/out/DiskRegistry.sol/DiskRegistry.json',
        runtimeArtifactMatch: true,
        explorerTransaction: `https://testnet.monadscan.com/tx/${hash}`,
        explorerAddress: `https://testnet.monadscan.com/address/${address}`,
      }),
    )
    writeFileSync(configPath, json(config))
    console.log(
      json({
        mode: 'confirmed',
        ...config,
        evidenceFile: fileURLToPath(evidencePath),
      }),
    )
  }

  // Save the hash before waiting, so interruption never silently causes another deployment.
  if (existsSync(evidencePath)) {
    const previous = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      chainId: number
      deployer: Address
      transactionHash?: Hex
      diskRegistry?: Deployment['diskRegistry']
      gasEstimated: string
      address: Address
      balanceBeforeWei: string
    }
    if (
      previous.chainId !== 10143 ||
      getAddress(previous.deployer) !== account.address
    )
      throw new Error(
        'Existing public evidence belongs to another chain or sender',
      )
    const hash =
      previous.transactionHash ?? previous.diskRegistry?.transactionHash
    if (!hash)
      throw new Error(
        'Existing public evidence has no deployment hash; reconcile it before broadcasting',
      )
    if (!broadcast) {
      console.log(
        json({
          mode: 'recorded-deployment',
          broadcast: false,
          transactionHash: hash,
          action:
            'Use --broadcast to verify receipt and restore config; no new deployment will be sent',
        }),
      )
      return
    }
    await record(
      hash,
      previous.diskRegistry?.gasEstimated ?? previous.gasEstimated,
      previous.diskRegistry?.address ?? previous.address,
      previous.balanceBeforeWei,
    )
    return
  }

  const [nonce, pendingNonce, balance, senderCode] = await Promise.all([
    client.getTransactionCount({
      address: account.address,
      blockTag: 'latest',
    }),
    client.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    }),
    client.getBalance({ address: account.address }),
    client.getCode({ address: account.address }),
  ])
  if (nonce !== pendingNonce)
    throw new Error(
      'DEPLOYER has pending transactions; do not risk nonce collision',
    )
  if (senderCode && senderCode !== '0x')
    throw new Error('DEPLOYER must be an undelegated EOA')
  // This is a one-time registry command. A used sender without evidence needs reconciliation.
  if (nonce !== 0)
    throw new Error(
      'DEPLOYER nonce is nonzero without registry evidence; reconcile prior deployments before signing',
    )
  const address = getContractAddress({
    from: account.address,
    nonce: BigInt(nonce),
  })
  const existingCode = await client.getCode({ address })
  if (existingCode && existingCode !== '0x')
    throw new Error(
      'Predicted registry address already has code; reconcile existing deployment',
    )
  const gasEstimated = await client.estimateGas({ account, data })
  const gasLimit = (gasEstimated * 120n + 99n) / 100n
  if (gasLimit <= 0n || gasLimit > 30_000_000n)
    throw new Error('Estimated gas exceeds Monad transaction bound')
  const fees = await client.estimateFeesPerGas()
  if (balance - gasLimit * fees.maxFeePerGas < parseEther('10'))
    throw new Error('Deployment would violate 10 MON reserve floor')
  console.log(
    json({
      mode: broadcast ? 'broadcast-plan' : 'dry-run',
      chainId: 10143,
      deployer: account.address,
      nonce,
      predictedAddress: address,
      gasEstimated,
      gasLimit,
      headroomPercent: 20,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      maxFeeWei: gasLimit * fees.maxFeePerGas,
      balanceWei: balance,
      codeBytes: 1885,
    }),
  )
  if (!broadcast) return
  if (
    (await client.getChainId()) !== 10143 ||
    (await client.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    })) !== nonce
  ) {
    throw new Error('Chain or DEPLOYER nonce changed before broadcast')
  }
  const wallet = createWalletClient({ account, chain: monadTestnet, transport })
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    gas: gasLimit,
    nonce,
    ...fees,
  })
  console.log(
    json({ mode: 'submitted', chainId: 10143, transactionHash: hash }),
  )
  writeFileSync(
    evidencePath,
    json({
      status: 'submitted',
      chainId: 10143,
      deployer: account.address,
      transactionHash: hash,
      address,
      nonce,
      gasEstimated,
      gasLimit,
      balanceBeforeWei: balance.toString(),
    }),
  )
  await record(hash, gasEstimated.toString(), address, balance.toString())
}

main().catch(() => {
  // Provider/signing errors may contain request bodies; do not expose them with role keys loaded.
  console.error(
    'Registry deployment stopped. Check chain 10143, approved role env, funding, artifact and existing public evidence. No automatic rebroadcast or fallback is performed.',
  )
  process.exitCode = 1
})
