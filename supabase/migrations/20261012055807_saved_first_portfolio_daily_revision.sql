-- Invalidate derived portfolios at the database boundary, including edits from
-- other devices/imports. No purchases, sales or existing snapshots are rewritten.
alter table public.portfolio_views
  add column inventory_revision bigint not null default 0,
  add column dirty_from date;

create function public.invalidate_saved_portfolio() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  before_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  after_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  owner_id uuid;
  affected_date date;
begin
  if before_row is not distinct from after_row then return null; end if;
  affected_date := least(
    coalesce(before_row->>'acquired_at', before_row->>'transaction_date', before_row->>'submitted_at', before_row->>'occurred_at')::date,
    coalesce(after_row->>'acquired_at', after_row->>'transaction_date', after_row->>'submitted_at', after_row->>'occurred_at')::date
  );
  -- A printing/grade/status change can affect all dated valuations.
  affected_date := coalesce(affected_date, date '0001-01-01');
  for owner_id in select distinct v::uuid from unnest(array[before_row->>'user_id',after_row->>'user_id']) v where v is not null loop
    if not exists(select 1 from auth.users where id=owner_id) then continue; end if;
    insert into public.portfolio_views(user_id,inventory_revision,dirty_from)
    values(owner_id,1,affected_date)
    on conflict(user_id) do update
    set inventory_revision=public.portfolio_views.inventory_revision+1,
        dirty_from=least(public.portfolio_views.dirty_from,excluded.dirty_from);
  end loop;
  return null;
end $$;
revoke all on function public.invalidate_saved_portfolio() from public,anon,authenticated;

create trigger portfolio_inventory_changed after insert or update or delete on public.collection_items for each row execute function public.invalidate_saved_portfolio();
create trigger portfolio_lots_changed after insert or update or delete on public.purchase_lots for each row execute function public.invalidate_saved_portfolio();
create trigger portfolio_transactions_changed after insert or update or delete on public.collection_transactions for each row execute function public.invalidate_saved_portfolio();
create trigger portfolio_submissions_changed after insert or update or delete on public.grading_submissions for each row execute function public.invalidate_saved_portfolio();
create trigger portfolio_lifecycle_changed after insert or update or delete on public.grading_lifecycle_events for each row execute function public.invalidate_saved_portfolio();

-- Publish total + daily series together, only if the inventory is still the one
-- read by this worker. This replaces the second complete inventory hydration.
create function public.publish_saved_portfolio(p_user_id uuid,p_token uuid,p_revision bigint,p_view jsonb,p_now timestamptz,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.portfolio_views
  set view=p_view,updated_at=p_now,error_code=p_error,
      refresh_until=null,refresh_token=null,
      dirty_from=case when (p_view->>'inventoryRevision')::bigint=p_revision then null else dirty_from end
  where user_id=p_user_id and refresh_token=p_token and inventory_revision=p_revision;
  return found;
end $$;
revoke all on function public.publish_saved_portfolio(uuid,uuid,bigint,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.publish_saved_portfolio(uuid,uuid,bigint,jsonb,timestamptz,text) to service_role;
