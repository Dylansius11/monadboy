# MONADBOY submission readiness

Verified 8 October 2026 against the authenticated Metropolis dashboard: four primary tracks, all 21 sponsor bounties, Prizes, Resources and the Rules v3.0 modal (last updated 3 September). [V] is published requirement text, [I] is our feature mapping, [U] is an unresolved organizer ruling or runtime proof. Targeting a bounty is not proof of a qualifying product or award.

This document owns submission packaging, current bounty eligibility and organizer questions. [PRD](PRD.md) owns product scope; [BUILD-PLAN](technical/BUILD-PLAN.md) owns implementation status; [BLOCKERS](BLOCKERS.md) owns external delivery gates. Tick submission boxes only against observed evidence. The final portal form, validation and character limits were not inspected: the audited account had no project. Sponsor response fields below were read on the official opportunity pages.

## 1. Decision and deadline

- Primary track: **01 — Onchain Finance & Trading**; STAY IN RANGE on Kuru flip orders.
- Playable execution remains Monad testnet **10143**; mainnet tracker data is read-only context, not proof of mainnet trading.
- Core targets: **Kuru Consumer Trading, Mera UX, Mera One Passkey Many Keys, Envio**. Feature fit is coherent; eligibility still requires the working evidence below.
- **Agora is skipped.** Mobile Trading requires Mera + AUSD + **Perpl trades**; Kuru-only execution does not satisfy it. Payments/remittance and adding Perpl are outside current scope. Do not keep Agora as a conditional prize merely because the app is mobile-first.
- Final deadline: **13 October 2026, 23:59 ET = 14 October, 03:59 UTC / 10:59 WIB**. Internal target: **13 October, 18:00 WIB**. Edits are allowed until the final deadline; late submissions are rejected.

## 2. Submission package

All four track pages share these deliverables; Rules §§4, 7 and 9 add code, documentation and provenance requirements.

| Asset            | Requirement                                                                                                             | Proof before ticking                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Logo/graphic     | JPG, JPEG, PNG or WEBP, maximum **3 MB**                                                                                | Correct format/size and accepted upload                     |
| Public GitHub    | Public complete source under an OSI-approved license; this repo uses MIT                                                | Signed-out repo access, LICENSE, readable setup             |
| Technical demo   | **Maximum 3 minutes**, public YouTube/Loom/Vimeo; operating product and Monad interactions, not slides/code walkthrough | Public link, duration and filmed tx hashes                  |
| Pitch video      | **Maximum 2 minutes**; team, problem and why we are building it                                                         | Separate playable public link and duration                  |
| Live product     | Deployed on Monad mainnet or testnet; our playable flow is testnet                                                      | HTTPS URL, supported-device/access instructions             |
| Documentation    | Description, architecture, stack, setup/deployment                                                                      | README links and clean-clone proof                          |
| Monad proof      | Contract addresses or tx hashes; integration purpose and why Monad                                                      | Intended network, explorer links, receipts/code             |
| Build provenance | Attribution, AI disclosure, in-window history, declared pre-existing foundation                                         | README before/during-window account matching actual history |
| Advertisement    | Optional, maximum **30 seconds**, not scored                                                                            | Only after required assets                                  |

**No pitch deck requirement was found** in the track pages or Rules read. Track deliverables do require a pitch video. Optional sponsor clips have separate caps and do not replace either required primary video.

- [ ] Describe the named first-user segment, range/flip-order loop, risk presentation and why Monad; label all balances TESTNET.
- [ ] Confirm eligible team of 1–5, designated primary contact and one project per participant; no overlapping participation in another Metropolis submission.
- [ ] Publish source, MIT license, external-code attribution and README architecture/setup/AI disclosure.
- [ ] Identify any pre-existing components honestly and explain substantial functionality built during the window; a new repository alone is not evidence of original in-window work.
- [ ] Fix the HTTPS domain/passkey relying-party ID and document supported authenticators and judge access.
- [ ] Rehearse public create/play/fill/withdraw/restore with fresh devices and no team assistance.
- [ ] Upload logo, technical demo and separate pitch; validate signed-out links/durations.
- [ ] Submit only eligible bounties and complete their exact response fields.
- [ ] Save the submission receipt/time and inspect the saved entry before the deadline.

