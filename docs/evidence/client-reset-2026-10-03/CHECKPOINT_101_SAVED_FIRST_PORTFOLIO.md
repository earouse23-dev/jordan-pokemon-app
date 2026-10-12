# Checkpoint 101 — saved-first daily portfolio

## Shipped behavior

The authenticated owner’s compact local total and daily chart render immediately, independently of profile, inventory and other account reads. A compact database snapshot refreshes that view without transferring archived sales evidence. Delayed responses cannot cross owners or roll back a newer result. The hero stays above the chart during account hydration. Owner-local display currency and a still-valid ECB rate also restore before the profile, avoiding a dollars-to-euros flicker. A real-demo browser run with delayed inventory reads exposed this gap; the corrected version is covered by the euro reload assertion and repeated real-demo check.

The server checks one saved owner row before hydrating inventory. A current UTC-day snapshot at the current inventory revision returns without provider requests or inventory hydration. New days refresh distinct pricing contexts concurrently using the existing provider caches and budgets; another physical copy of an already checked context reuses today’s price. A restricted database publication writes the total and daily series together only if the inventory revision and worker lease still match. Failed refreshes preserve the previous chart/value. Failed or partial attempts have a five-minute cooldown and a three-per-day/revision ceiling.

Saved historical chart points are retained and only missing days appended. Purchases, sales, acquisition-date, printing or grade changes invalidate the affected derived dates; reconstruction uses stored card history. New historical coverage can rebuild the relevant line from stored evidence. Historical provider archives remain shared and durable, with the existing raw daily delta and eBay exclusive ingestion cursor. Missing source coverage is not fabricated. A source-unpriced edition remains explicitly excluded rather than assigned a guessed grade/edition.

Existing daily cron schedule is unchanged. It now checks the UTC valuation day/revision and processes up to three owners concurrently under the existing 48-second deadline. The existing 100-owner scan is a beta ceiling, not a general-scale scheduler guarantee. No new dependency, paid service, provider budget or schedule was introduced.

## Database

Applied migration `20261012055807_saved_first_portfolio_daily_revision.sql` adds revision/dirty-date fields to existing `portfolio_views`, inventory invalidation triggers and service-only atomic publication. Existing purchases, sales, archives and snapshots are preserved. Auth deletion cannot recreate an orphan portfolio row. An isolated-demo transaction verified lot-edit invalidation, old-revision rejection, current-revision publication, lease clearing and restricted grants; the transaction was rolled back. No customer inventory was modified. Existing unrelated advisor findings remain outside this change.

## Verification

- Focused service/view/history/provider checks: 32 pass, one separately configured live database test skipped, zero failures.
- Lint 101 sources and syntax/typecheck pass.
- Six browser checks pass across desktop Chromium, mobile Chromium and mobile WebKit: cached first paint despite pending account/API reads, reload retention, complete-batch replacement, owner isolation and hero ordering.
- Final staged runtime checks pass: asset hash, health/capabilities, held routes, anonymous authorization, hostile origin and unknown routes. These checks consume no paid provider calls.
- Authenticated isolated-demo GET/POST/GET passes with real persisted graded pricing, more than 90 raw history rows and saved chart. Two further same-day visits leave the daily usage ledger at 43 reserved credits / five requests, latest request 2026-10-12 06:02:45.13606 UTC: zero additional credits.

Final candidate: `dpl_AP7tuFHxU9qs7AYh2nLr63juYSUg`, https://jordan-pokemon-7cy2ul6iu-earouse23-devs-projects.vercel.app . Frozen deployment/source/configuration manifest retained alongside this report. Git-triggered builds remain disabled; two existing cron definitions retained. Publication and final live browser evidence recorded below.

This acceptance covers the saved portfolio workflow; it does not establish whole-product commercial readiness. Elliott retains physical iPhone Safari camera/device acceptance.
