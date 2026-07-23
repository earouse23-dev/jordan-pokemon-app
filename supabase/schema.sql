-- Mica collection ledger — launch schema
-- Apply in a dedicated Supabase project. All user-owned tables use auth.uid()-based RLS.
create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  display_currency text not null default 'USD' check (display_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'preview', entitlements jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.usage_events (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, quantity integer not null default 1 check (quantity > 0), occurred_at timestamptz not null default now()
);
create index if not exists usage_events_user_idx on public.usage_events(user_id);

create table if not exists public.card_sets (
  id uuid primary key default gen_random_uuid(), name text not null, canonical_key text, series text, release_date date,
  language text not null default 'en'
);
create unique index if not exists card_sets_canonical_key_unique on public.card_sets(language,canonical_key);
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(), set_id uuid not null references public.card_sets(id) on delete cascade,
  name text not null, collector_number text not null, rarity text, artist text, language text not null default 'en',
  search_document tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(collector_number,''))) stored,
  unique(set_id, collector_number, language)
);
create index if not exists cards_search_idx on public.cards using gin(search_document);
create table if not exists public.card_variants (
  id uuid primary key default gen_random_uuid(), card_id uuid not null references public.cards(id) on delete cascade,
  finish text not null, edition text not null default '', language text not null default 'en', unique(card_id, finish, edition, language)
);
create table if not exists public.card_external_ids (
  card_id uuid not null references public.cards(id) on delete cascade, provider text not null, external_id text not null,
  primary key(provider, external_id)
);
create table if not exists public.set_external_ids (
  set_id uuid not null references public.card_sets(id) on delete cascade, provider text not null, external_id text not null,
  primary key(provider, external_id)
);
create index if not exists set_external_ids_set_idx on public.set_external_ids(set_id);
create index if not exists card_external_ids_card_idx on public.card_external_ids(card_id);
create table if not exists public.variant_external_ids (
  variant_id uuid not null references public.card_variants(id) on delete cascade, provider text not null, external_id text not null,
  mapping_method text not null default 'imported', mapping_confidence numeric(5,4) check(mapping_confidence between 0 and 1),
  reviewed_at timestamptz, primary key(provider, external_id)
);
create index if not exists variant_external_ids_variant_idx on public.variant_external_ids(variant_id);
create table if not exists public.card_images (
  id uuid primary key default gen_random_uuid(), card_id uuid not null references public.cards(id) on delete cascade,
  provider text not null, size text not null, url text not null, unique(card_id, provider, size)
);
create table if not exists public.catalog_sync_runs (
  id uuid primary key default gen_random_uuid(), provider text not null, status text not null,
  cursor text, records_processed integer not null default 0, started_at timestamptz not null default now(), finished_at timestamptz
);
create table if not exists public.catalog_sync_targets (
  language text primary key, next_page integer check(next_page > 0), page_size integer not null default 50 check(page_size between 1 and 50),
  status text not null default 'pending' check(status in ('pending','running','completed','paused')),
  refresh_interval interval not null default interval '24 hours', attempts integer not null default 0 check(attempts >= 0),
  last_request_id bigint, last_error text, claimed_at timestamptz, next_attempt_at timestamptz not null default now(),
  cycle_started_at timestamptz not null default now(), completed_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.scheduler_credentials (
  name text primary key, secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'), rotated_at timestamptz not null default now()
);
insert into public.catalog_sync_targets(language,next_page,page_size,refresh_interval)
values
  ('en',1,50,interval '12 hours'), ('fr',1,50,interval '24 hours'), ('es',1,50,interval '24 hours'),
  ('de',1,50,interval '24 hours'), ('it',1,50,interval '24 hours'), ('pt',1,50,interval '24 hours'),
  ('ja',1,50,interval '24 hours'), ('zh-tw',1,50,interval '24 hours'), ('id',1,50,interval '24 hours'), ('th',1,50,interval '24 hours')
on conflict(language) do nothing;

create or replace function public.dispatch_catalog_sync()
returns bigint language plpgsql security definer set search_path = '' as $$
declare project_url text; service_role_jwt text; target_language text; target_page integer; target_page_size integer; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='catalog_sync_project_url' limit 1;
  select decrypted_secret into service_role_jwt from vault.decrypted_secrets where name='catalog_sync_service_role_jwt' limit 1;
  if nullif(project_url,'') is null or nullif(service_role_jwt,'') is null then return null; end if;
  update public.catalog_sync_targets set next_page=1,status='pending',completed_at=null,cycle_started_at=now(),next_attempt_at=now(),updated_at=now()
    where status='completed' and completed_at <= now()-refresh_interval;
  with candidate as (
    select language from public.catalog_sync_targets where status in ('pending','running') and next_page is not null
      and next_attempt_at <= now() and (claimed_at is null or claimed_at < now()-interval '10 minutes')
    order by case when language='en' then 0 else 1 end,updated_at,language for update skip locked limit 1
  )
  update public.catalog_sync_targets target set status='running',claimed_at=now(),attempts=attempts+1,last_error=null,updated_at=now()
    from candidate where target.language=candidate.language
    returning target.language,target.next_page,target.page_size into target_language,target_page,target_page_size;
  if target_language is null then return null; end if;
  request_id := net.http_post(url=>rtrim(project_url,'/')||'/functions/v1/sync-catalog',
    headers=>jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_role_jwt),
    body=>jsonb_build_object('language',target_language,'page',target_page,'pageSize',target_page_size),timeout_milliseconds=>5000);
  update public.catalog_sync_targets set last_request_id=request_id,updated_at=now() where language=target_language;
  return request_id;
