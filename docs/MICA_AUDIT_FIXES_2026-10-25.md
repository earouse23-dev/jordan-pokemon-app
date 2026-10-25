# Mica audit fixes — October 25, 2026

Published source: `b2db88bbcb3e9325fe5cccea68c38838fed1b227`. Addresses the four interface defects and the focused polish recommendations in [the quality audit](MICA_FULL_QUALITY_AUDIT_2026-10-25.md).

## Changes

- **Search:** replaced the old light-only gradient and hover lift with theme surfaces. Owned-result badges also use theme colors. View, Add and Queue accessible names now identify language and printing. Queue remains available as the secondary action. Contrast checks cover loaded results at rest, hover and focus in both appearances.
- **Photo library:** the Add-screen tile is a native button that opens the existing restricted file input. Keyboard Tab/Enter checks cover Chromium and WebKit. Capture, file preparation and upload behavior are unchanged.
- **Grading availability:** the existing capability response controls launch/resume availability. New scans, resumed captures, identity-front retakes, supplemental evidence and analysis all check before dependent capture, scan creation or provider work. Availability responses cannot cross account changes, and connection failures fail closed. Saved reports and professional-grade/certificate records remain accessible. The production grading hold stays in place; identification is unchanged.
- **Library:** shorter grade labels, one value, compact signed purchase gains, and stale/missing-price notices only where relevant. Per-copy values still say Each. Quantities, sold/active counts, favorite controls and listing/submission status remain. Stored tags are preserved; an arbitrary tag no longer adds clutter to every tile.
- **Filters:** common identity controls remain visible; less frequent financial/date/acquisition/grouping controls move into More filters. Active advanced filters reopen automatically. Existing apply/reset behavior and stored view values remain.
- **Notifications:** the available in-app setting is the simple primary choice. Unavailable optional delivery/device controls stay out of the simple surface. Existing email/push preferences can still be turned off, and limits, quiet hours, rules and thresholds survive ordinary saves and retries. No delivery adapter is enabled.
- **Detail wording:** “Provider reference index” becomes “Market reference”; “Value context” becomes “Price options”. Exact identity, source evidence, uncertainty and price-history data remain available.
- **Regression coverage:** the responsive fixture now checks both the name and complete accessible identity instead of expecting all metadata inside the name-only span. Fixture navigation uses the same route/history contract as the app, so filter close/reopen is exercised correctly. Existing extracted camera fixtures explicitly supply browser/service prerequisites rather than relying on undefined globals.

The service-worker shell is `mica-shell-design-125`, with styles 92 and themes 110. Existing open tabs use the safe update notice; unsaved work is not forcibly reloaded. No production dependency, migration, provider budget, cron, public-signup configuration or platform setting changed.

## Acceptance evidence

See [verification](evidence/audit-fixes-2026-10-25/verification.json) for final local and independent release results and publication identity. The staged isolated-account canary confirmed a current-day complete view and identical repeated same-day saved history/dashboard facts, without inventory writes. Browser fixtures cover the failures identified by the audit, including a held grading service causing zero scan/analysis writes and late availability responses after an account switch.

Earlier intermediate test failures are not counted as final passes. They included an implementation selector typo caught before publication, the audit's stale responsive assertion, explicit extracted-camera prerequisites, and notification-fixture numeric representation. The final results apply to the corrected candidate.

## Boundaries

This closes the engineering/UI issues in this audit's demo polish pass. It does not activate digital grading, establish catalog-wide competitor data parity, or certify public commercial/App Store readiness. Elliott's physical Safari camera/device walkthrough and the already deferred public/native/operational gates remain separate. Customer inventory and preferences were outside write-test scope.

## Published verification

Published to the canonical app after independent [GitHub acceptance](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/40240084587) succeeded. Canonical health reports release `b2db88bbcb3e`. Final local checks passed: 595 unit, 406 core browser, 3 large-inventory and 437 expanded browser checks (skips recorded in verification).

Read-only live acceptance confirmed printing-specific search results, readable dark-theme results, the native photo-library button, compact library labels, expandable advanced filters, blocked unavailable grading with saved reports accessible, and one visible in-app alerts setting. Mobile search has no horizontal overflow at 390px; desktop was restored to 1710px with no horizontal overflow. No customer inventory or preferences were changed. The [published mobile screenshot](evidence/audit-fixes-2026-10-25/published-search-mobile.png) contains catalog results only. Physical iPhone Safari acceptance remains with Elliott.
