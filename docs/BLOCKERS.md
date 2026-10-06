# MONADBOY blockers

This is the repository's live blocker register. Update status and evidence when a gate changes; never erase the resolution history. The task checklist is [BUILD-PLAN](technical/BUILD-PLAN.md). Secrets belong only in ignored environment files, never here or in chat.

Labels: **[V]** observed evidence; **[I]** intended behavior; **[U]** unresolved. An external gate blocks its dependent proof, not independent implementation.

## Open gates

| ID | Status | Owner | Blocks | Resolution |
| --- | --- | --- | --- | --- |
| B1 | OPEN | User: funding; lead: receipts | Funded spikes, registry broadcast, live bot/drip and real gameplay | Fund separate DEPLOYER, BOT and DRIP roles; then record chain receipts. |
| B2 | OPEN | User | Production passkeys and public deployment | Choose the permanent app domain/subdomain before production card creation. |
| B3 | OPEN | User | VPS worker/web deployment and uptime proof | Supply SSH host, user and auth method privately, plus installation permission. |
| B5 | OPEN | User / organizers | Agora mobile bounty eligibility claim | Obtain the exact mobile-app requirement text. |
| B8 | OPEN | User: devices; lead: test surface | S4 supported-phone restore and standalone PWA launch acceptance | Exercise create/restore and standalone launch on iPhone Safari and Android Chrome over HTTPS. |
| B9 | OPEN, depends on B1 | Lead | Trusted transaction encodings, gas limits and indexed fills | Complete S2/S5 with our deployed market and recorded receipts. |

## B1: testnet supply

[V] Last recorded check: 2026-10-07 local (2026-10-06 UTC). `cast balance --ether <role-address> --rpc-url https://testnet-rpc.monad.xyz` returned `0.000000000000000000` for DEPLOYER, BOT and DRIP. See the external handoff `monadboy/BLOCKERS.md` for the public funding addresses. This is a dated observation, not an ongoing balance guarantee.

- Minimum to start funded spikes: **50 testnet MON on DEPLOYER**.
- Lean budget: DEPLOYER 50, BOT 80, DRIP 20 MON, about 150 total. [U] Actual deployment and inventory costs are measured in S3.
- Funding entry point: [Monad testnet faucet](https://faucet.monad.xyz/). Its human check requires the user.
- Use the existing funding sweep outside this repository; never reuse one operations key across roles.
- Close only after funding is observed and dependent broadcasts have receipts. A local chain is useful proof of logic, not testnet deployment.

## B2: permanent passkey hostname

[V] Mera passkeys bind to the relying-party hostname: [Mera guide](https://docs.monad.xyz/guides/mera).

- User supplies the final domain or subdomain; set `VITE_RP_ID` to that hostname.
- Disposable HTTPS-tunnel passkeys are device-test cards, not production cards.
- Local session/error-handling work can proceed; production create/restore acceptance cannot.
- Close after the hostname is fixed and its HTTPS origin is exercised.

## B3: deployment access

- Needed privately: SSH host, user, authentication method/key path, and permission to install Bun, Node, Caddy and service files.
- Never paste a private key into this document or a tracked file.
- Close after service restart recovery and HTTPS health are observed on the target VPS.
- Deployment acceptance also requires 24-hour health evidence and availability through judging; configuration files alone do not prove it.

## B5: mobile eligibility

[U] The exact Agora "Best Mobile Trading App" requirements remain unconfirmed. A portrait PWA is in product scope; native store publication is not.

Close with the organizer's requirement text and a source link. Do not imply that installability alone qualifies for the bounty.

## B8: real-device passkey proof

- The dev-only `/dev/passkey` create/restore, signature and authenticated-seal surface is prepared and exercised with native WebAuthn and a virtual PRF-capable authenticator on localhost. Production preview returned 404 for it. Virtual proof does not close this gate.
- The user must observe the actual authenticator on iPhone Safari and Android Chrome; headless browser checks do not establish physical-device PRF support.
- Record hostname, browser, authenticator, result and error code without PRF output or key material.
- Close S4 only after both required device results are recorded; document a supported-authenticator fallback if one fails.
- Isolated local registry smoke saved three encrypted disks, then restored them and NORMAL preferences after eject, storage clear and reload. A separate fresh virtual card also restored HARD with GOD MODE enabled. This proves reachable logic, not supported-phone or funded testnet acceptance.
- Native Chromium production manifest parsing and installability checks returned no errors. Physical-phone standalone launch remains unobserved; no Lighthouse report is claimed.

## B9: market and indexer evidence

[U] S2 must settle `isMargin`, minimum-output units, flip event attribution, `provisionOrRevert`, parameter encoding and measured gas before dependent execution is trusted. S5 needs our deployed address/start block and a fresh fill appearing in GraphQL within ten seconds.

No guessed address, fabricated receipt, fixture fill or placeholder deployment satisfies these gates. Record real evidence in [SMART-CONTRACTS](technical/SMART-CONTRACTS.md) and the relevant research notes.

## Resolved and non-blocking items

| ID | Status | Evidence / decision | Reopen condition |
| --- | --- | --- | --- |
| B4 | OPTIONAL | Public RPC is the default; private RPC credentials are not required for local development. | Observed limits prevent the intended workload despite available HyperSync. |
| B6 | RESOLVED | BUILD-PLAN D-SCORE uses option (a): clamp DAMAGE, display surplus NET; identity is conditional on NET <= SCORE. | User changes the accounting decision. |
| B7 | RESOLVED | Ignored HyperSync credential authenticated a real query (HTTP 200); isolated read-only worker completed the 24h window and served seven validated markets. One recorded snapshot had 21,668 trades. Native web used the real answer; no fallback fixture. | Authenticated query/backfill fails, or observed quota prevents required coverage. |
| Portrait approval | RESOLVED | User approved native portrait reflow, compact controls and the night-city backdrop; laptop clamshell remains. | User changes the approved direction. |
| Source spread policy | RESOLVED | User chose pause for a too-wide book. Worker rejects empty/crossed books or relative spread >2% immediately and resumes only after a valid tight source; 2% is operator policy, not calibration. | User changes source policy or measured execution establishes a different limit. |

## Update procedure

1. Add a newly discovered gate with owner, affected task IDs and the exact settling evidence.
2. Keep observed failures distinct from an untested assumption; include dates and commands, never credentials.
3. When resolved, move its state to RESOLVED with proof and immediately resume dependent tasks.
4. Mirror user-facing asks in the external handoff blocker log; keep this register and BUILD-PLAN aligned.
