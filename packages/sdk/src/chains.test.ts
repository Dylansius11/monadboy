import { describe, expect, it } from 'vitest'
import { rpcUrl } from './chains'

describe('RPC environment selection', () => {
  it('honours worker testnet and mainnet overrides independently', () => {
    const env = { TESTNET_RPC_URL: 'https://test.example', MAINNET_RPC_URL: 'https://main.example' }
    expect(rpcUrl('testnet', env)).toBe('https://test.example')
    expect(rpcUrl('mainnet', env)).toBe('https://main.example')
  })

  it('honours the explicit browser testnet override without leaking it to mainnet', () => {
    const env = { VITE_TESTNET_RPC_URL: 'https://browser.example' }
    expect(rpcUrl('testnet', env)).toBe('https://browser.example')
    expect(rpcUrl('mainnet', env)).toBe('https://rpc.monad.xyz')
  })

  it('uses the worker testnet key when both contexts are supplied', () => {
    expect(rpcUrl('testnet', {
      TESTNET_RPC_URL: 'https://worker.example', VITE_TESTNET_RPC_URL: 'https://browser.example',
    })).toBe('https://worker.example')
  })

  it('uses public defaults when overrides are absent', () => {
    expect(rpcUrl('testnet', {})).toBe('https://testnet-rpc.monad.xyz')
    expect(rpcUrl('mainnet', {})).toBe('https://rpc.monad.xyz')
  })
})
