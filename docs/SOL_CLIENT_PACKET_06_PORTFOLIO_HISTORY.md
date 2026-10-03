# CLIENT-06 — Portfolio history and profit/loss

2026-09-25. **ACTIVE — Elliott explicitly approved: “Approve scoped CLIENT-06 work.”** This scheduling exception authorizes the local implementation and controlled tests below while Step 5's positive live-price and production-display gates remain open. This is the sole active packet. It does not mark Step 5 complete or authorize release, further provider spending or CLIENT-07.

## Required approach

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before task work; reuse existing implementation first and choose the smallest correct change. If unavailable, report that fact. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both Mica roadmaps, `docs/evidence/ASTRA_CLIENT_PACKET_05M_REVIEW.md`, CLIENT-03 physical-copy evidence and 05I persistence acceptance. Trace current `lib/portfolio.js`, `lib/price-history.js`, transaction normalization in `lib/core.js`, portfolio/history adapters in `lib/supabase-data.js`, and existing app portfolio/history/filter screens. Read the installed Supabase skill before database work. Reuse calculations, tables, RPCs, screens and test harnesses before adding anything.

## Client result

A collector sees current portfolio value and profit/loss with honest price/cost coverage; opens a card or physical copy to inspect history; changes between 1w/1m/6m/1y and value/P&L; and finds copies using the requested filters. A sale removes the selected copy from active value but retains its realized result and history. No rescanning, fabricated backfill or synthetic production data.

## Freeze semantics, then implement the independent slice

At the start, put a concise calculation/acceptance table in the report. Use existing transaction costs and recorded fees; avoid charging acquisition costs twice. Preserve original amount/currency and unknown-versus-zero distinctions. Use integer minor units where existing money code supports them. Do not add transaction/historical FX: approved current-price FX display is not permission to convert a historical ledger at today's rate.

- Active value: sum eligible current exact-context valuations for currently owned copies. Unknown, unavailable and stale coverage must be explicit; do not silently turn them into zero or substitute the provider market index. Separate native USD/EUR totals; never add unlike currencies or conceal excluded currencies.
- Unrealized P/L: current value less known acquisition basis for active copies with comparable currency and usable price. Report the comparable subset/coverage; unknown basis is not free inventory. Unrealized percentage uses that subset's known basis; zero/unknown denominator gives unavailable, not infinity or zero.
- Realized P/L: recorded sale proceeds net of recorded sale fees, less that sold copy's known allocated basis. Retain sold events and distinguish realized from unrealized. Existing ledger fee definitions control what is already net; do not subtract fees twice. Unknown/mixed-currency facts remain unavailable.
- Dated history: use actual ownership/transaction membership and available observations at each date. A later purchase must not appear in earlier holdings. Selling B must leave A/C and B's past untouched. Historical missing points remain gaps/coverage limitations; no today's-price backfill or invented performance. Purchase/sale cash flows are not investment return. Distinguish point-in-time P/L from a time-weighted return; do not label one as the other.
- Persistence: reuse existing dated snapshots and transaction ledger. Store only actual available observations with provenance; do not write fixture values or current FX as historical truth. Ensure owner/session guards prevent stale-user writes, duplicate refresh snapshots and cross-account reads.

Build the existing-screen experience: portfolio graph above current value and P/L percentage, explicit Value/P&L views and 1w/1m/6m/1y ranges; card/copy history with source/date/coverage available in optional details. Concise empty/loading/retry states preserve context. Longer ranges with insufficient history stay honest. Preserve existing useful price-change/return behavior or clearly distinguish it; don't silently relabel it P/L.

Add/reuse inventory filters for profitable/negative, rising/falling/flat, missing/stale, set, language, grader, exact grade, value, P/L, movement and purchase date. Movement needs two comparable actual observations; unknown movement is not flat. Filter only on supported facts, show unavailable coverage clearly, retain selected filters and provide a simple clear action. Do not introduce a new navigation architecture.

## Verification in one consolidated pass

Freeze small controlled scenarios with exact expected numbers before coding: buy A/B/C at different dates and costs; observe price change; sell B; reopen fresh session; show active A/C value and unrealized P/L, B realized P/L and correct historical membership. Cover fees, unknown/zero cost, mixed currencies, stale/missing prices, partial coverage, zero denominator, duplicate refresh and account switching. Include hand-reconciled expected totals and percentages, not assertions copied from the implementation.

Use meaningful unit/integration tests for calculation boundaries and desktop Chromium/mobile Chromium/mobile WebKit checks for ranges, toggles, filters, failure recovery and accessibility. Reuse the 05I separately owned disposable local database arrangement for new/changed persistence paths and fresh-session proof; never use/reset the pre-existing mica-dev stack. Source/provider responses are synthetic and clearly labeled in tests only. Block all live provider/FX traffic. Clean up only this run's resources.

Run affected checks, lint, typecheck, a no-env-file neutral build and shipping certificate exclusion once the slice stabilizes. Broaden tests only for changed scope or actual failures. Do not repeatedly run unrelated suites between small changes.

## Schema boundary and deliverable

Existing schema/RPC use and existing migrations applied to a new disposable test DB are allowed after scheduling approval. If correct durability requires a new migration or production-baseline repair, prepare the smallest concrete additive proposal and stop that dependent work for review; finish independent calculations/UI tests in the same packet. Do not apply a new migration or claim in-memory behavior is persistent.

Write `docs/evidence/SOL_CLIENT_PACKET_06_REPORT.md`: calculation table, requirement-to-code/test mapping, controlled numeric reconciliation, native-currency/coverage behavior, persistence/browser evidence, screenshots using synthetic data, checks and remaining gates. Separate implemented behavior, proved persistence and blocked dependencies. Stop for Astra review after this numbered-step slice; do not begin CLIENT-07.

Preserve existing authentication/profiles/settings, raw/sealed records, pregrading, transactions and certificate facts. Preserve the dirty worktree. No production environment files, hosted mutation, live provider calls/credits, new paid services/dependencies/platforms, certificate activation, deployment or commit. External live-price/display, physical-device and release gates remain open throughout this scheduling exception.
