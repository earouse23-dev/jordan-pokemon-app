# Mica follow-up audit — October 26, 2026

Audited the published `b82f5f1a94fc` application, following the client reset and the prior light/dark correction packet. The application is materially better, but there is one confirmed broken interaction, a recovery UX gap and stale tests to repair before the next release gate. This was an audit only; no application code or production settings were changed.

## Findings, in repair order

### 1. P2 — library favorites receive no pointer input

The heart is visible and looks actionable, but a mouse click or tap at its center reaches the card-opening overlay underneath. This affects both themes and all checked size classes. Read-only hit testing reproduced it on multiple fully visible hearts, away from the bottom navigation. No customer favorite was changed to prove it.

**Root cause:** `styles.css:1359` sets `pointer-events:none` on every direct ledger-row child except the opening overlay and action container. `app.js:7314` renders the heart as another direct child. Its higher z-index in `themes.css:2364` does not restore pointer events.

**Repair:** explicitly allow pointer events on the favorite button, or exclude it from the shared noninteractive-child selector. Keep the overlay working on the rest of the card. Verify pointer/touch activation changes only the isolated fixture's favorite state, keyboard activation still works, and clicking elsewhere still opens details. Existing browser tests do not reference `.ledger-favorite`, which explains why this escaped the broader checks.

[Sanitized hit-test evidence](evidence/followup-audit-2026-10-26/favorite-hit-test.json).

### 2. P2 — an incomplete daily portfolio refresh has no visible recovery action

The saved portfolio correctly retains useful values when a refresh fails. However, the dashboard renders “Update incomplete” as status text with no adjacent retry or retry timing. A user cannot tell whether to wait or act. The previous verification observed this transient state; the live account was current and the warning cleared during this audit, so this is a confirmed failure-state UX gap, not a claim that today's refresh is broken.

**Root cause:** `app.js:6974` and `17410` render the status without an action. `refreshSavedPortfolio` makes a bounded continuation attempt, and `lib/portfolio-service.js:101` deliberately applies a five-minute backoff and daily failure limit. The old optional `#syncState` click handler at `app.js:19977` is not connected to an element in current `index.html`. Returning to a browser tab can trigger another attempt, but that is not a discoverable recovery control.

**Repair:** retain the last saved total and graph; show a compact retry action for a retriable incomplete refresh and indicate when the server backoff prevents another attempt. Reuse the existing refresh function and account request deduplication. Distinguish a daily provider budget limit from a transient failure. Do not delete saved history, poll on every render, or bypass the provider budget/backoff. Verify with controlled failure/recovery fixtures rather than inducing customer failures.

### 3. P2 — three regression tests still describe retired UI

The fresh supplemental run produced **101 passes, 1 skip and 8 failures across three tests**. These failures have identifiable stale expectations:

- `intake-continuity.spec.js:345` measures `label[for=galleryInput]`, which no longer exists; the visible control is `#chooseCardPhoto`. This fails in both mobile engines before the remaining sizing checks execute.
- `local-card-ocr.spec.js:160` requires the previous exact green RGB value. The current green palette differs. This fails in all three browser projects before the rest of theme-persistence checks execute.
- `portfolio-history.spec.js:858` requires the timeframe below the chart, contradicting the verified intentional move above it. This fails in all three projects before subsequent single-point recovery checks execute.

**Repair:** update only those obsolete selectors/expectations, retain the original behavioral checks and continue through the rest of each test. Use the current visible primary action and semantic theme/contrast requirements rather than an unrelated first button. Add the missing favorite hit-target regression. Rerun the affected suites and then the complete release gate; the previous green release gate must not be presented as proof that these newly exercised paths pass today.

[Fresh test results and exact failures](evidence/followup-audit-2026-10-26/verification.json).

## Responsive and visual review