exception when others then
  if target_language is not null then update public.catalog_sync_targets set status='pending',claimed_at=null,last_error='dispatch failed',
    next_attempt_at=now()+interval '5 minutes',updated_at=now() where language=target_language; end if;
  return null;
end $$;
revoke all on function public.dispatch_catalog_sync() from public,anon,authenticated;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100), created_at timestamptz not null default now(),
  unique(id, user_id)
);
create table if not exists public.catalog_coverage_snapshots (
  id bigint generated always as identity primary key, provider text not null, language text not null,
  entity_type text not null, expected_count integer, imported_count integer not null check(imported_count >= 0),
  mapped_price_count integer not null default 0 check(mapped_price_count >= 0), measured_at timestamptz not null default now()
);
create index if not exists catalog_coverage_provider_time_idx on public.catalog_coverage_snapshots(provider, measured_at desc);
create index if not exists collections_owner_idx on public.collections(user_id);
create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(), collection_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade, variant_id uuid references public.card_variants(id),
  quantity integer not null default 1 check (quantity between 1 and 99999), valuation_basis text not null default 'provider_market',
  manual_value numeric(14,2) check (manual_value >= 0), notes text check (char_length(notes) <= 10000),
  storage_location text check (char_length(storage_location) <= 250), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (collection_id, user_id) references public.collections(id, user_id) on delete cascade,
  unique(id, user_id)
);
create index if not exists collection_items_owner_collection_idx on public.collection_items(user_id, collection_id);
create index if not exists collection_items_collection_owner_idx on public.collection_items(collection_id, user_id);
create index if not exists collection_items_variant_idx on public.collection_items(variant_id);
create table if not exists public.owned_copies (
  id uuid primary key default gen_random_uuid(), collection_item_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade, condition text, grading_company text, grade numeric(4,2),
  purchase_price numeric(14,2) check (purchase_price >= 0), purchase_currency text check (purchase_currency ~ '^[A-Z]{3}$'),
  purchase_date date, notes text check (char_length(notes) <= 10000), storage_location text check (char_length(storage_location) <= 250),
  foreign key (collection_item_id, user_id) references public.collection_items(id, user_id) on delete cascade,
  unique(id, user_id)
);
create index if not exists owned_copies_item_owner_idx on public.owned_copies(collection_item_id, user_id);
create index if not exists owned_copies_owner_idx on public.owned_copies(user_id);
create table if not exists public.collection_tags (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60), unique(user_id,name), unique(id, user_id)
);
create table if not exists public.collection_item_tags (
  collection_item_id uuid not null, tag_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(collection_item_id,tag_id),
  foreign key (collection_item_id, user_id) references public.collection_items(id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.collection_tags(id, user_id) on delete cascade
);
create index if not exists collection_item_tags_item_owner_idx on public.collection_item_tags(collection_item_id, user_id);
create index if not exists collection_item_tags_tag_owner_idx on public.collection_item_tags(tag_id, user_id);
create index if not exists collection_item_tags_owner_idx on public.collection_item_tags(user_id);
create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, configuration jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists saved_views_owner_idx on public.saved_views(user_id);

create table if not exists public.card_scans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text, status text not null, quality_flags text[] not null default '{}', prompt_version text,
  expires_at timestamptz not null default (now()+interval '24 hours'), created_at timestamptz not null default now(),
  unique(id, user_id)
);
create index if not exists card_scans_owner_idx on public.card_scans(user_id);
create table if not exists public.scan_candidates (
  scan_id uuid not null references public.card_scans(id) on delete cascade, variant_id uuid not null references public.card_variants(id),
  rank smallint not null check(rank > 0), confidence numeric(5,4) check(confidence between 0 and 1), reasons jsonb not null default '[]',
  primary key(scan_id,variant_id)
);
create index if not exists scan_candidates_variant_idx on public.scan_candidates(variant_id);
create table if not exists public.scan_feedback (
  id uuid primary key default gen_random_uuid(), scan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade, selected_variant_id uuid references public.card_variants(id),
  outcome text not null, created_at timestamptz not null default now(),
  foreign key (scan_id, user_id) references public.card_scans(id, user_id) on delete cascade
);
create index if not exists scan_feedback_scan_owner_idx on public.scan_feedback(scan_id, user_id);
create index if not exists scan_feedback_selected_variant_idx on public.scan_feedback(selected_variant_id);
create index if not exists scan_feedback_owner_idx on public.scan_feedback(user_id);

