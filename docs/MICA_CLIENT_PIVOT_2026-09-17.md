# Mica client-directed implementation roadmap

Date: 2026-09-17. Owner: Elliott/client. Orchestration: Astra. Implementation: Sol.

## Authority and scope

Source: [Mica Client Requirements](https://app.notion.com/p/3deaaba4c66581a7b5e3fdbb85987863), read in full, last edited 2026-09-17T22:41:34.943Z. This translates the client's requirements into software work; it does not invent marketing, subscription prices, or business strategy. The Notion research workflow informed the source-to-requirement mapping and explicit uncertainty gates below. Notion was not modified.

This is the current priority override for `MICA_SOFTWARE_ROADMAP.md` and `MICA_MVP_BRIEF_2026-09-17.md` where their scope conflicts. Retain their engineering safeguards and prior evidence. Do not restart completed engineering work or proceed with the old Card Ladder-inspired sequence automatically.

Work one numbered step at a time. A packet may cover only part of a step. Sol stops at its review gate; Astra reviews evidence before issuing the next packet. No destructive migrations, new paid services, production dependencies, platform changes, or deployment without Elliott's approval. Preserve the existing dirty worktree.

## Client outcome

### Elliott's phased certificate release decision — 2026-09-24

This explicit client-directed scope update supersedes earlier statements requiring live official certificate access before the initial release or blocking all independent work on real slab ownership. Build complete certificate lookup/enrichment and GemRate population workflows now against isolated development/test fixtures; omit those integration-dependent screens and fixtures from the first shipping build. The first version may ship without GemRate/certificate lookup once its remaining quality/release gates pass. Preserve existing optional certificate storage as unverified user/OCR facts and existing records; never present it as functioning lookup or authentication.

Elliott intends to reconsider paid GemRate access around ten users / $200 monthly recurring revenue, with approximately $200/month as his current planning assumption, not a verified provider quote or purchase authorization. No billing implementation or automatic spending trigger is authorized. GemRate's public partner page documents certificate/population capabilities, but account entitlement, exact schemas, coverage, fees, storage/image rights and live behavior remain to be verified. Live integration and an approved release update follow that verification; fixture-complete UI is not live-provider acceptance.

Apple distinguishes TestFlight beta testing from a complete public App Store version and prohibits dormant/undocumented features in submitted builds (guidelines 2.2 and 2.3.1). Keep deferred feature source in the repository and internal builds, exclude it from initial shipping artifacts, and expose it through a later reviewed release. No submission, native platform installation or deployment is authorized by this scheduling update.

Elliott has no slabs. Permitted internet slab photos may support offline detector/crop and later authorized recognition benchmarks, with source/permission/ground-truth records. They do not establish physical slab camera/glare performance; screen/print rephotography is a proxy and must be reported separately. Real-device and physical-slab release evidence can come from consenting testers or borrowed items; it need not be Elliott's own collection. Do not buy slabs or paid image access.

`SOL_CLIENT_PACKET_04B_DEFERRED_CERTIFICATE_WORKFLOWS.md` and its R1–R3 revision were accepted locally by Astra on 2026-09-24; see `docs/evidence/ASTRA_CLIENT_PACKET_04B_ACCEPTANCE.md`. Internal draft/conflict/observation workflows and shipping exclusion are accepted for their tested scope; live integration and reload/database observation persistence remain open. This scheduling update supersedes the prior requirement to obtain physical slabs before any more software work. The next planned activity is an offline online-image scanner benchmark under a separate bounded packet. CLIENT-05 valuation remains unissued.

CLIENT-04C was reviewed on 2026-09-24; see `docs/evidence/ASTRA_CLIENT_PACKET_04C_REVIEW.md`. Its evidence task is closed with the real Pokémon corpus gate unmeasured (0/12). The resulting rejected-geometry defect was repaired in CLIENT-04D and accepted locally; see `docs/evidence/ASTRA_CLIENT_PACKET_04D_ACCEPTANCE.md`. Astra independently passed nine focused browser checks, 21 unit tests and shipping exclusion. No packet is currently active. Real-photo rights/coverage, physical-device and live-recognition gates remain open; no further detector tuning, paid/live providers or CLIENT-05 work is issued by this acceptance.

An iPhone beta collector can photograph the front of a graded Pokémon slab once, confirm the identity and certificate facts, save that physical copy, and subsequently track its value and profit/loss without rescanning. Inventory and portfolio history persist across sessions. Initial delivery is TestFlight for Jordan and friends, not merely a mobile website.

## Requirement map

| ID | Client requirement | Engineering acceptance boundary |
| --- | --- | --- |
| C01 | Graded Pokémon beta; PSA and Beckett | No raw-price fallback. Distinguish grader, exact grade, label/qualifier and variant. CGC is secondary. |
| C02 | English, Japanese, German; European relevance | Separate canonical identities and measured pricing coverage per language. A translated card name or EUR quote does not establish German sold coverage. |
| C03 | One front photo | Recognize card and slab; confirm/correct uncertain fields. Manual certificate recovery remains available. No routine back-photo requirement for this flow. |
| C04 | Save once, retrieve later | Authenticated durable save, idempotent retry, owner isolation, reopen after a fresh session without scanning again. |
| C05 | Multiple physical copies | A group of three identical slabs contains three independently addressable copies, with certificates and acquisition costs. Horizontal copy navigation. |
| C06 | Purchases and sales | Purchase price/date, explicit sale of the selected copy, proceeds/date, retained sale history. Realized and unrealized P/L are distinct. Trades later. |
| C07 | Calculated market value | Reliable recent completed sales for the exact context; source traceability, deduplication, recency, outlier review, sparse-data behavior. Active asks are not the calculation. |
| C08 | Compact confidence | Small gauge plus label; optional details for count, recency, agreement, match and missing evidence. Never portray model confidence as transaction verification. |
| C09 | Card and portfolio graphs | 1w/1m/6m/1y; value and P/L views; portfolio graph at top, P/L percentage and current value below. Missing history is visible, not invented. |
| C10 | Useful inventory navigation | Profitable/negative, rising/falling/flat, missing/stale; filters for set, language, grader, grade, value, P/L, movement and purchase date. |
| C11 | Certificate enrichment | PSA and Beckett manual/OCR certificate input; persist available source facts, permitted images and subgrades. Unavailable fields stay missing. |
| C12 | Local currency | Preserve native amounts and original currency plus conversion rate/source/time and valuation time. No relabeling EUR as USD. |
| C13 | Existing features retained | Preserve authentication, profiles, settings/privacy, prior scans and legacy records. Existing pregrading is secondary, not the graded beta's entry flow. |
| C14 | TestFlight quality | Real providers and persistence, real iPhone camera/session tests, polished loading/empty/error states and client walkthrough. Mock browser passes alone do not satisfy this. |

Raw and sealed acquisition/valuation expansion, set completion, alerts expansion, marketplace checkout, public sharing, advanced indexes, new TCGs, trades and subscription billing are outside this beta's critical path. Do not delete existing raw/sealed records or pregrading capabilities. This is scope prioritization, not permission to lose data. Keep future entitlement and category boundaries modest; do not build unused systems.

## Core flows and model guardrails

Navigation proposal for client review: Portfolio, Inventory, Scan/Add, with settings/profile secondary. A card or inventory group opens the canonical profile; a physical-copy view adds its certificate, acquisition and sale facts. Reuse existing screens before introducing tabs. Want/watch flows remain preserved but are not a new beta milestone.

Separate these concepts in the current model rather than rebuilding it wholesale:

- **Printing identity:** game, catalog IDs, set, printed number, language, year, rarity, finish, edition/promo/other variant. Provider mapping may be unresolved; uncertainty must not create a guessed canonical match.
- **Graded context:** printing + grading company + exact grade + relevant qualifier/label. Keep half-grades and BGS label distinctions; do not average different slab contexts.
- **Physical copy:** owner, stable copy ID, context, certificate as a string (including leading zeros), acquisition facts, user images, status and immutable event lineage. Group count is derived from copies; quantity alone is not enough.
- **Certificate observation:** grader, cert, source, observed time, available facts/images and verification status. OCR is a claim; a source response is a separate observation. A matching cert does not authenticate the photographed slab.
- **Market evidence:** sale identifier/URL, actual underlying marketplace, aggregator, sold time, ingested/retrieved time, original amount/currency, identity attribution, grading details and exclusion reasons.
- **Estimate:** context, as-of time, included evidence IDs, method/version, amount/currency, FX provenance, confidence and coverage. No raw fallback; no treating a quote snapshot as a sale.
- **Transactions/snapshots:** acquisitions, selected-copy sales, fees where entered, dated value/cost observations. Reuse existing ownership lots and grading lineage. Review migration baseline before proposing additive schema work; do not deploy it during planning.

Portfolio value sums priced active copies, with unpriced/stale coverage clearly visible. Unknown purchase cost means unknown P/L, not zero cost. A sale exits active value but remains in realized P/L and history. Define P/L percentage and fee handling explicitly in that packet. Acquisition cash flows are not investment returns. Never apply today's holdings to yesterday's graph. Keep historical portfolio P/L based on facts available at each date; no fabricated backfill.

Median is an evaluation baseline, not an approved production algorithm. Compare median, trimmed mean and recency-weighted median on real exact-match samples before choosing. Exclude ambiguous/shared evidence by default; do not count one eBay transaction twice through two aggregators. Missing or thin evidence must not produce confident-looking estimates. Confidence thresholds require documented calibration.

## Current baseline and open gates

Packet 01's local identity/profile safeguards remain useful. Packet 02's latest report says the owner-isolation revision is complete; Astra inspected the owner binding and session/onboarding path during this pivot but has not rerun its revised browser suite. The previous REVISE decision must be closed in a distinct review, not silently converted into production acceptance.

The repo is currently a web app. No native iOS project was found in the scoped file search. Choose and approve the TestFlight delivery route early; do not assume a PWA is a TestFlight binary or that a wrapper is already approved.

PkmnPrices Pro is purchased per Elliott, but the available local key was rejected. See the companion capability review. Actual hosted configuration was not inspected or changed. PSA API access exists publicly; our account access and reusable fields/images are not verified. An approved Beckett automation interface was not established by this research. These are explicit integration gates, not permissions to scrape.

## Numbered build sequence and exit gates

### Authorized scheduling exception — 2026-09-18

Elliott authorized preparing physical-copy inventory work while certificate-provider replies are pending. CLIENT-01 was accepted for local data readiness, not production readiness. CLIENT-02 research is accepted, the Capacitor direction is approved, and Elliott reports both official-access inquiries sent; certificate access and terms remain unresolved. Manual/OCR-only entry is **not** approved as a substitute for official records. These status updates supersede the historical setup blockers above.

Only the independent Step 3 slice in `SOL_CLIENT_PACKET_03_PHYSICAL_COPIES.md` may proceed during this pause. Step 2 is not marked complete or waived. No certificate integration, native-platform implementation, release, or additional roadmap step is authorized by this exception. Retain all approval and data-preservation boundaries.

### 1. Pro data readiness and exact graded-sales evidence

Implement only `SOL_CLIENT_PACKET_01_PRO_GRADED_EVIDENCE.md`. Reuse the adapter and demonstrate one truthful graded-evidence route, then report sampled PSA/BGS coverage across EN/JA/DE. Separate endpoint entitlement from data availability. Fix contract errors and regression-test only this slice. Close the old Packet 02 owner-boundary review as a small prerequisite check.

Exit: valid Pro access plus at least one real exact-context graded evidence result through the existing application path; complete sampled coverage matrix, explicit unsupported cells, no false fallback, budget accounting and Astra decision. If the key or required evidence is missing, report BLOCKED for live acceptance while completing safe offline checks. Do not proceed to dependent valuation claims.

### 2. Delivery and certificate access decision gate

Propose the smallest credible TestFlight route using the current application and its camera/auth/storage needs. Identify Apple account/signing/device prerequisites and required dependencies. Document PSA and Beckett approved access, response fields, quotas, image rights and fallback boundaries. No platform change yet.

Exit: Elliott approves the concrete iOS route and any new dependency/service; certificate access is verified or the client explicitly accepts a limited manual fallback. Do not quietly downgrade the beta's enrichment promise.

### 3. Physical-copy inventory and transaction foundation

Reuse existing positions/lots and cert lineage. Enable grouped copies with independent purchase dates/costs, sale events and owner-safe durable persistence. Preserve existing records and retry keys. Specify currency/fee semantics; support unknown cost. This may require a separately reviewed additive migration proposal.

Exit: three same-context slabs can be saved, reopened and navigated independently; selling copy B preserves A/C and B's history. Real approved test-environment persistence and cross-account isolation demonstrated.

### 4. One-photo slab capture and certificate enrichment

#### Local CLIENT-04 review — 2026-09-24

Astra accepted the authorized local capture slice after closing R1–R4; see `docs/evidence/ASTRA_CLIENT_PACKET_04_ACCEPTANCE.md` for independent checks and their limits. Real iPhone, consented real-image, live-recognition and official-provider gates remain open. This is not full Step 4 completion or authorization for CLIENT-05, deployment or native implementation. The next gate is arranging and executing separately authorized real-world validation with the proposed benchmark finalized before measurement.

#### Authorized CLIENT-04 slice — 2026-09-20

Elliott authorized `SOL_CLIENT_PACKET_04_DOCUMENT_CAPTURE.md` following local acceptance of CLIENT-03. This extends the scheduling exception to shared document-style capture across existing camera workflows and the one-front slab recognition/review/save flow. CLIENT-02 official-access and native delivery gates remain open; do not substitute OCR claims for official records or mark all of Step 4 complete.

The Notion requirements were reread on 2026-09-20 (page last edited 2026-09-20T22:01:48.659Z). Automatic live boundary detection, stable/sharp capture, rotation/perspective correction, background removal and processed recognition input are explicit requirements. Manual adjustment is recovery-only. Preserve both slab-label and card regions; preserve unaltered evidence for condition assessment.

The same notes now also request GemRate population/certification screens, sealed/ETB inventory, source-linked market evidence and history UI with honest disconnected states. Record these as pending scoped packets, superseding the earlier blanket sealed exclusion as a client requirement, but not authorizing their implementation in CLIENT-04. Verify provider capabilities/rights before promising live fields. Keep language-specific identity intact even when a user corrects a proposed match; never merge different-language records.

One front photo → candidate identity/slab facts → correction → explicit save → reopen. Manual cert path uses the same model. Only approved certificate adapters; show unavailable rather than invented facts. Keep pregrading separate.

Exit: consented real PSA/BGS slab benchmarks across target languages with per-field accuracy and failures documented; no wrong cert/card silently saved; retry creates one physical copy. Set acceptable benchmark thresholds before running the gate, with client review of failures.

### 5. Exact sold-derived valuation and currency

#### Authorized CLIENT-05 slice — 2026-09-24

Astra initially returned REVISE on CLIENT-05, then accepted the R1–R3 revision locally on 2026-09-24; see `docs/evidence/ASTRA_CLIENT_PACKET_05_ACCEPTANCE.md`. Independent checks passed all three original probes, 60 focused unit/integration tests, nine browser checks and shipping certificate exclusion. Native-currency implementation is accepted; real-sale numeric validation and approved FX remain open. This acceptance supersedes the active-packet statements below: no packet is currently active, no new live-call budget is granted and CLIENT-06 remains unissued.

Elliott explicitly authorized starting CLIENT-05 after local acceptance of CLIENT-04D. This extends the scheduling exception to independent exact sold-derived valuation while real-photo (0/12), physical-device and live-recognition gates remain open. It supersedes earlier statements that CLIENT-05 is unissued or no packet is active; it does not mark Step 4 complete. The sole active packet is `SOL_CLIENT_PACKET_05_EXACT_VALUATION.md`: shared exact-context valuation, native USD/EUR separation and existing-screen integration with deterministic offline evidence. New provider-call budget is zero; separately approved live evidence and FX integration remain Step 5 exit work. Sol stops for Astra review; no CLIENT-06, native implementation or release is authorized.

Evaluate the calculation on real evidence; implement explainable exclusions, source independence, freshness and compact confidence. Integrate an approved FX source with timestamped conversions. Confirm supported display currencies rather than promising every currency.

Exit: independently reproducible estimates from evidence IDs; wrong grade/language/variant excluded; unavailable/low-confidence states truthful; no asks or daily snapshot counts supporting sale confidence; mixed-currency tests and source timestamps pass.

### 6. Persistent card/portfolio history and profit/loss

Introduce or reuse dated snapshots and transaction-ledger calculations, then the client's graph arrangement, date ranges, value/P/L toggles and inventory filters. Price gaps and unpriced copies are explicit. Start with available history; do not invent a year of portfolio ownership.

Exit: controlled buy/price-change/sell scenarios reconcile card, portfolio, realized and unrealized values. Historical membership and currency semantics verified. Missing prices/costs and zero denominators cannot display misleading totals or percentages.

### 7. Approved iPhone integration

Implement the previously approved delivery route, including actual camera, auth return/session restoration, network recovery and secure persistence. Avoid platform-specific duplicate business logic.

Exit: installed build on a real iPhone completes scan→confirm→save→restart→inventory→sale→portfolio. App lifecycle and permission failures preserve drafts safely. No deployment implied by a local build.

### 8. Client acceptance and authorized TestFlight release

Run the client walkthrough, real-provider quota/failure tests, real persistence, mobile visual checks and privacy review. Confirm rollout/build configuration and any known gaps with Jordan/Elliott. Elliott owns submission.

Exit: explicit release approval, reproducible signed build, TestFlight availability to intended testers and documented feedback path. Automated/mock passes are reported separately from real-device/provider proof.

## Team loop

2026-09-29 07F review: bounded schema reconciliation and synthetic-data rehearsal accepted; Astra verified the exact SQL hash and reproduced the pending-name guard failure. Hosted activation is NOT approved. See `docs/evidence/ASTRA_CLIENT_PACKET_07F_REVIEW.md`. Sole active packet: `SOL_CLIENT_PACKET_07G_RELEASE_GATE_CLOSURE.md` for local pending-inventory repair, curated release artifact, required-surface compatibility on the rehearsed schema and concrete backup/activation approval bundle. No scheduled Supabase backup is evidenced; Elliott's earlier manual backup location/date was requested. No private export/restore, paid upgrade, hosted mutation or release implied.

2026-09-29 07E acceptance: local sealed recognition-contract/currency/private-photo/fresh-login/retry work is accepted on reviewed controlled evidence; simulator link proof is diagnostic, not a configured device flow. See `docs/evidence/ASTRA_CLIENT_PACKET_07E_ACCEPTANCE.md`. The reported hosted schema is behind and historically divergent. Sole active packet: `SOL_CLIENT_PACKET_07F_RELEASE_SCHEMA_REHEARSAL.md`, reusing prior reconciliation to create/rehearse an exact data-preserving collector upgrade in a new owned local database and prepare one concrete existing-stack activation approval bundle. Hosted metadata is read-only; no hosted mutation, new billing dependency/schema activation, provider budget, deployment or CLIENT-08.

2026-09-29 07D review: copy navigation, safe market-link and sealed-correction subset accepted with nine independently passing targeted checks (`docs/evidence/ASTRA_CLIENT_PACKET_07D_REVIEW.md`). Sealed form still saves USD; photo is comparison-only; browser reopen reconstructs in-memory state. Sole active packet: `SOL_CLIENT_PACKET_07E_COLLECTOR_FLOW_CLOSURE.md`, batching native USD/EUR acquisition, reusable sealed recognition software, actual isolated local save/fresh-login proof, native source-link handoff and concrete existing-hosted/subscription activation proposals. No provider spend, hosted change, new platform/dependency, subscription product or CLIENT-08 is approved. Cosmetic/low-impact work deferred; core correctness preserved.

2026-09-29 public-release clarification: Elliott defines “beta” as the first public App Store release to generate revenue, using only the existing Mica GitHub/Vercel/Supabase stack. This supersedes TestFlight-only outcome language; TestFlight may be intermediate validation. Read `MICA_RELEASE_DIRECTION_2026-09-29.md`. Existing hosted targets are designated, but no deployment/migration/submission is yet approved. Revenue mechanism/pricing is pending client input, not an engineering choice. Sole active packet remains 07D feature completion plus exact existing-target activation preparation. No separate permanent backend or repeated target-selection question.

2026-09-29 feature-completion direction: CLIENT-07C ordinary build and simulator Keychain scope is accepted (`docs/evidence/ASTRA_CLIENT_PACKET_07C_ACCEPTANCE.md`); backend/device gates stay open. Elliott requests larger batches implementing app requirements before cosmetic polish. The discovered Notion scope is reconciled in `MICA_NOTION_COMPLETION_LEDGER_2026-09-29.md`, preserving explicit certificate shipping deferral and treating Card Ladder as reference. Sole active packet is `SOL_CLIENT_PACKET_07D_BETA_FEATURE_COMPLETION.md`: finish existing copy navigation, source-evidence actions and sealed/ETB collector flows as an authorized independent beta-software scheduling exception. No hosted activation, provider budget, native extension target or CLIENT-08 is implied.

2026-09-29 native continuation: 07B's CORS correction is accepted with 12 independently passing tests; Sol's isolated pinned-artifact compile and actual simulator fail-closed launch are accepted as bounded milestones. Xcode 26.4.1 and the iOS simulator now work. Successful Keychain and the ordinary project build remain open. See `docs/evidence/ASTRA_CLIENT_PACKET_07B_LOCAL_ACCEPTANCE.md`. Sole active next packet: `SOL_CLIENT_PACKET_07C_SIMULATOR_STORAGE.md`, within Step 7, batching ordinary download/build diagnosis, Xcode-managed simulator entitlement investigation and real storage-canary proof. No new Apple identity, hosted activation, provider budget or CLIENT-08 is authorized.

2026-09-29 continuation: Astra independently passed 07B's ten native/CORS tests and 28 copied-asset checks, but found absent-Origin Vary omission and downstream Vary overwrite. See `docs/evidence/ASTRA_CLIENT_PACKET_07B_REVIEW.md`. Sole active packet remains CLIENT-07B via `SOL_CLIENT_PACKET_07B_REVISION.md`, batching that correction with hands-on Xcode setup/build and concrete activation preparation. Elliott explicitly authorizes use of his Mac/resources, including feasible free official Xcode/simulator setup; actual user-only authentication/legal prompts and existing hosted/signing/upload gates remain separate. No CLIENT-08 or provider budget.

2026-09-29: CLIENT-07 feasible native implementation is reported, with setup approval recorded on September 26. Astra read the report and independently passed seven native-runtime tests; native compilation/device/backend acceptance remains open, and the web run's one failure is not erased by its passing rerun. Sole active packet: `SOL_CLIENT_PACKET_07B_NATIVE_VALIDATION.md`, batching remaining review/fixes, bounded regression diagnosis, build/simulator checks when tooling exists and concrete activation preparation. No hosted change/provider budget/upload or CLIENT-08 is authorized. Continuity handoff: `ASTRA_CONTEXT_HANDOFF_2026-09-29.md`.

CLIENT-06's scoped local gate is accepted after 06C; see `docs/evidence/ASTRA_CLIENT_PACKET_06C_ACCEPTANCE.md`. Elliott requests CLIENT-07 with a beta target about one week away. The sole next packet is `SOL_CLIENT_PACKET_07_IPHONE_BETA.md`: preflight/dependency-free preparation active, native project/package actions pending the explicitly requested approval of the previously proposed Capacitor dependency set. Hosted migration/activation, signing/device and live-price/display release gates stay separate; no release or provider spending is authorized.

CLIENT-06B's read/history and fail-closed write contract are reviewed; Astra independently passed 13 focused tests, but actual atomic SQL remains unproved. See `docs/evidence/ASTRA_CLIENT_PACKET_06B_REVIEW.md`. The sole active packet is `SOL_CLIENT_PACKET_06C_ATOMIC_WRITE_VALIDATION.md`: apply the reviewed one-function addition only in a newly owned disposable local database, prove real route/concurrency/fresh-login behavior, and produce the validated additive migration for review. No existing/shared/hosted database migration, provider spending, deployment or CLIENT-07 is authorized. This supersedes earlier active-packet statements.

CLIENT-06's calculation/UI revision is accepted for its tested local scope; Astra independently passed the three original probes and seven focused tests. Graded exact-sold persistence remains incomplete; see `docs/evidence/ASTRA_CLIENT_PACKET_06_REVISION_ACCEPTANCE.md`. The sole active packet is `SOL_CLIENT_PACKET_06B_DURABLE_GRADED_VALUATION.md`: implement a secure durable path using existing schema if feasible, otherwise supply minimal non-applied SQL and contract evidence. No new migration application, provider spending, release or CLIENT-07 is authorized. This supersedes prior active-packet statements.

CLIENT-06 is under REVISE after Astra identified valuation-provenance, event-only history, historical uncertainty and native-EUR history gaps. See `docs/evidence/ASTRA_CLIENT_PACKET_06_REVIEW.md`. The sole active packet is `SOL_CLIENT_PACKET_06_REVISION.md` under Elliott's existing scheduling exception. No provider spending, new migration, release or CLIENT-07 is authorized. This supersedes earlier active-packet statements.

Elliott explicitly approved “Approve scoped CLIENT-06 work” on 2026-09-25 in response to the scheduling-exception question. The sole active packet is now `SOL_CLIENT_PACKET_06_PORTFOLIO_HISTORY.md`: local portfolio history/P&L, requested views/filters and controlled persistence/browser verification. Positive live-price and production-display gates remain open; Step 5 is not retroactively complete. No release, further provider spending, new migration or CLIENT-07 is authorized. This approval supersedes the pending-decision statement below.

CLIENT-05M's bounded observation and measured insufficiency are accepted; Astra independently replayed all row/valuation/accounting comparisons and passed 32 focused tests. See `docs/evidence/ASTRA_CLIENT_PACKET_05M_REVIEW.md`. No further live budget is authorized. `SOL_CLIENT_PACKET_06_PORTFOLIO_HISTORY.md` is prepared but **inactive pending Elliott's explicit scheduling exception**; Step 5 is not declared complete. No implementation packet is active until that decision. This status supersedes historical active-packet statements below.

CLIENT-05L's identity stop is accepted as measured: Astra independently replayed the retained ledger (one request/one reported credit, no sales) and passed 23 offline tests. The required top-level language field was an overly specific harness assumption; see `docs/evidence/ASTRA_CLIENT_PACKET_05L_REVIEW.md`. The sole active packet is `SOL_CLIENT_PACKET_05M_LANGUAGE_AND_SALES_PROOF.md`: establish English membership through the documented filtered list for exact ID 20618, then conditionally fetch at most ten sold rows, reusing the retained direct observation. This new one-shot authorization caps two requests/eleven existing-plan credits; 05L remains closed. No production mapping, deployment or CLIENT-06 is issued.

CLIENT-05K revision is accepted offline: Astra independently passed 18 guard/rehearsal and 83 affected tests; see `docs/evidence/ASTRA_CLIENT_PACKET_05K_ACCEPTANCE.md`. The sole active packet is `SOL_CLIENT_PACKET_05L_REAL_VALUATION_PROOF.md`, consolidating one real Clefable attempt with private retention, independent offline reconstruction and screen replay. Its cap is two requests/eleven existing-plan credits, no retries or replacement samples; no new service/top-up/overage purchase. Private ledger retention is cleared, while actual provider identity/positive numeric proof and broader release display scope remain to be measured/resolved. CLIENT-06 remains unissued. This supersedes earlier zero-live-budget/active-packet statements only for this bounded attempt.

On 2026-09-25 Elliott relayed PkmnPrices' permission to retain data with no specific requirements. See `docs/evidence/PKMNPRICES_RETENTION_CONFIRMATION_2026-09-25.md`. The private numeric audit-ledger retention blocker is cleared; prior unresolved-retention statements are superseded for that scope. Broader release display scope remains separately recorded. CLIENT-05K revision remains the sole active offline packet; no live request budget or CLIENT-06 is issued by the reply.

CLIENT-05K's offline evidence is reviewed: Astra reproduced 15 passing checks and two stale 05D harness failures; the known bare-title false rejection remains. See `docs/evidence/ASTRA_CLIENT_PACKET_05K_REVIEW.md`. The sole active packet is `SOL_CLIENT_PACKET_05K_REVISION.md`: narrowly handle collector-number-corroborated numeric catalog suffixes in sale-title comparison and repair the historical harness's display-label dependency. No live request budget, production crosswalk, provider-rights approval or CLIENT-06 is issued. This supersedes prior active-packet statements.

CLIENT-05J research is accepted for its scope; see `docs/evidence/ASTRA_CLIENT_PACKET_05J_REVIEW.md`. Astra independently confirmed local exact eligibility of the first-edition Jungle Clefable candidate, not its paid-provider mapping. The sole active packet is `SOL_CLIENT_PACKET_05K_OFFLINE_VALUATION_REHEARSAL.md`: reuse existing guards to rehearse the proposed experiment with fake transport and synthetic rows only. No live request budget or production alias is approved. Provider retention/display clarification and real numeric validation remain open; CLIENT-06 remains unissued. This status supersedes earlier active-packet statements.

CLIENT-05I's revision is accepted locally; see `docs/evidence/ASTRA_CLIENT_PACKET_05I_ACCEPTANCE.md`. Astra independently passed the unchanged reopen/four-case probes and 23 focused tests (two guarded DB skips), and reviewed Sol's enabled synthetic DB and real form/fresh-login evidence. Astra did not rerun the cleaned-up stack. The sole active packet is `SOL_CLIENT_PACKET_05J_VALUATION_PREFLIGHT.md`: one bounded real-candidate and provider-rights preflight, research only, with zero paid-provider budget. Positive real-sale numeric validation and production rights remain open; CLIENT-06 is unissued. This status supersedes historical active-packet statements below.

CLIENT-05I is under revision: Astra reproduced a fresh-reopen defect where unloaded catalog options are mislabeled as a removed detailed printing; real persistence remains unproved (22 focused passes, two database skips). See `docs/evidence/ASTRA_CLIENT_PACKET_05I_REVIEW.md`. The sole active packet is `SOL_CLIENT_PACKET_05I_REVISION.md`: repair the state distinction and attempt real persistence in a separately owned disposable project on unused local ports. The pre-existing mica-dev stack stays untouched. This supersedes the earlier fixed-port and no-application-fix constraints only within the revision. No paid-provider budget, migration changes, deployment or CLIENT-06 is issued.

CLIENT-05H R1–R3 is accepted locally; see `docs/evidence/ASTRA_CLIENT_PACKET_05H_ACCEPTANCE.md`. Astra independently passed the four unchanged probes, 89 focused tests, three browser cases and shipping exclusion. The sole active packet is `SOL_CLIENT_PACKET_05I_PRINTING_PERSISTENCE.md`: prove the new detailed-printing snapshots through actual isolated local database save and fresh-session reopen using existing tooling. No paid-provider budget, migration changes, deployment or CLIENT-06 is issued. Step 5 real-sale/canonical-mapping/rights gates remain open. This status supersedes historical active-packet statements below.

CLIENT-05H is under REVISE after independent source-contract probes: observed `variantId` was ignored, language-array/foil restrictions could be lost, and removed detailed selections could fall back to another option. See `docs/evidence/ASTRA_CLIENT_PACKET_05H_REVIEW.md`. The sole active handoff is `SOL_CLIENT_PACKET_05H_REVISION.md` (R1–R3); existing native valuation/FX acceptance remains unchanged. No live provider budget or CLIENT-06 is issued. This current status supersedes historical statements below.

CLIENT-05G's one-observation ECB source proof is accepted; Astra independently verified retained bytes/date/rate/hash and unchanged application hashes. See `docs/evidence/ASTRA_CLIENT_PACKET_05G_ACCEPTANCE.md`. The sole active packet is now `SOL_CLIENT_PACKET_05H_DETAILED_PRINTING_MAPPING.md`, preserving detailed catalog variant evidence through production normalization and selection while retaining unknown edition/promo fields. No live provider budget is renewed; the diagnostic Pikachu remains unresolved absent further evidence. Step 5 real-sale/rights and broader release gates remain open; CLIENT-06 is not issued. This is the current status over the historical statements below.

CLIENT-05F received Elliott's explicit FX approval and is accepted locally; see `docs/evidence/ASTRA_CLIENT_PACKET_05F_ACCEPTANCE.md` (68 focused unit/integration and 12 browser checks independently passed). The sole active packet is `SOL_CLIENT_PACKET_05G_FX_SOURCE_PROOF.md`: one public ECB request through the actual local route, cache verification and offline real-rate/synthetic-sales UI replay. No paid-provider request is renewed, and remaining Step 5 identity/real-sale/rights gates are not waived. No CLIENT-06 or release is issued. This status supersedes the historical packet statements below.

CLIENT-05E's FX design is reviewed and accepted as a proposal; see `docs/evidence/ASTRA_CLIENT_PACKET_05E_REVIEW.md`. `SOL_CLIENT_PACKET_05F_FX_DISPLAY.md` is prepared but **inactive pending Elliott's separate explicit FX approval**. Scope: ECB informational USD/EUR detail-card equivalents, native-first explicit toggle, no persisted conversions or transaction conversion. No packet is active until approval. This current status supersedes the historical statements below; no FX activation, provider-call budget, deployment or CLIENT-06 is implied.

CLIENT-05D completed its single authorized transient attempt: reported two requests/11 charged credits, ten rows, two final contributors and insufficient valuation; Astra accepted the bounded measurement, not positive price accuracy, and independently passed eight offline guard/harness tests. See `docs/evidence/ASTRA_CLIENT_PACKET_05D_REVIEW.md`. No more PkmnPrices calls are authorized. The sole active packet is now `SOL_CLIENT_PACKET_05E_FX_IMPLEMENTATION_PROPOSAL.md`, preparing the explicit currency-conversion approval scope using an ECB USD/EUR reference-rate proposal. It permits source/schema research and design docs only; no FX activation/application changes or CLIENT-06. This is the current status and supersedes the older active-packet statements below.

CLIENT-05C research is accepted with a source-scoped diagnostic mapping decision in `docs/evidence/ASTRA_CLIENT_PACKET_05C_REVIEW.md`. The sole active packet is now `SOL_CLIENT_PACKET_05D_TRANSIENT_VALUATION.md`: one conditional in-memory live arithmetic/path check, maximum two requests/11 reserved credits on existing quota. This supersedes older active-packet statements. The normal unresolved catalog record stays unresolved; temporary reviewer mapping is not production exactness. No numeric provider ledger is retained, so full canonical mapping/reproducible live evidence, FX and release gates remain open. CLIENT-06 remains unissued.

CLIENT-05B stopped at preflight with zero provider requests/reservations; Astra upheld the stop and independently passed four guard tests. The sole active packet is now `SOL_CLIENT_PACKET_05C_PREFLIGHT_RESOLUTION.md`: bounded public-source research to establish the fixed sample's mapping, endpoint row-limit contract and specific usage-rights evidence. A source-backed temporary mapping may replace the unnecessary requirement for a pre-existing saved local record, but defaults cannot manufacture exactness. No paid API call is active during this research slice. See `docs/evidence/ASTRA_CLIENT_PACKET_05B_REVIEW.md`; this status supersedes the historical active-packet statements below.

On 2026-09-24 Elliott requested continuous handoffs: every Astra review response should include the next concrete Sol prompt without requiring another generic “go.” This authorizes routine preparation of the next eligible packet, including revisions, while preserving one active packet, Astra review gates and explicit approval boundaries for purchases, destructive operations, platform changes and deployment. Do not invent completion of missing dependencies.

Following CLIENT-05 local acceptance, Elliott authorized its proposed capped real-sale check. The sole active packet is `SOL_CLIENT_PACKET_05B_LIVE_VALUATION.md`, superseding earlier no-active-packet/zero-call statements for this slice only. Maximum two allowlisted provider requests and 11 reserved returned-item credits on existing included PkmnPrices Pro quota; no retries, search fallback, additional samples or spending. Real-sale positive numeric validation, FX and release gates remain open until reviewed. CLIENT-06 is not yet issued.

Every future Sol handoff must explicitly invoke `ponytail:ponytail` in full mode and require reading its skill instructions. Apply reuse-first/minimal-correct-change principles, never a reduced client experience or weakened security, data safety, test evidence, or approval boundaries.

Astra issues one packet with exclusions and tests → Sol implements one slice → Sol reports changed files, commands/results, screenshots where applicable, sanitized live evidence, limitations and decisions → Astra independently inspects risk-bearing paths and returns ACCEPT/REVISE/BLOCKED → next packet.

Sol remains the only application-code writer. Astra edits plans/reviews, not overlapping application code. Do not launch multiple writers into this dirty worktree. Research can be parallel, but only one active implementation packet. A local ACCEPT is not production certification.
