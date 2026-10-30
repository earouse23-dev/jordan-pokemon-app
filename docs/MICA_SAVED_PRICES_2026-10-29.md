# Saved collection prices — 29 October 2026

The reported Collection initially showed every price as unavailable, then recovered. The saved portfolio summary and browser first-paint cache deliberately omitted all position pricing, and loading the summary did not rerender Collection. Inventory hydration starts with null prices, so valid database prices were invisible until the larger background POST completed. Raw-price display also discarded old matching quotes, and some detail reuse checks incorrectly used the source/sale date instead of the last successful check.

## Correction

- The compact owner-scoped portfolio response and local first-paint cache now retain per-position display prices/quotes and one validated latest slab comp. Full history/evidence remains in the database. The summary cannot replace full evidence already loaded.
- Inventory restoration checks the exact saved input/resolved pricing key, including language, printing, condition, grader, grade, qualifier and currency. Quantities, purchase lots and transactions remain current. Cached data cannot cross accounts.
- `checkedAt` is separate from source/sale dates. Successful pricing is reused for a rolling 24 hours, including across UTC midnight. Unchanged positions reuse pricing after inventory edits; server claims still deduplicate concurrent refreshes.
- Older matching prices remain visible while background work runs and after timeouts, quota failures or empty responses. A confirmed withdrawn comp or changed identity remains unpriced rather than reusing an incompatible value. A genuinely never-priced holding remains unavailable.
- Raw, graded and unopened detail paths reuse fresh saved data and wait for an existing portfolio refresh. Existing raw history, sale archives, daily snapshots, provider caches, budget limits, retry backoff and scheduled jobs are retained.
- Web entry point v119 and service-worker shell 133 prevent old browser assets from masking this fix. Browser harness references follow the shipping entry point to avoid a second app bootstrap.

No schema/migration, dependency, platform, provider budget or cron changes. Existing publication authorization applies. Customer records are outside write-test scope.

## Verification

See [verification.json](evidence/saved-prices-2026-10-29/verification.json). Tests use synthetic accounts/data and intercept provider calls. Checks cover immediate Collection restoration during a blocked network read, old price persistence after failed reads and reload, changed condition rejection, owner isolation, background publication, fresh detail reuse, partial refreshes and confirmed comp withdrawals. Chromium desktop, Chromium phone and WebKit phone pricing/portfolio regressions: 144 passed. Release and live acceptance are recorded separately below when completed.