## 3. Bounty eligibility and prize amounts

| Target                                      | Portal track              | Published award                        | Decision                                                                        |
| ------------------------------------------- | ------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Track 01                                    | Onchain Finance & Trading | $30,000 pool; 3 × $10,000              | Primary category                                                                |
| Build the Next Consumer Trading App on Kuru | Track 01                  | $5,000, single prize                   | Target; real Kuru execution plus demand/retention evidence                      |
| Best Mera-Powered UX                        | All tracks                | $2,500, single prize                   | Target; signing-session and stateless tests                                     |
| Mera: One Passkey, Many Keys                | All tracks                | $2,500, single prize                   | Target; non-account encrypted state, not just trading wallets                   |
| Best Use of Envio                           | All tracks                | $1,000, single prize                   | Target; live indexed data drives gameplay/history/leaderboard                   |
| Best Community Team Project                 | All tracks                | $5,000, single prize                   | Conditional on actual onboarded/selectable supporter affiliation                |
| Best use of Nansen                          | All tracks                | $5,000 pool: $2,000/$1,500/$1,000/$500 | Stretch only if a core feature actually integrates a supported endpoint/MCP/CLI |
| Grand Champion                              | Across all submissions    | $25,000                                | Separate judging decision, not a promised award                                 |

[Prizes](https://hackathon.monad.xyz/prizes) explicitly permits main-track/sponsor stacking and multiple earned bounties. Sponsor terms govern awards; USD labels do not guarantee payment. Do not present pools as a single winner's prize.

Not current targets: Agora (requires Perpl/payments), Kuru New Assets (existing pair/strategy is not a new asset class), Perpl/MetaMask/Cleanverse (different integrations), Aurora (requires actual cross-chain flow, not mocked), Qwen (Track 04), Hunyuan (Track 03). KIMI/Alchemy credit awards require meaningful integration; KIMI also requires a published article. No integration is added solely by this guide.

No blanket exclusivity clause between Mera and other embedded-wallet providers was found in the pages/Rules read. Mera still must be the **entire account layer**, without seed phrase, wallet extension or custody backend; we keep the approved Mera-only design.

## 4. Target requirements and exact sponsor response fields

### Kuru Consumer Trading

[V] A working focused spot product on Kuru, named user segment, evidence of demand/trading activity, acquisition/retention strategy and post-hackathon plan. Judges assess integration strength and founder/customer understanding, not only a successful order.

Asked for at submission:

> Clearly describe your target user segments
>
> Clearly describe case studies and/or research that shows evidence of demand.
>
> Clearly describe your roadmap for the product beyond the hackathon.
>
> Clearly describe your strategy for onboarding and retaining traders

[I] Proof: real testnet flip ladder → bot taker fill → flipped-order event → SCORE/DAMAGE → cancel/withdraw. Show transaction links and inspectable numeric inputs, honest losses and the source-paused behavior. Distinguish real external user testing from team-controlled demo activity; do not describe testnet inventory as TVL or organic trading demand without qualification.

### Mera UX

[V] One-prompt passkey onboarding, scoped prompt-free signing sessions, clean session-expiry/re-prompt UX, real Monad transactions and a stateless test. Judges clear local storage or use a fresh device; identity/access reconstructs from passkey plus untrusted storage if used.

Asked for at submission:

> Describe how your project meaningfully integrates Mera as the entire account layer
>
> Submit an optional demo video (up to 2 mins) showing how Mera is integrated into your app, focusing on UX elements

[I] Proof: INSERT CARD → first confirmed transaction; clear site data/fresh device → same derived disk addresses → registry read/decrypt → restored access. Measure taps/seconds and record devices/authenticators. Cached local state, a custody service or only same-browser restore does not establish this requirement.

### Mera: One Passkey, Many Keys

[V] At least one PRF namespace must do **non-account work**, demonstrated live. Salts must be genuinely namespaced, primitives used correctly and sensitive key material not persisted. The same passkey on a second device/fresh profile must reproduce keys or decrypt state.

Asked for at submission:

> Describe how your project meaningfully utilizes Mera in non-account work.
>
> Submit an optional demo video (up to 2 mins) showing how Mera is used where at least one PRF namespace does non-account work

[I] Proof: PRF-derived per-disk encryption keys seal private save state; DiskRegistry stores ciphertext; a fresh-device passkey decrypts the same state. Multiple derived wallet accounts alone do **not** satisfy the bounty. Film ciphertext/hash and successful restore, never raw PRF output, encryption keys or credentials.

### Envio

[V] HyperIndex/HyperSync/HyperRPC powers a real feature; Cloud or self-hosted pipeline, public config/schema/handlers or HyperSync client code, an actual consumer and end-to-end live/correct data proof. Derived entities, useful aggregation and readable schema strengthen the entry.

Asked for at submission:

> Describe how your project meaningfully uses Envio's HyperIndex, HyperSync or HyperRPC to power real on-chain data in your app — not just installed, but actually driving a feature.
>
> Submit an optional demo video (up to 2 mins) showing the data flowing end to end through Envio's HyperIndex, HyperSync or HyperRPC.

[I] Proof: fresh Kuru fill → indexed entity/query → SCORE history/leaderboard; reconcile client and indexer numbers for the same disk and measure event-to-query lag. A direct-log fallback is operationally useful but does not itself prove an Envio-powered feature.

## 5. Demo, pitch and evidence checklist

- [ ] Film INSERT CARD → difficulty/pool → range → real orders/flip fill → running/SCORE/DAMAGE → out-of-range sit → cancel/withdraw/results.
- [ ] Include clear-storage/fresh-device memory-card restore and encrypted-state recovery; never substitute fixtures for live fills.
- [ ] Prepare a separate ≤2-minute pitch: team, named first users, pain, what is new, why Monad/Kuru, actual user evidence and concrete acquisition/retention roadmap.
- [ ] Map each eligible bounty in README: exact requirement → operating feature → actual code path → video timestamp.
- [ ] Keep technical demo ≤3 minutes and optional Mera/Envio sponsor clips ≤2 minutes. Kuru asks written business responses, not a separate sponsor-video field on the page read.
- [ ] Record actual deploy/fill/withdraw/save txs, source ages, indexer lag and restore devices; keep signed-out explorer links usable.
- [ ] Disclose team-controlled/testnet bot activity separately from organic usage. Rules §§8.2/10.4 prohibit wash trading/fake volume and bot price manipulation; clarify controlled price-mirror demonstrations before making eligibility claims.

Store chain evidence in [SMART-CONTRACTS](technical/SMART-CONTRACTS.md), live integration measurements in [research](research/) and implementation proof in BUILD-PLAN. This checklist does not declare those runtime gates complete.

## 6. Organizer contacts and ready-to-send questions

1. **Primary: [Metropolis Support Forum](https://hackathon.monad.xyz/support?tab=forum).** The portal provides categorized organizer/mentor support. Use Rules/eligibility if offered; keep the written response URL and ruling. No thread was posted by this documentation task.
2. **Escalation: [Monad Developer Discord](https://discord.gg/monaddev).** Verified by [official Monad links](https://docs.monad.xyz/official-links); dashboard offers joining the developer server and obtaining the Metropolis role. Ask staff for the relevant organizer channel; no specific channel name or response-time promise is verified.
3. **Public developer account: [DevNads / @monad_dev](https://x.com/monad_dev).** Official routing option, not proof of open DMs or an eligibility decision.
4. `metropolis@hackathon.monad.xyz` is named for GitHub repository access in track deliverables, **not verified as a general support mailbox**.

Ready-to-send product/build question (draft, not sent):

> MONADBOY is a Track 01 Monad testnet app using Kuru flip orders and Mera passkeys. Any reused interface components are identified as pre-existing foundation; the trading engine, account/state-recovery layer, registry and data integration are built during the hackathon. We plan to disclose team-controlled testnet fills and a bot mirroring a public mainnet price, without claiming organic volume. Can you confirm how that demonstration should be presented under Rules §§8.2/10.4, and whether any additional foundation declaration is required under §4.1?

Also obtain clarification on:

- Rules §5.2's five equal 20% weights versus track pages' Technical 20%, Design 20%, Originality 15%, Founder/Market 25%, Traction 20%: which governs?
- Rules §5.1 says judging 14–27 October/winners 3 November; dashboard says judging through 3 November/winners from 4 November: which hosting period applies?
- If seeking Community Team, how should the actual affiliated onboarded group be recorded? Attending an event alone is not proof; the group must be selectable on the profile.

Agora is excluded, so no PWA qualification ruling is needed to complete the current scope. Written rulings, not assumptions or informal sponsor-name drops, determine exceptions. Until dates are clarified, [I] plan hosting through 4 November rather than switching off after 27 October.

## 7. Ruling and final-link record

- [ ] Record question/thread URL, answer date, exact organizer ruling and resulting decision before changing eligibility status.
- [ ] Record final project page, repo, live product, logo, technical demo, pitch and optional sponsor clips in README and the saved portal entry.
- [ ] Record final submission timestamp/receipt and responsible primary contact; never include private keys or identity documents.

No new organizer ruling or final submission receipt is asserted by this document.

## 8. Rules, free resources and prize caveats

[V] Rules §5.2: main-track Product Quality, Technical Excellence, Monad Integration, Track Fit and Innovation are each 20%; sponsor scoring is requirement adherence 40%, technical implementation 30%, Monad integration 20%, innovation 10%. The track-page rubric conflict is recorded in section 6. Prepare first-user, demand and retention evidence, not just a technically correct fill.

Rules require public source throughout and after the event, accurate attribution and non-confidential review. Teams retain ownership; the organizer/sponsors receive promotional-use rights. Prize recipients may need KYC and are responsible for taxes; main prizes are USDC/equivalent within 30 days of the later of announcement or verification completion. Sponsor awards have separate terms. Testnet tokens have no real-money value.

[Resources](https://hackathon.monad.xyz/resources) offers **one voucher per team per resource**: Quicknode Build 3 months (new accounts only), Tenderly Pro, Zerion API Builder 1 month, BlockVision Lite 2 months, Spectrum Business 2 months, Dwellir Developer 3 months. No voucher was claimed by this task. Winner services/rebates on Prizes are not extra cash; Envio's winner perk is two months Cloud hosting free and a third month at 50% off.

## 9. Official source index

- [Track 01 scope, rubric and shared deliverables](https://hackathon.monad.xyz/tracks/onchain-finance)
- [Rules v3.0: Dashboard → VIEW THE RULES](https://hackathon.monad.xyz/dashboard)
- [Kuru Consumer requirements](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru)
- [Mera UX requirements](https://hackathon.monad.xyz/tracks/best-mera-powered-ux-on-monad)
- [Mera non-wallet key-use requirements](https://hackathon.monad.xyz/tracks/mera-one-passkey-many-keys)
- [Envio requirements](https://hackathon.monad.xyz/tracks/best-use-of-envio)
- [Agora trading: Mera + AUSD + Perpl](https://hackathon.monad.xyz/tracks/best-mobile-trading-app-on-monad-agora-onchain-trading-bount)
- [Community eligibility](https://hackathon.monad.xyz/tracks/best-community-team-project)
- [Nansen feature requirements and prize split](https://hackathon.monad.xyz/tracks/best-use-of-nansen)
- [Prizes and stacking](https://hackathon.monad.xyz/prizes), [participant resources](https://hackathon.monad.xyz/resources)

Rules retain the equal-weight rubric; track pages conflict with it. Both were read directly. Dashboard links require login. Requirements are verified; product completion and organizer exceptions still require separate evidence.

## 10. Portal answers, ready to paste

Written 12 October 2026. Every number below was read from the live indexer, the worker health endpoint or a paper we link. Copy the text inside each box as is.

**Agora (Best Mobile Trading App):** not entering. It requires Mera + AUSD + **Perpl trades**, and we only trade on Kuru. Entering without Perpl would be an ineligible entry.

### Project name

```text
MONADBOY
```

### One-line description (max 200)

```text
Market making as a pocket game: set a price range and MONADBOY turns it into real Kuru flip orders on Monad TESTNET, with SCORE and DAMAGE shown side by side.
```

### Description

```text
The problem
Providing liquidity is the most important job in any market and the one almost nobody understands. People who can swap without thinking freeze when they see "set your range". The risk is real too: a study of 17 large Uniswap v3 pools found LPs earned $199.3M in fees but lost $260.1M to impermanent loss, so they would have been $60.8M better off just holding (Loesch et al., 2021, arxiv.org/abs/2111.09192). Most people learn this by losing money.

What MONADBOY is
A handheld game console in your browser. You insert a memory card (a Mera passkey), pick a save disk and a Monanimal, and play STAY IN RANGE. The tracker shows real Kuru markets as a map. On the playable TESTNET market you choose how much and how wide, and the console places a real ladder of Kuru flip orders on Monad testnet. When the price moves through your ladder, fills flip and you earn SCORE. When price leaves your range you sit out and take DAMAGE. Both are always the same size on screen, because hiding the loss is exactly how people get hurt.

Every number has a source you can open: the order transactions, the fills read from our Envio indexer, the mainnet price and the TESTNET book. Exiting cancels the orders and withdraws the funds back to your disk.

What makes it useful
- You learn market making by doing it, with real orders and fake money. Nothing here can lose real funds.
- No wallet setup. One passkey tap, no seed phrase, no extension. The same passkey restores your disks and your encrypted save history on a new phone.
- Difficulty means something. EASY, NORMAL and HARD (Molandak, Moyaki, Mouch) filter which pools you are allowed to play, from calm to wild.
- It is honest about the demo. A testnet market has no natural price action, so a bot we run mirrors the live Kuru mainnet MON price on our own TESTNET market, with moves amplified 20x so a five minute session actually shows something. The app labels this DEMO x20 on every screen and shows the raw mainnet price, the DEMO target and the actual book separately.

Built on Monad testnet with Kuru (order book and flip orders), Mera (accounts and encrypted saves) and Envio HyperIndex (fills, scores, leaderboard).
```

### Go-to-market and user acquisition

```text
First users: people in the Monad community who already swap and hold tokens but have never provided liquidity. They are online, curious, and close to Kuru already. Second: community leads and educators who run onboarding sessions and need something hands-on instead of slides.

How we reach them:
1. Closed beta with communities, one at a time. We run a 30 minute play session with a community (Discord stage or in person), everyone plays the same market at the same time, and the leaderboard is the event. Each cohort gets invite links so we can see which community converts.
2. Clips from real runs. A 20 second clip of a Monanimal sitting out of range while DAMAGE ticks up teaches more than a thread. We post these with the transactions linked.
3. Partner cartridges. Each market is a cartridge. A protocol or community that wants its own pair taught can sponsor a cartridge for its users.
4. Kuru as the natural partner. Every session places real Kuru orders, so MONADBOY is an onboarding funnel into Kuru liquidity, not a competitor to it.

What we measure: first completed run, whether the player can explain why they took DAMAGE, restore success on a second device and return sessions. We will not reward raw volume, because that only attracts farmers.

Business model (planned, not live): paid onboarding pilots for communities and protocols, and sponsored cartridges. Today the game is free and runs only on testnet tokens.
```

### Judge access instructions

```text
Live app: https://monadboy-play.vercel.app (open /play to go straight to the console)
Source: https://github.com/Dylansius11/monadboy

Best device: an Android phone with Chrome and Google Password Manager. That is the path we tested end to end (Samsung S22). iPhone Safari should work but we have not tested it on a real device. On desktop, Chrome with a Google Password Manager passkey works; some local authenticators do not support the passkey extension Mera needs, and the app tells you when that happens.

1. Open the link and tap PRESS START. Optional: INSTALL APP adds it to your home screen.
2. INSERT CARD, then New card. Confirm the passkey with your fingerprint or PIN. This is your whole account.
3. Pick a save disk. The app sends you free TESTNET funds once (1 MON for gas and 10 AUSD). No real money anywhere.
4. Choose EASY (Molandak) and open the tracker. Move to the pin marked PLAYABLE TESTNET and press A.
5. Set Range: pick 2 AUSD or less and WIDE, then confirm. You will see each step (approve, deposit, zap, place orders) with its transaction link.
6. Watch the live screen. SCORE grows when your orders fill, DAMAGE grows when price leaves your range. Press B to exit: orders are cancelled and funds return to your disk.
7. Stateless test: clear site data (or use another phone), open the app, INSERT CARD with the same passkey. Your disks, Monanimal and run history come back from the chain.

Fair use: the free funding is limited to 20 drips per day in total and one per network, so if a teammate on the same Wi-Fi already claimed, switch to mobile data. Price movement is DEMO x20: our bot mirrors the Kuru mainnet MON price on our TESTNET market with moves amplified 20x, and the app labels it everywhere. Worker health is public: https://monadboy-api.43.129.38.115.sslip.io/v1/health
```

### Kuru: target user segments

```text
1. Swappers who never became liquidity providers. They hold MON, they use DEXs, and "concentrated liquidity" scares them. This is the biggest group and the one Kuru needs most, because order book depth comes from makers.
2. AMM LPs who never placed a maker order. They know ranges from Uniswap style pools but not order books or flip orders. MONADBOY shows them the same idea as a ladder of orders they can see fill.
3. Community leads and educators. They onboard new people every week and need a hands-on tool that is safe (testnet) and fun enough that people stay for the whole session.

We start with segment 1 inside the Monad community, through community play sessions.
```

### Kuru: evidence of demand

```text
Research: the pain is documented. Loesch et al. (2021, arxiv.org/abs/2111.09192) looked at 17 Uniswap v3 pools covering 43% of TVL. LPs earned $199.3M in fees and lost $260.1M to impermanent loss, so in aggregate they were $60.8M worse off than if they had just held. People provide liquidity without understanding the risk, and they learn by losing real money. MONADBOY lets them learn it with test money first, on a real order book.

What we see in our own data (Monad testnet, read from our Envio indexer on 12 October 2026):
- 384 Kuru orders placed and 139 fills indexed on our MON/AUSD TESTNET market
- 13 maker addresses, 11 save disks with encrypted saves written onchain
- A full player round trip verified on testnet: approve, deposit, zap, place the ladder, fills, cancel, withdraw

To be clear, almost all of this activity is ours: the founder, a few early testers, test accounts and our price mirror bot. We are not claiming organic users yet. The closed beta with Monad communities is how we plan to get the first real numbers, and the indexer already tracks everything we need to report them honestly.
```

### Kuru: roadmap beyond the hackathon

```text
Now (Metropolis): playable on Monad testnet. Passkey memory card, three save disks, three difficulty tiers, real Kuru flip order ladders, SCORE and DAMAGE from indexed fills, leaderboard, installable on phones.

Next 4 to 6 weeks: closed beta with 2 to 3 Monad communities. iPhone testing, a replay of each run (where you entered, where price went, what each fill paid), and a simpler first run that explains one concept at a time.

Then: more cartridges, meaning more Kuru TESTNET markets with different behaviour (calm stable pairs, wild pairs). A practice mode that shows what the same ladder would have done on real Kuru mainnet data, still with no money at risk.

Later, only after an audit: an optional mainnet mode with small hard caps, for players who have finished the testnet levels. Kuru gets new makers who already understand the risk.

Business: paid onboarding pilots for communities and protocols, and sponsored cartridges where a project pays to have its pair taught. The game itself stays free.
```

### Kuru: onboarding and retaining traders

```text
Onboarding
- One passkey tap. No wallet app, seed phrase or extension. Free TESTNET MON and AUSD arrive on the first disk.
- The game teaches the words. Range is "how wide", the ladder is drawn as ground the Monanimal walks on, and out of range is shown as sitting down. The GUIDE key explains the current screen only.
- Difficulty tiers limit which pools you can pick, so a new player starts on calm markets.
- Every transaction is shown as a step with its link, so nobody wonders what was signed.

Retention
- Save disks. Each run is sealed into your disk history onchain, so you come back to your own record on any device.
- Leaderboard and cartridges give a reason to play again and to try a harder tier.
- Community sessions create a fixed time to come back, like a weekly game night.
- We reward understanding, not volume. No points for trading more, because that brings farmers and teaches the wrong lesson.
```

### Mera UX: Mera as the entire account layer

```text
Mera is the only account system in MONADBOY. There is no seed phrase, no wallet extension, no email login and no custody server.

The passkey is the memory card. INSERT CARD runs one Mera passkey prompt. From its PRF output the app derives an HD root inside the browser: index 0 is the card serial and indexes 1 to 3 are three SAVE DISKS, each its own Monad account. Every in-game transaction (save, approve, deposit, zap, place orders, cancel, withdraw) is signed in the browser by the disk's key with no extra prompts while the card is in.

The session behaves like hardware. EJECT clears the keys from memory. If the tab is hidden for more than 10 minutes the card is ejected and the next action asks you to insert it again. The worker never signs for a player and never sees a key.

Stateless test: clear site data or open the app on another phone, INSERT CARD with the same passkey, and you get the same three disk addresses, then your saves are read from our DiskRegistry contract and decrypted. Nothing important lives in local storage. We tested this on Android Chrome with Google Password Manager.

Code: apps/web/src/chain/card-session.ts, apps/web/src/chain/mera-backend.ts, packages/sdk/src/mera.ts
```

### Mera: One Passkey, Many Keys (non-account work)

```text
The same passkey does a second job that has nothing to do with accounts: it encrypts your save disks.

From the PRF output we derive a separate key per disk with HKDF (SHA-256, salt "monadboy/v1", info "disk:1:seal", "disk:2:seal", "disk:3:seal"). These are AES-GCM 256 keys, created as non-extractable WebCrypto keys and never stored. They are a different namespace from the signing keys, so knowing a disk's account key tells you nothing about its seal key.

What gets sealed: the disk name, chosen Monanimal, palette, difficulty, notes and the full run history. The ciphertext is written onchain to our DiskRegistry contract, and the AES-GCM associated data binds it to the chain id, the registry address and the disk address, so a save cannot be copied to another disk or chain and still decrypt.

Live proof: on a fresh device, INSERT CARD with the same passkey, the app reads the ciphertext from the chain and decrypts it locally. As of 12 October 2026, 11 disks have encrypted saves on Monad testnet.

Code: packages/sdk/src/seal.ts, apps/web/src/chain/registry.ts, contracts (DiskRegistry v2 at 0xbfc885C572Cb1121FC4e4e82434279c4B4302714)
```

### Envio: how HyperIndex drives the app

```text
Envio HyperIndex is where MONADBOY's score comes from. We run it self-hosted (Docker on our VPS, Postgres and Hasura) with HyperSync as the data source, and it indexes two contracts on Monad testnet: our Kuru MON/AUSD OrderBook and our DiskRegistry.

Handlers build four entities:
- Order: every flip order with its price, flip price, side and whether it has flipped
- Fill: each maker fill with taker, price, size, block and transaction, plus the realized spread when a flipped order fills
- Disk: per player SCORE, fill count and save count, derived from fills and DiskSaved events
- Market: last traded price

Features it drives:
1. Live SCORE. While you play, the worker and the app read your disk's fills from the indexer. SCORE is the realized flip spread from those fills, not a client guess.
2. Leaderboard. Every 60 seconds the worker pulls each disk's fills from the indexer and ranks SCORE, DAMAGE and NET for the last 24 hours, 7 days and all time.
3. Run results and history. The results screen lists observed maker fills for the run.

If the indexer falls behind, the app says so and falls back to reading logs directly, labelled as fallback. Locally we measured fresh fills showing up in 564 to 570 ms. Today the index holds 384 orders, 139 fills and 13 maker addresses on our TESTNET market.

Public read-only GraphQL: https://monadboy-data.43.129.38.115.sslip.io/v1/graphql
Code: indexer/config.yaml, indexer/schema.graphql, indexer/src/handlers, apps/worker/src/chain/indexed-fill-source.ts
```

### Optional sponsor video links

Mera UX, Mera Many Keys and Envio each accept an optional demo video up to 2 minutes. Paste the public link once recorded; leave the field empty otherwise. Kuru has no video field.
