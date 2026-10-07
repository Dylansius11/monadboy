# Lessons

Newest on top. Each entry: root cause, then the durable rule.

## Technical

### 2026/10/07 — Preserve signed margin cash flows

- **Cause:** Clamping cumulative base withdrawals above deposits to zero created phantom DAMAGE after a real zap/exit.
- **Rule:** Keep each token's deposits-minus-withdrawals signed; clamp only final DAMAGE. Label public lifetime cash-flow accounting separately from private per-run basis.

### 2026/10/07 — Keep small realized spread visible

- **Cause:** Four decimals rounded a real0.0000029978AUSD SCORE to zero; six decimals then exceeded narrow phone columns.
- **Rule:** Preserve six decimal precision below one quote unit and reflow equally weighted SCORE/DAMAGE/NET before reducing readability. Verify actual font geometry, not just formatted strings.

### 2026/10/07 — Keep disposable authenticator lifetime explicit

- **Cause:** The owned Chromium process ended while its virtual CTAP credential existed only in memory; onchain ciphertext cannot reconstruct a lost passkey.
- **Rule:** Keep the same disposable reader alive through funded play, exit and stateless restore proof. Never export PRF/key material to preserve a test harness; production recovery requires the user's durable supported passkey.

### 2026/10/07 — Measure indexed appearance, not later receipt collection

- **Cause:** A real fresh fill appeared in GraphQL 16.620 seconds after its observed receipt; retrospective receipt collection cannot establish ingestion latency.
- **Rule:** Start a read-only observer before the needed transaction, record immediate receipt observation and first GraphQL appearance, and preserve missed targets. Select runtime-supported live RPC ingestion separately from HyperSync backfill.

### 2026/10/07 — Remove owned quotes before taking external liquidity

- **Cause:** The mirror repeatedly took its own stale plain quotes; a later quote refusal also hid the successful preceding trade hash.
- **Rule:** Cancel authoritative-live owned plain quotes before a taker, re-read remaining external liquidity, and preserve all confirmed partial hashes when a later step fails. Revalidate source freshness immediately before signing after every await.

### 2026/10/07 — Prove live order membership

- **Cause:** Filled plain orders retained positive size/owner in storage even though their price-point list was empty.
- **Rule:** Verify linked membership from the same-block price-point head before cancellation or resting-inventory valuation; fail on inconsistent or cyclic links rather than invent holdings.

### 2026/10/07 — Keep Kuru input scales and maker direction distinct

- **Cause:** Market-buy quote input uses pricePrecision, not quote-token decimals; margin zap debits margin; Trade.isBuy describes the taker.
- **Rule:** Use shared exact quote encoding, deposit quote before margin zap, express minOut in raw output-token units, and invert direction for maker accounting. Pin units to captured raw receipt bytes.

### 2026/10/07 — Bound estimates before paying declared gas

- **Cause:** An unbounded native-payout estimate declared21,491,618 gas and billed2.192145036 MON although a bounded equivalent succeeded near310,060 gas.
- **Rule:** Simulate and freshly estimate within the measured shape's budget, add explicit headroom and refuse over-budget signing. Receipt gasUsed is Monad's billed declared limit, not an independent execution-gas measurement.


### 2026/10/07 — Recheck card ownership after every await

- **Cause:** Eject during post-receipt refresh allowed a stale operation to return the previous card's saved disk.
- **Rule:** Assert the session lease and generation after every asynchronous boundary before publishing a card result, including confirmed-receipt refresh.

### 2026/10/07 — Bound mathematically normalized producer values

- **Cause:** Different floating-point addition orders produced maker concentration slightly above 1 and rejected two otherwise valid worker markets.
- **Rule:** Bound the producer's normalized ratio to its mathematical domain; keep strict consumer validation and regression coverage.

### 2026/10/07 — Reconcile native dialog cancellation

- **Cause:** Escape closed the native help dialog while React retained its input lock.
- **Rule:** Reconcile controlled state on native cancel before closing; exercise the next console action after Escape.

### 2026/10/05 — Check price-source liveness, not listing existence

- **Cause:** A listed book can be empty. The approved MON_AUSD finding is not a live price guarantee [U: S2 / Phase 6 source validation].
- **Rule:** Inspect bids, asks, and recent activity before accepting a price source; missing activity pauses the feed rather than producing a synthetic price.