create table if not exists public.price_sources (
  id uuid primary key default gen_random_uuid(), provider text not null unique, attribution text not null,
  terms_url text, status text not null default 'evaluation', capabilities jsonb not null default '{}'::jsonb
);
create table if not exists public.provider_policies (
  source_id uuid primary key references public.price_sources(id) on delete cascade,
  commercial_authorized boolean not null default false, derived_metrics_allowed boolean not null default false,
  raw_retention_days integer check(raw_retention_days is null or raw_retention_days >= 0),
  attribution_requirements text, contract_reference text, reviewed_at timestamptz, review_due_at timestamptz
);
create table if not exists public.price_products (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references public.price_sources(id), variant_id uuid not null references public.card_variants(id),
  external_id text not null, condition text, grading_company text, grade numeric(4,2), currency text not null check(currency ~ '^[A-Z]{3}$'),
  unique(source_id,external_id,condition,grading_company,grade)
);
create index if not exists price_products_variant_idx on public.price_products(variant_id);
create table if not exists public.price_snapshots (
  id bigint generated always as identity primary key, product_id uuid not null references public.price_products(id),
  price_type text not null, amount numeric(14,2) not null check(amount >= 0), observed_at timestamptz, retrieved_at timestamptz not null default now(),
  provider_url text, quality jsonb not null default '{}'::jsonb
);
create index if not exists price_snapshots_product_time_idx on public.price_snapshots(product_id,retrieved_at desc);
create index if not exists price_snapshots_observed_idx on public.price_snapshots(product_id,price_type,observed_at desc);
create unique index if not exists price_snapshots_observation_unique on public.price_snapshots(product_id,price_type,observed_at,amount);
create table if not exists public.price_daily_metrics (
  product_id uuid not null references public.price_products(id) on delete cascade, price_type text not null, metric_date date not null,
  open_amount numeric(14,2) not null check(open_amount >= 0), high_amount numeric(14,2) not null check(high_amount >= 0),
  low_amount numeric(14,2) not null check(low_amount >= 0), close_amount numeric(14,2) not null check(close_amount >= 0),
  average_amount numeric(14,2) not null check(average_amount >= 0), sample_count integer not null check(sample_count > 0),
  computed_at timestamptz not null default now(), primary key(product_id, price_type, metric_date)
);
create index if not exists price_daily_metrics_date_idx on public.price_daily_metrics(product_id,metric_date desc);
create or replace function public.refresh_price_daily_metrics(target_date date default current_date)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  insert into public.price_daily_metrics(product_id,price_type,metric_date,open_amount,high_amount,low_amount,close_amount,average_amount,sample_count,computed_at)
  select product_id, price_type, target_date,
    (array_agg(amount order by coalesce(observed_at,retrieved_at) asc, retrieved_at asc, id asc))[1], max(amount), min(amount),
    (array_agg(amount order by coalesce(observed_at,retrieved_at) desc, retrieved_at desc, id desc))[1], avg(amount), count(*)::integer, now()
  from public.price_snapshots
  where (coalesce(observed_at,retrieved_at) at time zone 'UTC')::date = target_date
  group by product_id,price_type
  on conflict(product_id,price_type,metric_date) do update set
    open_amount=excluded.open_amount, high_amount=excluded.high_amount, low_amount=excluded.low_amount,
    close_amount=excluded.close_amount, average_amount=excluded.average_amount, sample_count=excluded.sample_count, computed_at=excluded.computed_at;
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function public.refresh_price_daily_metrics(date) from public, anon, authenticated;
create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.price_products(id),
  provider_sale_id text not null, amount numeric(14,2) not null, currency text not null, sold_at timestamptz not null,
  source_url text, title text, sale_type text, listing_condition text, grading_company text, grade numeric(4,2),
  match_confidence numeric(5,4) check(match_confidence between 0 and 1), quality jsonb not null default '{}'::jsonb,
  unique(product_id,provider_sale_id)
);
create table if not exists public.pricing_sync_runs (
  id uuid primary key default gen_random_uuid(), provider text not null, status text not null,
  cursor text, products_processed integer not null default 0, failures integer not null default 0,
  started_at timestamptz not null default now(), finished_at timestamptz
);
create table if not exists public.purchase_transactions (
  id uuid primary key default gen_random_uuid(), owned_copy_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0), currency text not null check(currency ~ '^[A-Z]{3}$'),
  transacted_at date not null, source text, notes text check (char_length(notes) <= 10000), created_at timestamptz not null default now(),
  foreign key (owned_copy_id, user_id) references public.owned_copies(id, user_id) on delete cascade
);
create index if not exists purchase_transactions_copy_owner_idx on public.purchase_transactions(owned_copy_id, user_id);
create index if not exists purchase_transactions_owner_idx on public.purchase_transactions(user_id);
create table if not exists public.sale_transactions (
  id uuid primary key default gen_random_uuid(), owned_copy_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0), fees numeric(14,2) not null default 0 check (fees >= 0),
  currency text not null check(currency ~ '^[A-Z]{3}$'), transacted_at date not null, source text,
  notes text check (char_length(notes) <= 10000), created_at timestamptz not null default now(),
  foreign key (owned_copy_id, user_id) references public.owned_copies(id, user_id) on delete cascade
);
create index if not exists sale_transactions_copy_owner_idx on public.sale_transactions(owned_copy_id, user_id);
create index if not exists sale_transactions_owner_idx on public.sale_transactions(user_id);
create table if not exists public.valuation_snapshots (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null, total numeric(16,2) not null,
  currency text not null check(currency ~ '^[A-Z]{3}$'), priced_items integer not null, unpriced_items integer not null, observed_at timestamptz not null default now(),
  foreign key (collection_id, user_id) references public.collections(id, user_id) on delete cascade
);
create index if not exists valuation_snapshots_collection_owner_idx on public.valuation_snapshots(collection_id, user_id);
create index if not exists valuation_snapshots_owner_idx on public.valuation_snapshots(user_id);

