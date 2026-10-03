# Sol CLIENT-05 — exact sold-derived valuation, local slice

**For Astra review.** The existing graded detail and physical-copy screen now places a native-currency sold-derived estimate ahead of its separate provider market index. The estimate is reproducible from exact completed-sale IDs when at least three eligible distinct sales remain after validation, deduplication and outlier review. Raw and sealed valuation, purchase amounts, certificates, inventory writes, portfolio history and FX behavior were not replaced.

## Paths and changed files

| Path | CLIENT-05 behavior |
| --- | --- |
| `lib/providers/pkmnprices.js` | Retains CLIENT-01 resolved-card and title validation; exact lookup now also rejects contradictory finish, edition and promo/label context when explicitly supplied. Its existing printing alias normalizer is reused. |
| `api/sales.js` | Parses exact finish/edition/promo and requested USD/EUR context, returns the already validated lookup and provider card ID as an explicit envelope, and returns raw normalized sales. The old API-level outlier pass was removed because it could mix currencies. No new provider query or pagination was added. |
| `lib/pricing.js` | `exactSoldValuation` applies one deterministic exact-context/native-currency calculation; existing `reviewComparableOutliers` and completed-sale freshness boundaries are reused. The older `summarizePsaSales` remains for compatibility but no longer powers the visible PSA comparison. |
| `app.js`, `styles.css` | The selected graded card or physical copy shows the sold estimate, qualitative meter, source details, exclusions and retry; the provider market index remains separately labeled and an empty provider-index response settles as unavailable. Existing PSA grade comparison uses the same calculator. Currency and qualifier controls use the existing context selector. Delayed results and owner changes cannot paint a prior selection. |
| Tests and config | Focused unit/API cases, three-browser physical-copy and price-evidence workflows, and mobile WebKit inclusion for the physical-copy spec. |

Caller path: the existing detail `loadSales` builds the selected copy/context lookup, `api/sales.js` calls `fetchPkmnPricesSales`, and the validated response reaches `renderExactSoldValue` through `exactSoldValuation`. The existing `loadPsaGradeEvidence` and `renderGradedPriceLadder` call the same calculator for PSA grade comparisons. The provider market index still follows `loadCardPreviewPricing` and its quote selection independently.

The sales API's `validatedContext` is issued after `fetchPkmnPricesSales` resolves the canonical provider card, checks exact grading/printing attribution and applies the CLIENT-01 title/canonical identity matcher. The estimator requires that envelope plus the matching client catalog ID, an exact local printing status, complete name/set/number/language/finish/edition/promo/variant, grader, numeric grade and explicit qualifier. Missing or conflicting fields resolve to no estimate. The envelope is not inferred from a provider's `exact` flag. Existing historical records remain intact; a legacy record with unknown context can still show its separate provider index, while the sold estimate abstains.

## Frozen calculation and reproduction

The [pre-implementation fixture table](sol-client-05/FROZEN_EXPECTATIONS.md) records hand-calculated odd/even medians, sparse counts, context separations, duplicate aliases, currencies, outliers, dates and failures. All rows are purpose-built synthetic evidence. A documented implementation-review amendment caps confidence at limited when the provider page is known truncated; it does not change the frozen numeric answers.

Policy `mica-exact-sold-v1`:

- Use completed, exactly attributed sales with a finite positive original amount, supported native USD or EUR, a direct HTTPS transaction source, and valid nonfuture sold time within 90 days. Reject asks, quote snapshots, raw/wrong-grade/wrong-language/wrong-printing/qualifier rows and missing provenance with stable reasons. Sold time sets freshness; retrieval and ingestion times remain separate diagnostics.
- Group eBay regional/title URL aliases by the underlying `/itm/{id}` transaction, independent of feed or provider ID. Other recognized markets require an explicit marketplace transaction ID and matching domain; no live non-eBay source is claimed. Repeated identical retrievals count once. If copies of one transaction disagree on amount or sold time, all are excluded as `conflicting_duplicate` rather than choosing an arbitrary value. Sorting makes estimate, IDs and exclusions invariant under input order.
- Run the existing robust outlier review **after** exact-context, currency, window and transaction deduplication. Flagged rows remain inspectable but do not contribute. Report median before/after review and the observed min/max as a *comparable sale range*, never a confidence interval. With fewer than three post-review sales, return `estimate: null` while keeping the sparse rows visible. Otherwise return the median; rounding occurs in the UI only.
- Newest contributing sold date over 30 days old is visibly stale; no sale older than 90 days can support a current estimate. A fresh retrieval or transient provider error does not refresh the sold date. A failed refresh retains prior evidence with an error label.
- Confidence is qualitative: fewer than three = insufficient; >30-day newest sale = stale; fresh 3–4 or one-market evidence = limited; at least five fresh sales across two marketplaces and ≤30% observed range/median = moderate; at least seven and ≤15% = strong. Known pagination truncation caps fresh confidence at limited. These are uncalibrated policy labels, never probabilities or transaction authentication.

