import {
  batchProvisionArgs,
  kuruMarginAccountAbi,
  kuruOrderbookAbi,
  erc20Abi,
  quoteToUnits,
  readMarketParams,
  measuredTestnetGas,
} from '@monadboy/sdk'
import {
  BaseError,
  createWalletClient,
  decodeAbiParameters,
  encodeFunctionData,
  formatUnits,
} from 'viem'
import { CHAIN } from './config'
import { bufferedGas, cancelPairIds, MARGIN, rawQuoteCeil } from './gameplay'
import {
  browserTransport,
  delay,
  rememberSenderBlock,
  waitForSender,
  withSenderLock,
} from './sender'
import type { Address, Hex, PublicClient, TransactionReceipt } from 'viem'
import type { Ladder, Market } from '@monadboy/sdk'
import type { DiskLease } from './card'
import type { PositionRead } from './gameplay'

export type DiskCall = { to: Address; data: Hex; value?: bigint; cap: bigint }
export type StepReceipt = {
  step: string
  hash: Hex
  block: bigint
  estimate: bigint
  gas: bigint
  gasUsed: bigint
  effectiveGasPrice: bigint
  status: TransactionReceipt['status']
}
export type ExecutionStep = {
  step: string
  state: 'checking' | 'broadcast' | 'confirmed' | 'not-sent' | 'unconfirmed'
  detail?: string
  hash?: Hex
  receipt?: StepReceipt
}
export type FundingQuote = {
  ladder: Ladder
  block: bigint
  at: number
  zapRaw: bigint
  depositRaw: bigint
  minimumBaseRaw: bigint
  quotedBase: number
  takerFeeQuote: number
  gasPrice: bigint
  sampleGas: bigint
  gasCostMon: number
  quoteRequired: number
}
const SLIPPAGE_BPS = 100n

/** Prepare, sign, broadcast and confirm separately so an eject during any await revokes the next action. */
export async function sendDiskTransaction(
  client: PublicClient,
  rpc: string,
  lease: DiskLease,
  call: DiskCall,
  step: string,
  publish: (state: ExecutionStep) => void,
): Promise<StepReceipt> {
  return withSenderLock(lease.address, async () => {
    let broadcasting = false
    let hash: Hex | undefined
    let confirmed = false
    try {
      lease.assertLive()
      publish({ step, state: 'checking' })
      await waitForSender(client, lease.address, lease)
      lease.assertLive()
      const code = await client.getCode({ address: call.to })
      lease.assertLive()
      if (!code || code === '0x')
        throw new Error(
          'Required TESTNET contract has no code. No transaction signed.',
        )
      const estimate = await client.estimateGas({
        account: lease.address,
        to: call.to,
        data: call.data,
        value: call.value,
        gas: call.cap,
      })
      lease.assertLive()
      const gas = bufferedGas(estimate, call.cap)
      const wallet = createWalletClient({
        account: lease.account,
        chain: CHAIN,
        transport: browserTransport(rpc),
      })
      const request = await wallet.prepareTransactionRequest({
        account: lease.account,
        to: call.to,
        data: call.data,
        value: call.value,
        gas,
      })
      lease.assertLive()
      const signed = await wallet.signTransaction(request)
      lease.assertLive()
      broadcasting = true
      publish({ step, state: 'broadcast' })
      hash = await client.sendRawTransaction({
        serializedTransaction: signed,
      })
      // A broadcast survives eject; retain the hash and receipt without starting another signature.
      publish({ step, state: 'broadcast', hash })
      const receipt = await client.waitForTransactionReceipt({ hash })
      rememberSenderBlock(lease.address, receipt.blockNumber)
      const proof = {
        step,
        hash,
        block: receipt.blockNumber,
        estimate,
        gas,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        status: receipt.status,
      }
      confirmed = true
      publish({ step, state: 'confirmed', hash, receipt: proof })
      if (receipt.status !== 'success')
        throw new Error(
          `${step} reverted. Check its receipt; prior confirmed steps remain on chain.`,
        )
      return proof
    } catch (error) {
      if (!confirmed)
        publish({
          step,
          state: broadcasting ? 'unconfirmed' : 'not-sent',
          hash,
          detail: broadcasting
            ? 'broadcast outcome or confirmation unavailable; refresh chain state'
            : !lease.isLive()
              ? 'card ejected'
              : 'operation failed before broadcast',
        })
      throw error
    }
  })
}

