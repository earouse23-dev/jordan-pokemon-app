# Continuous product improvement — 2026-07-20

This report records four complete research, implementation, critique, and fix cycles. Each cycle began by checking the current repository and authenticated production app so existing Mica capabilities were preserved rather than rebuilt.

## Baseline

Mica already supported exact-print search, English and Japanese cards, raw/graded/sealed positions, variants, FIFO purchase lots, sales, seller planning, watch targets, trades, set completion, grading estimates, CSV import/export, responsive layouts, two selectable UI themes, and owner-scoped Supabase storage. The work below targets gaps that remained in those existing workflows.

## Cycle 1 — Understandable price confidence

- Problem: Mica separated incompatible raw, graded, finish, condition, grader, grade, and currency observations, but a collector still had to interpret source count, freshness, and disagreement manually.
- Evidence: Collectr users repeatedly report cross-checking prices with TCGplayer, eBay, PriceCharting, or Card Ladder. Card Ladder markets verified sales history, value estimates, population reports, and alerts as trust features. Binder explicitly markets recent sold listings, outlier removal, and an explanation of why a price was chosen.
- Change: Added exact-context price evidence that reports compatible provider count, freshness, stale sources, provider spread, and a strong/moderate/limited/unavailable confidence level. It never uses a raw quote for a graded card or crosses condition, finish, grader, grade, or currency.
- Critique and fix: Authenticated mobile testing found the zero-source state said “one-source reference.” It now says “No matching source.” Missing providers remain visible as unavailable instead of being replaced by fixture values.
- Result: A new collector gets plain-language confidence; a serious collector can inspect source agreement; a skeptical engineer can trace every score to compatible observations.

## Cycle 2 — Fast, safe raw-card intake

- Problem: Rapid queueing already retained exact print identity, but every queued card still required a separate acquisition form.
- Evidence: Collectors with hundreds or thousands of cards repeatedly describe one-card-at-a-time entry as too slow. Current scanner competitors market rapid or batch scanning as their main advantage.
- Change: Added “Batch add raw” to the existing rapid queue. Shared raw condition and purchase date are entered once, while variant, quantity, and total acquisition cost remain independently reviewable for every exact printing. Graded and unusual positions retain the detailed route. Partial failure keeps unsaved cards in the queue.
- Critique and fix: Mobile browser testing found the queue bar could cover the next result and local purchase dates could roll into tomorrow through UTC conversion. The bar moved to a safe sticky position, date defaults now use the local calendar, and mobile targets were raised to 44px.
- Result: Repetitive entry is faster without merging variants or guessing condition, cost, grade, or grader.

## Cycle 3 — Bulk collection organization

- Problem: Labels, storage locations, statuses, filters, and exports existed, but applying organization to many positions required opening every card.
- Evidence: Dex reviews request hold selection for roughly 1,000-card collections. PokeVest added multi-card selection for bulk actions. Inventory users praise bulk field updates but complain when selection clears after a single change.
- Change: Added accessible multi-select rows, Select shown/Clear shown, retained selection, and one sheet that can add or remove a label, set or clear storage, and keep or archive selected positions. Listings still require individual asking-price and venue review.
- Security: Added a security-invoker Supabase RPC limited to 500 IDs and the signed-in owner. It can only update labels, storage, owned/archive status, and stale listing metadata when status changes. Identity, variant, condition, grader, grade, quantity, currency, purchase cost, and transactions are outside the operation.
- Critique and fix: Authenticated mobile and desktop tests covered no-op validation, multi-field application, retained selection, both UI themes, keyboard semantics, horizontal overflow, and error/console state. The fixed bar originally obscured the final row, so selection mode now reserves scroll space. QA labels, locations, and test positions were removed afterward.
- Result: Large-collection organization no longer requires opening every position, while seller and financial workflows remain auditable.

## Cycle 4 — Large-library loading and rendering

- Problem: the collection query relied on one API response, dependent rows used unbounded ID filters, hydration repeatedly scanned whole arrays, and the DOM rendered every matching card.
- Evidence: collectors are actively asking how to digitize 1,000- and 14,000-card collections, while current app feedback consistently prioritizes speed and batch workflows.
- Change: Collection rows now page past the API’s 1,000-row response boundary with stable created-at/id ordering backed by an owner/date/id index. Transactions, lots, and FIFO allocations use bounded 200-ID filters with controlled concurrency; complete FIFO-lot lookup has a matching non-partial index. Hydration uses keyed maps instead of repeated full-array scans. Initial durable history is bounded to the latest 60 observations per position; opening a card still loads its full available history. The library renders 100 rows at a time with an explicit remaining count and “Show 100 more,” while totals and filters continue to use the full loaded collection.
- Critique: A beginner with a small library sees no pagination controls. A large owner gets stable totals and progressive rows. Bulk “Select shown” intentionally selects only the currently rendered window. Search and filters reset the window. A skeptical engineer gets bounded request sizes, deterministic paging, and tests at 450 dependent IDs and 2,050 positions.
- Result: Mica no longer silently stops at the first API page or creates a DOM node for every card at once.

## Verification

- Formatting and diff whitespace checks
- Source linting and JavaScript syntax/type checks
- 111 automated domain, pricing, API, security, offline, bulk, paging, and regression tests
- Schema validation across 83 public tables with RLS enabled on every table
- Production build
- Supabase security and performance advisors
- Authenticated production browser verification at 390×844 and 1280×800
- Clean and analytics themes, exact search/intake, collection, price confidence, bulk organization, deletion cleanup, responsive overflow, browser errors, and console regression checks

## Remaining competitive weaknesses and owner decisions

- Licensed camera recognition/multi-card vision: Mica’s current photo flow is an assist, not a claimed automatic scanner. Reliable recognition across languages, variants, vintage/non-TCG products, and thousands of cards needs a measured provider evaluation, licensing/legal review, and operating-cost approval.
- PkmnPrices Pro: graded price ladders, deeper history, completed sales, and sealed data housing are ready, but production data depends on the paid entitlement and key.
- Card Ladder and Alt: integrations remain disabled until licensed API access is approved. No restricted service was scraped.
- Very large live repricing: the UI and private database loading now scale incrementally, but continuously refreshing thousands of exact products is constrained by provider rate limits and should be designed against the approved paid provider plan.
- Multi-currency portfolio conversion is not implemented. Mica keeps currencies separated rather than fabricating exchange-rate comparisons; adding conversions requires an approved rate source and accounting policy.
- Supabase Auth currently reports leaked-password protection as disabled. Magic-link sign-in is unaffected, but enabling compromised-password screening for password users requires an owner Auth setting decision.

No marketplace, paid provider, destructive migration, copied competitor layout, or fabricated market data was introduced.
