import { expect, test } from 'bun:test'
import {
  createTreasuryMonitor,
  treasurySection,
} from '../src/jobs/treasury-monitor'
import { address, quiet } from './helpers'

const wallets = [
  { role: 'bot' as const, address: address('1') },
  { role: 'drip' as const, address: address('2') },
]
const floor = { mon: 10n ** 18n, ausd: 10_000_000n }

test('before the first read the section is unread, not ok, and raises no alarm', () => {
  const monitor = createTreasuryMonitor({
    wallets,
    read: async () => ({ mon: 0n, ausd: 0n }),
    logger: quiet,
  })
  const section = treasurySection(monitor, floor, () => 0)()
  expect(section.value).toMatchObject({ status: 'unread' })
  expect(section.amber).toBeUndefined()
})

test('a wallet under either floor turns health amber and names the role; at the floor is fine', async () => {
  const balances: Record<string, { mon: bigint; ausd: bigint }> = {
    [address('1')]: { mon: 5n * 10n ** 18n, ausd: 10_000_000n },
    [address('2')]: { mon: 10n ** 18n - 1n, ausd: 50_000_000n },
  }
  const monitor = createTreasuryMonitor({
    wallets,
    read: async (wallet) => balances[wallet],
    now: () => 1000,
    logger: quiet,
  })
  await monitor.tick()
  const section = treasurySection(monitor, floor, () => 4000)()
  expect(section.amber).toBe('testnet-supply-low:drip')
  expect(section.value).toMatchObject({
    status: 'low',
    wallets: [
      { role: 'bot', mon: '5', ausd: '10', ageMs: 3000, error: null },
      { role: 'drip', mon: '0.999999999999999999', ausd: '50' },
    ],
  })
})

test('a failed read keeps the last balances with the error, so a stale number is never shown as fresh', async () => {
  let down = false
  const monitor = createTreasuryMonitor({
    wallets: wallets.slice(0, 1),
    read: async () => {
      if (down) throw new Error('GET https://rpc.example/?key=s3cret failed')
      return { mon: 10n ** 18n, ausd: 10_000_000n }
    },
    now: () => 1000,
    logger: quiet,
  })
  await monitor.tick()
  down = true
  await monitor.tick()
  const section = treasurySection(monitor, floor, () => 1000)()
  expect(section.value).toMatchObject({
    wallets: [{ mon: '1', error: 'Error: GET <url> failed' }],
  })
})

test('with no treasury key configured the section says not-configured', () => {
  expect(treasurySection(null, floor, () => 0)().value).toEqual({
    status: 'not-configured',
    wallets: [],
  })
})
