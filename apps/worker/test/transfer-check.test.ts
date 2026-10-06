import { expect, test } from 'bun:test'
import { zeroAddress } from 'viem'
import { checkTransfers } from '../src/chain/transfer-check'
import type { TransferProbe } from '../src/chain/transfer-check'
import { address } from './helpers'

const tokenA = address('a')
const tokenB = address('b')

test('passes only when every non-native token transfer simulates cleanly, skipping native MON', async () => {
  const seen: string[] = []
  const probe: TransferProbe = async (token) => {
    seen.push(token)
    return 'ok'
  }
  expect(await checkTransfers(probe, [zeroAddress, tokenA, tokenB])).toEqual({
    clean: true,
    status: 'passed',
  })
  expect(seen).toEqual([tokenA, tokenB])
})

test('a token that refuses the transfer fails the gate and later tokens are not trusted', async () => {
  const seen: string[] = []
  const probe: TransferProbe = async (token) => {
    seen.push(token)
    return token === tokenA ? 'refused' : 'ok'
  }
  expect(await checkTransfers(probe, [tokenA, tokenB])).toEqual({
    clean: false,
    status: 'failed',
  })
  expect(seen).toEqual([tokenA])
})

test('no simulation inventory and network errors fail closed as unavailable, not as clean', async () => {
  expect(await checkTransfers(async () => 'no-balance', [tokenA])).toEqual({
    clean: false,
    status: 'unavailable',
  })
  expect(
    await checkTransfers(async () => {
      throw new Error('offline')
    }, [tokenA]),
  ).toEqual({ clean: false, status: 'unavailable' })
})

test('a market of only native assets has nothing to probe and is clean', async () => {
  expect(await checkTransfers(async () => 'refused', [zeroAddress])).toEqual({
    clean: true,
    status: 'passed',
  })
})
