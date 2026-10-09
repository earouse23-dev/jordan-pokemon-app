# Checkpoint 95 — Saved portfolio and daily historical valuation

## Behavior

Portfolio views store the headline, full-coverage daily chart and matching position prices together. Opening the app restores the owner-scoped saved view. A server refresh groups duplicate pricing contexts, runs three workers under the existing account rate/credit controls, and publishes once after all required reads succeed. Failed refreshes preserve the previous published view and retain private progress for a later attempt. Inventory changes during refresh invalidate publication. Price, condition, currency, printing, grader and grade identity changes invalidate cached matching evidence.

Historical daily values use acquisition/sale dates and historical matching market observations. Prices carry forward from an earlier observation, never backward from a future price. Purchase cost is separate. Missing holdings cannot silently become zero or a changing partial-subset return line. The visible history starts only where the whole portfolio has historical coverage; older missing history is disclosed. Slab prices do not project a professional grade before a recorded grading return.

Raw/sealed history is cached durably across function instances and users with the same provider request. Daily expiry uses UTC midnight. After the initial backfill, single-series histories request only the newly elapsed days plus overlap and merge into retained history. Slab history comes from exact completed eBay sold records, not raw price history. Sold pagination resumes from saved cursors, then polls using the documented ingested_at high-watermark. Four pages per refresh fit the existing time/budget ceiling; large backfills continue on later refreshes.

Daily portfolio cron: 25 6 * * * UTC. It refreshes registered owners without an active login, oldest first, bounded to 100 owners and the existing 48-second request deadline. This is sufficient for the present small deployment; a larger account population would need approved scheduling capacity. Existing grading-deletion cron remains 15 5 * * * UTC; old price-sync and held AI routes remain disabled. No dependency, platform or budget changes.

## Credits

PkmnPrices documents one credit per history record, up to 365 records per page. Roughly 33 full-year pages can return 12,000 records. Repeated full-history reads, broad condition/currency pagination and warm-instance-only caching explain a plausible consumption path. Earlier accounting records reservations, not actual per-request returned credits, so today's exact 12,000 billed-credit attribution cannot be reconstructed. The local 20,000 daily reservation ceiling is exhausted; it was not reset. New sanitized usage records retain endpoint, reserved credits, returned item count and HTTP status for future diagnosis.

Sources: https://www.pkmnprices.com/docs/price-history ; https://www.pkmnprices.com/docs/ebay-listings . The sold-listing since field refers to ingestion time, not sale date. Provider history coverage is up to one year; All time cannot invent unavailable older data.

## Verification and limitations

- Unit checks: 556 passed, 3 conditional skips. Additional service fixture verified empty inventory publication, owner scoping, failed reads preserving the prior view and cron rejecting browser tokens; no paid calls.
- Browser checks: 114 passed, 9 conditional skips across desktop Chromium, mobile Chromium and mobile WebKit. Includes saved restore, one atomic update, failed-refresh preservation, parallel legacy batches and existing card profiles. Mobile screenshots inspected.
- Lint: 101 files. Build Output routing: nine functions, held/auth/CORS boundaries checked offline with zero provider calls.
- Additive migration 20261009163000_durable_portfolio_views applied once. Owner-only reads for portfolio views; provider caches/usage and claim functions are service-only. Anonymous read/client write privileges verified absent. Customer purchases, lots and sales unchanged.
- Exact shipping overlay and manifest frozen; 163 source/deployment entries scanned against local private environment values with zero findings. Publication includes previously held pricing corrections in 91/92, now reconciled and tested.
- Fresh paid-provider history and slab results cannot be confirmed today while the allowance is exhausted. Existing slab printing/tier uncertainty still fails closed; the previously sent PkmnPrices support questions remain pending. No false promise of complete past history or slab coverage.

## Publication

Pending runtime verification and promotion; final IDs and live cron/hash evidence will be recorded after publication.
