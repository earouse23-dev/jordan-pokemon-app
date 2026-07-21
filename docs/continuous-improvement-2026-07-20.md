# Continuous product improvement — 2026-07-20

This report records eight complete research, implementation, critique, and fix cycles. Each cycle began by checking the current repository and production app so existing Mica capabilities were preserved rather than rebuilt.

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

## Cycle 5 — Recoverable large-collection import

- Problem: Mica's parser already accepted 5,000 records, but the account workflow silently kept only the first 100 and saved them one at a time. That contradicted the large-library work and made migration from another collector app needlessly slow.
- Evidence: Card Ladder documents bulk CSV upload; PriceCharting's text importer accepts up to 5,000 lines; current collector discussions ask specifically for easy CSV/Excel migration; and Collectr's documented TCGplayer import process relies on emailing a file and waiting 2–3 business days. The existing Mica source and production copy confirmed the 100-position bottleneck.
- Change: Removed the extra 100-row truncation and exposed the parser's honest 5,000-row limit. Imports now validate exact raw, graded, sealed, condition, grader, grade, variant, cost, date, and currency context before saving. Four owner-scoped writes run concurrently with visible progress, pause-after-current-writes, continue, and failed-row retry.
- Reliability: Every normalized row receives a deterministic SHA-256 idempotency key. Identical duplicate rows receive stable occurrence numbers so legitimate multiple positions remain distinct. If a response is lost or Supabase retries a completed request, Mica resolves the existing owner-visible purchase transaction after the unique-key conflict instead of creating another position. Re-importing with the same fallback date is therefore safe. The sheet cannot close while writes are in flight.
- Critique and fix: New collectors get one clear fallback-date decision; graded collectors retain grader, decimal grade, and certification; large owners get progress and pause; sellers keep existing rows untouched; mobile users get native progress and 44px controls; and the engineer review added error-code branching, bounded concurrency, RLS-backed recovery, validation failures, and a regression test that prevents the 100-row cap from returning.
- Result: Collection migration now scales to the same 5,000-row order as a major incumbent, remains recoverable under partial network failure, and does not trade speed for duplicate financial records.

## Cycle 6 — Direct TCGplayer migration without fabricated profit

- Problem: Mica could import its own CSV shape, but a current TCGplayer inventory export required manual column editing. More importantly, TCGplayer inventory exports do not contain historical acquisition cost or date; reading blank values as zero would overstate profit and returns.
- Evidence: TCGplayer's current help material documents CSV export/import fields for product identity, condition, language, printing, quantity, product ID, and market price, with a 5,000-card collection limit. Collectr's documented TCGplayer migration requires emailing the CSV and waiting 2–3 business days. Current large-inventory discussions describe tens of thousands of rows blocked by required-field mismatches and weeks of manual migration. Newer import tools emphasize direct Collectr/TCGplayer mapping and import history as differentiators.
- Change: The importer now detects current TCGplayer headers, normalizes BOM and punctuation, preserves Product ID, product name, set, collector number, language, printing, condition, and quantity, rejects non-Pokémon product lines, and never mistakes TCGplayer market price for what the owner paid. Mica and generic header aliases remain supported.
- Accounting integrity: Missing acquisition cost and date are first-class database states. Unknown cost is excluded from current cost basis, realized gain, sale planning, below-cost review, rankings, and inventory-health totals rather than stored as apparent free inventory. Missing dates remain visibly unrecorded while a fallback date is used only to keep FIFO order deterministic.
- Critique and fix: A beginner can upload the original file without reshaping it; a graded collector retains grader/grade/certification columns when present; a large owner keeps the 5,000-row progress, pause, retry, and idempotency behavior; a seller keeps condition and printing without confusing market reference with cost; and mobile users receive a plain count of unknown fields. Skeptical engineering review found that an honest unknown state was incomplete without a repair path, so each owner can now add one known total cost or original date later. The security-invoker RPC repairs the purchase transaction, purchase lot, identity flags, remaining basis, and any already-sold FIFO allocations while preserving every cent.
- Security: The new columns are additive with safe defaults for existing positions. Both creation and repair derive the owner from `auth.uid()`. The repair RPC is unavailable to anonymous users, executable by authenticated users, and targets only a lot belonging to the caller. The live database reports the function as security-invoker with those privileges.
- Result: Moving a Pokémon inventory from TCGplayer no longer requires spreadsheet surgery or turns missing bookkeeping into fake profit, and users can progressively complete their history inside Mica.