create table if not exists public.import_jobs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, status text not null, totals jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists public.export_jobs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, status text not null, created_at timestamptz not null default now(), expires_at timestamptz);
create table if not exists public.provider_health_events (id bigint generated always as identity primary key, provider text not null, status text not null, latency_ms integer, occurred_at timestamptz not null default now());
create table if not exists public.audit_events (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, occurred_at timestamptz not null default now());
create index if not exists import_jobs_owner_idx on public.import_jobs(user_id);
create index if not exists export_jobs_owner_idx on public.export_jobs(user_id);
create index if not exists audit_events_owner_idx on public.audit_events(user_id);

-- Exposed canonical data is read-only to signed-in users. User data is ownership-scoped.
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.card_sets enable row level security;
alter table public.set_external_ids enable row level security;
alter table public.cards enable row level security;
alter table public.card_variants enable row level security;
alter table public.card_external_ids enable row level security;
alter table public.variant_external_ids enable row level security;
alter table public.card_images enable row level security;
alter table public.catalog_sync_runs enable row level security;
alter table public.catalog_sync_targets enable row level security;
alter table public.scheduler_credentials enable row level security;
alter table public.catalog_coverage_snapshots enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.owned_copies enable row level security;
alter table public.collection_tags enable row level security;
alter table public.collection_item_tags enable row level security;
alter table public.saved_views enable row level security;
alter table public.card_scans enable row level security;
alter table public.scan_candidates enable row level security;
alter table public.scan_feedback enable row level security;
alter table public.price_sources enable row level security;
alter table public.provider_policies enable row level security;
alter table public.price_products enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.price_daily_metrics enable row level security;
alter table public.sales_records enable row level security;
alter table public.pricing_sync_runs enable row level security;
alter table public.purchase_transactions enable row level security;
alter table public.sale_transactions enable row level security;
alter table public.valuation_snapshots enable row level security;
alter table public.import_jobs enable row level security;
alter table public.export_jobs enable row level security;
alter table public.provider_health_events enable row level security;
alter table public.audit_events enable row level security;

