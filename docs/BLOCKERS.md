# MONADBOY blockers

This is the repository's live blocker register. Update status and evidence when a gate changes; never erase the resolution history. The task checklist is [BUILD-PLAN](technical/BUILD-PLAN.md). Secrets belong only in ignored environment files, never here or in chat.

Labels: **[V]** observed evidence; **[I]** intended behavior; **[U]** unresolved. An external gate blocks its dependent proof, not independent implementation.

## Current external gates

| ID | Status | Owner | Blocks | Resolution |
| --- | --- | --- | --- | --- |
| B2 | RESOLVED | Lead / user-approved hostname | No remaining hostname gate; physical passkeys remain B8 | Canonical `monadboy-play.vercel.app`, matching production RP ID, persisted project domain and anonymous rendered HTTPS proof. Requested `monadboy.vercel.app` was already in use. |
| B3 | RESOLVED: access/HTTPS/recovery | Lead | No remaining access gate;24-hour operations remain9.4 | Target SSH/sudo, actual unit/Caddy validation, public HTTPS health, worker restart/SQLite preservation and indexer recreation/persistent-fill recovery observed. |
| B5 | SKIPPED | User decision / verified requirement | No current submission gate | Agora requires Mera + AUSD + Perpl; current Kuru-only scope is excluded ([SUBMISSIONS](SUBMISSIONS.md)). |
| B8 | OPEN: remaining device proofs; S22 entry/UI user-accepted | User: devices; lead: test surface | S4 restore, iPhone and standalone PWA evidence | Tested S22 card/disk entry, sound and repaired UI accepted by user; remaining create/restore/standalone scenarios are not recorded as passed. |
| B10 | OPEN: bounded final mirror acceptance | Lead | Continuous healthy production mirror and operating budget | Original ten-minute run self-took BOT quotes; final correction has one external-maker transition, but target quote preflight refused a crossing third-party bid. Prove final-strategy alignment and cost before continuous enablement. |

## B1: testnet supply

[V] Funding resolved on 2026-10-07 UTC after the user funded all three roles. `cast balance --ether <role-address> --rpc-url https://testnet-rpc.monad.xyz` returned DEPLOYER **50**, BOT **80**, DRIP **20 MON**. Earlier 2026-10-06 zero balances are historical, superseded by this observation. See the external handoff `monadboy/BLOCKERS.md` for public role addresses.

