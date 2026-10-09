type RpcFetchOptions = {
  fetcher?: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
  now?: () => number
  pause?: (ms: number) => Promise<unknown>
}

// Bound one worker's testnet starts to20/s, leaving headroom under the observed
// 50/s account quota for the separate indexer. Responses need not finish in order.
export function createPacedRpcFetch({
  fetcher = fetch,
  now = () => performance.now(),
  pause = (ms) => Bun.sleep(ms),
}: RpcFetchOptions = {}) {
  let queue = Promise.resolve()
  let nextAt = 0
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const slot = queue.then(async () => {
      init?.signal?.throwIfAborted()
      const delay = Math.ceil(nextAt - now())
      if (delay > 0) await pause(delay)
      init?.signal?.throwIfAborted()
      nextAt = now() + 50
    })
    queue = slot.catch(() => {})
    await slot
    return fetcher(input, init)
  }
}

export const testnetRpcFetch = createPacedRpcFetch()
