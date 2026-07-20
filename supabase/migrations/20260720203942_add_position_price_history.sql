-- Durable, owner-scoped price history for positions that do not yet map to the internal catalog.
create table if not exists public.position_price_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null references public.collection_items(id) on delete cascade,
  aggregator text not null default 'pkmnprices',
  provider text not null,
  provider_variant_id text not null default '',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  valuation_type text not null check (valuation_type in ('market','average_sale','low','high','provider_estimate')),
  finish text not null,
  card_state text not null check (card_state in ('raw','graded','sealed')),
  raw_condition text not null default '' check (raw_condition in ('','near_mint','lightly_played','moderately_played','heavily_played','damaged')),
  provider_condition text,
  grader text not null default '',
  grade numeric(4,1) check (grade is null or grade between 1 and 10),
  grade_label text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  price_low numeric(14,2) check (price_low is null or price_low >= 0),
  price_high numeric(14,2) check (price_high is null or price_high >= 0),
  sales_count integer check (sales_count is null or sales_count >= 0),
  granularity text not null default 'observation' check (granularity in ('observation','day')),
  quality jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (card_state='raw' and raw_condition<>'' and grader='' and grade is null and grade_label='')
    or (card_state='graded' and raw_condition='' and grader<>'' and grade is not null and grade_label<>'')
    or (card_state='sealed' and raw_condition='' and grader='' and grade is null and grade_label='')
  ),
  unique (
    collection_item_id,provider,provider_variant_id,currency,valuation_type,card_state,
    raw_condition,grader,grade_label,observed_at,amount
  )
);

create index if not exists position_price_observations_owner_item_time_idx
  on public.position_price_observations(user_id,collection_item_id,observed_at desc);
create index if not exists position_price_observations_item_time_idx
  on public.position_price_observations(collection_item_id,observed_at desc);

alter table public.position_price_observations enable row level security;

drop policy if exists "position price history owners can read" on public.position_price_observations;
create policy "position price history owners can read" on public.position_price_observations
  for select to authenticated using ((select auth.uid())=user_id);

revoke all on public.position_price_observations from public,anon,authenticated;
grant select on public.position_price_observations to authenticated;
grant all on public.position_price_observations to service_role;

create or replace function public.get_portfolio_price_history(
  p_days integer default 400,
  p_per_position integer default 400
) returns table (
  collection_item_id uuid,
  provider text,
  provider_variant_id text,
  currency text,
  valuation_type text,
  finish text,
  card_state text,
  raw_condition text,
  provider_condition text,
  grader text,
  grade numeric,
  grade_label text,
  amount numeric,
  price_low numeric,
  price_high numeric,
  sales_count integer,
  granularity text,
  quality jsonb,
  observed_at timestamptz
) language sql stable security invoker set search_path='' as $$
  with ranked as (
    select observation.*,
      row_number() over (
        partition by observation.collection_item_id
        order by observation.observed_at desc,observation.id desc
      ) as position_rank
    from public.position_price_observations observation
    join public.collection_items item on item.id=observation.collection_item_id
    where observation.user_id=(select auth.uid())
      and item.user_id=(select auth.uid())
      and item.status='owned'
      and observation.observed_at >= now()-make_interval(days=>least(greatest(coalesce(p_days,400),1),730))
  )
  select
    ranked.collection_item_id,ranked.provider,ranked.provider_variant_id,ranked.currency,
    ranked.valuation_type,ranked.finish,ranked.card_state,ranked.raw_condition,
    ranked.provider_condition,ranked.grader,ranked.grade,ranked.grade_label,
    ranked.amount,ranked.price_low,ranked.price_high,ranked.sales_count,
    ranked.granularity,ranked.quality,ranked.observed_at
  from ranked
  where ranked.position_rank<=least(greatest(coalesce(p_per_position,400),1),500)
  order by ranked.collection_item_id,ranked.observed_at;
$$;

revoke all on function public.get_portfolio_price_history(integer,integer) from public,anon;
grant execute on function public.get_portfolio_price_history(integer,integer) to authenticated,service_role;
