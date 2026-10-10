import { create } from 'zustand'
import {
  LadderError,
  evaluateGates,
  gatesFor,
  mainnetMarkets,
  mainnetProfile,
  openDisk,
  planLadder,
  testnetMarkets,
} from '@monadboy/sdk'
import { z } from 'zod'
import { getCardManager } from './card-store'
import {
  readChainEnv,
  resolveRegistryAddress,
  resolveRpcUrl,
  resolveWorkerUrl,
} from './config'
import { createViemChain, saveDisk, verifyRegistry } from './registry'
import { createPositionReader } from './gameplay'
import { delay, gameplayClient } from './sender'
import {
  cancelAndWithdraw,
  fundAndProvision,
  quoteExitCost,
  quoteFunding,
  verifyMarket,
} from './market-execution'
import { appendActualRun, basisFromDisk, diskWithBasis } from './gameplay-disk'
import { zDiskPlaintext } from './disk-plaintext'
import { parseTracker } from '../lib/worker/schemas'
import { TRACKER_STALE_MS } from '../game/data/provenance'
import { ladderErrorCopy } from '../lib/range/ladder-copy'
import { useSession } from '../state/session'
import { cardErrorCopy, isCardError, meraCodeOf } from './errors'
import { createMirrorDemand } from './mirror-demand'
import type { Market } from '@monadboy/sdk'
import type { Address, Hex } from 'viem'
import type { DiskLease, DiskSlot } from './card'
import type { PositionRead, RunBasis } from './gameplay'
import type { ActualExit, GameplayDisk } from './gameplay-disk'
import type {
  ExecutionStep,
  FundingQuote,
  StepReceipt,
} from './market-execution'

export type GameplayState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  market: Market | null
  owner: Address | null
  position: PositionRead | null
  basis: RunBasis | null
  quote: FundingQuote | null
  exitCostMon: number | null
  amount: number
  width: 'wide' | 'tight'
  manual: { low: number; high: number } | null
  sourceMid: number | null
  mainnetMid: number | null
  demoMultiplier: number
  demandError: string | null
  sourceFresh: boolean
  source: string | null
  sigmaDaily: number | null
  busy: boolean
  steps: ExecutionStep[]
  receipts: StepReceipt[]
  error: string | null
  readError: string | null
  saveError: string | null
  saved: { hash: Hex; sealedHash: Hex } | null
  result: ActualExit | null
  allowed: boolean
  gateReason: string | null
}
const EMPTY: GameplayState = {
  status: 'idle',
  market: null,
  owner: null,
  position: null,
  basis: null,
  quote: null,
  exitCostMon: null,
  amount: 0.24,
  width: 'wide',
  manual: null,
  sourceMid: null,
  mainnetMid: null,
  demoMultiplier: 1,
  demandError: null,
  sourceFresh: false,
  source: null,
  sigmaDaily: null,
  busy: false,
  steps: [],
  receipts: [],
  error: null,
  readError: null,
  saveError: null,
  saved: null,
  result: null,
  allowed: false,
  gateReason: null,
}
const sourceSchema = z.object({
  targetMid: z.number().finite().positive().nullable(),
  mainnetMid: z.number().finite().positive().nullable(),
  demo: z.object({ multiplier: z.number().int().min(1).max(20) }).nullable(),
  source: z.string(),
  fresh: z.boolean(),
  state: z.enum(['running', 'paused']),
  at: z.number().nullable(),
  ageMs: z.number().nullable(),
})
function errorCopy(error: unknown) {
  if (error instanceof LadderError) return ladderErrorCopy(error)
  if (isCardError(error) || meraCodeOf(error)) return cardErrorCopy(error).text
  // viem shortMessage contains only the public operation failure, not serialized signing inputs.
  if (error instanceof Error)
    return 'shortMessage' in error && typeof error.shortMessage === 'string'
      ? error.shortMessage
      : error.message
  return 'The TESTNET operation could not complete. Refresh chain state before retrying.'
}

