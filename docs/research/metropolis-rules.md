# Metropolis rules research

Evidence checked 2026-10-05. **[V]** is fetched official public content; **[V secondary]** is the inspected participant transcription of Rules v3.0; **[I]** is a conversion or product policy; **[U]** awaits the named rules-confirmation spike.

## Calendar and deadline

[V] Metropolis is a six-week global online hackathon. Registration/build starts 1 September 2026; build window ends 13 October; judging runs **14–27 October**; winners are announced **3 November**. Source: [official Metropolis page](https://monad.xyz/developers/hackathons/metropolis).

[V secondary] Rules §4.2 deadline is **Tuesday 13 October 2026, 11:59 PM ET**; late submissions are not accepted and submissions can be edited until the deadline. Source: playbook section 1 and inspected [Rules v3.0 transcription](https://github.com/precious-akpan/monad-metropolis-merchant-rails). Official application/submission surface: [organizer platform](https://hackathon.monad.xyz/).

| Clock | Deadline | Evidence |
|---|---|---|
| ET, America/New_York | Tue 13 Oct 2026 11:59 PM, UTC−4 on this date | [V secondary] Rules §4.2; [I] daylight-saving conversion |
| UTC | **2026-10-14 03:59 UTC**, Wednesday | [I] ET + four hours |
| WIB, Asia/Bangkok timezone equivalent | **Wed 14 Oct 2026 10:59 WIB**, UTC+7 | [I] UTC + seven hours |

[I] Internal target is Tuesday 13 October 18:00 WIB, leaving a buffer before the official cutoff. This is team policy, not a second organizer deadline.

[U] **Rules-confirmation spike:** inspect the exact deadline and binding Rules modal in the signed-in dashboard before submitting. The public official page gives the date, while exact time/late-edit behavior above is secondary evidence.

## Submission requirements

[V secondary] The following requirements are transcribed in playbook sections 1 and 8 and the inspected [Rules v3.0 source](https://github.com/precious-akpan/monad-metropolis-merchant-rails). [U] **Rules-confirmation spike** confirms them against the organizer dashboard; they are treated as submission gates, not downgraded because marketing wording is looser.

| Requirement | Submission evidence to provide |
|---|---|
| Public repository during and after the event | Public GitHub URL, reproducible run instructions |
| OSI-approved open-source license | MIT LICENSE in repository |
| AI coding tools allowed, disclosure mandatory in README | Explicit Claude Code / OMP agent disclosure; team review and authorship responsibility |
| Public video **no longer than three minutes** | Operating product and actual Monad blockchain interactions; not mockups/slides |
| Monad integration proof | Full checked deployed contract addresses and transaction hashes, with chain and explorer links |
| Explain why Monad | Fast fill-driven interactions, onchain Kuru execution and Monad-specific gas/reserve handling |
| Build-window evidence | Inspectable in-window commit history and accurate disclosure of relevant work |
| One project per participant; one track per project | MONADBOY registered in Track 01 Onchain Finance & Trading |
| Team size one to five | Accurate registered members and primary contact |

[I] Mainnet or testnet are allowed by the cited rule, but MONADBOY commits to **testnet play only**. Mainnet is read-only Pool Tracker/mirror data. Every balance screen says TESTNET; no real-money movement is promised.

[I] Video and README map each targeted bounty's requirement to a feature, exact code path and recorded timestamp. Paths are filled as code lands; timestamps and transaction evidence are added before submission. See [bounties](bounties.md).

[I] Keep the deployed app, Hono worker on Bun + SQLite and indexer available throughout judging. A working submission includes discoverable sources for every number and recovery paths after partial transaction failure.

## Rule authority and public-page discrepancy

[V secondary] Rules §7.2 says open source under an OSI license and public GitHub access are mandatory. The cited transcription explicitly notes that this conflicts with the public marketing FAQ's softer open-source language. Treat the binding rules as stricter. Sources: [official page](https://monad.xyz/developers/hackathons/metropolis), [Rules transcription](https://github.com/precious-akpan/monad-metropolis-merchant-rails).

[V secondary] Review is non-confidential under Rules §5.3. [I] Never include private keys, PRF output, account secrets, confidential notes or environment values in the public repository. The encrypted disk blob is deliberately public ciphertext.

[U] **Rules-confirmation spike:** read the signed-in terms directly, verify participant eligibility/registration and confirm sponsor terms. This research has no organizer credentials and does not claim agreement acceptance on the user's behalf.

## Judges and judging evidence

[V] The [official judges/mentors roster](https://monad.xyz/developers/hackathons/metropolis) lists Keone Hon, Eunice Giarta, Will Nuelle, Maria Shen, Alex Svanevik, Wyatt Khosrowshahi and other operators/investors. Use its Judges filter for the current full roster rather than an inferred list of decision-makers.

[V secondary] Main-track rubric has five equally weighted 20% criteria; sponsor rubric weights requirement adherence 40%, technical implementation 30%, Monad integration 20%, innovation 10%. Exact criterion names and feature proof mapping are in [bounties](bounties.md), sourced to Rules §5.2.

[I] Submission proof must stay honest: a fetched ABI is not a successful order, a simulation is not a broadcast, published authenticator support is not our device test, and a bounty listing is not verified eligibility.

## Open confirmations

[U] **Agora eligibility spike:** organizer answer pending for exact Mobile Trading wording, responsive/PWA eligibility and any Mera condition. Cross-Border Payments is not targeted.

[U] **Rules-confirmation spike:** confirm whether multiple sponsor bounties may be awarded to one project and record any sponsor-specific restrictions. No main-track or sponsor award is promised.
