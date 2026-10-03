# CLIENT-05L — One real valuation attempt and complete evidence review

2026-09-25. Sole active Astra packet within client Step 5. Elliott requests careful verification while maximizing useful progress per handoff. Complete all independent work below in this packet, then stop for Astra review; do not create new sub-packets for routine execution choices.

## Required approach and authority

Use `ponytail:ponytail` in **full mode**; read its installed `SKILL.md` before task work. Reuse existing implementation first and choose the smallest correct change. Report if unavailable. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both roadmaps, the 05J dossier, revised 05K report/tests, `docs/evidence/ASTRA_CLIENT_PACKET_05K_ACCEPTANCE.md` and `docs/evidence/PKMNPRICES_RETENTION_CONFIRMATION_2026-09-25.md`.

This packet authorizes **one** candidate-specific attempt using the existing subscribed PkmnPrices service: at most **two outbound provider requests and eleven reserved existing-plan credits**. No paid upgrade, top-up, new service or overage purchase. An error/timeout consumes its request slot; never retry. Record actual reported charges separately from reservations. This authorization replaces the prior zero-request limit for this packet only, and expires after the attempt, including a stopped/failed first request.

## Freeze before transport

Reuse the 05K guard, synthetic fixtures and independent calculator with minimal extraction into an isolated runner. Preserve completed evidence. The production app, matching rules and estimator remain unchanged. Before any live call, demonstrate offline that the runner blocks retries, redirects, search fallback, pagination, changed sample/filters and extra requests. Require explicit live opt-in and a durable secret-free attempt ledger outside shipped assets so restarting the runner cannot reset the budget and repeat the attempt. Treat a request with an unknown outcome as spent. Do not read credentials during offline checks.

Freeze English Jungle Clefable `base2-1`, first-edition holo variant `3a83wf50ts0izj268xwv3crwi`, source number `1/64`, candidate provider ID `20618`, PSA 10, empty qualifier, native USD. The provider-facing name `Clefable (1)` and number `01/64` are a **candidate-specific diagnostic crosswalk**, conditional on the direct identity gate. Preserve original source facts; do not install a production alias. Freeze current source hashes, rule version and evaluation clock immediately before execution. Reuse retained public catalog observations; at most one public TCGdex detail fetch is allowed if necessary to check source drift, with no images or other cards.

For this run only, obtain the existing `PKMNPRICES_API_KEY` from the process environment first. If absent, read only that named value programmatically from `.env.local`, without printing the file, other values or the key. This narrowly supersedes prior no-env-file scope for that credential lookup only. Do not open `.env.production.local`, inspect dashboards or access hosted configuration. If no usable credential is available, complete the offline deliverables and report the live gate blocked. Never include credentials in logs/URLs/artifacts/browser code.

## Single guarded attempt

1. `GET https://api.pkmnprices.com/v1/cards/20618?currency=usd`, reserve one credit. Apply the rehearsed direct gate: returned ID, reviewed name, Jungle set, collector number/total, explicit English language and first-edition holo association must be substantiated by the response. Do not infer missing provider fields from the English source route. Preserve the minimum identity evidence privately. If required fields are absent, contradictory, unexpected or the response fails, stop live transport and use the observed response for an offline diagnosis; do not weaken the gate mid-run.
2. Only if that gate passes, request `https://api.pkmnprices.com/v1/cards/20618/listings/ebay?limit=10&sort=date_desc&graded=true&variant=1st+Edition+Holofoil&grader=PSA&grade=10`, reserve ten credits. Follow the existing API/adapter path with a pre-transport guard so its automatic fallback/retry cannot escape this sequence. A cached first direct response may be reused in-process to avoid repeating a network request; disclose exactly which path uses it. No third call for diagnostics, quota, pagination, UI refresh or another sample. Enforce row currencies and exact printing from evidence, not merely endpoint parameters.

Do not run another attempt if fewer than three eligible contributors remain. A sparse or unavailable result is a measured outcome, not permission to tune the policy or change grade/card. No positive-price claim is required for successful execution of this packet.

## Retain, reconstruct and verify without more requests

Private retention is permitted. Store the minimal reconstructable ledger in a private local directory outside the repo/web root, with owner-only file/directory permissions; record its path and hashes in the report without copying numeric rows into public assets. Include the necessary direct identity facts and per-row title, sale/underlying transaction IDs, URL, native amount/currency, sold/ingested/retrieved times, attribution, language, printing, grade/qualifier and decisions. Strip keys, authorization headers, personal seller/buyer fields and images. Retain evaluation time, source/rule hashes, truncation flag and exact request/credit accounting. Do not discard the ledger merely because the result is sparse or the identity gate fails.

Using only retained input, independently reproduce the production accepted/excluded rows, deduplication, outlier decisions, contributor count, native median/range and freshness. The independent calculation must not import production filtering/median helpers. Separate raw provider rows, adapter exclusions and estimator exclusions. Surface disagreement as a failed check; do not alter live data or policy to force agreement. Include a rerunnable offline command so Astra can audit the same observation later with zero additional requests.

Replay the resulting estimate or truthful unavailable state through the existing detail screen in desktop Chromium and mobile WebKit with all external traffic blocked and no database writes. Serve retained evidence only in the private local test harness; do not add real rows to repository fixtures or shipping artifacts. Avoid screenshots containing real prices unless independently established permission covers that publication; DOM assertions and private test artifacts suffice. Source IDs/currency/count/freshness and optional USD/EUR display must remain honest; reuse a previously retained ECB rate for an offline FX check, never make an extra ECB call. If no sales request ran, replay the observed blocked identity state rather than inventing sale data.

## Consolidated deliverable

Write `docs/evidence/SOL_CLIENT_PACKET_05L_REPORT.md` with one clear outcome, attempt ledger, private artifact paths/hashes, exact repeatable offline commands, independent agreement/disagreement and browser results. Separate observed real proof from synthetic/setup checks and unresolved production crosswalk/display scope. Production display permission remains a release question; do not relabel it as a private-retention blocker.

Finish with a compact Step 5 exit table and the concrete remaining prerequisites for CLIENT-06. Do not start CLIENT-06 or declare Step 5 complete merely because the runner succeeded. If blocked, diagnose all safe offline consequences in this packet, then state the specific missing fact once. No speculative framework, repeated research or unrelated test reruns.

Run focused runner/guard/affected tests, format/diff checks and private evidence replay. Application code is unchanged, so no unrelated full build/browser suite is required. Preserve the dirty worktree. No database mutation, deployment, commit, new dependencies, provider messages, artwork use or additional provider spend. Stop for Astra review after the consolidated evidence is ready.
