-- Resumable multilingual catalog ingestion and durable price-history rollups.
create table if not exists public.set_external_ids (
  set_id uuid not null references public.card_sets(id) on delete cascade, provider text not null, external_id text not null,
  primary key(provider, external_id)
);
alter table public.card_sets add column if not exists canonical_key text;
create unique index if not exists card_sets_canonical_key_unique on public.card_sets(language,canonical_key);
create index if not exists set_external_ids_set_idx on public.set_external_ids(set_id);
create unique index if not exists price_snapshots_observation_unique
  on public.price_snapshots(product_id,price_type,observed_at,amount);

create or replace function public.refresh_price_daily_metrics(target_date date default current_date)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  insert into public.price_daily_metrics(product_id,price_type,metric_date,open_amount,high_amount,low_amount,close_amount,average_amount,sample_count,computed_at)
  select product_id, price_type, target_date,
    (array_agg(amount order by coalesce(observed_at,retrieved_at) asc))[1], max(amount), min(amount),
    (array_agg(amount order by coalesce(observed_at,retrieved_at) desc))[1], avg(amount), count(*)::integer, now()
  from public.price_snapshots
  where coalesce(observed_at,retrieved_at)::date = target_date
  group by product_id,price_type
  on conflict(product_id,price_type,metric_date) do update set
    open_amount=excluded.open_amount, high_amount=excluded.high_amount, low_amount=excluded.low_amount,
    close_amount=excluded.close_amount, average_amount=excluded.average_amount, sample_count=excluded.sample_count, computed_at=excluded.computed_at;
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function public.refresh_price_daily_metrics(date) from public, anon, authenticated;

alter table public.set_external_ids enable row level security;
drop policy if exists "catalog set ids read" on public.set_external_ids;
create policy "catalog set ids read" on public.set_external_ids for select to authenticated using (true);
revoke all on public.set_external_ids from anon, authenticated;
grant select on public.set_external_ids to authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'refresh-current-price-daily-metrics',
  '15 * * * *',
  $job$select public.refresh_price_daily_metrics((now() at time zone 'UTC')::date);$job$
);
