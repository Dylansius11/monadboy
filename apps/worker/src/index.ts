import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createPublicClient, http } from 'viem'
import type { Address } from 'viem'
import { diskRegistryAbi, mainnetProfile, monad, monadTestnet, scorePool } from '@monadboy/sdk'
import manifest from '../package.json'
import { createApp } from './app'
import type { HealthSections, RouteModule } from './app'
import { createBirthResolver } from './chain/market-births'
import { createBookReader } from './chain/l2-book'
import { createDirectFillSource } from './chain/fill-source'
import { createIndexedFillSource } from './chain/indexed-fill-source'
import { testnetRpcFetch } from './chain/rpc-fetch'
import {
  createHypersyncFetcher,
  createRpcFetcher,
} from './chain/trade-fetchers'
import { createTradeSource } from './chain/trade-source'
import { createTransferProbe } from './chain/transfer-check'
import { migrate } from './db/migrate'
import { parseEnv } from './env'
import { faucetSection } from './jobs/faucet-topup'
import { createLeaderboardJob, leaderboardSection } from './jobs/leaderboard'
import {
  createMidSampler,
  createMidState,
  SOURCE_MARKET,
  sourceSection,
  testnetSection,
} from './jobs/mid-sampler'
import {
  createMirrorJob,
  createMirrorState,
  mirrorSection,
} from './jobs/mirror'
import { createScheduler } from './jobs/scheduler'
import type { JobSpec } from './jobs/scheduler'
import { createTrackerSnapshot, trackerSection } from './jobs/tracker-snapshot'
import { treasurySection } from './jobs/treasury-monitor'
import { log } from './logger'
import { loadTestnetMarkets } from './markets'
import { createOperations } from './operations'
import { dripRoute } from './routes/drip'
import { leaderboardRoute } from './routes/leaderboard'
import { midRoute } from './routes/mid'
import { trackerRoute } from './routes/tracker'
import { createDemoPrice } from './jobs/demo-price'
import { createDemand, demandRoute } from './routes/demand'
import { createGasBudget } from './chain/gas-budget'

// [V] Kuru mainnet MarginAccount holds deposited tokens: the holder for sellability eth_calls (cast code: 141 bytes).
const MAINNET_MARGIN: Address = '0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5'
const now = Date.now

const env = parseEnv(Bun.env)
mkdirSync(dirname(resolve(env.SQLITE_PATH)), { recursive: true })
const db = new Database(env.SQLITE_PATH, { create: true })
migrate(db)

const mainnet = createPublicClient({
  chain: monad,
  transport: http(env.MAINNET_RPC_URL, { timeout: 8_000, retryCount: 0 }),
})
// getLogs over 100 blocks and bisection reads are slower than book reads: longer budget, separate client.
const mainnetHistory = createPublicClient({
  chain: monad,
  transport: http(env.MAINNET_RPC_URL, { timeout: 25_000, retryCount: 0 }),
})
// Reads issued together at one block share a Multicall3 eth_call: order-membership
// walks for every disk cost one call per step instead of one per order.
const testnet = createPublicClient({
  chain: monadTestnet,
  batch: { multicall: { batchSize: 4096 } },
  transport: http(env.TESTNET_RPC_URL, { timeout: 8_000, retryCount: 0, fetchFn: testnetRpcFetch }),
})
const markets = loadTestnetMarkets(env.MARKETS_JSON)

const mid = createMidState()
const mirrorState = createMirrorState()
const ops = await createOperations({
  db, env, client: testnet, markets,
  assertActive: () => {
    if (demand.active() === 0) throw new Error('No active gameplay before mirror signing')
  },
})
const demo = createDemoPrice(db, markets.find((entry) => entry.baseSymbol === 'MON')?.address ?? 'MON_AUSD')
const demand = createDemand({
  market: markets.find((entry) => entry.baseSymbol === 'MON')?.address ?? '',
  savedDisk: async (owner) => {
    if (!env.TESTNET_REGISTRY_ADDRESS) return false
    const record = await testnet.readContract({
      address: env.TESTNET_REGISTRY_ADDRESS, abi: diskRegistryAbi,
      functionName: 'diskOf', args: [owner],
    })
    return record.createdAt > 0n
  },
})
const gasBudget = createGasBudget(db, env.MIRROR_DAILY_GAS_MON)

const fetcher = env.HYPERSYNC_API_TOKEN
  ? createHypersyncFetcher({
      url: env.HYPERSYNC_URL,
      token: env.HYPERSYNC_API_TOKEN,
    })
  : createRpcFetcher(mainnetHistory)
