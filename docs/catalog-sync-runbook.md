# Catalog sync runbook

## Security boundary

The deployed `sync-catalog` Edge Function requires a valid Supabase service-role JWT at the gateway and verifies the JWT role again in the function. Never put that token in source control, browser code, logs, screenshots, or a public scheduler. An unauthenticated production request must return `401`.

## Activate the scheduler

The live project already contains `catalog_sync_project_url`, ten language targets, and an active dispatcher cron. In the Supabase SQL editor, add the legacy service-role JWT directly to Vault; do not paste it into chat or source control:

```sql
select vault.create_secret('<service-role-jwt>', 'catalog_sync_service_role_jwt', 'Catalog scheduler service role');
```

The next minute tick automatically begins the import. `dispatch_catalog_sync()` claims up to three different language pages per minute, and the Edge Function advances each cursor only after a successful committed page. English refreshes after 12 hours; the other supported languages refresh after 24 hours. Those intervals reflect the upstream market cadence rather than claiming unavailable minute-level source data.

For a controlled manual invocation, POST JSON to `/functions/v1/sync-catalog` with `Authorization: Bearer <service-role-jwt>` and `{ "language": "en", "page": 1, "pageSize": 40 }`. The same idempotent upserts and observation key protect retries.

The scheduler follows [Supabase's documented `pg_cron` + `pg_net` pattern](https://supabase.com/docs/guides/functions/schedule-functions). It remains safely dormant when the JWT secret is missing, and stale claims become retryable after ten minutes.

## Verification queries

After each language finishes, compare the latest `catalog_coverage_snapshots.imported_count` with the provider's current catalog count. Investigate reductions, duplicate external IDs, failed runs, cards without variants, and cards without images. A missing market quote is valid and must remain “No verified market data”; it is not a zero-dollar observation.

The internal `refresh-current-price-daily-metrics` job runs at minute 15 of every hour and derives daily open, high, low, close, average, and sample count from immutable snapshots. Confirm both cron jobs remain active, inspect `catalog_sync_targets` for stale claims, and alert on failed database jobs or `catalog_sync_runs.status = 'failed'`.

## Release gates

The baseline importer does not satisfy the sold-comparable requirement. Enable a sold-data adapter only after written commercial authorization confirms that storing, deriving analytics from, and displaying the provider's transaction records and original listing URLs are permitted. Keep raw, graded, condition, finish, edition, language, currency, asking, and sold observations separated.
