# Sol CLIENT-05 — exact sold-derived valuation, first implementation slice

## Authority and scope

Elliott explicitly authorized starting CLIENT-05 on 2026-09-24. This permits independent valuation work while Step 4 real-photo, physical-device and live-recognition gates remain open. It does not declare those gates passed. This is the sole active packet; stop for Astra review before any next slice.

Use `ponytail:ponytail` in **full mode**. Read its installed SKILL.md before work (currently `/Users/elliottrouse/.codex/plugins/cache/ponytail/ponytail/4.10.0/skills/ponytail/SKILL.md`); report unavailable honestly. Reuse existing implementation first and choose the smallest correct change. Do not reduce required functionality, security, data preservation, accessibility, tests, evidence or approval gates.

Read AGENTS.md, `docs/MICA_SOFTWARE_ROADMAP.md`, `docs/MICA_CLIENT_PIVOT_2026-09-17.md`, CLIENT-01's packet/report and CLIENT-03/04D acceptance evidence. Preserve the dirty worktree. Sol is the application-code writer; Astra reviews.

Outcome: an existing graded card/physical-copy screen can show a reproducible estimate from eligible completed sales for that exact printing and slab context, or an honest insufficient/stale/unavailable state. USD and EUR stay separate. This is the native-currency calculation/UI slice of Step 5; live valuation and approved FX remain separate exit evidence.

## 1. Trace and reuse before changing behavior

Start with `lib/pricing.js` (`summarizePsaSales`, `priceEvidence`, `reviewComparableOutliers`, freshness policy), `api/sales.js`, `lib/providers/pkmnprices.js`, the graded price ladder/card and physical-copy renderers in `app.js`, and existing pricing/provider/browser tests. Trace all consumers before replacing the PSA/USD-only summary. Reuse accepted CLIENT-01 identity validation and CLIENT-03 exact copy context.

Keep raw/sealed prices, market indexes, latest sales, asks, manual estimates and sold-derived estimates distinct. Preserve existing records and unrelated screens. Do not reuse the old quote confidence as sale confidence or overwrite acquisition amounts/grades/certificates. No portfolio/history redesign in this packet.

## 2. Calculation contract and fixed initial policy

Implement one reusable calculation at the existing shared pricing boundary, with explicit requested context and valuation time. No speculative pricing service/framework.

- Require canonical printing identity, language, finish/edition/variant and exact grader, numeric grade including half grades, and relevant qualifier/label. PSA 10, BGS 10, BGS Black Label and BGS 9.5 cannot share a pool. Missing or conflicting context is unresolved, never an invitation to fall back. Preserve CLIENT-01 title/canonical validation rather than trusting endpoint scope or provider `exact` alone. Context may be supplied by the validated adapter envelope where explicitly established; do not invent missing row facts.
- Accept only finite positive amounts for attributable completed-sale observations with valid source identities/links and usable sold timestamps. Preserve sold, retrieved/ingested and valuation times separately. Reject future/invalid dates, wrong context, shared/ambiguous attribution, asks, raw prices, snapshots and unsupported currencies with reproducible exclusion reasons.
- Deduplicate the same underlying marketplace transaction across URL aliases, provider rows and repeated retrievals. A second feed of the same marketplace is not a second independent source. Keep legitimate distinct sales; explain uncertain duplicate handling. Filtering and deduplication must be deterministic under input reordering.
- First policy: within a **90-day sold-date window**, use the median of eligible non-outlier distinct sales in one exact-context/native-currency pool. Require **at least three** contributing sales for a numeric estimate. Zero means no estimate; one or two remain visible as limited sale evidence without becoming a market-value estimate. This is a provisional engineering policy for review, not a calibrated accuracy claim.
- Reuse the existing robust outlier review on the already context-filtered, deduplicated, currency-separated, time-windowed pool. Never compute outliers across grades/currencies. Preserve flagged rows and reasons in optional evidence; exclude them from this version's calculation, recompute eligible count and disclose sensitivity (median before/after review). Do not silently discard an expensive legitimate sale or claim the flag proves it false.
- Reuse the 30/90-day completed-sale freshness boundaries. If the newest contributing sale is older than 30 days, the estimate must be visibly stale; after the 90-day window it cannot remain a current value. A fresh fetch does not rejuvenate an old sale. Retain prior evidence on transient errors with honest freshness/error status.
- Return estimate or null, native currency, contributing evidence IDs, excluded IDs/reasons, distinct sale count, source-market count, newest sale and retrieval times, evaluation time and rule version. Include observed min/max as a **comparable sale range**, never a statistical confidence interval. Round consistently at the display boundary without modifying stored source amounts.
- Compact confidence must reflect count, freshness, dispersion and actual source independence. Prefer the existing small indicator with a short qualitative label and optional factors; do not invent a probability of correctness. Document the deterministic label rules before evaluating fixtures. Single-market evidence must not become independently corroborated because two adapters supplied it. Known pagination truncation remains visible as a limited recent sample, not the entire market.

