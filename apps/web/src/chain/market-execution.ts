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
  createWalletClient,
  decodeAbiParameters,
  encodeFunctionData,
  formatUnits,
} from 'viem'
import { CHAIN } from './config'
import { bufferedGas, cancelPairIds, MARGIN, rawQuoteCeil } from './gameplay'
import {
  browserTransport,
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
  state: 'checking' | 'broadcast' | 'confirmed'
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
    const hash = await client.sendRawTransaction({
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
    publish({ step, state: 'confirmed', hash, receipt: proof })
    if (receipt.status !== 'success')
      throw new Error(
        `${step} reverted. Check its receipt; prior confirmed steps remain on chain.`,
      )
    return proof
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

/** L2 asks are a block-backed preview; the funded margin call is simulated again before signing. */
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
  let remaining = neededBase
  let cost = 0
  let askCapacity = 0n
  while (offset < raw.length) {
    const price = BigInt(`0x${raw.slice(offset, offset + 64)}`)
    offset += 64
    if (price === 0n) break
    if (offset + 64 > raw.length) throw new Error('TESTNET asks are truncated.')
    const size = BigInt(`0x${raw.slice(offset, offset + 64)}`)
    offset += 64
    askCapacity += price * size
    const available = Number(size) / Number(market.params.sizePrecision)
    const take = Math.min(remaining, available)
    cost += (take * Number(price)) / Number(market.params.pricePrecision)
    remaining -= take
  }
  if (remaining > 1e-9)
    throw new Error(
      'TESTNET ask depth cannot fund this ladder. Refresh the book or retry when liquidity returns. No funds moved.',
    )
  const quoteBeforeFee = cost / (1 - market.params.takerFeeBps / 10000)
  const zapRaw = rawQuoteCeil(
    quoteBeforeFee * (1 + Number(SLIPPAGE_BPS) / 10000),
    market.params.quoteDecimals,
  )
  // Fill-or-kill consumes the full fee/slippage-buffered input, not just the minimum base.
  const zapUnits = quoteToUnits(
    Number(formatUnits(zapRaw, market.params.quoteDecimals)),
    market.params,
  )
  if (zapUnits * market.params.sizePrecision > askCapacity)
    throw new Error(
      'TESTNET asks cannot cover this amount plus its safety buffer. Refresh the book or retry when liquidity returns. No funds moved.',
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
    const input = quoteToUnits(
      Number(formatUnits(quote.zapRaw, market.params.quoteDecimals)),
      market.params,
    )
    const data = encodeFunctionData({
      abi: kuruOrderbookAbi,
      functionName: 'placeAndExecuteMarketBuy',
      args: [input, quote.minimumBaseRaw, true, true],
    })
    const result = await client.call({
      account: lease.address,
      to: market.address,
      data,
      gas: 2000000n,
    })
    lease.assertLive()
    const [output] = decodeAbiParameters(
      [{ type: 'uint256' }],
      result.data ?? '0x',
    )
    if (output < quote.minimumBaseRaw || quote.minimumBaseRaw === 0n)
      throw new Error(
        'Actual funded margin quote cannot cover the ladder. Withdraw or re-quote.',
      )
    await send('Zap MON to margin', { to: market.address, data, cap: 2000000n })
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
