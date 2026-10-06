import { decodeAbiParameters, encodeFunctionData, zeroAddress } from 'viem'
import type { Address, PublicClient } from 'viem'
import { erc20Abi } from '@monadboy/sdk'
import { errorMentions } from '../logger'

export type TransferCheck = {
  clean: boolean
  status: 'passed' | 'failed' | 'unavailable'
}
export type TransferProbe = (
  token: Address,
) => Promise<'ok' | 'refused' | 'no-balance'>

// Dead-address recipient: a simulated transfer never changes state.
const SINK: Address = '0x000000000000000000000000000000000000dEaD'

// Simulates a 1-unit transfer out of a holder (eth_call, never broadcast). It is a
// sellability gate for the token, not proof against address-specific restrictions.
export function createTransferProbe(
  client: PublicClient,
  holder: Address,
): TransferProbe {
  return async (token) => {
    const balance = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [holder],
    })
    if (balance < 1n) return 'no-balance'
    try {
      const { data } = await client.call({
        account: holder,
        to: token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [SINK, 1n],
        }),
      })
      // Tokens that return nothing (non-standard) succeeded if the call did not revert.
      if (
        data &&
        data !== '0x' &&
        !decodeAbiParameters([{ type: 'bool' }], data)[0]
      )
        return 'refused'
      return 'ok'
    } catch (error) {
      // A revert is the token refusing; anything else is an unreadable network.
      if (errorMentions(error, 'revert')) return 'refused'
      throw error
    }
  }
}

// Fails closed: a token that cannot be probed is not clean. Native MON (zero address) has no token to probe.
export async function checkTransfers(
  probe: TransferProbe,
  tokens: readonly Address[],
): Promise<TransferCheck> {
  for (const token of tokens) {
    if (token === zeroAddress) continue
    try {
      const result = await probe(token)
      if (result === 'refused') return { clean: false, status: 'failed' }
      if (result === 'no-balance')
        return { clean: false, status: 'unavailable' }
    } catch {
      return { clean: false, status: 'unavailable' }
    }
  }
  return { clean: true, status: 'passed' }
}