The returned artifact includes estimate or null, original currency, contributing transaction evidence IDs, excluded IDs/reasons, distinct sale and marketplace counts, latest sold/retrieval times, evaluation time, rule version, range and outlier medians. For the frozen USD example, eBay transactions `1001/1002/1003` sold at 100/120/140 yield `120 USD`, range `100–140`, three distinct sales and one marketplace. The exact same rows cannot produce an EUR estimate; independent 90/110/130 EUR rows yield `110 EUR`. The 90/100/110/120/1000 outlier fixture yields before median 110 and after median/estimate 105. No source amount is overwritten.

## Browser behavior and local evidence

The actual graded-copy detail flow uses local `/api/sales` and Supabase stubs. [Desktop USD](sol-client-05/desktop-chromium-exact-usd.png), [mobile Chromium USD](sol-client-05/mobile-chromium-exact-usd.png), and [mobile WebKit USD](sol-client-05/mobile-webkit-exact-usd.png) show a `120 USD` synthetic estimate and inspectable source links. The USD stub response also carries three EUR rows; the screen labels them separately and only the USD sources contribute. The [desktop EUR](sol-client-05/desktop-chromium-exact-eur.png), [mobile Chromium](sol-client-05/mobile-chromium-exact-eur.png), and [mobile WebKit](sol-client-05/mobile-webkit-exact-eur.png) captures show `110 EUR` after the user changes currency; the prior USD value disappears first. The browser test also exercises two-sale insufficiency, no eligible sale, stale sales, provider failure, retry retaining prior evidence, qualifier/grade change, separate copy navigation and a delayed prior-copy response. No automatic inventory write occurs. These screenshots are synthetic and do not show provider coverage or market accuracy.

The existing quote and graded-price-ladder UI remain available as separate source types. The PSA comparison now requires the same three-sale threshold and native currency; one sale is shown as evidence, never as a valuation. Currency changes use separate in-memory grade evidence keys. The selected exact valuation uses a request ID, identity/context keys, owner ID and session generation; copy and account changes clear owner-specific result state.

## Verification

| Command | Result |
| --- | --- |
| `node --test tests/exact-sold-valuation.test.js tests/pricing.test.js` | 58 passed after the initial fixture-envelope correction. |
| `npm test` | 429 passed, 1 existing guarded local-database skip, 0 failed. A focused 58-test run passed after the final catalog-ID check. |
| `npx playwright test tests/browser/price-evidence.spec.js tests/browser/physical-copies.spec.js --workers=1` | 39 passed in an earlier full run. |
| `npx playwright test tests/browser/card-profile.spec.js tests/browser/physical-copies.spec.js tests/browser/price-evidence.spec.js --workers=1` | 108 passed, 9 existing capture-only skips, 0 failed across desktop Chromium, mobile Chromium and mobile WebKit after the final empty-response fix. |
| `npx playwright test tests/browser/physical-copies.spec.js --grep 'exact sold value follows' --workers=1` | 3 passed, 0 failed after adding mixed-currency and settled-index screenshot assertions. |
| `npm run lint`; `npm run typecheck`; `npm run build` | Passed after the valuation changes; lint checked 90 source files. Final `app.js` focus change is covered by the browser acceptance rerun. |
| `node scripts/verify-certificate-exclusion.mjs` | Passed across 25 shipping files. |
| Scoped Prettier and `git diff --check` | Passed for packet files. `app.js` retains one pre-existing unrelated Prettier difference around internal fixture save; newly changed blocks were formatted. |

Intermediate broader browser runs exposed a raw-card context-key mismatch and a rapid-input focus race in the shared valuation selector. Both were corrected while preserving keyboard focus and sticky-action visibility. A rapid-entry repeat passed 16/16 on mobile WebKit, and the refined focus behavior passed 12/12 targeted checks across all three profiles. A mobile Chromium physical-copy repeat passed 8/8 after the test waited for each committed field value. The later screenshot check exposed the empty provider-index response leaving its separate quote at “Checking…”; the fallback now settles as unavailable. Earlier failures are diagnostic, not acceptance evidence.

## Astra R1–R3 revision — 2026-09-24

The unchanged [Astra review probe](sol-client-05/astra-review-probe.mjs) failed all three assertions before this revision: unqualified BGS accepted a Black Label title, a valid first-edition title failed canonical matching, and `first_edition` received HTTP 400. It passes all three after the shared adapter/API fixes. This probe is diagnostic; the new `tests/client-05-revision.test.js` drives locally stubbed PkmnPrices responses through `api/sales.js` into `exactSoldValuation` with all outbound provider traffic intercepted.

