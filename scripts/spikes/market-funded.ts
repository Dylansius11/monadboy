import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  addresses,
  assertChain,
  ausdFaucetAbi,
  balances,
  code,
  erc20Abi,
  evidenceDir,
  json,
  operation,
  priorEvidence,
  publicClient,
  roles,
  save,
  viem,
} from './runtime'
const { getAddress } = viem

const command = process.argv[2] ?? 'status'
await assertChain()
const codeBytes = Object.fromEntries(
  await Promise.all(
    Object.entries(addresses).map(async ([name, address]) => [
      name,
      await code(address),
    ]),
  ),
)
const accounts = await roles()
if (command === 'status') {
  console.log(
    json({
      chainId: 10143,
      codeBytes,
      balances: await balances(),
      priorEvidence: await priorEvidence(),
    }),
  )
} else if (command === 's1') {
  const token = await publicClient.readContract({
    address: addresses.faucet,
    abi: ausdFaucetAbi,
    functionName: 'token',
  })
  if (getAddress(token) !== getAddress(addresses.ausd))
    throw new Error('Faucet token mismatch')
  const previous = await publicClient.readContract({
    address: addresses.ausd,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [accounts.BOT.address],
  })
  if (previous < 1_000_000_000n) {
    await operation('s1-bot-faucet', {
      role: 'BOT',
      address: addresses.faucet,
      abi: ausdFaucetAbi,
      functionName: 'requestFunds',
      args: [accounts.BOT.address],
    })
  }
  for (const [scenario, sender, recipient] of [
    ['repeat-recipient', 'BOT', accounts.BOT.address],
    ['other-sender', 'DRIP', accounts.BOT.address],
    ['same-sender-new-recipient', 'BOT', accounts.DEPLOYER.address],
  ] as const) {
    try {
      await operation(
        `s1-bot-${scenario}`,
        {
          role: sender,
          address: addresses.faucet,
          abi: ausdFaucetAbi,
          functionName: 'requestFunds',
          args: [recipient],
        },
        true,
      )
    } catch (error) {
      const evidence = JSON.parse(
        await readFile(resolve(evidenceDir, `s1-bot-${scenario}.json`), 'utf8'),
      )
      if (
        !JSON.stringify(evidence.error ?? {}).includes('MaxFrequencyExceeded')
      )
        throw error
    }
  }
  // Verified AgoraFaucet implementation exposes global cooldown and balance cap.
  const faucetReadAbi = [
    'faucetDripAmount',
    'maxAmountToOwn',
    'maxDripFrequency',
    'lastDripTimestamp',
  ].map((name) => ({
    type: 'function' as const,
    name,
    stateMutability: 'view' as const,
    inputs: [],
    outputs: [{ type: 'uint256' }],
  }))
  const configuration: Record<string, unknown> = {}
  for (const item of faucetReadAbi)
    configuration[item.name] = await publicClient.readContract({
      address: addresses.faucet,
      abi: faucetReadAbi,
      functionName: item.name,
    })
  await save('s1-faucet-configuration', {
    configuration,
    source:
      'https://testnet.monadscan.com/address/0xba804DF5c476E8EaeF87BF8085F295300ccE2a49#code',
  })
  for (const role of ['DRIP', 'DEPLOYER']) {
    const balance = await publicClient.readContract({
      address: addresses.ausd,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [accounts[role].address],
    })
    if (balance < 1_000_000_000n)
      await operation(`s1-bot-transfer-${role.toLowerCase()}`, {
        role: 'BOT',
        address: addresses.ausd,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [accounts[role].address, 1_000_000_000n - balance],
      })
  }
  const result = {
    chainId: 10143,
    codeBytes,
    token,
    blockNumber: await publicClient.getBlockNumber(),
    balances: await balances(),
  }
  await save('s1-supply', result)
  console.log(json(result))
} else if (command === 'evidence') {
  for (const name of await priorEvidence()) {
    console.log(
      `${name}\n${await readFile(resolve(evidenceDir, name), 'utf8')}`,
    )
  }
} else {
  throw new Error(`Unknown command ${command}; expected status, s1, evidence`)
}
