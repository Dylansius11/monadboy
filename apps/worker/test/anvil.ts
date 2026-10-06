import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, http } from 'viem'
import type { Abi, Address, Hex, PublicClient } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from '@monadboy/sdk'

export const hasAnvil =
  Bun.which('anvil') !== null && Bun.which('forge') !== null
type Artifact = { abi: Abi; bytecode: string }
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))
const NAMES = [
  'MockToken',
  'MockRevertToken',
  'MockFaucet',
  'MockMargin',
  'MockBook',
]

// Compiles fixtures/LocalChain.sol into a scratch directory; nothing generated is kept in the repo.
function compile(): Record<string, Artifact> {
  const scratch = mkdtempSync(join(tmpdir(), 'local-chain-'))
  try {
    const build = Bun.spawnSync(
      [
        'forge',
        'build',
        '--root',
        fixtures,
        '--contracts',
        fixtures,
        '--out',
        join(scratch, 'out'),
        '--cache-path',
        join(scratch, 'cache'),
      ],
      { stdout: 'ignore', stderr: 'pipe' },
    )
    if (build.exitCode !== 0)
      throw new Error(
        `forge build failed: ${build.stderr.toString().slice(0, 400)}`,
      )
    return Object.fromEntries(
      NAMES.map((name) => {
        const artifact = JSON.parse(
          readFileSync(
            join(scratch, 'out', 'LocalChain.sol', `${name}.json`),
            'utf8',
          ),
        ) as { abi: Abi; bytecode: { object: string } }
        return [name, { abi: artifact.abi, bytecode: artifact.bytecode.object }]
      }),
    )
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

async function freePort(): Promise<number> {
  const probe = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { data() {} },
  })
  const { port } = probe
  probe.stop(true)
  return port
}

// A throwaway local chain that reports Monad testnet's chain id and mines every 0.5 s, so
// "three blocks apart" is real elapsed chain time. Local evidence only: not Monad, not Kuru.
export async function startAnvil() {
  const contracts = compile()
  const port = await freePort()
  const process = Bun.spawn(
    [
      'anvil',
      '--chain-id',
      '10143',
      '--block-time',
      '0.5',
      '--port',
      String(port),
      '--silent',
    ],
    { stdout: 'ignore', stderr: 'ignore' },
  )
  const url = `http://127.0.0.1:${port}`
  const client: PublicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(url),
  })
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await client.getBlockNumber()
      break
    } catch {
      await Bun.sleep(100)
    }
  }
  const setBalance = (address: Address, wei: bigint) =>
    client.request({
      method: 'anvil_setBalance' as never,
      params: [address, `0x${wei.toString(16)}`] as never,
    })
  const deployer = privateKeyToAccount(generatePrivateKey())
  await setBalance(deployer.address, 10n ** 24n)
  const wallet = createWalletClient({
    account: deployer,
    chain: monadTestnet,
    transport: http(url),
  })
  const deploy = async (
    name: string,
    args: unknown[] = [],
  ): Promise<Address> => {
    const artifact = contracts[name]
    const hash = await wallet.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode as Hex,
      args,
      gas: 3_000_000n,
    })
    return (await client.waitForTransactionReceipt({ hash })).contractAddress!
  }
  const write = async (
    address: Address,
    name: string,
    functionName: string,
    args: unknown[],
  ) => {
    const hash = await wallet.writeContract({
      address,
      abi: contracts[name].abi,
      functionName,
      args,
      gas: 500_000n,
    })
    return client.waitForTransactionReceipt({ hash })
  }
  return {
    url,
    client,
    deployer,
    setBalance,
    deploy,
    write,
    abi: (name: string) => contracts[name].abi,
    stop: () => process.kill(),
  }
}
