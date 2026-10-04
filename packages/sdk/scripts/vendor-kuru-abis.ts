import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Extract outside this repository (SDK is not a dependency):
 * npm pack @kuru-labs/kuru-sdk@0.0.95 --pack-destination <temp-dir>
 * tar -xzf <temp-dir>/kuru-labs-kuru-sdk-0.0.95.tgz -C <temp-dir>
 * bun packages/sdk/scripts/vendor-kuru-abis.ts <temp-dir>/package/abi
 */
const source = process.argv[2]
if (!source) throw new Error('Provide the extracted package/abi directory')
const destination = fileURLToPath(new URL('../src/abi/', import.meta.url))
mkdirSync(destination, { recursive: true })
const files = [
  ['OrderBook', 'kuru-orderbook', 'kuruOrderbookAbi'],
  ['MarginAccount', 'kuru-margin-account', 'kuruMarginAccountAbi'],
  ['Router', 'kuru-router', 'kuruRouterAbi'],
  ['IERC20', 'erc20', 'erc20Abi'],
] as const
for (const [artifact, filename, name] of files) {
  const data: { abi: unknown[] } = JSON.parse(readFileSync(resolve(source, `${artifact}.json`), 'utf8'))
  // One ABI item per line keeps generated data reviewable without changing its content.
  const items = data.abi.map((item) => `  ${JSON.stringify(item)},`).join('\n')
  writeFileSync(resolve(destination, `${filename}.ts`),
    `// Generated from @kuru-labs/kuru-sdk@0.0.95; run scripts/vendor-kuru-abis.ts.\nexport const ${name} = [\n${items}\n] as const\n`)
}
