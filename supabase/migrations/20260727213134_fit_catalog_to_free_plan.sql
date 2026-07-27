-- Keep the Free-plan database focused on durable user data.
--
-- The multilingual catalog importer can recreate these provider-derived rows,
-- while live catalog and price requests already fall back to the provider APIs.
-- The previous minute-level dispatcher imported more than 1 GB of snapshots
-- and daily rollups, which put the database into read-only mode.

set transaction read write;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'dispatch-catalog-sync',
  'refresh-current-price-daily-metrics'
);

update public.catalog_sync_targets
set status = 'paused',
    claimed_at = null,
    next_attempt_at = now() + interval '100 years',
    updated_at = now()
where status <> 'paused'
   or claimed_at is not null;

-- These tables contain provider cache/history, not user positions, purchase
-- lots, collection transactions, watchlists, or owned-position observations.
truncate table
  public.price_snapshots,
  public.price_daily_metrics,
  public.sales_records,
  public.price_products
restart identity;

truncate table
  public.catalog_sync_runs,
  public.catalog_coverage_snapshots
restart identity;

comment on table public.price_snapshots is
  'Provider cache. Keep empty on Free plan; live prices come from server-side provider adapters.';

comment on table public.price_daily_metrics is
  'Derived provider rollups. Populate only after approving storage requirements for a paid plan.';
