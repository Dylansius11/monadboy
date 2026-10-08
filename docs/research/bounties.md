# Metropolis bounty research

Evidence first checked 2026-10-05; authenticated dashboard and Rules v3.0 re-read 2026-10-08. [SUBMISSIONS](../SUBMISSIONS.md) owns current eligibility, exact response fields, contacts and packaging. **[V]** is an official published source; **[V secondary]** preserves older participant-transcription provenance; **[I]** is our feature mapping; **[U]** needs the named organizer or runtime proof. Product scope is MONADBOY, STAY IN RANGE, Track 01 Onchain Finance & Trading.

## Source authority

[V] The [official Metropolis page](https://monad.xyz/developers/hackathons/metropolis) lists the five targeted bounty names and amounts. Some full requirements live in the signed-in [organizer platform](https://hackathon.monad.xyz/), not on that public page.

[V secondary] Earlier requirement quotes preserve the original research's participant-transcription provenance. The authenticated audit on 8 October corroborated the Mera and Envio requirements directly; current primary-source links and full submission fields are in [SUBMISSIONS](../SUBMISSIONS.md).

[V] No blanket exclusivity clause between Mera and other embedded-wallet providers was found in the audited pages or Rules. Mera must still be the entire account layer; we keep the approved Mera-only design. [U] Organizer clarification remains needed for the conflicting rubric/dates and controlled testnet bot demonstrations.

## Kuru: Next Consumer Trading App

[V] Amount: **$5,000**, listed on the official page. Verbatim playbook requirement, corroborated by the [Kuru announcement](https://x.com/KuruExchange/status/2094830938463010922):

> Build a new trading experience routed through Kuru's onchain order book

[I] Feature: a handheld trading experience whose range is an actual Kuru flip-order ladder on our MON-AUSD testnet market. Every fill has an explorer transaction, SCORE counts realized flip spread, DAMAGE has equal visual weight, and exit really cancels/withdraws.

[U] **S2** must show a real flip fill; ABI extraction alone does not satisfy the bounty. Mainnet tracker pins are read-only context, not claimed execution.

## Mera: Best Mera-Powered UX

[V] Amount: **$2,500**, listed on the official page. [V secondary] Verbatim playbook requirement:

> Build an app on Monad where Mera is the entire account layer — no seed phrase, no extension, no custody backend.

[V secondary] The stateless-test deliverable is transcribed in [the cited issue](https://github.com/emmanuelist/curb/issues/40):

> Must pass the stateless test — judges clear local storage or open the app on a fresh device mid-demo, and identity/access must fully reconstruct from the passkey

[I] Feature: INSERT MEMORY CARD restores indices 1..3, reads DiskRegistry v2 ciphertext directly from chain, and decrypts the save disks without localStorage or a custody server. Optional credential metadata only accelerates passkey selection.

[U] **S4** proves real-phone creation and restore. **Rules-confirmation spike** confirms the quote in the organizer dashboard. Do not substitute a same-browser cache for the clear-storage/fresh-device test.

## Mera: One Passkey, Many Keys

[V] Amount: **$2,500**, listed on the official page. [V secondary] Verbatim playbook requirement phrase:

> the most creative non-wallet use of Mera's PRF-derived key material

[I] Feature: independent per-disk HKDF-derived AES-GCM keys seal private names, cosmetics, notes and run history; ciphertext lives in DiskRegistry v2. Multiple derived trading accounts alone do not demonstrate the **non-wallet** use.

[I] The demonstration opens the same sealed disks after a fresh-device passkey ceremony and exposes the ciphertext hash/explorer proof, not the secret PRF or encryption key. See [Mera research](mera.md) for the exact seal domains and AAD.

[U] **S4** validates device restore; **Rules-confirmation spike** verifies binding Many Keys terms.

## Agora: Best Mobile Trading App

[V] Amount: **$10,000** and public title “Best Mobile Trading App on Monad” appear on the [official page](https://monad.xyz/developers/hackathons/metropolis).

[V] The [authenticated bounty page](https://hackathon.monad.xyz/tracks/best-mobile-trading-app-on-monad-agora-onchain-trading-bount) requires Mera authentication, an AUSD balance and a trade through **Perpl**. Kuru-only execution is insufficient.

**Skipped for current scope.** No Perpl or remittance integration is added to chase this award. PWA qualification is irrelevant to the current submission while Perpl is absent; this is no longer an unresolved requirement-text spike.

## Envio: Best Use of Envio

[V] Amount: **$1,000**, listed on the official page. [V secondary] Verbatim playbook requirement:

> Meaningfully use Envio's HyperIndex, HyperSync, or HyperRPC to power real on-chain data driving a core feature in your app.

[I] Feature: HyperIndex handles real Kuru flip/fill events into the S7 fill feed, S8 history and leaderboard SCORE. The Trade handler distinguishes initial inventory-changing fills from realized flipped-order spread.

[U] **S5** proves event sync on our deployed testnet market. A GraphQL health response alone does not demonstrate a core data feature. See [Envio research](envio.md).

## Judging rubric

[V] Rules v3.0 §5.2 was read directly on 8 October and retains the weights below. The track pages instead show 20/20/15/25/20 (Technical, Design, Originality, Founder/Market, Traction). [U] Ask the organizer which governs; preserve both rather than silently replacing the Rules rubric. See [SUBMISSIONS](../SUBMISSIONS.md).

| Main-track criterion           | Weight | Sponsor-bounty criterion                   | Weight |
| ------------------------------ | ------ | ------------------------------------------ | ------ |
| Product Quality & Completeness | 20%    | Adherence to published bounty requirements | 40%    |
| Technical Excellence           | 20%    | Technical Implementation                   | 30%    |
| Monad Integration              | 20%    | Monad Integration                          | 20%    |
| Track Fit & Problem Relevance  | 20%    | Innovation                                 | 10%    |
| Innovation & Impact            | 20%    |                                            |        |

[I] The evidence chain is requirement → operating feature → exact code path → video moment. A sponsor logo or unused package is not the evidence.

## Requirement-to-proof mapping

[I] These are approved feature mappings, not implemented-code or filmed-demo claims. Exact paths are filled as code lands; timestamps are filled before submission, after recording.

| Requirement                                                    | MONADBOY feature                                                       | Code path            | Video timestamp          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------- | ------------------------ |
| Kuru: trading experience routed through its onchain order book | Real testnet flip ladder, taker fill, SCORE/DAMAGE, exit               | filled as code lands | filled before submission |
| Mera UX: entire account layer, no custody backend              | INSERT MEMORY CARD and per-disk sessions                               | filled as code lands | filled before submission |
| Mera UX: stateless test                                        | Clear site data / fresh device, passkey, three disks return from chain | filled as code lands | filled before submission |
| Mera Many Keys: non-wallet PRF material                        | Per-disk private AES-GCM save, ciphertext proof, passkey restore       | filled as code lands | filled before submission |
| Agora Mobile Trading: Mera + AUSD + Perpl                      | Skipped: no Perpl trades in current Kuru-only scope                    | No eligibility claim | Not submitted            |
| Envio: real onchain data driving a core feature                | S7 feed, S8 history, derived leaderboard                               | filled as code lands | filled before submission |

[I] Never cut the real flip fill on camera or the stateless memory-card restore. Show TESTNET on every balance screen, explicit transaction links and honest losses. Bounty candidacy never turns testnet balances into real-money rewards.