export async function verifyMarket(
  client: PublicClient,
  market: Market,
  lease: DiskLease,
): Promise<Market> {
  if ((await client.getChainId()) !== CHAIN.id)
    throw new Error('Wrong chain. Only Monad TESTNET 10143 is playable.')
  lease.assertLive()
  for (const address of [market.address, MARGIN, market.quoteToken]) {
    const code = await client.getCode({ address })
    lease.assertLive()
    if (!code || code === '0x')
      throw new Error(
        'Playable market, margin or quote contract is unavailable.',
      )
  }
  const params = await readMarketParams(client, market.address)
  lease.assertLive()
  return { ...market, params }
}

/** Cost in quote of buying `neededBase` from the L2 asks, cheapest first, and the base left unfilled. */
export function walkAsks(
  raw: Hex,
  neededBase: number,
  params: Market['params'],
): { cost: number; remaining: number; askQuote: number } {
  if (!/^0x(?:[a-fA-F0-9]{64}){2,}$/.test(raw))
    throw new Error('TESTNET book quote is unreadable.')
  let offset = 66
  while (offset < raw.length) {
    const price = BigInt(`0x${raw.slice(offset, offset + 64)}`)
    offset += 64
    if (price === 0n) break
    if (offset + 64 > raw.length)
      throw new Error('TESTNET book quote is truncated.')
    offset += 64
  }
  let remaining = neededBase
  let cost = 0
  let askQuote = 0
  while (offset < raw.length) {
    const units = BigInt(`0x${raw.slice(offset, offset + 64)}`)
    offset += 64
    if (units === 0n) break
    const price = Number(units) / Number(params.pricePrecision)
    if (offset + 64 > raw.length) throw new Error('TESTNET asks are truncated.')
    const size = Number(BigInt(`0x${raw.slice(offset, offset + 64)}`)) / Number(params.sizePrecision)
    offset += 64
    askQuote += price * size
    const take = Math.min(remaining, size)
    cost += take * price
    remaining -= take
  }
  return { cost, remaining, askQuote }
}

