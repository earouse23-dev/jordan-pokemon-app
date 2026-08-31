# Mica Step 2 competitor workflow benchmark

- Status: complete software benchmark
- Research date: 2026-08-31
- Dependency: [Step 1 audit](MICA_STEP1_CAPABILITY_AUDIT.md)
- Evidence: [Step 2 source ledger](evidence/MICA_STEP2_SOURCE_LEDGER.md)

## Outcome

The useful competitor standard is not “more features.” It is faster intake with
an obvious correction path, identity-aware organization, inspectable pricing,
self-service portability, recoverable seller transactions, and grading evidence
that does not pretend to be official.

Mica's strongest software opportunity is to connect those workflows through one
auditable identity and transaction model. Its immediate weaknesses are the
opposite: disconnected flows, unsafe partial import behavior, weak deployment
reproducibility, limited signed-in evidence, and several controls that lead to a
dead end or do not persist.

This document does not make product, pricing, market, or positioning decisions.
It converts verified public procedures and confirmed Mica defects into technical
requirements for later roadmap steps. It changes no application code.

## Method and limitations

The evidence ledger distinguishes documented first-party procedure, current
product evidence, unverified vendor claims, anecdotes, and unavailable paid or
device-only behavior. “Verified path” below means the sequence is documented by
a current first-party source; it does not mean Codex successfully completed the
flow in a signed-in competitor account.

Purposeful actions count selections, captures, confirmations, and required data
entry. Passive loading is recorded separately. When the available evidence does
not expose exact controls, the count is “not measurable” rather than estimated.

No competitor subscription was purchased. No current iPhone or Android device
was attached. Scanner throughput, offline behavior, assistive-technology support,
and paid-only recovery paths therefore remain unverified. Those gaps become
controlled Mica test requirements, not competitor scores.

## Shortest publicly evidenced paths