Fresh live DOM measurements covered **300 states**: ten surfaces × fifteen sizes × light/dark. Surfaces: portfolio, library, card detail, edit card, settings, notifications, filters, empty search, populated search and add-card dialog. Widths: 320, 360, 375, 390, 430, 667, 759, 760, 768, 820, 1023, 1024, 1280, 1440 and 1920px, including 667×375 short landscape and both navigation breakpoints.

There was no horizontal document overflow, and the observed chart canvas bitmaps settled to their displayed sizes. Manual inspection supplemented the measurements on phone settings, search, intake, card detail and short-landscape edit. This is a measured matrix plus selected visual inspections, not 300 separate human visual reviews or exhaustive accessibility certification.

The previous tablet action collision, phone timeframe placement, chart-resize and targeted contrast repairs remain intact. The historical “Blastoise base set” query returns three distinct printing choices. The saved portfolio and graded price history stayed present through the tested navigation and resize sequence. The chart reveal/reduced-motion behavior was covered by the previous same-source correction gate, not freshly re-exercised in this supplemental run.

Candidate hit-test warnings were manually separated from defects: controls temporarily beneath the fixed bottom navigation can scroll clear; the short-landscape notes field scrolls into view when focused; fractional 43.999px values are rounding. Those were not reported as broken controls. Desktop navigation remains 42px tall and the library More disclosure about 39px wide; these are optional consistency improvements, not the release-blocking issue identified above.

[Complete sanitized geometry matrix](evidence/followup-audit-2026-10-26/rendered-matrix.json). Full captures containing collection values or notes remain in the local private audit directory, outside Git. Browser-local theme was restored to System, viewport override removed, and dashboard restored.

## Workflow, security and operational checks

- Fresh lint and syntax checks passed; **595 unit tests passed, 3 skipped**. Nine supplemental browser suites covered detail recovery, intake continuity, portfolio history, local OCR/theme behavior, native integration, collection continuity, import recovery, saved-change recovery and certificate exclusion. Their exact results are above.
- The previous same-source correction run passed **783 browser checks / 21 skips**. Those are historical evidence for the unchanged release, not tests rerun in this audit. The supplemental failures remain open until repaired.
- The public health endpoint identifies the expected release and reports healthy database/auth/pricing-provider connectivity. It explicitly leaves paid pricing and identification unverified at that health-check level and grading held.
- Fresh anonymous saved-portfolio and account-deletion requests returned **401**, with non-public/no-store caching. Identification with `mode:identify` also returned **401**. An empty non-identification vision request returned the intended **503 release hold**. No authenticated deletion was attempted.
- Fresh database metadata: **86 public ordinary tables, none without RLS; four storage buckets, none public**. This does not prove every RLS policy or security-definer statement correct. The prior security advisories and deferred leaked-password protection are not newly resolved by these checks.
- Production dependency audit reported **zero known vulnerabilities**. Observed responses retain CSP, HSTS, nosniff, frame, referrer and permissions protections. No new production security defect was confirmed in the sampled checks; this is not a penetration-test certification.
- The saved-view workflow retains a same-day reuse path, owner-scoped refresh claim, failure backoff and preservation of useful previous values. This audit did not spend provider quota to reprice the entire collection or simulate repeated daily transitions. No pricing accuracy claim for all cards is implied.

## Before showing Jordan

Repair the favorite interaction first, make incomplete-refresh recovery clear, then repair/rerun the stale tests and the full release gate. Recheck those exact interactions live in both themes at phone/tablet/desktop sizes. Preserve the current concise interface; this audit does not call for more product features or another visual redesign.

Physical iPhone camera/keyboard/safe-area acceptance remains Elliott's check. No new 100-account/20-concurrent/1,000-copy capacity run, hosted restore drill, public email/signup activation, legal/support work or App Store qualification was performed. Those previously held milestones are distinct from this demo-polish audit. No customer inventory, favorite, notification preference, database schema, provider budget, dependency or application deployment was changed.