/** L2 asks are a block-backed preview; depth is read again and the zap simulated before signing. */
export async function quoteFunding(
  client: PublicClient,
  market: Market,
  ladder: Ladder,
  position: PositionRead,
): Promise<FundingQuote> {
  const raw = await client.readContract({
    address: market.address,
    abi: kuruOrderbookAbi,
    functionName: 'getL2Book',
    blockNumber: position.block,
  })
  const sellBaseRaw = ladder.orders
    .filter((order) => !order.isBuy)
    .reduce(
      (total, order) =>
        total +
        (order.sizeUnits * 10n ** BigInt(market.params.baseDecimals)) /
          market.params.sizePrecision,
      0n,
    )
  const minimumBaseRaw =
    sellBaseRaw > position.marginBaseRaw
      ? sellBaseRaw - position.marginBaseRaw
      : 0n
  const neededBase = Number(
    formatUnits(minimumBaseRaw, market.params.baseDecimals),
  )
  const { cost, remaining, askQuote } = walkAsks(raw, neededBase, market.params)
  if (remaining > 1e-9) {
    // About half a ladder's budget buys MON, plus fee and slippage: name what the book can fund.
    const fundable = Math.floor(askQuote * 2 * (1 - market.params.takerFeeBps / 10000) / (1 + Number(SLIPPAGE_BPS) / 10000) * 100) / 100
    throw new Error(
      fundable >= 0.01
        ? `TESTNET asks can fund about ${fundable.toFixed(2)} AUSD right now. Choose that or less, or retry when liquidity returns. No funds moved.`
        : 'TESTNET book has no asks to fund a ladder right now. Retry when liquidity returns. No funds moved.',
    )
  }
  const quoteBeforeFee = cost / (1 - market.params.takerFeeBps / 10000)
  // The zap is not fill-or-kill: it stops once asks run out and keeps the unspent buffer in
  // margin, while minimumBaseRaw (minAmountOut) still refuses a fill short of the ladder.
  const zapRaw = rawQuoteCeil(
    quoteBeforeFee * (1 + Number(SLIPPAGE_BPS) / 10000),
    market.params.quoteDecimals,
  )
  const requiredQuote =
    rawQuoteCeil(ladder.quoteNeeded, market.params.quoteDecimals) + zapRaw
  const depositRaw =
    requiredQuote > position.marginQuoteRaw
      ? requiredQuote - position.marginQuoteRaw
      : 0n
  const gasPrice = await client.getGasPrice()
  // [V] S2 declared/charged samples: approval85305, deposit163923, marginbuy285153, provision2+2=939879/8+8=2668775.
  // Preview is explicitly a measured-shape estimate, never a universal ceiling. Every signed step re-estimates with a bounded cap.
  const sampleGas =
    (depositRaw > 0n
      ? measuredTestnetGas.approveMargin.gasLimit +
        measuredTestnetGas.depositQuote.gasLimit
      : 0n) +
    (zapRaw > 0n ? measuredTestnetGas.marketBuyMarginPartial.gasLimit : 0n) +
    (ladder.levels <= 2
      ? measuredTestnetGas.provision4.gasLimit
      : measuredTestnetGas.provision16.gasLimit)
  return {
    ladder,
    block: position.block,
    at: Date.now(),
    zapRaw,
    depositRaw,
    minimumBaseRaw,
    quotedBase: neededBase,
    takerFeeQuote: quoteBeforeFee - cost,
    gasPrice,
    sampleGas,
    gasCostMon: Number(formatUnits(sampleGas * gasPrice, 18)),
    quoteRequired: Number(formatUnits(depositRaw, market.params.quoteDecimals)),
  }
}

const ZAP_DEPTH_WAIT_MS = 30_000
// Kuru custom errors a margin market buy can revert with (selectors from their signatures).
const ZAP_FAILURE = {
  InsufficientLiquidity:
    'TESTNET asks are too thin to swap for your MON right now, so the swap was not sent. Your AUSD is safe in margin: WITHDRAW returns it, or re-quote to try again.',
  SlippageExceeded:
    'The TESTNET price moved more than 1% before the swap, so it was not sent. Your AUSD is safe in margin: WITHDRAW returns it, or re-quote at the new price.',
  InsufficientBalance:
    'Margin AUSD is short of the swap amount, so it was not sent. Refresh: WITHDRAW returns what is in margin, or re-quote.',
} as const
const ZAP_SELECTORS: Record<string, keyof typeof ZAP_FAILURE> = {
  '0xbb55fd27': 'InsufficientLiquidity',
  '0x8199f5f3': 'SlippageExceeded',
  '0xf4d678b8': 'InsufficientBalance',
}

/** Human copy for a zap revert, or null when the error is not a known swap revert. */
export function zapFailure(error: unknown): string | null {
  if (error instanceof Error && Object.values(ZAP_FAILURE).some((copy) => copy === error.message))
    return error.message
  if (!(error instanceof BaseError)) return null
  // eth_call / eth_estimateGas put the revert bytes on the RPC error (RpcRequestError.data,
  // verified against testnet); contract reads wrap them in RawContractError.data.
  const hexData = (cause: unknown) =>
    typeof cause === 'object' && cause !== null && 'data' in cause && typeof cause.data === 'string' && cause.data.startsWith('0x')
      ? cause.data
      : undefined
  const data = hexData(error.walk((cause) => hexData(cause) !== undefined))
  const name = data ? ZAP_SELECTORS[data.slice(0, 10).toLowerCase()] : undefined
  return name ? ZAP_FAILURE[name] : null
}

