# CLIENT-05I revision — Saved printing reopen and isolated persistence

Date: 2026-09-24. Astra → Sol. Sole active packet. Execute R1 and R2, then stop for Astra review. This amends CLIENT-05I's prohibition on application fixes and fixed port 54321 requirement only as stated below. All other scope/data-preservation limits remain.

## Required approach

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before task work; reuse existing implementation first and choose the smallest correct change. If unavailable, report that fact. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both Mica roadmaps, the original CLIENT-05I packet, Sol's 05I report, `docs/evidence/ASTRA_CLIENT_PACKET_05I_REVIEW.md`, and the corrected 05H report/revision. Read the installed `supabase:supabase` skill before database work. Trace every caller of `selectVariantOption`, snapshot creation, portfolio/watchlist hydration, and `app.js:selectedPrinting` before changing shared selection behavior. No broad identity refactor.

## R1 — Preserve saved evidence without inventing source removal

Reproduce the unchanged `docs/evidence/sol-client-05i-reopen-probe.mjs` failure first. Keep that probe unchanged as the before/after check.

Define and implement the smallest explicit distinction between:

- A saved detailed identity with no catalog options loaded: retain its source ID, saved supported printing facts, metadata and existing eligibility. Do not label the source removed merely because the loaded portfolio row omits options. Saved evidence is not a fresh provider verification and must not receive a fabricated refresh timestamp.
- A successfully loaded source option set that lacks the selected record, including an explicit empty/replacement set: preserve the selected source reference but keep it review-needed. Do not switch to another printing or use the saved exact status to defeat this known disappearance.
- A failed/unavailable refresh: preserve saved facts without treating the failure as evidence of deletion. Keep refresh failure/freshness truthful and preserve existing pricing freshness behavior.
- Missing, malformed, contradictory or unsupported saved facts: remain review-needed. An ID or `identityStatus:'exact'` string alone must not manufacture a valid detailed printing. Unknown edition/stamp, language/foil restrictions and conflicting source references must retain the 05H safeguards.

Reuse existing normalization/metadata rather than introducing another printing parser or catalog service. If input shape alone cannot distinguish loaded from not loaded, use the smallest explicit availability signal at the actual producer/consumer boundary. Document the semantics and cover them in tests. Do not weaken the earlier four Astra probes or turn removed-source cases exact to make the reopen probe pass.

Add focused regression coverage for saved exact, unresolved/restricted, malformed/conflicting, failed refresh, explicit removal/empty options and reordered options. Exercise the real detail consumer through an offline browser reopen case on desktop Chromium, mobile Chromium and mobile WebKit; do not stop at calling the selector directly. Keep existing raw/sealed and legacy selection behavior covered by affected tests. Fix any shared-path regression within this scope; no new feature screens.

## R2 — Run persistence without disturbing mica-dev

The hard-coded API port 54321 and requirement for a particular globally selected Docker context are superseded. Safety comes from verified ownership and a precise local endpoint, not one port number or a context-name string.

Use already installed tooling/images to create a separate disposable Supabase project with a unique run/project ID and unused ports for **every enabled service**. Prefer the smallest existing-tooling arrangement; a separately named project with new test containers/volumes on the existing daemon is allowed if isolation can be verified. A separate existing-tooling disposable profile is also allowed if needed. Do not use the existing `mica-dev` database, its volumes, credentials, config or forwarded ports. Do not stop/restart it or alter the user's global Docker context. Scope commands explicitly to the intended project/daemon.

Before startup, inspect installed CLI help/version and current official local configuration documentation. Public documentation reads are allowed; runtime tests must not call external catalog, image, recognition, FX or paid-provider endpoints. Relevant reference: https://supabase.com/docs/guides/local-development/cli/config . Configure only a temporary test work directory; copy the necessary existing schema/migrations without copying secrets. No repository Supabase config change or new migration. Apply existing migrations only to the new disposable database.

Before any database/Auth request, verify and record the run-owned project/container/volume identifiers, actual published ports and exact loopback API origin. The harness must require explicit disposable-run opt-in, match that verified endpoint, reject port 54321 for this run, reject non-loopback origins and redirects, and fail before requests if ownership/config is absent or inconsistent. Do not merely replace the existing guard with “any localhost URL.” Keep negative guard checks network-free. Use process-local disposable credentials without opening environment files or printing secrets.

Update the focused persistence harness for this verified endpoint. Leave unrelated guarded tests disabled unless adapted with equivalent ownership guarantees; do not point CLIENT-03's 54321 harness at the existing stack. Run the original 05I source→production adapter/RPC→stored row→new authenticated client→production load/hydration→detail/valuation checks without a skip. Preserve two distinct copies, unknown facts, source metadata, UUID separation, idempotent retry, certificates/acquisitions/transactions and source reorder/removal behavior.

For unauthorized read/write attempts, verify owner-visible rows remain unchanged afterward. Keep service-role access restricted to synthetic setup/cleanup. Sign out test sessions and clean up only run-owned users/resources; record cleanup failures instead of hiding them.

Connect one browser save→fresh browser context login→reopen to the disposable database, reusing existing harness tooling and synthetic catalog routes. Browser writes/reads must actually reach the disposable stack; do not replace persistence calls with fixtures. This closes the form-to-adapter UUID boundary and actual detail consumer together. Use test-only configuration; never expose service-role credentials in the browser. A minimal test harness addition is authorized; an application auth redesign is not. Run this real persistence browser case on desktop Chromium and mobile WebKit, with exact network boundary accounting. If this boundary cannot be reached, describe it as still unproved even if RPC tests pass.

If installed images/tooling or resources cannot support a second isolated stack, make a bounded diagnosis (at most two distinct startup attempts), leave mica-dev untouched, finish R1 and offline verification, and report R2 blocked with the precise missing prerequisite. Do not install/upgrade platforms or pull new images to bypass that boundary.

## Verification, deliverables and limits

Run the unchanged 05I reopen probe, unchanged four-probe 05H regression, focused identity/valuation/persistence checks and the browser cases above. For application changes, run lint, typecheck, build, shipping certificate exclusion and the affected browser/unit suites. Report actual passes, skips and failures separately; no claim of durable persistence from replay or skips.

Append revision evidence to `docs/evidence/SOL_CLIENT_PACKET_05I_REPORT.md`, retaining the original blocked result. Include before/after commands, file hashes, state-semantics table, synthetic stored/reopened comparisons, actual database/browser coverage, endpoint ownership and cleanup proof without secrets. Separate R1 fixed status from R2 persistence acceptance.

Preserve the dirty worktree and existing user data. No `.env.local`/`.env.production.local` access, hosted mutation, new migration, paid/provider requests, dependencies/platform changes, certificate activation, transaction FX, deployment, commit or CLIENT-06. Positive real-sale numeric validation and provider-rights gates remain open. Stop for Astra review.
