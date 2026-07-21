-- A compatible but stale quote is still useful for a value view, but it must
-- not qualify a cash-adjusted result as trustworthy market performance.

alter table public.valuation_snapshots
  add column if not exists fresh_items integer not null default 0
  check (fresh_items>=0 and fresh_items<=priced_items);

drop function if exists public.record_portfolio_valuation_snapshot(numeric,text,integer,integer);
create or replace function public.record_portfolio_valuation_snapshot(
  p_total numeric,
  p_currency text,
  p_priced_items integer,
  p_unpriced_items integer,
  p_fresh_items integer
) returns bigint language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target_collection uuid;
  target_snapshot bigint;
  normalized_currency text := upper(trim(coalesce(p_currency,'')));
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_total is null or p_total<0 or p_total>99999999999999.99 then raise exception 'invalid_valuation_total'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_currency'; end if;
  if p_priced_items is null or p_unpriced_items is null or p_fresh_items is null
    or p_priced_items<0 or p_unpriced_items<0 or p_fresh_items<0 or p_fresh_items>p_priced_items
    or p_priced_items>10000000 or p_unpriced_items>10000000
    or p_priced_items+p_unpriced_items=0 then raise exception 'invalid_valuation_coverage'; end if;

  select collection.id into target_collection
  from public.collections collection
  where collection.user_id=owner_id
  order by collection.created_at,collection.id limit 1;
  if target_collection is null then raise exception 'collection_not_found'; end if;

  insert into public.valuation_snapshots(
    user_id,collection_id,total,currency,priced_items,unpriced_items,fresh_items,snapshot_date,observed_at
  ) values(
    owner_id,target_collection,round(p_total,2),normalized_currency,p_priced_items,p_unpriced_items,p_fresh_items,current_date,now()
  )
  on conflict (collection_id,user_id,currency,snapshot_date) do update
  set total=excluded.total,priced_items=excluded.priced_items,unpriced_items=excluded.unpriced_items,
      fresh_items=excluded.fresh_items,observed_at=now()
  where public.valuation_snapshots.user_id=owner_id
  returning id into target_snapshot;
  return target_snapshot;
end $$;

revoke all on function public.record_portfolio_valuation_snapshot(numeric,text,integer,integer,integer) from public,anon;
grant execute on function public.record_portfolio_valuation_snapshot(numeric,text,integer,integer,integer) to authenticated;
