# Catalog sync runbook

## Smart catalog search

`/api/catalog` uses TCGdex for multilingual card identity. The server parses a collector's natural query before calling TCGdex: card-name terms are sent as `name`, collector numbers as `localId`, recognized set names as `set.name`, set codes as `set.id`, and the denominator in `151/165` as `set.cardCount.official`. Never send a mixed query such as `Mew ex 151/165` as one `name` value.

The adapter makes a narrow exact request plus relaxed fallback requests, deduplicates provider IDs, fetches full card records, and ranks locally. Ranking considers exact name, set, local number, official set size, set code, rarity/finish hints, image availability, and selected language. The normalized result preserves the real TCGdex ID and includes confidence plus human-readable match reasons. It does not guess IDs from legacy local seed formats.

Release smoke searches:

- `Mew ex 151/165` -> `sv03.5-151` first.
- `151/165` -> local number 151 results, including Mew ex from 151.
- `Charizard 4/102` -> Base Set Charizard first.
- `Greninja 214/167` -> Twilight Masquerade Greninja ex first.
- `Pikachu 151` -> Pikachu in set 151; `151` is not treated as its local number.
- Repeat one query with `language=ja` and confirm every upstream card request stays under `/v2/ja/cards`.

When these fail, inspect the returned `parsedQuery` and normalized `match.reasons` before changing UI matching. A local static preview cannot execute Vercel routes and may use the small offline fixture catalog; provider-backed acceptance must call the server route or adapter directly.

## Security boundary

The deployed `sync-catalog` Edge Function requires a valid Supabase service-role JWT at the gateway and verifies the JWT role again in the function. Never put that token in source control, browser code, logs, screenshots, or a public scheduler. An unauthenticated production request must return `401`.

## Activate the scheduler

The live project already contains `catalog_sync_project_url`, ten language targets, and an active dispatcher cron. To activate it:

1. Open the Supabase project dashboard.
2. Go to **Project Settings → API Keys → Legacy API Keys**.
3. Reveal and copy the `service_role` key—not the `anon` or publishable key. It is a long JWT beginning with `eyJ`.
4. Open **SQL Editor → New query**, replace only the placeholder below, and run it. Do not paste the JWT into chat or source control.

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
