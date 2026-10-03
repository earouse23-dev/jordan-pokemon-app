# CLIENT-06 revision — Valuation provenance and complete historical boundaries

2026-09-25. Sole active packet under Elliott's existing CLIENT-06 scheduling exception. Complete R1–R3 in one consolidated revision and stop for Astra review. No renewed permission is needed for this scoped repair.

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before work; reuse existing implementation first and choose the smallest correct change. Report if unavailable. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both roadmaps, the original CLIENT-06 packet, Sol's report, and `docs/evidence/ASTRA_CLIENT_PACKET_06_REVIEW.md`. Run `node docs/evidence/sol-client-06-astra-probe.mjs` before editing. Preserve that probe and its before/after results; for the unknown-membership assertion, an equivalent explicit result contract may be documented and tested if necessary, but do not remove the behavior requirement.

## R1 — Use the intended valuation evidence

Trace the production reference-quote and exact-sold paths into current totals, comparable P/L, history, snapshot writes and filters. A generic `pricingStatus:'live'` must not make a graded provider index an eligible exact-sold portfolio estimate. Reuse the accepted exact-sold result/context/freshness contract and cache where present. Insufficient, unresolved, stale and failed estimates remain unpriced with coverage; do not fetch providers automatically or introduce more live calls. Keep the index available separately under its existing label. Preserve legacy raw/sealed behavior without treating those records as graded sold-proof.

Use only appropriately attributable dated estimates for graded sold-derived historical value/P&L. Existing generic market observations must not silently become those estimates. Preserve them as separately identified reference history if needed. If the existing schema cannot persist the necessary context/provenance, prepare the smallest additive proposal and mark that persistence boundary blocked; do not invent evidence, migrate a shared database or claim fixture-only storage is durable.

Add a production-path regression: a graded copy has a fresh provider index but insufficient exact sales; current value/P&L and new snapshots must not count that index. A ready synthetic exact-sale estimate should contribute with the correct context, native currency, as-of/freshness and provenance. Reopen must not turn old generic observations into eligible estimates. Cover account switching and stale request completion using existing patterns.

## R2 — Dates, unknown membership and costs

Include dated purchase/sale events in history even when no new price observation occurs that day. Sale proceeds can establish realized P/L without a new market quote; do not backfill active copies' prices. A fully liquidated known portfolio can have known zero active value; a held unpriced copy cannot. Preserve sold-copy history and correct sibling membership.

Expose unknown acquisition dates as historical membership uncertainty. Do not guess membership or silently drop the copy and label the remaining point complete. Validate numeric costs as well as known flags: missing/invalid cost remains unknown, true zero remains zero, and partial lot sales/allocated basis must reconcile without subtracting costs twice. Preserve original native currencies.

Extend the frozen hand calculations with: final sale after last observation, purchase-only date, one sold plus one unpriced active copy, unknown acquisition date, missing numeric cost despite optimistic flag, zero basis, partial sale/multiple lots and cross-currency transaction. Verify the independent expected totals/coverage and the actual screen, not just a helper return. Preserve the original A/B/C scenario.

## R3 — Native-currency history and honest chart coverage

Add a concise USD/EUR selector to the existing history view when applicable, using existing UI patterns. Value/P&L/ranges and relevant summary amounts must use the selected native currency; do not apply current FX to historical values/costs. Preserve mode/range and filter context when switching. Verify EUR-only and mixed portfolios, not just a separate EUR current-total label.

Both Value and P/L views must distinguish complete points from partial/unknown coverage; do not present changes in the priced subset as a complete portfolio gain or loss. Include unknown membership and basis in accessible summaries and tooltips. Preserve honest loading/empty/error/retry behavior in both modes, including P/L, and avoid connecting a line through an unknown point. Keep ordinary screen copy concise.

## Evidence and boundaries

Run the retained Astra probe, focused unit/integration tests and desktop Chromium/mobile Chromium/mobile WebKit cases for these boundaries. Reuse the guarded disposable database for changed persistence behavior and fresh login; keep mica-dev untouched. Use synthetic data and block external providers. If schema work is required, stop that dependent write path for review while finishing independent fixes and tests in this packet.

Run affected regressions, lint, typecheck, neutral no-env-file build, shipping exclusion and format/diff checks. Update `docs/evidence/SOL_CLIENT_PACKET_06_REPORT.md` with before/after results, precise provenance/storage limits, hand-reconciled amounts, native-currency screenshots and exact persistence evidence. Do not repeat broad checks absent changes or unresolved failures.

No live requests/credits, production environment files, hosted mutations, new migrations/dependencies/platforms, deployment, commit or CLIENT-07. Preserve existing records and dirty work. Positive live-price/display/device gates remain open. Stop for Astra review.