export async function fundAndProvision(
  client: PublicClient,
  rpc: string,
  lease: DiskLease,
  market: Market,
  quote: FundingQuote,
  publish: (state: ExecutionStep) => void,
  beforeProvision: () => Promise<void>,
): Promise<StepReceipt[]> {
  const receipts: StepReceipt[] = []
  const send = async (step: string, call: DiskCall) => {
    const proof = await sendDiskTransaction(
      client,
      rpc,
      lease,
      call,
      step,
      publish,
    )
    receipts.push(proof)
    lease.assertLive()
    return proof
  }
  if (Date.now() - quote.at > 60000)
    throw new Error('Quote expired. Refresh the actual book before confirming.')
  const neededBase = Number(formatUnits(quote.minimumBaseRaw, market.params.baseDecimals))
  const zapQuote = Number(formatUnits(quote.zapRaw, market.params.quoteDecimals))
  // Latest-block asks still sell the ladder's MON within the zap's fee/slippage-buffered input.
  const asksCover = async () => {
    const raw = await client.readContract({ address: market.address, abi: kuruOrderbookAbi, functionName: 'getL2Book' })
    lease.assertLive()
    const { cost, remaining } = walkAsks(raw, neededBase, market.params)
    return remaining <= 1e-9 && cost / (1 - market.params.takerFeeBps / 10000) <= zapQuote
  }
  // Re-read before any signature: the quote may be up to a minute old.
  if (quote.zapRaw > 0n && !(await asksCover()))
    throw new Error(
      'TESTNET asks moved since this quote and no longer fund the ladder. Re-quote to see the current price. No funds moved.',
    )
  if (quote.depositRaw > 0n) {
    const allowance = await client.readContract({
      address: market.quoteToken,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [lease.address, MARGIN],
    })
    lease.assertLive()
    if (allowance < quote.depositRaw)
      await send('Approve AUSD', {
        to: market.quoteToken,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [MARGIN, quote.depositRaw],
        }),
        cap: 300000n,
      })
    // S2 proves margin=true consumes margin quote, not a wallet allowance. Deposit BEFORE zap.
    await send('Deposit AUSD', {
      to: MARGIN,
      data: encodeFunctionData({
        abi: kuruMarginAccountAbi,
        functionName: 'deposit',
        args: [lease.address, market.quoteToken, quote.depositRaw],
      }),
      cap: 400000n,
    })
  }
  if (quote.zapRaw > 0n) {
    const step = 'Zap MON to margin'
    // Approve and deposit take several blocks; the market maker may be re-quoting meanwhile.
    // Its ladder refills in one atomic batch, so give it up to one mirror cycle to return.
    publish({ step, state: 'checking', detail: 'checking TESTNET asks' })
    const deadline = Date.now() + ZAP_DEPTH_WAIT_MS
    let covered = await asksCover()
    while (!covered && Date.now() < deadline) {
      publish({ step, state: 'checking', detail: 'waiting for TESTNET asks to refill' })
      await delay(3000)
      lease.assertLive()
      covered = await asksCover()
    }
    if (!covered) {
      publish({ step, state: 'not-sent', detail: 'TESTNET asks too thin' })
      throw new Error(ZAP_FAILURE.InsufficientLiquidity)
    }
    const input = quoteToUnits(zapQuote, market.params)
    // Not fill-or-kill: unspent buffer stays in margin; minAmountOut refuses a short fill.
    const data = encodeFunctionData({
      abi: kuruOrderbookAbi,
      functionName: 'placeAndExecuteMarketBuy',
      args: [input, quote.minimumBaseRaw, true, false],
    })
    try {
      const result = await client.call({ account: lease.address, to: market.address, data, gas: 2000000n })
      lease.assertLive()
      const [output] = decodeAbiParameters([{ type: 'uint256' }], result.data ?? '0x')
      if (output < quote.minimumBaseRaw || quote.minimumBaseRaw === 0n)
        throw new Error(ZAP_FAILURE.SlippageExceeded)
    } catch (error) {
      const copy = zapFailure(error)
      if (!copy) throw error
      publish({ step, state: 'not-sent', detail: 'swap simulation refused' })
      throw new Error(copy)
    }
    try {
      await send(step, { to: market.address, data, cap: 2000000n })
    } catch (error) {
      const copy = zapFailure(error)
      throw copy ? new Error(copy) : error
    }
  }
  await beforeProvision()
  lease.assertLive()
  await send('Provision flip ladder', {
    to: market.address,
    data: encodeFunctionData({
      abi: kuruOrderbookAbi,
      functionName: 'batchProvisionLiquidity',
      args: batchProvisionArgs(quote.ladder),
    }),
    cap: 4000000n,
  })
  return receipts
}