export function createGameplayController() {
  const store = create<GameplayState>(() => EMPTY)
  let session: {
    lease: DiskLease
    rpc: string
    client: ReturnType<typeof gameplayClient>
    market: Market
    reader: ReturnType<typeof createPositionReader>
  } | null = null
  let demand: ReturnType<typeof createMirrorDemand> | null = null
  let generation = 0
  let reading: Promise<void> | null = null
  let saving: Promise<void> = Promise.resolve()

  const publish = (event: ExecutionStep) => {
    store.setState((state) => ({
      steps: [...state.steps.filter((old) => old.step !== event.step), event],
      receipts: event.receipt
        ? [
            ...state.receipts.filter((old) => old.hash !== event.receipt!.hash),
            event.receipt,
          ]
        : state.receipts,
    }))
  }
  async function disk(lease: DiskLease) {
    const chain = createViemChain(resolveRpcUrl(readChainEnv()))
    const registry = await verifyRegistry(
      chain,
      resolveRegistryAddress(readChainEnv()),
    )
    lease.assertLive()
    const record = await chain.diskOf(registry.address, lease.address)
    lease.assertLive()
    if (record.createdAt === 0n)
      throw new Error('Open a chain-saved disk before playing.')
    const plaintext = zDiskPlaintext.parse(
      await openDisk(lease.sealKey, record.sealedData, {
        chainId: registry.chainId,
        registry: registry.address,
        disk: lease.address,
      }),
    )
    lease.assertLive()
    return { chain, registry, plaintext }
  }
  async function persist(transform: (plaintext: GameplayDisk) => GameplayDisk) {
    const active = session
    if (!active) return
    const pending = saving.then(async () => {
      if (session !== active || !active.lease.isLive()) return
      try {
        const current = await disk(active.lease)
        active.lease.assertLive()
        const saved = await saveDisk(current.chain, {
          lease: active.lease,
          registry: current.registry,
          plaintext: transform(current.plaintext),
        })
        // Receipt remains valid after eject, but private fields are not republished.
        if (session === active && active.lease.isLive())
          store.setState({
            saved: { hash: saved.txHash, sealedHash: saved.sealedHash },
            saveError: null,
          })
      } catch (error) {
        if (session === active)
          store.setState({
            saveError: `${errorCopy(error)} Play and withdrawal remain available.`,
          })
      }
    })
    saving = pending
    await pending
  }
  async function sourceAndGate() {
    let sourceFresh = false
    let sourceMid: number | null = null
    let mainnetMid: number | null = null
    let demoMultiplier = 1
    let source: string | null = null
    let sigmaDaily: number | null = null
    let allowed = false
    let gateReason =
      'Source eligibility could not be read. Existing TESTNET funds can still be withdrawn.'
    try {
      const worker = resolveWorkerUrl(readChainEnv())
      const midResponse = await fetch(`${worker}/v1/mid?market=MON_AUSD`, {
        signal: AbortSignal.timeout(4000),
      })
      if (midResponse.ok) {
        const mid = sourceSchema.parse(await midResponse.json())
        sourceMid = mid.targetMid
        mainnetMid = mid.mainnetMid
        demoMultiplier = mid.demo?.multiplier ?? 1
        source = mid.source
        sourceFresh =
          mid.fresh &&
          mid.state === 'running' &&
          mid.ageMs !== null &&
          mid.ageMs <= 60000
      }
      const response = await fetch(`${worker}/v1/tracker`, {
        signal: AbortSignal.timeout(4000),
      })
      if (response.ok) {
        const tracker = parseTracker(await response.json())
        const entry = tracker.markets.find(
          (market) => market.market === 'MON_USDC',
        )
        if (entry) {
          sigmaDaily =
            entry.inputs.realizedVol24h === null
              ? null
              : entry.inputs.realizedVol24h / Math.sqrt(365)
          const choices = useSession.getState()
          const gate = evaluateGates(
            entry.inputs,
            entry.score,
            gatesFor(choices.difficulty, mainnetProfile),
            Math.floor(Date.now() / 1000),
          )
          allowed =
            entry.score.honeypotClean &&
            entry.playable &&
            entry.status === 'live' &&
            tracker.ageMs !== null &&
            tracker.ageMs <= TRACKER_STALE_MS &&
            (choices.godMode || gate.passed)
          gateReason = allowed
            ? ''
            : 'Current source market does not pass this disk difficulty. The unsellable gate is never bypassed.'
        }
      }
    } catch {
      /* An unavailable worker pauses new risk, not chain recovery or withdrawal. */
    }
    return { sourceFresh, sourceMid, mainnetMid, demoMultiplier, source, sigmaDaily, allowed, gateReason }
  }
  async function refresh() {
    const active = session
    if (!active || reading) return reading
    const mine = generation
    const work = (async () => {
      try {
        const position = await active.reader(store.getState().basis)
        active.lease.assertLive()
        const source = await sourceAndGate()
        active.lease.assertLive()
        if (mine === generation)
          store.setState({
            position,
            ...source,
            status: 'ready',
            readError: null,
          })
      } catch (error) {
        if (mine === generation)
          store.setState({
            readError: errorCopy(error),
            sourceFresh: false,
            status: store.getState().position ? 'ready' : 'error',
          })
      }
    })()
    reading = work
    try {
      await work
    } finally {
      if (reading === work) reading = null
    }
  }
  async function open(id: string, slot: DiskSlot) {
    const mine = ++generation
    store.setState({ ...EMPTY, status: 'loading' })
    demand?.stop()
    demand = null
    session = null
    try {
      const sourceMarket = mainnetMarkets.find(
        (market) => market.symbol === 'MON_USDC',
      )
      const configured = testnetMarkets.find(
        (market) =>
          market.address.toLowerCase() === id.toLowerCase() ||
          (market.baseSymbol === 'MON' &&
            sourceMarket?.address.toLowerCase() === id.toLowerCase()),
      )
      if (!configured)
        throw new Error('This address has no verified playable TESTNET mirror.')
      const lease = getCardManager().lease(slot)
      const rpc = resolveRpcUrl(readChainEnv())
      const client = gameplayClient(rpc)
      const market = await verifyMarket(client, configured, lease)
      const latest = await disk(lease)
      lease.assertLive()
      if (mine !== generation) return
      const basis = basisFromDisk(latest.plaintext, market.address)
      session = {
        lease,
        rpc,
        client,
        market,
        reader: createPositionReader(
          client,
          market,
          lease.address,
          import.meta.env.VITE_ENVIO_GRAPHQL_URL?.trim() || undefined,
        ),
      }
      demand = createMirrorDemand(lease, market.address, resolveWorkerUrl(readChainEnv()))
      store.setState({
        market,
        owner: lease.address,
        basis,
        result: latest.plaintext.lastExit ?? null,
        status: 'ready',
      })
      await refresh()
    } catch (error) {
      if (mine === generation)
        store.setState({ status: 'error', error: errorCopy(error) })
    }
  }
  async function quote() {
    const active = session
    if (!active || store.getState().busy) return
    store.setState({ busy: true, error: null, quote: null })
    try {
      await refresh()
      active.lease.assertLive()
      const state = store.getState()
      const position = state.position
      if (!position || position.paused || !state.sourceFresh)
        throw new Error(
          'PRICE FEED PAUSED. The actual source/book is empty, crossed, stale or wider than 2%. Withdrawal remains available.',
        )
      if (!state.allowed)
        throw new Error(
          state.gateReason ?? 'Current source market is not eligible.',
        )
      if (position.orders.length)
        throw new Error(
          'This disk already has chain-owned orders. Open the current position or withdraw before adding another ladder.',
        )
      const mid = position.mid!
      if (state.sigmaDaily === null && state.manual === null)
        throw new Error(
          'Observed volatility is unavailable. Enter an explicit manual range; no width suggestion is invented.',
        )
      const ladder = planLadder({
        mid,
        mode: state.width === 'wide' ? 'WIDE' : 'TIGHT',
        budgetQuote: state.amount,
        sigmaDaily: (state.sigmaDaily ?? 0) * state.demoMultiplier,
        params: active.market.params,
        manual: state.manual ?? undefined,
      })
      const funding = await quoteFunding(
        active.client,
        active.market,
        ladder,
        position,
      )
      active.lease.assertLive()
      if (funding.quoteRequired > position.walletQuote)
        throw new Error(
          'This disk does not hold enough TESTNET AUSD for the actual quote plus fee/slippage.',
        )
      if (position.walletBase <= funding.gasCostMon)
        throw new Error(
          'This disk does not hold enough TESTNET MON for the measured-shape fee estimate.',
        )
      store.setState({ quote: funding })
    } catch (error) {
      if (session === active) store.setState({ error: errorCopy(error) })
    } finally {
      if (session === active) store.setState({ busy: false })
    }
  }
  async function confirm(): Promise<boolean> {
    const active = session
    const funding = store.getState().quote
    if (!active || !funding || store.getState().busy) return false
    store.setState({
      busy: true,
      error: null,
      steps: [],
      saved: null,
      saveError: null,
    })
    try {
      await fundAndProvision(
        active.client,
        active.rpc,
        active.lease,
        active.market,
        funding,
        publish,
        async () => {
          const before = await active.reader(null, true)
          active.lease.assertLive()
          const openedAt = Number(
            (await active.client.getBlock({ blockNumber: before.block }))
              .timestamp,
          )
          active.lease.assertLive()
          store.setState({
            basis: {
              openedAt,
              startBlock: before.block,
              deposit: {
                base0: before.holdings.marginBase,
                quote0: before.holdings.marginQuote,
              },
              low: funding.ladder.low,
              high: funding.ladder.high,
              step: funding.ladder.step,
            },
          })
        },
      )
      active.lease.assertLive()
      await refresh()
      active.lease.assertLive()
      const basis = store.getState().basis!
      // Optional save never undoes a funded position or gates entering S7.
      store.setState({ quote: null, result: null })
      void persist((plaintext) =>
        diskWithBasis(plaintext, active.market.address, basis),
      )
      return true
    } catch (error) {
      if (session === active)
        store.setState({
          error: `${errorCopy(error)} Confirmed steps are not atomic. Refresh, re-quote the remaining margin, or withdraw.`,
          quote: null,
        })
      await refresh()
      return false
    } finally {
      if (session === active) store.setState({ busy: false })
    }
  }
  async function withdraw(): Promise<boolean> {
    const active = session
    if (!active || store.getState().busy) return false
    store.setState({ busy: true, error: null, saved: null, saveError: null })
    try {
      const exited = await cancelAndWithdraw(
        active.client,
        active.rpc,
        active.lease,
        active.market,
        async (minimumBlock) => {
          const deadline = Date.now() + 30_000
          let position = await active.reader(store.getState().basis)
          active.lease.assertLive()
          while (minimumBlock !== undefined && position.block < minimumBlock) {
            if (Date.now() >= deadline) {
              // Indexed lag never traps funds: a latest chain read can continue exit with unavailable totals.
              position = await active.reader(store.getState().basis, true)
              active.lease.assertLive()
              break
            }
            await delay(500)
            active.lease.assertLive()
            position = await active.reader(store.getState().basis)
            active.lease.assertLive()
          }
          return position
        },
        publish,
      )
      const basis = store.getState().basis
      const totals = exited.position.valuation
      const closedAt = Number(
        (
          await active.client.getBlock({
            blockNumber: exited.receipts.at(-1)?.block ?? exited.position.block,
          })
        ).timestamp,
      )
      active.lease.assertLive()
      const result: ActualExit = {
        market: active.market.address,
        openedAt: basis?.openedAt ?? null,
        closedAt,
        score: totals?.score ?? null,
        damage: totals?.damage ?? null,
        net: totals?.net ?? null,
        fills: exited.position.fills.length,
        receipts: exited.receipts.map((receipt) => receipt.hash),
        complete: totals !== null,
      }
      // No new signature after eject; retain already-broadcast receipt evidence via publish.
      active.lease.assertLive()
      store.setState({ result, basis: null, quote: null })
      await refresh()
      active.lease.assertLive()
      void persist((plaintext) => appendActualRun(plaintext, result))
      return true
    } catch (error) {
      if (session === active)
        store.setState({
          error: `${errorCopy(error)} Existing funds remain chain-recoverable; refresh and retry the unfinished exit step.`,
        })
      return false
    } finally {
      if (session === active) store.setState({ busy: false })
    }
  }
  const card = getCardManager()
  let serial = card.getState().serial
  card.subscribe(() => {
    const next = card.getState()
    if (next.phase === 'ejected' || next.serial !== serial) {
      generation++
      session = null
      demand?.stop()
      demand = null
      reading = null
      // Public broadcast/receipt evidence survives; decrypted position/history does not.
      store.setState((state) => ({
        ...EMPTY,
        steps: state.steps,
        receipts: state.receipts,
        error:
          next.phase === 'ejected'
            ? 'CARD EJECTED. INSERT CARD AGAIN. Broadcast receipts remain valid.'
            : null,
      }))
    }
    serial = next.serial
  })
  return {
    useState: store,
    open,
    refresh,
    quote,
    keepMirrorActive: async () => {
      const active = demand
      if (!active) return
      try {
        await active.pulse()
        if (demand === active) store.setState({ demandError: null })
      } catch {
        if (demand === active)
          store.setState({ demandError: 'DEMO mirror activation unavailable. Withdrawal remains available.' })
      }
    },
    confirm,
    withdraw,
    quoteExit: async () => {
      const active = session
      if (!active || store.getState().busy) return
      store.setState({ exitCostMon: null })
      try {
        const position = await active.reader(store.getState().basis, true)
        active.lease.assertLive()
        const exitCostMon = await quoteExitCost(
          active.client,
          active.market,
          active.lease.address,
          position,
        )
        active.lease.assertLive()
        if (session === active) store.setState({ exitCostMon })
      } catch (error) {
        if (session === active)
          store.setState({
            error: `Exit cost unavailable: ${errorCopy(error)}. No re-center transaction signed.`,
          })
      }
    },
    setAmount: (amount: number) =>
      store.setState({ amount: Math.max(0, amount), quote: null }),
    setWidth: (width: 'wide' | 'tight') =>
      store.setState({ width, manual: null, quote: null }),
    setManual: (manual: { low: number; high: number } | null) =>
      store.setState({ manual, quote: null }),
    retrySave: async () => {
      const state = store.getState()
      if (state.result)
        await persist((plaintext) => appendActualRun(plaintext, state.result!))
      else if (state.basis && state.market)
        await persist((plaintext) =>
          diskWithBasis(plaintext, state.market!.address, state.basis!),
        )
    },
  }
}
let controller: ReturnType<typeof createGameplayController> | null = null
export function getGameplayController() {
  return (controller ??= createGameplayController())
}
