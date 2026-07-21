-- A split creates independently completable positions. Require the source lot
-- history first so reconstructed acquisition cash flow never becomes attached
-- to the split date or counted twice across positions.

create or replace function public.require_complete_basis_for_position_split()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (not new.cost_basis_known or not new.acquired_at_known) and exists(
    select 1 from public.collection_transactions transaction
    where transaction.id=new.purchase_transaction_id
      and transaction.user_id=new.user_id
      and transaction.collection_item_id=new.collection_item_id
      and transaction.transaction_type='position_split'
  ) then raise exception 'split_requires_complete_acquisition_history'; end if;
  return new;
end $$;

drop trigger if exists require_complete_basis_for_position_split on public.purchase_lots;
create trigger require_complete_basis_for_position_split
before insert on public.purchase_lots
for each row execute function public.require_complete_basis_for_position_split();

revoke all on function public.require_complete_basis_for_position_split()
from public,anon,authenticated;