## 3. Integrate the existing user flow

Use the existing exact graded detail/physical-copy view and evidence panel. Lead with estimate and currency, freshness/confidence and a useful action; keep source/exclusion details optional. Do not add another navigation system or a new mandatory confirmation screen.

Switching language, printing, grade, qualifier, currency or physical copy must update the requested context and cannot display an earlier request's result under the new selection. Account changes must clear owner-specific state. Do not refetch on every render or broaden provider queries. Handle loading, insufficient sales, no coverage, stale evidence, provider rejection and retry without clearing the user's inventory or acquisition draft.

Use native USD/EUR evidence only for the matching currency. If a requested currency lacks eligible sales, show unavailable rather than relabeling another currency, averaging mixed currencies or filling with an ask/raw quote. Existing other-currency evidence can be shown separately and explicitly labeled. Do not claim provider EUR/grade/language coverage that has not been measured.

## 4. Evidence and verification

- Freeze a small table of inputs and independently hand-calculated expected outputs before implementation tests: ordinary odd/even medians, 0/1/2 sales, exact minimum, half grades/qualifiers, wrong language/finish, identical transaction through multiple providers, genuinely distinct transactions, USD/EUR separation, outlier/zero-MAD behavior, stale/future timestamps, missing provenance, truncation and provider errors. Expected values must not be generated by the implementation under test.
- Add focused unit/API tests for the shared contract and exact-context filtering; preserve CLIENT-01 adversarial regressions. Prove record reordering does not change the estimate or duplicate counts.
- Browser-test the actual consumer on desktop Chromium, mobile Chromium and mobile WebKit: valid estimate with inspectable sources, sparse/missing/stale/error states, mixed currency, copy/context changes and delayed old responses, and no automatic inventory writes. Use local provider stubs with outbound requests blocked. Capture only relevant permitted screenshots.
- Reuse any existing licensed real evidence that contains sufficient amounts, dates and source IDs to independently reconstruct a result. The sanitized CLIENT-01 coverage ledger intentionally omits prices and identifiers and is not sufficient numeric valuation proof. Do not infer them, fabricate live rows or treat synthetic tests as a real market evaluation.
- **New live provider budget is zero for this slice.** Earlier CLIENT-01 request budgets were packet-specific and are not renewed here. If retained real evidence is insufficient, complete implementation and synthetic validation, then report the exact smallest capped live probe required for the next review. Do not read/print secrets or make background/provider requests during tests.
- Run affected pricing/provider/domain/unit and browser checks, lint, typecheck, build, shipping certificate exclusion and scoped formatting/diff checks. Broaden regression coverage if a shared pricing consumer changed. No database mutation is necessary; if durable schema changes prove essential, report a concrete proposal separately instead of applying them.

## 5. FX and remaining Step 5 work

The roadmap requires separate FX approval. Do not add a live FX provider or conversion in this slice. Report the existing currency/display assumptions and a concise integration contract for a later approved source: base/quote, rate direction, effective date, fetched time, source identity, stale/missing behavior, rounding, preservation of native amounts and distinction between present valuation and historical transaction conversion. No new currency promise, service subscription or pricing/business decision.

## Return and stop

Write `docs/evidence/SOL_CLIENT_PACKET_05_REPORT.md`: path/caller map, changed files, frozen calculation examples, exact policy and confidence rules, evidence-ID reproduction, screenshots, commands/counts/skips, source rights and real-versus-synthetic limitations. Separate local code acceptance, real-sale valuation validation, FX activation and release readiness. Record any live probe/FX decisions needed as concrete follow-up proposals, not blockers to authorized local implementation.

No scanner tuning, certificate activation, paid service/new production dependency, live provider request, hosted mutation, migration, native platform work, deployment, commit, CLIENT-06 graphs/P&L or unrelated feature work. Keep GemRate modules excluded from shipping. Stop for Astra review.