const trades = createTradeSource({
  db,
  client: mainnetHistory,
  fetcher,
  // Public RPC caps getLogs at 100 blocks [V]. HyperSync pages server-side and meters 1000 units per
  // request against 15000 per minute [V], so parallel chunks only burn the budget: one chunk at a time.
  chunkBlocks: env.HYPERSYNC_API_TOKEN ? 25_000n : 100n,
  concurrency: env.HYPERSYNC_API_TOKEN ? 1 : env.TRACKER_LOG_CONCURRENCY,
})
const births = createBirthResolver({ db, client: mainnetHistory })
// SAFETY and HEAT come from the shared SDK model (mainnet profile), so the web and worker never fork the maths.
const tracker = createTrackerSnapshot({
  db,
  readBook: createBookReader(mainnet),
  probe: createTransferProbe(mainnet, MAINNET_MARGIN),
  trades,
  births: births.births,
  scorer: (input) => scorePool(input, mainnetProfile),
  testnetMarkets: markets,
  sourceSymbol: SOURCE_MARKET,
})
const directFills = createDirectFillSource({
  db,
  client: testnet,
  markets,
  margin: env.TESTNET_MARGIN_ADDRESS,
  registry: env.TESTNET_REGISTRY_ADDRESS,
  startBlock: env.TESTNET_START_BLOCK,
})
const fills = createIndexedFillSource({
  url: env.ENVIO_GRAPHQL_URL,
  client: testnet,
  markets,
  startBlock: env.TESTNET_START_BLOCK,
  direct: directFills,
})

const scheduler = createScheduler()
const trackerJob: JobSpec = {
  name: 'tracker-snapshot',
  intervalMs: 900_000,
  timeoutMs: 180_000,
  run: tracker,
}
const jobs: JobSpec[] = [
  {
    name: 'mid-sampler',
    intervalMs: 5_000,
    timeoutMs: 20_000,
    run: createMidSampler({
      db,
      state: mid,
      mainnet,
      testnet,
      testnetMarkets: markets,
    }),
  },
  {
    name: 'trade-source',
    intervalMs: 30_000,
    timeoutMs: 120_000,
    run: async () => {
      const covered = trades.coverage().complete
      await trades.refresh()
      // Volume, concentration and volatility only exist once the 24h window is covered: snapshot at once.
      if (!covered && trades.coverage().complete)
        void scheduler.runOnce(trackerJob)
    },
  },
  {
    name: 'market-births',
    intervalMs: 300_000,
    timeoutMs: 300_000,
    run: async () => {
      const before = births.births().size
      await births.resolve()
      if (births.births().size > before) void scheduler.runOnce(trackerJob)
    },
  },
  trackerJob,
  {
    name: 'leaderboard',
    intervalMs: 60_000,
    timeoutMs: 120_000,
    run: createLeaderboardJob({ db, source: fills }),
  },
]
if (ops.executor)
  jobs.push({
    name: 'mirror',
    intervalMs: 5_000,
    timeoutMs: 60_000,
    run: createMirrorJob({
      db,
      mid,
      state: mirrorState,
      executor: ops.executor,
      maxStepNotional: env.MIRROR_MAX_STEP_NOTIONAL,
      deviationThreshold: env.MIRROR_DEVIATION_THRESHOLD,
      active: demand.active,
      intervalMs: 30_000,
      target: () => demo.read(mid.targetMid).targetMid,
    }),
  })
if (ops.topup)
  jobs.push({
    name: 'faucet-topup',
    intervalMs: 60_000,
    timeoutMs: 120_000,
    run: ops.topup.tick,
  })
if (ops.monitor)
  jobs.push({
    name: 'treasury-monitor',
    intervalMs: 30_000,
    timeoutMs: 30_000,
    run: ops.monitor.tick,
  })

const sections: HealthSections = {
  source: sourceSection(mid, now),
  testnet: testnetSection(mid, now),
  mirror: mirrorSection(mirrorState, ops.execution, now),
  demo: () => ({ value: { ...demo.read(mid.targetMid), activePlayers: demand.active(), gas: gasBudget.status() } }),
  tracker: trackerSection(db, trades, now),
  treasury: treasurySection(
    ops.monitor,
    { mon: env.TREASURY_MIN_MON, ausd: env.TREASURY_MIN_AUSD },
    now,
  ),
  faucet: faucetSection(ops.topup, now),
  drip: () => ({ value: ops.dripStatus }),
  leaderboard: leaderboardSection(
    db,
    () =>
      fills.state.status === 'live'
        ? 'envio'
        : markets.length
          ? 'direct-logs'
          : 'not-configured',
    now,
  ),
  envio: () => ({
    value: { ...fills.state },
    amber: fills.state.status === 'offline' ? 'indexer-offline' : undefined,
  }),
}
const routes: RouteModule[] = [
  midRoute(mid, now, demo),
  demandRoute(demand, env.APP_ORIGIN),
  trackerRoute(db, now),
  leaderboardRoute(db, now),
  dripRoute(ops.drip, env.TRUSTED_PROXY_IP),
]
const app = createApp({
  origin: env.APP_ORIGIN,
  version: manifest.version,
  sections,
  jobs: () => scheduler.status,
  routes,
  now,
})

const server = Bun.serve({
  hostname: env.WORKER_BIND,
  port: env.WORKER_PORT,
  fetch: app.fetch,
})
log('worker.started', {
  host: env.WORKER_BIND,
  port: server.port,
  version: manifest.version,
  execution: ops.execution,
  jobs: jobs.map((job) => job.name),
})
scheduler.start(jobs)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    scheduler.stop()
    // Keep already-broadcast receipts and SQLite updates observable before exit.
    // stop() prevents new job ticks; the current bounded RPC/receipt work may finish.
    void (async () => {
      while (Object.values(scheduler.status).some((job) => job.running))
        await Bun.sleep(100)
      await server.stop(true)
      db.close()
      process.exit(0)
    })()
  })
}
