import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Run `forge build` in contracts/, then `bun packages/sdk/scripts/generate-disk-registry-abi.ts`.
const artifact = fileURLToPath(new URL('../../../contracts/out/DiskRegistry.sol/DiskRegistry.json', import.meta.url))
const destination = fileURLToPath(new URL('../src/abi/', import.meta.url))
const { abi }: { abi: unknown[] } = JSON.parse(readFileSync(artifact, 'utf8'))
const items = abi.map((item) => `  ${JSON.stringify(item)},`).join('\n')
mkdirSync(destination, { recursive: true })
writeFileSync(new URL('../src/abi/disk-registry.ts', import.meta.url),
  `// Generated from contracts/out/DiskRegistry.sol/DiskRegistry.json; run scripts/generate-disk-registry-abi.ts.\nexport const diskRegistryAbi = [\n${items}\n] as const\n`)