## Cycle 7 — Fair exact-price refresh for large portfolios

- Problem: The daily server job selected an unordered fixed limit of 50 active positions. A small collection could refresh repeatedly while most of a 5,000-position import never entered scheduled pricing. The same job also ignored an imported TCGplayer Product ID even though the interactive pricing route already supported it.
- Evidence: Card Ladder advertises automatic daily collection estimates as a paid portfolio benefit. Current collector reports continue to complain that tracking apps lag real markets, mix conditions or editions, and require a separate check of actual sales. Repository inspection showed Mica already preserved exact condition, grade, finish, and provider evidence, so the verified weakness was refresh coverage and identity—not another price widget.
- Change: The existing 50-position provider budget now advances through active raw and graded positions using the durable `provider_sync_status.sync_cursor`. Batches are UUID-ordered, wrap without wasting the remaining capacity, deduplicate the wrap boundary, and continue after partial provider failures. No paid request budget or cron frequency was increased.
- Matching: Scheduled grouping now includes TCGplayer Product ID, and PkmnPrices receives that direct ID before falling back to name, set, and number. Two superficially identical imported rows with different provider identities can no longer collapse into one scheduled lookup.
- Critique and fix: A new collector sees no extra controls; a graded collector keeps exact grader/grade filtering; a large owner eventually reaches every active position rather than the same first 50; a seller gets fresher references across the inventory; a mobile user incurs no new interface friction; and skeptical engineering review added malformed-cursor recovery, bounded batch sizes, deterministic ordering, wrap tests, secret/admin endpoint tests, and cursor visibility limited to the existing administrator diagnostic table.
- Result: Large portfolios now receive fair scheduled coverage and exact imported identity without increasing operating cost or weakening Mica's compatible-price rules. A 5,000-position portfolio still cannot be repriced daily under the approved 50-position budget; faster full coverage remains a provider-plan and operating-cost decision.

## Cycle 8 — Correct a wrong card or printing without rebuilding the ledger

- Problem: Imported and manually found positions could preserve an ambiguous or wrong catalog identity, but correcting it meant deleting the position and losing its purchase lots, sales, and FIFO history. A precise market value is not trustworthy when the underlying first-edition, unlimited, stamped, holo, reverse, language, set, or collector-number match is wrong.
- Evidence: Current collector reports repeatedly cite first-edition sales mixed with unlimited, missing vintage variants, stamped-print mismatches, and applications jumping to a higher-priced alternate card. Current import competitors increasingly route uncertain rows into match review, while Dex explains that foreign CSV labels cannot always map safely to its structured catalog.
- Change: Every owned raw or graded position now offers “Correct card or printing.” The user searches the catalog, sees set, collector number, language, rarity, match evidence, and image, selects the exact card, then explicitly chooses the available printing. Vintage results can offer both first-edition and unlimited states when both are supported. Sealed products keep their separate provider-ID workflow and do not show this card-only action.
- Ledger integrity: One owner-scoped security-invoker RPC atomically replaces only `identity_snapshot`, `card_id`, and `variant_id`. Quantity, raw condition, grader, grade, certification, purchase transactions, sale transactions, FIFO lots, costs, notes, labels, and location are untouched. Existing unknown-cost/date flags are preserved. Position-scoped observations from the old match are deleted in the same transaction so incompatible prices cannot follow the corrected identity.
- Critique and fix: A beginner gets plain “correct” language and a selected-match confirmation; a graded collector keeps the slab context while changing only the underlying card; a large owner can enter from the existing needs-pricing queue; a seller keeps auditable sales; a mobile user gets the existing accessible sheet/search controls; and skeptical engineering review added JSON size/shape validation, catalog foreign-key validation, sealed rejection, RLS delete scope, anonymous execute denial, rollback verification, and tests proving the client uses one atomic RPC.
- Result: Mica now gives owners a safe escape hatch for the variant and edition errors collectors cite most often, without using a manual price override that hides the real identity problem.

## Verification

- Formatting and diff whitespace checks
- Source linting and JavaScript syntax/type checks
- 124 automated domain, pricing, API, security, offline, bulk, paging, import, scheduler, remapping, and regression tests
- Connected Supabase table inspection with RLS enabled on every public table
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
