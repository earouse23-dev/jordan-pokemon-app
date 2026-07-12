# Catalog sync runbook

## Security boundary

The deployed `sync-catalog` Edge Function requires a valid Supabase service-role JWT at the gateway and verifies the JWT role again in the function. Never put that token in source control, browser code, logs, screenshots, or a public scheduler. An unauthenticated production request must return `401`.

## First full import

1. Keep the service-role token only in an approved secret manager or trusted operator environment.
2. POST JSON to `/functions/v1/sync-catalog` with `Authorization: Bearer <service-role-token>` and `{ "language": "en", "page": 1, "pageSize": 40 }`.
3. Continue with the returned `nextPage` until `hasMore` is false.
4. Repeat for `en`, `fr`, `es`, `de`, `it`, `pt`, `ja`, `zh-tw`, `id`, and `th`.
5. Retry failed pages from the cursor recorded in `catalog_sync_runs`; do not restart successful pages. Upserts and the snapshot observation key make retries idempotent.

For unattended operation, follow [Supabase's documented `pg_cron` + `pg_net` pattern](https://supabase.com/docs/guides/functions/schedule-functions) and store the project URL and service-role token in Supabase Vault. Schedule one bounded page per invocation so provider latency and function runtime remain controlled. This repository intentionally does not create that external HTTP schedule until a service-role token is stored in Vault by an authorized operator.

## Verification queries

After each language finishes, compare the latest `catalog_coverage_snapshots.imported_count` with the provider's current catalog count. Investigate reductions, duplicate external IDs, failed runs, cards without variants, and cards without images. A missing market quote is valid and must remain “No verified market data”; it is not a zero-dollar observation.

The internal `refresh-current-price-daily-metrics` job runs at minute 15 of every hour and derives daily open, high, low, close, average, and sample count from immutable snapshots. Confirm the job remains active in `cron.job` and alert on failed database jobs or `catalog_sync_runs.status = 'failed'`.

## Release gates

The baseline importer does not satisfy the sold-comparable requirement. Enable a sold-data adapter only after written commercial authorization confirms that storing, deriving analytics from, and displaying the provider's transaction records and original listing URLs are permitted. Keep raw, graded, condition, finish, edition, language, currency, asking, and sold observations separated.
