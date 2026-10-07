import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { evidenceDir, json, save } from './runtime'

// Only named public spike JSON is read; the operations env is never part of this report.
const measurements = []
const simulations = []
for (const file of (await readdir(evidenceDir))
  .filter((name) => /^s[12]-.*\.json$/.test(name))
  .sort()) {
  const evidence = JSON.parse(
    await readFile(resolve(evidenceDir, file), 'utf8'),
  )
  if (evidence.receipt) {
    measurements.push({
      file,
      operation: evidence.functionName,
      label: evidence.label,
      transactionHash: evidence.transactionHash,
      blockNumber: evidence.receipt.blockNumber,
      status: evidence.receipt.status,
      estimate: evidence.estimate,
      estimateCap: evidence.estimateCap,
      gasLimit: evidence.gasLimit,
      gasUsed: evidence.receipt.gasUsed,
      effectiveGasPrice: evidence.receipt.effectiveGasPrice,
      chargedWei: (
        BigInt(evidence.gasLimit) * BigInt(evidence.receipt.effectiveGasPrice)
      ).toString(),
      args: evidence.args,
      value: evidence.value,
      events: evidence.events,
    })
  } else if (evidence.functionName) {
    simulations.push({
      file,
      label: evidence.label,
      operation: evidence.functionName,
      timestamp: evidence.timestamp,
      args: evidence.args,
      value: evidence.value,
      status: evidence.status ?? 'refusal',
      result: evidence.simulatedResult,
      estimate: evidence.estimate,
      gasLimit: evidence.gasLimit,
      error: evidence.error,
    })
  }
}
const report = {
  chainId: 10143,
  generatedAt: new Date().toISOString(),
  gasInterpretation:
    'Monad charges declared gas limit. These RPC receipts report gasUsed equal to declared limit; this is not an independent measurement of EVM instruction gas. Keep raw estimates, limits, receipts and traces distinct.',
  measurements,
  simulations,
}
await save('market-funded-public', report)
console.log(json(report))