-- Run once in a fresh project. Policies intentionally use SELECT wrappers for stable plans.
drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "subscriptions own rows" on public.subscriptions;
drop policy if exists "usage own rows" on public.usage_events;
drop policy if exists "collections own rows" on public.collections;
drop policy if exists "items own rows" on public.collection_items;
drop policy if exists "copies own rows" on public.owned_copies;
drop policy if exists "tags own rows" on public.collection_tags;
drop policy if exists "item tags own rows" on public.collection_item_tags;
drop policy if exists "views own rows" on public.saved_views;
drop policy if exists "scans own rows" on public.card_scans;
drop policy if exists "scan candidates via scan" on public.scan_candidates;
drop policy if exists "feedback own rows" on public.scan_feedback;
drop policy if exists "purchases own rows" on public.purchase_transactions;
drop policy if exists "sales own rows" on public.sale_transactions;
drop policy if exists "valuations own rows" on public.valuation_snapshots;
drop policy if exists "imports own rows" on public.import_jobs;
drop policy if exists "exports own rows" on public.export_jobs;
drop policy if exists "catalog sets read" on public.card_sets;
drop policy if exists "catalog set ids read" on public.set_external_ids;
drop policy if exists "catalog cards read" on public.cards;
drop policy if exists "catalog variants read" on public.card_variants;
drop policy if exists "catalog ids read" on public.card_external_ids;
drop policy if exists "variant ids read" on public.variant_external_ids;
drop policy if exists "catalog images read" on public.card_images;
drop policy if exists "catalog coverage read" on public.catalog_coverage_snapshots;
drop policy if exists "price sources read" on public.price_sources;
drop policy if exists "price products read" on public.price_products;
drop policy if exists "price snapshots read" on public.price_snapshots;
drop policy if exists "price daily metrics read" on public.price_daily_metrics;
drop policy if exists "sales records read" on public.sales_records;