- Minimum to start funded spikes: **50 testnet MON on DEPLOYER**.
- Lean funded budget: DEPLOYER 50, BOT 80, DRIP 20 MON, about 150 total. [V] Real drip receipts give 10 MON +200 AUSD payouts and 0.221344080 MON gas for twenty players at 102 gwei. Retaining a 10 MON reserve needs 20.221344080 MON before payouts; using the approved emptying exception instead requires all sender transactions spaced by at least three actual blocks and verified absence of delegation.
- Funding entry point: [Monad testnet faucet](https://faucet.monad.xyz/). Its human check requires the user.
- Use the existing funding sweep outside this repository; never reuse one operations key across roles.
- B1 is resolved: all three roles meet the lean funding targets. Dependent deployment, inventory and gas acceptance still requires its own receipts; funding alone does not prove any broadcast.
- [V, S3] With three players already funded, DRIP held 18.446398388 MON. Seventeen remaining payouts plus observed gas require 8.688142468 MON, leaving 9.758255920 MON under the approved block-spaced branch. Unsigned reads at head68996303 found empty DRIP code and no sender transactions or authorization lists in the prior three blocks. No additional funding request is needed for this measured branch; future gas, balance and delegation state must be rechecked.
- [V, 2026-10-09] The phone funding error was a disabled production service, not exhausted treasury. At testnet block69480629, DRIP still held18.446398388MON and10,970AUSD. Production now enables only DRIP, never BOT; real HTTPS0.5MON/10AUSD receipts succeeded six blocks apart and repeat funding returned409. Post-smoke17.935331184MON/10,960AUSD remains available. [Deployment proof](../deploy/README.md) records the receipts; no new top-up is requested.

## B2: permanent passkey hostname

[V] Mera passkeys bind to the relying-party hostname: [Mera guide](https://docs.monad.xyz/guides/mera).

- [V, 2026-10-08] The user approved `monadboy-play.vercel.app` after Vercel refused the already-assigned original hostname.
- [V] Production deployment READY; project-domain persistence verified; `VITE_RP_ID` matches the canonical host. Anonymous Edge rendered landing1440x900 and card412x915 without the missing-domain error and navigated START to `/play`.
- B2 is closed. Existing tunnel cards do not migrate to this RP. Physical S22 Chrome and later iPhone Safari create/restore remain B8.

## B3: deployment access

- [V, 2026-10-08] VPS SSH access and `sudo -n true` verified using the user-approved, restricted24-hour deployment key. Key material stays outside the repository and is removed after deployment.
- [V] Only the three approved Mandate containers are stopped; their data and nine unrelated running containers are preserved. Capacity and proxy inspection support VPS-first deployment.
- [V] Actual worker unit and Caddy candidate validated. Public HTTPS health returned200; worker restart preserved migrations1..5 and the first SQLite price sample. Force-recreated PostgreSQL/Hasura/indexer retained an actual historical fill and recovered public GraphQL.
- B3 access/deployment recovery is closed. Five-minute durable health sampling has started, but24-hour healthy uptime, full maker-basis coverage and judging-period availability remain open acceptance, not a new credentials request.

## B5: mobile eligibility

[V, 2026-10-08] The [authenticated Agora trading page](https://hackathon.monad.xyz/tracks/best-mobile-trading-app-on-monad-agora-onchain-trading-bount) requires Mera authentication, an AUSD balance and at least one **Perpl** trade. The earlier requirement-text uncertainty is resolved.

**Skipped by scope decision:** current Kuru-only execution does not qualify. Do not add Perpl or block the current submission on a PWA eligibility reply. The portrait PWA remains product scope; packaging and current targets are in [SUBMISSIONS](SUBMISSIONS.md).

## B8: real-device passkey proof

- The dev-only `/dev/passkey` create/restore, signature and authenticated-seal surface is prepared and exercised with native WebAuthn and a virtual PRF-capable authenticator on localhost. Production preview returned 404 for it. Virtual proof does not close this gate.
- The user must observe the actual authenticator on iPhone Safari and Android Chrome; headless browser checks do not establish physical-device PRF support.
- Record hostname, browser, authenticator, result and error code without PRF output or key material.
- [V, user-reported2026-10-09] Samsung S22 Chrome with Google Password Manager reached the production SAVE DISKS shelf. The newer screenshot shows a populated second slot, TESTNET MON0.476637308 and SAVED TO CARD with a confirmed-transaction link; desktop also shows a populated first slot. This advances physical funded-save evidence beyond card access. Stateless restore, full gameplay and standalone launch remain unobserved; reuse the existing passkey and open the saved disk instead of requesting another drip.
- [V, user-reported2026-10-09] The latest S22 run reports sound, card/disk access and the shelf repair working. Screenshots reach difficulty, tracker, range and a live position with four active orders and zero observed maker fills. Public receipt checks independently confirm approval/deposit/zap/provision at blocks69567374/69567393/69567407/69567429. This advances physical entry/provision evidence, not a flipped fill, fill-specific audio, exit/results, stateless restore or standalone launch.
- [V, user decision2026-10-09] The user accepts the tested S22 experience and requests its acceptance checkbox closed. BUILD-PLAN7.2 and the S22 user-acceptance checkbox are closed on that basis. Other browser/authenticator outcomes, all-three-disk stateless restore, fill-specific audio/exit/results and physical standalone launch remain unobserved; no iPhone or24-hour proof is inferred from this approval.
- Close S4 only after both required device results are recorded; document a supported-authenticator fallback if one fails.
- Isolated local registry smoke saved three encrypted disks, then restored them and NORMAL preferences after eject, storage clear and reload. A separate fresh virtual card also restored HARD with GOD MODE enabled. This proves reachable logic, not supported-phone or funded testnet acceptance.
- Native Chromium production manifest parsing and installability checks returned no errors. Physical-phone standalone launch remains unobserved; no Lighthouse report is claimed.
- Funded native-card testnet play confirmed provision, flipped-maker fill, cancel/withdraw and first-run discoverable restore. The second exit/seal completed and its shelf showed two saved runs; later repeat restore stalled and CDP could not find the disposable virtual authenticator ID. No PRF/key export, guessed successful restore or physical-device equivalence is claimed.

## B9: market and indexer evidence

[V] S2 is resolved: our MON-AUSD deployment, margin funding before zap, raw-token minimum outputs, taker/maker direction, linked-pair cancellation, maximum ladder and bounded gas all have recorded receipts and parameter readbacks. Registry deployment has exact artifact/runtime comparison and source verification.

[V] S5 resolved with live-RPC ingestion: three fresh sells and native-card flipped buy `0x10883c2ff43adb087f22c17fd798e1b5024219f18ccb17aa72fb4b6f418022aa` were publicly observed within **564–570 ms after receipt observation**, using300ms query sampling. An independent observer started before the needed transactions and recorded real rows. Client, indexer and worker SCORE all equal **0.000002997833732854715 AUSD** for the same disk. The earlier16.620second miss is retained as a failed historical measurement, not overwritten.

No guessed address, fabricated receipt, fixture fill or merely configured endpoint satisfies these gates. Evidence is in [SMART-CONTRACTS](technical/SMART-CONTRACTS.md), [Kuru research](research/kuru.md), and external public receipt/latency artifacts. This gate requires engineering verification, not a new user login.

## B10: final mirror alignment and cost

[V] The historical ten-minute worker run produced 31 BOT-self-taking trades, cost 2.990181918 MON, and correctly paused for genuine source spread >2%. It proves neither external-player fills nor production operating economics.

[V] The final correction cancels authoritative-live owned plain quotes before a taker, checks the remaining external side, and revalidates source freshness immediately before signing. One bounded transition confirmed cancellation and a sell filling DEPLOYER and native-card makers for 0.069997398 MON. Target quote preflight then refused a still-crossing third-party bid; no quote revert was broadcast, and successful partial hashes remained in the ledger.

- [V, 2026-10-09] Public health reports source0.0247735 versus TESTNET book0.03302882, amber solely `mirror-disabled:no-bot-key`, enabled healthy DRIP and live Envio lag2. The S22 sitting state is consistent with source/book divergence; extra player funding does not align prices. The frontend retains mainnet-price gameplay and exposes both prices/range rather than manufacturing movement or fills.
- [V] Read-only indexed-path measurement took2173ms for11paced RPC requests; GraphQL answered21–73ms. Separate cold fallback without an indexer took135RPC requests/18243ms unpaced; normal indexed cost is not that fallback cost. One attempt hit the public15rps quota. These reads do not establish a VPS compute bottleneck or a new latency guarantee.
- [V, 2026-10-09] Fresh SSH access is restored: the user authenticated directly in visible Orca terminal `MONADBOY VPS login`, and the Ubuntu24.04.4 welcome plus `ubuntu@VM-4-200-ubuntu:~$` prompt were observed. No password was read or recorded, and no VPS reboot/container change was performed. The prior restricted key remains revoked. The preceding `Connection closed by 43.129.38.115 port 22` cause is still unverified; a later successful session is not a root-cause fix. B10's engineering/safety acceptance remains lead-owned; authentication does not authorize an unattended loop or bypass the crossing guard.

This is a lead-owned engineering/operational gate, not a new protocol signup or funding request; fresh SSH authentication has been observed as recorded above. Do not enable an unattended signing loop or extrapolate24-hour costs from the self-taking run. Preserve the approved step cap/source policy and record final-strategy continuous alignment/cost before closing Phase6's live mirror acceptance.


## Resolved and non-blocking items

| ID | Status | Evidence / decision | Reopen condition |
| --- | --- | --- | --- |
| B1 | RESOLVED | 2026-10-07 UTC `cast balance --ether` observed 50/80/20 MON for separate DEPLOYER/BOT/DRIP roles after user funding. Funded execution resumed. | Available role balances no longer cover the measured remaining work. |
| B4 | OPTIONAL | Public RPC is the default; private RPC credentials are not required for local development. | Observed limits prevent the intended workload despite available HyperSync. |
| B6 | RESOLVED | BUILD-PLAN D-SCORE uses option (a): clamp DAMAGE, display surplus NET; identity is conditional on NET <= SCORE. | User changes the accounting decision. |
| B7 | RESOLVED | Ignored HyperSync credential authenticated a real query (HTTP 200); isolated read-only worker completed the 24h window and served seven validated markets. One recorded snapshot had 21,668 trades. Native web used the real answer; no fallback fixture. | Authenticated query/backfill fails, or observed quota prevents required coverage. |
| B9 | RESOLVED | S2 funded receipts/params/gas; live-RPC S5 observations564–570ms and exact client/indexer/worker SCORE parity on native-card flipped fill. | Fresh actual indexed events exceed10s, lose provenance/coverage or disagree with SDK accounting. |
| Portrait approval | RESOLVED | User approved native portrait reflow, compact controls and the night-city backdrop; laptop clamshell remains. | User changes the approved direction. |
| Source spread policy | RESOLVED | User chose pause for a too-wide book. Worker rejects empty/crossed books or relative spread >2% immediately and resumes only after a valid tight source; 2% is operator policy, not calibration. | User changes source policy or measured execution establishes a different limit. |

## Update procedure

1. Add a newly discovered gate with owner, affected task IDs and the exact settling evidence.
2. Keep observed failures distinct from an untested assumption; include dates and commands, never credentials.
3. When resolved, move its state to RESOLVED with proof and immediately resume dependent tasks.
4. Mirror user-facing asks in the external handoff blocker log; keep this register and BUILD-PLAN aligned.
