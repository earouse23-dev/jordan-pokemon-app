-- Record one owner-visible valuation baseline per UTC day. The client supplies
-- the same exact-compatible total it displays; ledger cash flows are applied
-- separately when the UI derives market-only performance.

alter table public.valuation_snapshots
  add column if not exists snapshot_date date not null default current_date;

create unique index if not exists valuation_snapshots_owner_currency_day_idx
  on public.valuation_snapshots(collection_id,user_id,currency,snapshot_date);
create index if not exists valuation_snapshots_owner_day_idx
  on public.valuation_snapshots(user_id,snapshot_date desc);

drop policy if exists "valuation snapshots own inserts" on public.valuation_snapshots;
create policy "valuation snapshots own inserts" on public.valuation_snapshots
  for insert to authenticated
  with check ((select auth.uid())=user_id);
drop policy if exists "valuation snapshots own updates" on public.valuation_snapshots;
create policy "valuation snapshots own updates" on public.valuation_snapshots
  for update to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
drop policy if exists "valuation snapshots own deletes" on public.valuation_snapshots;
create policy "valuation snapshots own deletes" on public.valuation_snapshots
  for delete to authenticated
  using ((select auth.uid())=user_id);

grant select,insert,update,delete on public.valuation_snapshots to authenticated;
grant usage,select on sequence public.valuation_snapshots_id_seq to authenticated;

create or replace function public.record_portfolio_valuation_snapshot(
  p_total numeric,
  p_currency text,
  p_priced_items integer,
  p_unpriced_items integer
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
  if p_priced_items is null or p_unpriced_items is null or p_priced_items<0 or p_unpriced_items<0
    or p_priced_items>10000000 or p_unpriced_items>10000000
    or p_priced_items+p_unpriced_items=0 then raise exception 'invalid_valuation_coverage'; end if;

  select collection.id into target_collection
  from public.collections collection
  where collection.user_id=owner_id
  order by collection.created_at,collection.id limit 1;
  if target_collection is null then raise exception 'collection_not_found'; end if;

  insert into public.valuation_snapshots(
    user_id,collection_id,total,currency,priced_items,unpriced_items,snapshot_date,observed_at
  ) values(
    owner_id,target_collection,round(p_total,2),normalized_currency,p_priced_items,p_unpriced_items,current_date,now()
  )
  on conflict (collection_id,user_id,currency,snapshot_date) do update
  set total=excluded.total,priced_items=excluded.priced_items,unpriced_items=excluded.unpriced_items,observed_at=now()
  where public.valuation_snapshots.user_id=owner_id
  returning id into target_snapshot;
  return target_snapshot;
end $$;

revoke all on function public.record_portfolio_valuation_snapshot(numeric,text,integer,integer) from public,anon;
grant execute on function public.record_portfolio_valuation_snapshot(numeric,text,integer,integer) to authenticated;

create or replace function public.delete_collection_position(
  p_collection_item_id uuid
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target_collection uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select item.collection_id into target_collection
  from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id for update;
  if target_collection is null then raise exception 'position_not_found'; end if;
  delete from public.valuation_snapshots snapshot
  where snapshot.collection_id=target_collection and snapshot.user_id=owner_id;
  delete from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id;
  return p_collection_item_id;
end $$;

revoke all on function public.delete_collection_position(uuid) from public,anon;
grant execute on function public.delete_collection_position(uuid) to authenticated;

create or replace function public.reset_valuation_history_after_identity_correction()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.identity_snapshot - 'acquisitionCostKnown' - 'acquisitionDateKnown')
    is distinct from
    (old.identity_snapshot - 'acquisitionCostKnown' - 'acquisitionDateKnown') then
    delete from public.valuation_snapshots snapshot
    where snapshot.collection_id=old.collection_id and snapshot.user_id=old.user_id;
  end if;
  return new;
end $$;
drop trigger if exists reset_valuation_history_after_identity_correction on public.collection_items;
create trigger reset_valuation_history_after_identity_correction
after update of identity_snapshot on public.collection_items
for each row execute function public.reset_valuation_history_after_identity_correction();
revoke all on function public.reset_valuation_history_after_identity_correction() from public,anon,authenticated;