create policy "profiles own rows" on public.profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy "subscriptions own rows" on public.subscriptions for select to authenticated using ((select auth.uid())=user_id);
create policy "usage own rows" on public.usage_events for select to authenticated using ((select auth.uid())=user_id);
create policy "collections own rows" on public.collections for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "items own rows" on public.collection_items for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "copies own rows" on public.owned_copies for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "tags own rows" on public.collection_tags for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "item tags own rows" on public.collection_item_tags for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "views own rows" on public.saved_views for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "scans own rows" on public.card_scans for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "scan candidates via scan" on public.scan_candidates for select to authenticated using (exists(select 1 from public.card_scans s where s.id=scan_id and s.user_id=(select auth.uid())));
create policy "feedback own rows" on public.scan_feedback for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "purchases own rows" on public.purchase_transactions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "sales own rows" on public.sale_transactions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "valuations own rows" on public.valuation_snapshots for select to authenticated using ((select auth.uid())=user_id);
create policy "imports own rows" on public.import_jobs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "exports own rows" on public.export_jobs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "catalog sets read" on public.card_sets for select to authenticated using (true);
create policy "catalog set ids read" on public.set_external_ids for select to authenticated using (true);
create policy "catalog cards read" on public.cards for select to authenticated using (true);
create policy "catalog variants read" on public.card_variants for select to authenticated using (true);
create policy "catalog ids read" on public.card_external_ids for select to authenticated using (true);
create policy "variant ids read" on public.variant_external_ids for select to authenticated using (true);
create policy "catalog images read" on public.card_images for select to authenticated using (true);
create policy "catalog coverage read" on public.catalog_coverage_snapshots for select to authenticated using (true);
create policy "price sources read" on public.price_sources for select to authenticated using (true);
create policy "price products read" on public.price_products for select to authenticated using (true);
create policy "price snapshots read" on public.price_snapshots for select to authenticated using (true);
create policy "price daily metrics read" on public.price_daily_metrics for select to authenticated using (true);
create policy "sales records read" on public.sales_records for select to authenticated using (true);

-- Tables created in public may otherwise inherit broad Data API grants. Make client access explicit.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.collections, public.collection_items, public.owned_copies, public.collection_tags, public.collection_item_tags, public.saved_views, public.card_scans, public.scan_feedback, public.purchase_transactions, public.sale_transactions, public.import_jobs, public.export_jobs to authenticated;
grant select on public.subscriptions, public.usage_events, public.scan_candidates, public.valuation_snapshots, public.card_sets, public.set_external_ids, public.cards, public.card_variants, public.card_external_ids, public.variant_external_ids, public.card_images, public.catalog_coverage_snapshots, public.price_sources, public.price_products, public.price_snapshots, public.price_daily_metrics, public.sales_records to authenticated;

-- Seller workflow additions are owner-protected by the collection_items RLS policy above.
alter table public.collection_items
  add column if not exists asking_price numeric(14,2) check (asking_price is null or asking_price >= 0),
  add column if not exists listing_venue text check (listing_venue is null or char_length(listing_venue) <= 100),
  add column if not exists listed_at date check (listed_at is null or listed_at <= current_date),
  add column if not exists price_reviewed_at date check (price_reviewed_at is null or price_reviewed_at <= current_date);
create index if not exists collection_items_owner_active_listing_idx on public.collection_items(user_id,status,listed_at desc) where status='listed';
-- Cover foreign keys used by cleanup, joins, and provider reconciliation.
create index if not exists card_provider_mappings_variant_idx
  on public.card_provider_mappings(card_variant_id);
create index if not exists fifo_lot_allocations_purchase_lot_idx
  on public.fifo_lot_allocations(purchase_lot_id);
create index if not exists price_anomalies_card_idx
  on public.price_anomalies(card_id);
create index if not exists price_anomalies_observation_idx
  on public.price_anomalies(price_observation_id);
create index if not exists price_observations_variant_idx
  on public.price_observations(card_variant_id);