/** Cancellation is freshly estimated; withdrawal uses the disclosed S2 shape until funds unlock. */
export async function quoteExitCost(
  client: PublicClient,
  market: Market,
  owner: Address,
  position: PositionRead,
): Promise<number> {
  let gas = 0n
  for (const isFlip of [true, false]) {
    const orders = position.orders.filter((order) => order.isFlip === isFlip)
    const ids = isFlip ? cancelPairIds(orders) : orders.map((order) => order.id)
    if (!ids.length) continue
    const data = encodeFunctionData({
      abi: kuruOrderbookAbi,
      functionName: isFlip ? 'batchCancelFlipOrders' : 'batchCancelOrders',
      args: [ids],
    })
    gas += bufferedGas(
      await client.estimateGas({
        account: owner,
        to: market.address,
        data,
        gas: 4000000n,
      }),
      4000000n,
    )
  }
  const holdings = position.holdings
  if (
    holdings.marginBase +
      holdings.marginQuote +
      holdings.restingBase +
      holdings.restingQuote >
    0
  ) {
    gas += measuredTestnetGas.withdrawBounded.gasLimit
  }
  return Number(formatUnits(gas * (await client.getGasPrice()), 18))
}

export async function cancelAndWithdraw(
  client: PublicClient,
  rpc: string,
  lease: DiskLease,
  market: Market,
  read: (minimumBlock?: bigint) => Promise<PositionRead>,
  publish: (state: ExecutionStep) => void,
): Promise<{ receipts: StepReceipt[]; position: PositionRead }> {
  const receipts: StepReceipt[] = []
  const position = await read()
  lease.assertLive()
  for (const isFlip of [true, false]) {
    const orders = position.orders.filter((order) => order.isFlip === isFlip)
    const ids = isFlip ? cancelPairIds(orders) : orders.map((order) => order.id)
    if (!ids.length) continue
    receipts.push(
      await sendDiskTransaction(
        client,
        rpc,
        lease,
        {
          to: market.address,
          cap: 4000000n,
          data: encodeFunctionData({
            abi: kuruOrderbookAbi,
            functionName: isFlip
              ? 'batchCancelFlipOrders'
              : 'batchCancelOrders',
            args: [ids],
          }),
        },
        isFlip ? 'Cancel linked flips' : 'Cancel plain orders',
        publish,
      ),
    )
    lease.assertLive()
  }
  const unlocked = await read(receipts.at(-1)?.block)
  lease.assertLive()
  if (unlocked.orders.length)
    throw new Error(
      'Orders changed during exit. Refresh and retry cancellation before withdrawing.',
    )
  if (unlocked.holdings.marginBase > 0 || unlocked.holdings.marginQuote > 0) {
    receipts.push(
      await sendDiskTransaction(
        client,
        rpc,
        lease,
        {
          to: MARGIN,
          cap: 2000000n,
          data: encodeFunctionData({
            abi: kuruMarginAccountAbi,
            functionName: 'batchWithdrawMaxTokens',
            args: [[market.baseToken, market.quoteToken]],
          }),
        },
        'Withdraw margin',
        publish,
      ),
    )
  }
  return { receipts, position: unlocked }
}