### 2026/10/05 — Sequence low-balance spending by blocks

- **Cause:** Monad's reserve mechanism can reject closely spaced value-spending transactions from low-balance accounts [V: reserve-balance documentation](https://docs.monad.xyz/developer-essentials/reserve-balance).
- **Rule:** For an undelegated sender relying on the emptying exception, wait until no other sender transaction is within the prior three blocks, or retain sufficient reserve; do not substitute a wall-clock guess.

### 2026/10/05 — Treat book scaling and emptiness as separate cases

- **Cause:** A scaled price integer or an empty-book sentinel can look like a valid number if parsed generically; Kuru's approved 1e18 scaling and (2^256-1, 0) empty pair require live confirmation [U: S2].
- **Rule:** Decode bestBidAsk units explicitly and reject the empty pair before computing a mid; never turn a sentinel into a displayed price.

### 2026/10/05 — Validate event signatures against live topics

- **Cause:** Published event declarations can disagree with the deployed contract; the approved Kuru event mismatch requires direct proof [U: S2].
- **Rule:** Derive selectors from the vendored SDK ABI and compare with real log topics before decoding or valuing fills.

### 2026/10/05 — Introspect only after the project exists

- **Cause:** Project-aware tooling run against an incomplete tree produces missing imports and misleading guidance.
- **Rule:** Install the actual dependency graph and create the relevant project surface before generating mappings or running introspection tools.

### 2026/10/05 — Keep data-only tools reproducible offline

- **Cause:** A live data-tool dependency makes a deterministic screen or review depend on network availability.
- **Rule:** Data-only analysis tools consume explicit inputs offline and commit their reproducible output when appropriate; live product sources stay live and failures stay visible.

### 2026/10/05 — Draw gates from the same configuration

- **Cause:** A hand-drawn filter boundary can disagree with the gate that selects markets.
- **Rule:** Derive visible eligibility geometry and actual filtering from the same thresholds and axis mapping.

### 2026/10/05 — Keep the key legend on the shell

- **Cause:** Repeating a legend inside screens consumes scarce vertical space and lets labels drift.
- **Rule:** The shell owns contextual help and its shared key legend; screens provide current intents and context-specific labels. Avoid a persistent legend that consumes the phone viewport.

### 2026/10/05 — Measure a fixed inset fit box

- **Cause:** Measuring changing content or a transformed element creates unstable fit-scale feedback; late fonts and mobile viewport changes alter the result.
- **Rule:** Measure a fixed inset box, keep scale outside its measurement, and re-measure after fonts.ready and visualViewport resize.

### 2026/10/05 — Give transforms separate owners

- **Cause:** Fit-scale, press motion, or sprite movement on one element overwrite each other's transform.
- **Rule:** Put independently controlled transforms on separate nested elements with one clear owner each.

### 2026/10/05 — Land the shared base layer before parallel screens

- **Cause:** Parallel screen work against unsettled shared libraries and types creates conflicting contracts and route generation.
- **Rule:** Settle the shared base layer first, then parallelize independent screens; regenerate the route tree once, centrally.

### 2026/10/05 — Check glyphs against the shipped font

- **Cause:** A system fallback can draw non-ASCII symbols that the bitmap font cannot.
- **Rule:** Inspect the actual font and keep a confirmed glyph list before using non-ASCII player text; use supported ASCII or a deliberate pixel icon otherwise.

### 2026/10/05 — Make viewport overflow observable

- **Cause:** A 320px logical viewport clips excess content silently, so an apparently valid component can hide its own controls.
- **Rule:** Use useOverflowWarning in development and inspect the rendered screen, including wrapped copy, modals, and error states.

### 2026/10/05 — Budget from the component's default type role

- **Cause:** Height calculations based on a guessed font size miss real line heights and wrapping.
- **Rule:** Allocate space from the actual default role and line height of each component, then verify the real font at phone scale.

### 2026/10/05 — A real action must expose its real cost

- **Cause:** Turning a simulated action into execution can create a larger lie if the interface still presents it as free.
- **Rule:** Show inventory changes, DAMAGE implications, taker fees, and transaction cost before manual re-centering; never sell a reset as loss removal.