| Finding | Change and executable evidence |
| --- | --- |
| R1 — slab labels | `saleMatchesLookup` now checks explicit title labels and grade claims against structured facts and the request. Missing structured label facts, conflicting Black/Gold/Silver labels, and a title half-grade conflicting with structured grade are excluded. The adapter/API/estimator integration accepts three ordinary BGS 10 sales for 120 USD, three genuine BGS 10 Black Label sales for 600 USD, and three BGS 9.5 Gold Label sales for 320 USD; each pool rejects the other cases, including missing and conflicting structured qualifiers. |
| R2 — first edition | The API accepts canonical `first_edition` without permitting malformed underscore input. The adapter recognizes `1stEditionHolofoil`, `FirstEditionHolofoil`, `1st Edition Holofoil`, and human-readable first-edition aliases while the canonical title matcher ignores edition words only for a requested first edition. A locally stubbed three-sale first-edition response produces the hand-computed 120 USD median; three unlimited sales separately produce 20 USD. Feeding either accepted pool to the opposite exact context yields no estimate. Wrong-card, language, set, number and bundle safeguards remain in the canonical matcher. |
| R3 — upstream provenance | The adapter now returns one stage-labeled exclusion per rejected provider row, a safe provider ID or `null` when none is available, and received/accepted/excluded counts. Normalization, context, and canonical rejections are disjoint. The API passes these fields to `loadSales`, which retains them with same-context evidence after a failed refresh and clears them on currency or copy change. The optional evidence panel shows provider screening separately from valuation-window/currency/duplicate/outlier exclusions. Rejected URLs are never linked. The first-edition fixture receives 8 rows: 3 accepted and 5 excluded (1 normalization, 3 context, 1 canonical), with counts reconciling exactly. |

[Desktop](sol-client-05/desktop-chromium-upstream-exclusions.png), [mobile Chromium](sol-client-05/mobile-chromium-upstream-exclusions.png), and [mobile WebKit](sol-client-05/mobile-webkit-upstream-exclusions.png) screenshots use synthetic data and show `5 received · 3 accepted · 2 excluded before valuation`, a safe rejected provider ID, and one explicitly unidentified provider row. The corresponding browser test verifies a 120 USD estimate from only the three accepted links, retention after HTTP 502, and clearing on currency/copy change. It makes no claim of real provider coverage.

| Revision check | Result |
| --- | --- |
| Unchanged `node docs/evidence/sol-client-05/astra-review-probe.mjs` | Before: 3 failed assertions. After: all 3 passed. The probe makes no provider request. |
| `node --test tests/client-05-revision.test.js tests/pricing.test.js tests/exact-sold-valuation.test.js` | 60 passed, 0 failed. The new two integration cases use only intercepted fixture responses. |
| `npm test` | 431 passed, 1 existing guarded local-database skip, 0 failed. |
| `npx playwright test tests/browser/physical-copies.spec.js --grep 'provider exclusions remain traceable' --workers=1` | 3 passed, 0 failed on desktop Chromium, mobile Chromium and mobile WebKit. |
| `npx playwright test tests/browser/card-profile.spec.js tests/browser/physical-copies.spec.js tests/browser/price-evidence.spec.js --workers=1` | 111 passed, 9 existing capture-only skips, 0 failed. |
| Lint, typecheck, build, certificate exclusion, scoped Prettier, `git diff --check` | Passed; lint checked 90 source files and certificate exclusion checked 25 shipping files. `app.js` still has one unrelated pre-existing Prettier hunk around internal fixture save; revised blocks match formatting. |

The frozen median/window/confidence/currency policy and the absence of real-sale numeric evidence are unchanged.

## Real evidence, FX and remaining gates

The retained CLIENT-01 live coverage files contain no sale prices or listing IDs; inspecting their schema confirms they cannot reconstruct a numeric market value. The CLIENT-01 report records eight exact accepted rows in one English PSA 10 case, but its sanitized ledger intentionally omits amounts and links. No rights-cleared, reproducible real-sale numeric evaluation is claimed here. No new provider call, secret access, hosted mutation or paid service occurred.

**Smallest proposed live valuation probe for separate approval:** one known exact English Pikachu 006/015 Holofoil PSA 10 lookup through the current adapter, capped at one card resolution and one sold-listings request, `limit=10`, with retries and pagination disabled. Retain only rights-approved transaction IDs/URLs, native amounts/currencies, sold and retrieved times plus matcher decisions in a private evidence ledger. Recompute the median independently and review false matches/outliers. If fewer than three eligible rows remain, report insufficient evidence. EUR, BGS, half-grade and other-language coverage would still need separately budgeted samples; this proposal is not authorization to call the provider.

**Later FX contract, subject to approval:** a source record should state base currency, quote currency, units of quote per one base, rate, effective time, retrieval time and provider ID. A conversion should reference that immutable rate record and valuation time, preserve every native sale/acquisition amount, define stale/missing handling before display, and round only the converted display amount. Present-value conversion and a historical purchase/sale conversion need different effective dates; neither may silently use today's rate for a past cash flow. No FX source or conversion was added in this packet.

Local code and synthetic workflow acceptance remain separate from real-sale valuation accuracy, FX activation and release readiness. CLIENT-04 real-photo 0/12, physical iPhone, live recognition and official certificate gates remain open. GemRate remains excluded from shipping. No migration, native work, deployment, commit or CLIENT-06 work. Stop for Astra review.
