alter table public.collection_items
  add column if not exists asking_price numeric(14,2)
    check (asking_price is null or asking_price >= 0),
  add column if not exists listing_venue text
    check (listing_venue is null or char_length(listing_venue) <= 100),
  add column if not exists listed_at date
    check (listed_at is null or listed_at <= current_date),
  add column if not exists price_reviewed_at date
    check (price_reviewed_at is null or price_reviewed_at <= current_date);

create index if not exists collection_items_owner_active_listing_idx
  on public.collection_items(user_id,status,listed_at desc)
  where status='listed';

create or replace function public.get_portfolio_price_history(p_days integer default 400,p_per_position integer default 400)
returns table(
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
      and item.status in ('owned','listed')
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
