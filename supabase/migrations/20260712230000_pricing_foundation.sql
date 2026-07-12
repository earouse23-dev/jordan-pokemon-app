-- Provider-neutral catalog, quote history, coverage and sold-evidence foundation.
create table if not exists public.variant_external_ids (
  variant_id uuid not null references public.card_variants(id) on delete cascade, provider text not null, external_id text not null,
  mapping_method text not null default 'imported', mapping_confidence numeric(5,4) check(mapping_confidence between 0 and 1),
  reviewed_at timestamptz, primary key(provider, external_id)
);
create index if not exists variant_external_ids_variant_idx on public.variant_external_ids(variant_id);

create table if not exists public.catalog_coverage_snapshots (
  id bigint generated always as identity primary key, provider text not null, language text not null,
  entity_type text not null, expected_count integer, imported_count integer not null check(imported_count >= 0),
  mapped_price_count integer not null default 0 check(mapped_price_count >= 0), measured_at timestamptz not null default now()
);
create index if not exists catalog_coverage_provider_time_idx on public.catalog_coverage_snapshots(provider, measured_at desc);

alter table public.price_sources add column if not exists terms_url text;
alter table public.price_sources add column if not exists status text not null default 'evaluation';
create table if not exists public.provider_policies (
  source_id uuid primary key references public.price_sources(id) on delete cascade,
  commercial_authorized boolean not null default false, derived_metrics_allowed boolean not null default false,
  raw_retention_days integer check(raw_retention_days is null or raw_retention_days >= 0),
  attribution_requirements text, contract_reference text, reviewed_at timestamptz, review_due_at timestamptz
);

create index if not exists price_snapshots_observed_idx on public.price_snapshots(product_id,price_type,observed_at desc);
create table if not exists public.price_daily_metrics (
  product_id uuid not null references public.price_products(id) on delete cascade, price_type text not null, metric_date date not null,
  open_amount numeric(14,2) not null check(open_amount >= 0), high_amount numeric(14,2) not null check(high_amount >= 0),
  low_amount numeric(14,2) not null check(low_amount >= 0), close_amount numeric(14,2) not null check(close_amount >= 0),
  average_amount numeric(14,2) not null check(average_amount >= 0), sample_count integer not null check(sample_count > 0),
  computed_at timestamptz not null default now(), primary key(product_id, price_type, metric_date)
);
create index if not exists price_daily_metrics_date_idx on public.price_daily_metrics(product_id,metric_date desc);

alter table public.sales_records add column if not exists title text;
alter table public.sales_records add column if not exists sale_type text;
alter table public.sales_records add column if not exists listing_condition text;
alter table public.sales_records add column if not exists grading_company text;
alter table public.sales_records add column if not exists grade numeric(4,2);
alter table public.sales_records add column if not exists match_confidence numeric(5,4) check(match_confidence between 0 and 1);
alter table public.sales_records add column if not exists quality jsonb not null default '{}'::jsonb;
alter table public.pricing_sync_runs add column if not exists cursor text;

alter table public.variant_external_ids enable row level security;
alter table public.catalog_coverage_snapshots enable row level security;
alter table public.provider_policies enable row level security;
alter table public.price_daily_metrics enable row level security;

create policy "variant ids read" on public.variant_external_ids for select to authenticated using (true);
create policy "catalog coverage read" on public.catalog_coverage_snapshots for select to authenticated using (true);
create policy "price daily metrics read" on public.price_daily_metrics for select to authenticated using (true);

revoke all on public.variant_external_ids, public.catalog_coverage_snapshots, public.provider_policies, public.price_daily_metrics from anon, authenticated;
grant select on public.variant_external_ids, public.catalog_coverage_snapshots, public.price_daily_metrics to authenticated;
