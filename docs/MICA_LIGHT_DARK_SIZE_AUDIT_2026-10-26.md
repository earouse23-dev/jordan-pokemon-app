# Mica light/dark and responsive audit — October 26, 2026

**Correction status:** all five findings were repaired and published in release `b82f5f1a94fc`. See [verified corrections](MICA_AUDIT_CORRECTIONS_2026-10-26.md). The original audit observations below describe the earlier release.

**Verdict: the core flows are passing, but I would fix the tablet header collision and phone chart-control overlap before an unrestricted Jordan walkthrough.** A small contrast pass and two lower-priority consistency fixes remain. No new feature or redesign is needed.

Audited canonical release `64c9d2a670aa` and repository checkpoint `fcb2e36`. This was a read-only application audit: no application source, production setting, provider budget, dependency, schema or customer inventory was changed. Appearance changes used the existing browser-local setting and were restored to System. The temporary viewport was reset and the dashboard restored.

## Coverage and method

Live computer-use inspection covered **10 states × 15 viewport sizes × 2 appearances = 300 combinations**:

| States | Viewports in CSS pixels |
| --- | --- |
| Portfolio, library, populated card search, graded card detail, settings, notifications, common filters, expanded filters, add-copy form, edit-copy form | 320×568, 360×800, 375×667, 390×844, 430×932, 667×375, 759×900, 760×900, 768×1024, 820×1180, 1023×900, 1024×768, 1280×800, 1440×900, 1920×1080 |

The sweep deliberately straddles the 759/760 and 1023/1024 boundaries. It measures actual canvas dimensions, document overflow, control geometry and possible obstructions, rather than only the width of a chart container. Initial canvas resize frames were retried until bitmap and CSS dimensions agreed. Representative screenshots were visually reviewed; not every combination received a separate visual screenshot review.

This is representative responsive coverage, not a claim to have exercised every possible window size, text zoom, browser setting or physical device. Authentication, recovery and failure states received controlled browser tests, not this entire 300-combination live matrix. Hidden controls, decorative arrows and controls that were merely passing behind a fixed bar during scrolling were not automatically counted as failures.

[Rendered measurements](evidence/appearance-size-audit-2026-10-26/rendered-matrix.json) · [Verification](evidence/appearance-size-audit-2026-10-26/verification.json)

## Findings, in order

### 1. P1 — Tablet floating header blocks the dashboard menu

**Observed live in both appearances:** at 760, 768, 820 and 1023px widths, the floating header shares the dashboard action row. At 820px, the menu button occupies x552–596/y34–78; its center hits the header's Mica home button instead. Add Cards is also partially covered. This is a real hit-target obstruction, not just crowded styling. The desktop sidebar layout at 1024px no longer has this collision.

[Light screenshot](evidence/appearance-size-audit-2026-10-26/light-tablet-header-overlap.png) · [Dark screenshot](evidence/appearance-size-audit-2026-10-26/dark-tablet-header-overlap.png)

**Cause:** `themes.css:6708` fixes the header at the top right. The full-width phone header rule ends at 759px (`themes.css:6737`), while the 760px rule restores only 28px of view top padding (`themes.css:6755`). The intermediate shell still includes the Mica wordmark and page context, so its footprint is wider than the desktop pill and intersects the actions.

**Repair:** give the intermediate shell an explicit layout contract: either extend the phone header treatment through the tablet breakpoint or reserve the floating pill's measured footprint before placing page actions. Preserve the requested floating appearance. Acceptance must hit-test the action centers at both boundaries in both appearances, not merely assert zero overflow.

### 2. P2 — Phone copy toolbar covers the chart timeframe selector

**Observed live from a clean card-detail entry at 390×844:** the timeframe selector spans y752–800. The fixed copy-action bar spans y774–836, so the selector's center receives the action-bar overlay instead of the select. It can be exposed by scrolling; it is not permanently unavailable, but its first presentation looks broken and makes a core chart action harder to discover.

[Exact geometry and hit test](evidence/appearance-size-audit-2026-10-26/phone-selector-overlap.json). The full customer-detail captures were retained locally rather than published with inventory evidence.

**Cause:** `themes.css:6858` fixes `.owned-banner > .owned-actions` above the bottom edge, while `renderInteractiveHistory()` keeps the selector after the canvas. End-of-page padding does not prevent an intermediate control from landing under the fixed toolbar.

**Repair:** place the chart's timeframe in the chart header, consistently with the dashboard's intended hierarchy, and preserve scroll clearance for focused controls. Do not solve this by shrinking the chart. Verify clean entry, range changes, keyboard focus and short landscape height with the owned-action bar present.

### 3. P2 — Several secondary labels still miss normal-text contrast

Confirmed measured examples:

| Appearance / element | Ratio |
| --- | ---: |
| Light: library result count (`#resultCount`) | 4.09:1 |
| Light: older-price note (`.row-unit.price-provenance`) | 4.40:1 |
| Light: unselected collection-count badges | 4.46:1 |
| Light: detail estimate notice (`.legal-copy`) | 4.09:1 |
| Dark: Portfolio details disclosure (`#dashboardMoneyDetails > summary`) | 3.79:1 |
| Light: the same Portfolio details disclosure | 4.43:1 |