| Product          | Core workflow            | Shortest supported path                                                                            | Purposeful actions | Evidence status                                                                                                                         | Important limit                                                                                          |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------------------------- | -----------------: | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Collectr         | Repeated card intake     | Search → Camera → capture while prior images process → review match → correct if needed → add      |          5 minimum | Documented procedure ([COL-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#col-2))                                                              | One target portfolio at a time; runtime and recognition accuracy unmeasured.                             |
| Dex              | Variant-aware scan       | Scanner → point → select result → assign variants → add                                            |                4–5 | Documented procedure ([DEX-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#dex-2))                                                              | Paid Dex+ scanner; sorting physical cards before batch assignment reduces per-card work.                 |
| Rare Candy       | Scan raw/slab            | Scan → result tray → review match/variant → add, with manual tray-add fallback                     |     Not measurable | Current product evidence ([RAR-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#rar-1))                                                          | Current reviews and release notes show the matching/variant tray has changed; reliability is unverified. |
| Shiny            | Bulk multilingual intake | Bulk scan → review → assign collection/folder                                                      |     Not measurable | Current product evidence ([SHI-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#shi-1))                                                          | Exact sequence, accuracy, and recovery unavailable publicly.                                             |
| DittoDex         | Continuous session scan  | Scanner → continuous capture → session/gallery review → variant confirmation → save/share/export   |     Not measurable | Current product evidence ([DIT-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#dit-1))                                                          | Published speed is anecdotal; no controlled device run.                                                  |
| PokeData         | Scan to collection       | Scan/search → choose raw/graded/sealed result → add/log transaction                                |     Not measurable | Current product evidence ([POK-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#pok-1))                                                          | Exact click count and required fields unavailable publicly.                                              |
| Card Ladder      | Sale comp to collection  | Sales History search → select sale → bookmark-plus → fill category/year/set/player/condition → add |     5+ plus fields | Documented procedure ([LAD-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#lad-2))                                                              | Strong evidence link, but redundant fields increase entry cost.                                          |
| PriceCharting    | Text import              | Paste up to 5,000 lines → choose category → submit/match → review unmatched → collection           |                 4+ | Public workflow ([PC-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#pc-2))                                                                     | Claimed match rate is unverified; no atomic rollback evidence.                                           |
| eBay Price Guide | Scan to sales insight    | My eBay → Scan cards → capture raw/graded card → inspect insights                                  |                  4 | Official procedure ([EBA-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#eba-1))                                                                | US and app scanner constraints; it is a price-insight path, not a complete collection ledger.            |
| Dragon Shield    | Scan to collection       | Scanner → review result → select folder/add                                                        |     Not measurable | Current product evidence ([DRA-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#dra-1))                                                          | Exact Pokémon variant/language behavior and recovery are unverified.                                     |
| Ludex            | Manual capture to record | Open → Scan → choose type → align → shutter → details → edit price/condition → add/list            |                7–8 | Documented procedure ([LUD-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#lud-1), [LUD-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#lud-2))         | Capture is explicit rather than continuous; public export instructions conflict.                         |
| CollX            | Scan with correction     | Scan → review match/variants → Add; if wrong, search and connect → set condition/grade             |          3 minimum | Documented procedure ([CLX-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#clx-1))                                                              | Scanner does not assess condition; the user must set it.                                                 |
| Double Holo      | Card-show acquisition    | Scan → inspect comparable → apply configured buy/trade percentage → review stack → confirm/log     |                  5 | Documented public workflow ([DH-3](evidence/MICA_STEP2_SOURCE_LEDGER.md#dh-3))                                                          | Open-beta performance and accuracy are unverified.                                                       |
| DeckTradr        | Vendor transaction       | Choose buy/sell/trade → scan batch → price/payment → confirm → sync; void restores inventory       |     Not measurable | Current product evidence ([DEC-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#dec-1))                                                          | Release notes prove recovery intent; exact signed-in behavior is unverified.                             |
| InVelocity       | Inventory/channel sync   | Import with column mapping or capture inventory → review mapping → explicit eBay sync              |     Not measurable | Public procedure/description ([INV-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#inv-1), [INV-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#inv-2)) | Consultation and sign-in are required; public access/trial statements conflict.                          |
| SnapGradeAI      | Digital grade estimate   | Capture/upload front and back → quality check → AI processing → report                             |                  4 | Public demonstrated path ([SNA-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#sna-1))                                                          | Accuracy claims conflict and public PSA examples include invalid half grades.                            |
| CardGrade.io     | Guided pre-grade         | Guided front/back capture, or front/back plus eight corner macros → submit → report/history        |     Not measurable | Current product evidence ([CGR-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#cgr-1), [CGR-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#cgr-2))     | Accuracy, capture time, and actual-outcome comparison are unverified.                                    |

## Workflow comparison

### Intake, identity, and organization

| Product       | Verified/public advantage                                                                                                                                          | Verified/public weakness or constraint                                                                        | Mica response                                                                                                                       | Roadmap dependency | Effort |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------ |
| Collectr      | A capture queue allows the next image while processing; quick-add and bulk portfolio moves reduce friction.                                                        | Correction is a separate review action; import/export is narrow, delayed, emailed, or premium.                | Build a non-blocking capture queue, keep correction in context, and make preview/export self-service.                               | Steps 3, 5, 8      | L      |
| Dex           | Variant assignment is explicit; physical sorting can turn repeated variant entry into one batch choice; smart folders and binder view reflect collector structure. | Automated cross-app import is intentionally absent because mappings can be wrong; scanner/export are gated.   | Preserve the identity-safety rationale but solve it with preview, explicit ambiguities, correction memory, and reversible mappings. | Steps 3, 5, 8      | XL     |
| Rare Candy    | Current app evidence spans English/Japanese raw and major slab families and provides manual fallback.                                                              | Public change history indicates matching and variant controls can regress.                                    | Version scanner contracts, preserve a manual route, and test tray/review behavior across releases.                                  | Steps 3, 5, 7, 12  | L      |
| Shiny         | Broad batch, language, organization, market-history, and set-progress surfaces reduce app switching.                                                               | Exact behavior and recovery cannot be inspected publicly.                                                     | Match only evidence-linked workflow outcomes; do not copy breadth without identity and recovery gates.                              | Steps 3, 5, 8, 9   | XL     |
| DittoDex      | Continuous capture and a session gallery emphasize throughput and post-capture review.                                                                             | Throughput evidence is anecdotal and device-dependent.                                                        | Use a defined benchmark corpus and report correct saved identities per minute, not captures per minute.                             | Steps 3, 5, 12     | L      |
| Ludex         | Explicit card-type selection and camera-quality guidance give users a recovery path.                                                                               | The capture sequence has more actions; web/mobile feature differences and export statements are inconsistent. | Provide live quality guidance with fewer modal transitions and one documented portability contract.                                 | Steps 5, 11, 12    | M      |
| CollX         | Match/variant review is compact; condition remains an honest user choice rather than a scanner guess.                                                              | Wrong matches require search-and-connect; collection and export have limits.                                  | Keep condition explicit, offer correction in at most three actions, and preserve corrections for future matching.                   | Steps 3, 5         | M      |
| PriceCharting | A permissive 5,000-line text importer lowers migration friction and reports unmatched items.                                                                       | Match-rate claims are not independently verified and no whole-import rollback is evidenced.                   | Pair broad parsing with a dry run, exact result counts, downloadable rejects, and atomic/resumable commit.                          | Steps 3, 5, 11     | L      |

### Pricing, alerts, and transactions

| Product          | Verified/public advantage                                                                                         | Verified/public weakness or constraint                                                         | Mica response                                                                                                      | Roadmap dependency | Effort |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ------ |
| Card Ladder      | Multiple estimation methods expose the relationship between a card, a sale, an index, and human-vetted evidence.  | Adding from a sale requires several redundant identity fields; much functionality is paid.     | Make every value inspectable while reusing canonical identity fields already known to Mica.                        | Steps 3, 4         | L      |
| PokeData         | Puts raw/graded/sealed prices, population, volume, alerts, and transaction logging in one public product surface. | Exact workflow, error recovery, and responsiveness are unavailable publicly.                   | Connect evidence, holdings, and ledger events, but require provider/grade/freshness details for every value.       | Steps 4, 9, 10     | XL     |
| eBay Price Guide | Moves directly from capture/listing to completed-sale evidence, including accepted offers and grade filters.      | US/app constraints and eBay-centered evidence do not provide canonical identity or accounting. | Preserve original sale evidence and source context; keep marketplace data as evidence, not internal truth.         | Steps 3, 4         | M      |
| Double Holo      | Applies configured buy/trade rules to comparables and logs a complete event.                                      | Performance, calculation detail, and open-beta recovery are unverified.                        | Build balanced, idempotent buy/sell/trade events with visible assumptions and a review checkpoint.                 | Steps 4, 10        | XL     |
| DeckTradr        | Current release evidence treats voids and failed sync as explicit recoverable states.                             | App reviews signal sale errors but do not establish frequency or cause.                        | Make transaction state durable, make retries idempotent, and prove void restores inventory and accounting.         | Steps 10, 12       | L      |
| InVelocity       | Unifies inventory, custom fields, channel sync, roles, activity, and performance data.                            | Signed-in workflows are inaccessible without consultation; public onboarding claims conflict.  | Defer channel integrations and roles; retain an auditable internal ledger and explicit sync state as future seams. | Steps 10, 13       | XL     |

### Pre-grading

| Product      | Verified/public advantage                                                                                                        | Verified/public weakness or constraint                                                                  | Mica response                                                                                                                      | Roadmap dependency | Effort |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------ |
| SnapGradeAI  | A quality gate precedes the report and public surfaces show subgrades, confidence, batch work, and saved reports.                | Accuracy/access claims conflict; examples use invalid PSA half grades; terms grant broad upload rights. | Enforce official label spaces, abstain on weak evidence, show defects/reasons, and make consent/retention narrow and revocable.    | Steps 7, 11, 12    | XL     |
| CardGrade.io | Guided capture, high-detail corner capture, saved history, reports, and actual-outcome comparison form a coherent evidence loop. | Accuracy and device performance are public claims, not verified measurements.                           | Preserve guided capture and outcome calibration but publish accuracy only after a versioned held-out benchmark and minimum sample. | Steps 7, 12        | XL     |
| Double Holo  | Connects pre-grading to grading economics and submission organization.                                                           | Exact calculations and grading quality are unavailable publicly.                                        | Link pre-grade evidence to submission/outcome and realized economics without presenting an official grade.                         | Steps 7, 10        | L      |

## Mica baseline against those workflows

Step 1 confirmed these implementation facts:

- Catalog search can return exact candidates and requires confirmation, but photo
  identification, batch capture, persistence, and multilingual paths lack current
  signed-in/device proof.
- CSV import has bounded idempotent retries but can partially commit without a
  row preview, dry run, or whole-import rollback.
- Purchase and sale calculations have strong unit coverage; trades are memory-only
  and do not create ledger events.
- Watch entries persist, but alerts are foreground-only and device-local.
- Grading capture, evidence, prediction, submission, and outcome code exists, but
  the live schema is behind local V3 contracts and real calibration remains
  unverified.
- Account export omits grading data, preferences, storage, auth factors, and
  sessions despite “complete backup” language.
- Direct `/profile`, sealed entry, stale dashboard failure handling, and account
  deletion have confirmed critical defects or production incompatibilities.

These confirmed Mica problems are valid requirement sources even when no
competitor demonstrates the desired solution.

## Testable software requirements

Targets below are acceptance thresholds for their named future step, not claims
about current Mica behavior. “Action” means a purposeful user action as defined in
the method. Latency targets exclude third-party provider time unless stated.

| ID  | Requirement                                | Source                                                                                                                                                                                                     | Acceptance criteria and measurable target                                                                                                                                                                                                                                                                                                                                                                                                       | Dependency        | Effort |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ |
| R01 | Canonical, variant-safe identity           | Dex variant handling ([DEX-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#dex-2)); Collectr/CollX correction paths; Step 1 identity fragmentation                                                                 | A saved raw, graded, or sealed item references one stable internal identity plus versioned provider mappings. Ambiguous language/finish/edition/promo/grade matches never auto-commit. Benchmark reports top-1/top-3 and silent-substitution rates; silent wrong identities must be 0 in the release corpus.                                                                                                                                    | Step 3            | XL     |
| R02 | Non-blocking capture queue                 | Collectr repeated capture ([COL-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#col-2)); DittoDex session model ([DIT-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#dit-1))                                              | User can capture the next item while prior items process; a 20-item queue survives refresh/retry without loss or duplication. On the approved mid-tier device and benchmark deck: at least 12 correctly reviewed-and-saved identities per minute and 0 silent substitutions.                                                                                                                                                                    | Steps 3, 5, 12    | L      |
| R03 | In-context correction and mapping memory   | CollX search/connect ([CLX-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#clx-1)); Step 1 unverified AI correction                                                                                                | From a result, a user reaches the correct candidate in no more than 3 actions without losing the capture or batch position. A correction records a reversible mapping/rule version and is used in subsequent candidate ranking.                                                                                                                                                                                                                 | Steps 3, 5        | M      |
| R04 | Safe high-volume import                    | PriceCharting 5,000-line input ([PC-2](evidence/MICA_STEP2_SOURCE_LEDGER.md#pc-2)); Dex identity warning ([DEX-4](evidence/MICA_STEP2_SOURCE_LEDGER.md#dex-4)); Step 1 partial commits                     | A 5,000-row supported CSV produces a dry-run preview with created/updated/ambiguous/rejected counts in p95 ≤5 seconds on CI reference hardware. No account writes occur before confirmation. Commit is atomic or a resumable idempotent job; forced failure yields no duplicates and a downloadable row-level result file.                                                                                                                      | Steps 3, 5, 11    | L      |
| R05 | Variant-aware organization                 | Dex folders/smart folders/binder ([DEX-5](evidence/MICA_STEP2_SOURCE_LEDGER.md#dex-5), [DEX-6](evidence/MICA_STEP2_SOURCE_LEDGER.md#dex-6)); Step 1 no settled organization model                          | Folders/lists/tags/saved rules preserve exact variant quantities and never clone financial events. Create or apply an organization target to selected items in ≤4 actions. Filters over a 10,000-item fixture update in p95 ≤200 ms on reference desktop and ≤400 ms on reference mobile.                                                                                                                                                       | Steps 3, 8, 12    | L      |
| R06 | Inspectable, contextual pricing            | Card Ladder estimation methods ([LAD-3](evidence/MICA_STEP2_SOURCE_LEDGER.md#lad-3)); eBay completed sales ([EBA-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#eba-1)); Step 1 provider gaps                     | Every displayed value exposes source, market, identity, condition/grade, currency, observed-at/checked-at, sample status, and supported/unsupported/stale state within 1 action. No missing or unsupported value is coerced to zero. Fixture calculations are deterministic and trace to accepted observations.                                                                                                                                 | Steps 3, 4        | L      |
| R07 | One durable transaction ledger             | PriceCharting sale path ([PC-3](evidence/MICA_STEP2_SOURCE_LEDGER.md#pc-3)); Double Holo POS ([DH-3](evidence/MICA_STEP2_SOURCE_LEDGER.md#dh-3)); Step 1 memory-only trades                                | Purchase, sale, trade-in, trade-out, fee, shipping, tax, grading, void, and adjustment events persist and reload. A trade records both sides, cash, and fees as one balanced idempotent operation. Duplicate submission changes balances once; void restores inventory and financial totals exactly.                                                                                                                                            | Steps 3, 10       | XL     |
| R08 | Durable, explainable alerts                | Card Ladder watchlist ([LAD-4](evidence/MICA_STEP2_SOURCE_LEDGER.md#lad-4)); PokeData alerts ([POK-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#pok-1)); Step 1 foreground-only alerts                          | Rules store threshold, evidence scope, channel, quiet hours, and status server-side. A qualifying completed sync creates one durable delivery record within 15 minutes, retries transient failure without duplication, and exposes why it fired.                                                                                                                                                                                                | Steps 4, 9, 11    | L      |
| R09 | Evidence-based, non-official pre-grading   | CardGrade guided/outcome loop ([CGR-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#cgr-1)); SnapGrade quality gate and failures ([SNA-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#sna-1)); Step 1 privacy-copy defect | Output uses only the chosen grader's valid labels, calls itself an estimate, includes capture-quality state, defect evidence, model/rubric version, and abstention. PSA output can never be 9.5. No accuracy statement appears until a versioned held-out set meets the predeclared sample minimum and confidence reporting. Image recipients, repeat processing, retention, and withdrawal are accurately disclosed and tested.                | Steps 7, 11, 12   | XL     |
| R10 | Recoverable card-show transaction mode     | Double Holo configured offer flow ([DH-3](evidence/MICA_STEP2_SOURCE_LEDGER.md#dh-3)); DeckTradr void/retry ([DEC-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#dec-1)); Step 1 hidden seller tools              | After identity confirmation, a configured buy/sell/trade completes in ≤30 seconds in the benchmark without re-entering known identity or price fields. Percentage, rounding, fees, cash, and basis are visible before confirm. Refresh/retry never duplicates a transaction; void restores inventory; per-event profit/loss reconciles to the ledger.                                                                                           | Steps 4, 10, 12   | XL     |
| R11 | Self-service complete portability          | Collectr delayed export ([COL-5](evidence/MICA_STEP2_SOURCE_LEDGER.md#col-5)); Ludex conflict ([LUD-4](evidence/MICA_STEP2_SOURCE_LEDGER.md#lud-4)); Step 1 incomplete backup                              | A user can request a versioned machine-readable export without support. A 10,000-item seeded account completes within 60 seconds or becomes a resumable job with visible status. The manifest covers profile/preferences, identities, holdings, lots, transactions, grading, alerts, organization, provider mappings created by the user, and file inventory; omissions are explicit. Re-import dry run reconciles entity counts and checksums. | Steps 5, 11, 12   | L      |
| R12 | Accessible core workflows                  | Shiny current accessibility declarations ([SHI-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#shi-1)); Step 1 device/test gaps                                                                                    | Auth, search/add/edit, scan review, import, pricing evidence, transaction, grading, alert, export, and deletion meet WCAG 2.2 AA automated rules and have zero critical manual blockers with keyboard, VoiceOver, TalkBack, 200% text, visible focus, reduced motion, and narrow portrait layout on the approved matrix.                                                                                                                        | Steps 5–12        | L      |
| R13 | Honest loading, stale, and recovery states | DeckTradr visible failed-sync retry ([DEC-1](evidence/MICA_STEP2_SOURCE_LEDGER.md#dec-1)); Step 1 stale dashboard and partial-job defects                                                                  | Any failed account/provider/job request clears or labels stale derived totals, retains safe user input, supplies retry/resume where valid, and exposes last-success time. Forced offline, 429, 500, timeout, and refresh tests produce no duplicate mutation, false success, or unlabeled stale value.                                                                                                                                          | Steps 4, 5, 9–12  | L      |
| R14 | No visible dead ends or no-op controls     | Step 1 sealed 403, toast-only currency, no-op onboarding, hidden tools, and `/profile` 404                                                                                                                 | Every visible enabled action succeeds in its supported environment or reaches a specific recoverable state. Unavailable entitlements are detected before data capture and offer a truthful supported fallback. Direct loads for every documented route return the app shell. Release E2E contains one success and one forced-failure assertion for every critical action.                                                                       | Steps 5, 6, 10–12 | L      |

Effort is relative software-engineering size: S is localized, M is cross-module, L
is a substantial vertical slice, and XL changes shared identity, ledger, provider,
or verification contracts. It is not a schedule or staffing estimate.

## Parity requirements

These are later-step requirements because they have verified workflow value and a
confirmed Mica need, not because a competitor lists them:

1. Variant-safe search, scan review, and fast correction (R01–R03).
2. Batch capture with persistent review and measurable correct-card throughput
   (R02).
3. Dry-run import with explicit ambiguities, rejects, and recovery (R04).
4. Variant-aware organization, saved views, and set/binder progress (R05).
5. Source-linked prices, completed-sale evidence, history, and durable alerts
   (R06, R08).
6. One persisted purchase/sale/trade/grading ledger with safe void/retry behavior
   (R07, R10).
7. Guided pre-grade capture, honest evidence, saved outcomes, and calibration
   (R09).
8. Self-service, versioned export and tested re-import (R11).
9. Mobile, keyboard, screen-reader, loading, and failure recovery quality across
   core workflows (R12–R14).

## Defensible software differentiators

These extend existing Mica foundations and address confirmed problems:

1. One canonical identity connects catalog, holdings, price evidence, lots,
   trades, sales, grading submissions, and corrections without making a provider
   ID the source of truth.
2. Every money value preserves exact arithmetic, source currency, fees, cost
   basis, and the distinction between unknown, unsupported, stale, and zero.
3. Identity corrections and merges are versioned, reversible, and auditable.
4. Pre-grading uses valid official label spaces and explicit abstention but never
   presents itself as the official grader.
5. Grading media is private by default with accurate processor disclosure,
   explicit research consent, limited retention, and dependable withdrawal.
6. Every automation—matching, pricing, alerting, repricing, or grading—exposes its
   evidence, version, state, and recovery path.

## Rejection and deferral list

The following do not become current roadmap requirements:

- Social feeds, creator features, community scoring, and gamification merely
  because consumer trackers offer them.
- A native app, public marketplace, multi-TCG expansion, or offline mutation queue
  before the Step 12 release gate. Those remain Step 13 branches.
- Cryptocurrency valuation or payment surfaces.
- Price prediction, sentiment, or technical signals presented as market truth.
- Faux official slabs, invalid grade labels such as PSA 9.5, or accuracy claims
  without a versioned held-out benchmark.
- Export that requires support email, waits up to 30 days, or is limited to once a
  year as the only portability path.
- Import that silently accepts identity matches without preview, correction, and
  rollback/resume evidence.
- Grading economics based on one flat fee and an assumed grade 9.
- Automatic repricing or channel sync without caps, confirmation, idempotency,
  and an audit trail.
- Broad reuse rights or indefinite retention for private grading images.
- Any capability justified only by a vendor's feature list, install count, rating,
  or marketing claim.

## Exit-gate traceability

| Gate                                                                           | Evidence                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every proposed feature links to a verified workflow or confirmed Mica problem. | R01–R14 each name source-ledger evidence and/or a Step 1 finding. Claims alone are explicitly insufficient.                                                                       |
| Every requirement has acceptance criteria and a measurable target.             | R01–R14 define observable state plus rate, latency, action-count, data-integrity, accessibility, or error-recovery thresholds.                                                    |
| No item exists only because a competitor lists it.                             | The parity list maps to requirements; the rejection list removes marketing-only breadth and deferred platform scope.                                                              |
| Verified behavior is separate from claims.                                     | The evidence ledger classes every source; the matrices use “documented,” “current product evidence,” “claim,” “anecdote,” or “unverified.”                                        |
| Core comparison dimensions are covered.                                        | Paths and R01–R14 cover fields/defaults, corrections, batch work, search/identity, responsiveness, accessibility, offline/failure behavior, exports, notifications, and recovery. |
| No software or external state changed.                                         | Step 2 adds documentation only. No paid access, dependency, application code, database, provider, deployment, or competitor account was changed.                                  |

## Inputs deferred to later gates

- Paid competitor access may refine an unverified row but is not required to use
  the public benchmark safely. It must be separately approved before purchase.
- The recommended device matrix remains iPhone Safari, Android Chrome, and desktop
  Chrome. Exact models/OS versions must be fixed before Steps 5, 7, and 12 device
  benchmarks.
- Step 3 needs benchmark identities covering difficult language, finish, edition,
  promo, grader, grade, and sealed-product cases. No destructive migration or
  production application is authorized by this benchmark.

Step 2 is ready to hand to Step 3 when repository checks confirm the documentation
is internally complete and the working tree remains traceable.
