# Daily sale chart correction — October 22, 2026

## Scope and root cause

The old card chart connected every individual transaction as a line. The retained Umbreon PSA 10 sample had 113 records on 49 dates, with six different prices at July 20 midnight. It therefore drew arbitrary same-day vertical strokes. First/last transaction ordering also controlled the chart's period change.

## Implementation

- A shared daily-median derivation receives the existing exact-context evaluator's eligible transactions. It separates currencies, groups dates in UTC, retains each original sale, and records daily median/count/range. No mismatching grade/printing is newly admitted.
- The derivation carries a version and evidence revision key. Same evidence reuses its saved derived series; changed amounts, dates or eligible IDs invalidate it. Original sale metadata is resolved directly from retained evidence, so corrections to links or sale-type labels are not hidden by the derived cache. Daily statistics store sale-ID references rather than duplicate sale records. The normal server portfolio-pricing publication saves this object inside the existing exact-sale-evidence JSON, without a schema migration. Older saved evidence upgrades locally without a historical provider download. Local detail rendering retains the derived object for reopening.
- The primary line uses daily medians; original sales appear as separate scatter points. Dotted connections distinguish days without sale observations. Monotone interpolation is presentation between observed medians, not a claim of recorded intervening prices.
- Period change uses the displayed daily series. Tooltip details provide sale count/range, and individual unknown amounts remain labelled unverified. The original transaction table and original-listing links remain available.
- The y-axis uses the complete visible range plus modest padding, with rounded interior tick labels. Responsive sizing is preserved, and the daily-median label remains visible on phones.
- The latest-comp headline, purchase basis, ownership history, valuation selection, provider budgets and primary portfolio valuation method are not replaced by the chart statistic. Portfolio fallback observations retain their prior transaction order.

## Freshness trace

Read-only shared-cache checks first confirmed the older 113-sale archive ending September 27. A direct local provider diagnostic stopped at the existing budget/configuration guard; it was not bypassed. A normal authenticated production `/api/sales` GET using the approved isolated demo account then returned 117 accepted sales through October 21, complete pagination, 164 received and 47 exclusions (19 context, 28 canonical identity). Four newer accepted PSA 10 records were present: October 20 at $3,400/$3,500/$3,800, and October 21 at $3,763. No customer inventory/settings or private pricing records were write-tested.

The shared source can now return newer evidence. Previously published personal snapshots still follow the existing daily refresh policy; this work does not force re-downloads on every navigation. It also does not add an upstream correction polling channel or manufacture sales missing from the source.

## Checks

- Unit coverage includes permutation invariance, same-day duplicates, changed-source invalidation, cross-currency separation, UTC-offset grouping, sparse windows, serialization and FX preservation of individual sales.
- Browser regression checks cover two sales on one date becoming one median, all original transactions remaining, median-based change, unconnected sale dots, tighter bounds, visible phone method labels, same-day cached reopening, and unchanged original-comp links with no additional sales request.
- Read-only visual replays use both retained public samples (113 and 117 records), with all writes/provider network calls intercepted by the test harness. The public sale arrays remain outside the repository; screenshots and summary evidence are retained here.
- The old sample produces 49 daily points, 113 sale dots and −$925 / −19.5%. The newer sample produces 51 daily points, 117 sale dots and −$987 / −20.8%. These are daily-median changes, not a recalculation of the latest-sale headline.
- Final qualification/publication results follow below.

Local checks: lint and syntax passed; 590 unit checks passed, 3 skipped; schema and production migration-baseline checks passed. The pricing/copy suite initially exposed stale locally served CSS in a phone-label assertion; rebuilding the local served artifact corrected it. A broader run also exposed an existing fake-clock FX fixture's unnecessary dynamic module import; that test now uses its retained module handle with the same account-switch and late-response assertions. No FX application behavior changed.

The initial candidate passed the complete local beta gate (590 unit passes; 370 browser passes, 11 intentional skips; 3 large-inventory passes). Final review then compacted the derived cache to daily statistics plus sale-ID references. The 117-sale sample stores 51 daily points in 17,611 bytes, without duplicating the retained sale rows (57,665 bytes). Original dots, labels and URLs are resolved from the exact validated evidence on display. This final cache form passed all 590 unit checks and six targeted desktop/mobile real-data and cache-reopening checks; the full gate is repeated for the final source below.

## Final source qualification and live review

The compact-cache source `64393af655323c18179213daa3b96e2a2826381c` passed `npm run beta:check` locally with exit 0: 590 unit passes / 3 skips, 370 browser passes / 11 intentional skips, and 3 large-inventory passes. The hosted bundle matched the built artifact; canonical health confirmed the source release after promotion. Live Chrome reopening of the existing saved Umbreon confirmed the new daily-median label and −$925 / −19.5% statistic, preserving its saved 113-sale context without forcing private pricing writes.

The live visual review caught over-aggressive automatic tick rounding with tight explicit bounds. Raising the native Chart.js tick budget from four to six restores the clean $3k/$4k/$5k interior labels, rather than only $4k or imprecise padding-bound labels. This one-line presentation correction and shell-cache bump were checked with lint, syntax, all 590 unit passes, and six targeted desktop/mobile chart checks. The real-data browser regression explicitly asserts those three tick values. The statistical series, persistence and provider workflow are unchanged by this final presentation correction.

GitHub's duplicate final-source beta check was queued while the identical local gate completed; remote status is reported separately rather than described as a remote pass.