These are normal-size text; the normal-text threshold is 4.5:1 and should not be rounded up. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Cause:** older faint/brand-color rules still govern some utility text. For example, the dark disclosure inherits `--pine` (#66785d) against #111814 rather than the lighter dark-theme text token. The repaired search titles themselves are readable.

**Repair:** adjust the relevant semantic text tokens/selectors against each actual surface, preserving hierarchy without making every label bold. Include active, hover/focus and stale/missing-price states. [Confirmed measurements and exclusions](evidence/appearance-size-audit-2026-10-26/confirmed-contrast.json). The raw candidate scan also contains hidden/decorative candidates and is not a blanket conformance verdict. In particular, the actual P/L picker passes in dark mode; it is not the failing disclosure.

### 4. P3 — Very short histories can repeat an x-axis date

A fresh controlled WebKit rendering of three daily observations on September 1, 2 and 3 labels the axis “Sep 1”, “Sep 1”, “Sep 3”. This is a **fixture-observed formatting edge case**, not evidence of duplicate sales or a corrupt live Umbreon history.

[Fresh synthetic screenshot](evidence/appearance-size-audit-2026-10-26/short-history-date-labels-synthetic.png). Its synthetic shell setup is not used to diagnose navigation overlap on the actual live app.

**Cause:** `mountPriceChart()` uses a numeric linear time axis with automatically chosen numeric ticks, then formats each tick as a calendar date. Separate sub-day ticks can become the same printed date.

**Repair:** align short daily-series ticks to UTC day boundaries, reusing the portfolio's daily-step convention where suitable. Keep hour labels for truly intraday records and preserve the original x values. Verify 2-day, 3-day, month and year-boundary histories; do not fabricate points to fill the axis.

### 5. P3 — A few optional detail targets are smaller than the surrounding controls

The live Market reference and Price options disclosures measure about **22.5px tall**, while neighboring controls are 44–56px. The Edit button measures about 41.8px wide in intermediate layouts. They work, but feel less consistent on touch screens.

**Cause:** the two renderer paths create plain details/summary elements (`app.js:8539` and `app.js:8941`) outside the larger `.detail-tool-group` and `.history-values` target rules.

**Repair:** reuse the existing padded disclosure-row treatment and a 44px minimum for primary touch targets. This is a consistency recommendation, not a claim that every target below 44px violates WCAG: WCAG's minimum is 24px with spacing and other exceptions. The small native checkbox itself was excluded because its containing label supplies a larger target. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## What passed

- **No horizontal document overflow in the 300 main live combinations.** Both chart canvases settled to their actual CSS width and height in every recorded combination. Phone chart gutters were 8px; larger layouts filled the available content width. These measurements support reflow, but do not replace complete zoom/accessibility certification. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Loaded search remained readable in light and dark appearances. The three Blastoise printing choices retained distinct accessible View/Add/Queue names. [Light search](evidence/appearance-size-audit-2026-10-26/light-search-390.png) · [Dark search](evidence/appearance-size-audit-2026-10-26/dark-search-390.png).
- The chart reveal, range changes, canvas resizing and reduced-motion tests passed. The audit found a selector placement issue, not another missing-data/reveal failure.
- Notifications stayed a single clear in-app choice on the simple surface; common and advanced filters remained available; add/edit sheets reflowed without horizontal overflow. The short landscape copy form kept its footer actions visible, with scrolling for remaining fields.
- Held digital grading remained unavailable before starting capture, while saved reports stayed accessible. Production still reports `grading: release_hold`; this audit does not activate or qualify it.
- Production's saved-view aggregate showed **2/2 views current-day and 0 incomplete**. From 23:32:03 UTC through the bounded provider-usage inspection, the ledger recorded **0 provider requests / 0 reserved credits** during repeated live navigation. This is useful cache-reuse evidence, not an unattended next-day completion or universal 24-hour guarantee.
- Fresh checks passed: **595 unit / 3 skipped**, **440 expanded browser / 10 skipped**, and **334 core browser / 11 skipped**; zero failures or flaky passes. Chromium desktop/mobile and WebKit mobile were covered. Core checks include add/save retries, copies, price evidence, sealed items, documents and password recovery. Real public reset-email delivery remains a separate held qualification.

## Security and release boundaries

Fresh read-only inspection found zero ordinary public tables without RLS, all four storage buckets private, and zero known vulnerabilities in the production dependency tree. Anonymous saved-portfolio, identification and deletion requests returned 401 with non-public caching. The live shell retains CSP, HSTS, nosniff, frame and permissions protections. [Anonymous boundary results](evidence/appearance-size-audit-2026-10-26/anonymous-boundaries.json).

The existing Supabase advisories remain: 21 RLS/no-policy informational findings, 14 authenticated-executable security-definer warnings and disabled leaked-password protection. The 14 functions retain empty search paths and owner/admin references. This is metadata/guard-reference evidence, not a complete per-statement authorization proof or penetration test. No grants, policies or auth settings were changed.

This audit did not perform new production inventory writes, authenticated account deletion, a new target-capacity load test, hosted backup restore, physical iPhone capture/keyboard/safe-area/offline acceptance, email/push activation, provider-wide price verification or App Store qualification. Those limits should not be confused with the concrete UI defects above. Public signup, business/legal/support and store requirements remain at the previously deferred milestone.

## Next correction packet

1. Repair the tablet header/action collision and move chart timeframe controls clear of fixed copy actions.
2. Correct the confirmed contrast selectors, then normalize the optional disclosure targets.
3. Correct short-history tick labels. Add focused regressions for the actual overlap and date-label defects; the existing green suite did not detect them.
4. Repeat the affected light/dark breakpoint and keyboard checks, then Elliott's physical Safari capture → confirm → save → reopen walkthrough on the frozen candidate.

Application code is unchanged. This report identifies what to fix; it does not mark those repairs implemented or certify a flawless commercial release.
