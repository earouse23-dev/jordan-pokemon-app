# Checkpoint 94 — Watch history preservation and comparison removal

Source commit: 2dbb399. Isolated release derives from checkpoint93; only app.js and sw.js shipping sources change. All server function hashes remain identical. Pending91/92 pricing changes remain unshipped.

## Root cause and change

The Watch background refresh requests current prices only. It replaced stored history with an empty/not-requested history response. Full detail reads already request full history with the selected valuation context; these now merge recorded history and retain it in same-context Watch memory. No customer database writes or additional background full-history calls were added.

“All time” filters available records; it cannot create provider history. The screenshot's Oct8 observation is current-price fallback data, not proof that older historical prices were retrieved. One observation now displays a concise missing-history message instead of an empty chart. Failed historical requests report error/rate-limited status. No fabricated dates or prices.

Removed the shared Compare grading outcomes renderer, handlers and entry from every card detail path. Professional-grade price evidence remains separate and unchanged.

PkmnPrices documentation: https://www.pkmnprices.com/docs/price-history — provider history is daily closing prices up to one year, paginated by row count and filtered by printing/condition. All time means all available records, not unlimited provider coverage.

## Verification

- Exact isolated shipping source card-profile browser suite: 99 passed, 9 conditional skips across desktop Chromium, mobile Chromium and mobile WebKit.
- Additional one-observation visual replay: 3 passed; screenshots included. Verified concise history status and no comparison after opening More options.
- Working-tree unit suite: 549 passed, 3 skipped; lint 98 sources passed. This tree contains pending91/92 source and is not claimed as exact shipping unit coverage.
- Frozen source/deployment manifest and private-value scan: 161 entries, zero private findings; all server functions unchanged from93.
- Regression verifies full historical Watch records survive a later current-only refresh, and one-observation charts do not silently appear blank.

## Limits

Mica's read-only provider ledger showed all 20,000 daily reserved credits consumed on Oct9. This is Mica's reservation accounting, not evidence the provider billed that amount. Fresh paid history could not be verified under the existing allowance. No allowance reset, bypass, budget increase, secret publication, SQL replay, new dependency or customer-record write. Five incomplete slab printing identities remain blocked; eBay pricing repairs in91/92 are not part of this release.

## Publication

READY deployment: dpl_8wV5F3pnnA4cacf49ydFQGuARUNx.
Unique URL: https://jordan-pokemon-ekkmgqf2z-earouse23-devs-projects.vercel.app
Canonical target: https://jordan-pokemon-app.vercel.app
Runtime/alias/cron evidence accompanies this report after promotion. Only deletion scheduling remains enabled, and Git-triggered builds remain suppressed.
