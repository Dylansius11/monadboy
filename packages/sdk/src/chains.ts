export { monadTestnet, monad } from 'viem/chains'

export type CHAIN = 'testnet' | 'mainnet'

// Pass browser env explicitly; Node/Bun callers may use process.env by default.
export function rpcUrl(chain: CHAIN, env: Record<string, string | undefined> =
  typeof process === 'undefined' ? {} : process.env): string {
  return chain === 'testnet'
    ? env.MONAD_TESTNET_RPC_URL ?? 'https://testnet-rpc.monad.xyz'
    : env.MONAD_MAINNET_RPC_URL ?? 'https://rpc.monad.xyz'
}