### 2026/10/05 — Keep machine-specific settings untracked

- **Cause:** Personal permissions and local paths in shared configuration break other machines and can expose sensitive context.
- **Rule:** Never track .claude/settings.json or machine-specific agent settings; keep shared rules in portable project documents.

### 2026/10/05 — Rewrite context-dependent key labels

- **Cause:** A key with several contextual actions is misleading when its legend stays fixed.
- **Rule:** Bind the label to the currently reachable action and update it with context, not just the handler.

### 2026/10/05 — Separate cursor state from applied state

- **Cause:** A highlighted control can be mistaken for the selected value when navigating without applying it.
- **Rule:** Render cursor location and committed choice as distinct visual states on every applicable control.

### 2026/10/05 — Let one flex block absorb remaining height

- **Cause:** Manually summing fixed heights to 320px fails as copy, borders, or type roles change.
- **Rule:** Reserve fixed regions and let one flex block absorb the remainder; inspect overflow rather than compensating with scattered pixel edits.

### 2026/10/05 — Install with Bun, run browser tooling with Node

- **Cause:** jsdom 30 depends on undici APIs that require Node 22 or newer; installation and test runtimes are not interchangeable.
- **Rule:** Keep the runtime guard in vitest.config.ts, use Bun for installs and scripts, and Node 24 for Vite / Vitest under the approved toolchain.

## Working with the user

### 2026/10/05 — Evidence outranks reassuring language

- **Cause:** Unverified claims and mediocre compromises obscure whether the product actually works.
- **Rule:** Name concrete evidence, label verified facts [V], inferences [I], and unresolved facts [U] with a settling spike or gate; never imply execution from a document.

### 2026/10/05 — Match the conversational register, not the document language

- **Cause:** A rigid monolingual reply can lose the intent of mixed Indonesian / English feedback.
- **Rule:** Reply in the user's mixed register when they use it; keep repository docs and code in English.

### 2026/10/05 — Decide docs, design system, then screens

- **Cause:** Screen work before shared decisions invites inconsistent scope and visual conventions.
- **Rule:** Set product contracts in docs, settle the design system, then build screens against those contracts.

### 2026/10/05 — Offer distinct directions with a first choice

- **Cause:** Near-identical alternatives shift responsibility without clarifying the trade-off.
- **Rule:** Present genuinely different directions, recommend one first, and state what each costs.

### 2026/10/05 — Audit blockers before polish

- **Cause:** Optimistic reviews can bury the issue that prevents a real run.
- **Rule:** Start audits with blockers, name their evidence and dependency, then discuss improvements and their cost.

### 2026/10/05 — Keep the root guide to rules and pointers

- **Cause:** A long root guide duplicates subject documents and makes operational rules difficult to find.
- **Rule:** CLAUDE.md stays concise; each subject document owns its detail and the root guide points to it.

### 2026/10/05 — Use references for density, never style

- **Cause:** Literal style imitation can override the product's chosen language.
- **Rule:** Extract information density and hierarchy from references while retaining the approved palette, materials, and identity.

### 2026/10/05 — Fill the screen with its subject

- **Cause:** Empty composition reads as unfinished even when the controls function.
- **Rule:** Give the screen's actual subject enough visual area and useful content before adding decorative filler.

### 2026/10/05 — Recommend after incorporating edited options

- **Cause:** The user edits proposed choices to expose a better combined constraint, not to request another neutral list.
- **Rule:** Incorporate their edits, make one informed recommendation, and explain the trade-off instead of repeating options.

### 2026/10/05 — Name the full input-to-pixel chain

- **Cause:** A plausible value without provenance does not answer where a number comes from.
- **Rule:** Identify source, observation time, conversion, formula, shared function, and visual output; provide an inspectable path.

### 2026/10/05 — Every reachable control needs selection feedback

- **Cause:** A working handler without visible selection makes navigation feel broken.
- **Rule:** Show focus / cursor and applied state for every reachable control on touch and keyboard paths.

### 2026/10/05 — Review spacing on a phone screenshot

- **Cause:** Desktop approval can hide cramped gaps and density problems that are immediately obvious on a phone.
- **Rule:** Review actual 412px phone renders and screenshots, checking spacing first; say whether the surface was seen rendered.
