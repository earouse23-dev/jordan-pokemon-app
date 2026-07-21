-- A ledger event entered after its historical date changes what inventory was
-- represented by earlier snapshots. Restart rather than mislabel that backfill
-- as current market performance. Zero-cost additions are non-cash inventory
-- contributions whose entry value is unknown, so they also restart.

create or replace function public.reset_valuation_history_after_backdated_ledger()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  target_collection uuid;
  acquisition_date_known boolean := true;
begin
  if new.transaction_type not in ('purchase','sale','trade_in','trade_out','adjustment') then return new; end if;
  select item.collection_id,
         case when new.transaction_type='purchase'
           then item.identity_snapshot->>'acquisitionDateKnown' is distinct from 'false'
           else true end
  into target_collection,acquisition_date_known
  from public.collection_items item
  where item.id=new.collection_item_id and item.user_id=new.user_id;
  if target_collection is not null and (
    new.transaction_date<current_date
    or not acquisition_date_known
    or (new.transaction_type in ('purchase','trade_in') and coalesce(new.total_cost,0)=0)
  ) then
    delete from public.valuation_snapshots snapshot
    where snapshot.collection_id=target_collection and snapshot.user_id=new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists reset_valuation_history_after_backdated_ledger on public.collection_transactions;
create trigger reset_valuation_history_after_backdated_ledger
after insert on public.collection_transactions
for each row execute function public.reset_valuation_history_after_backdated_ledger();
revoke all on function public.reset_valuation_history_after_backdated_ledger() from public,anon,authenticated;
