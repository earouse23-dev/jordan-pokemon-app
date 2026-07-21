-- Cross-app inventory exports often omit historical purchase cost and date.
-- Preserve FIFO quantities while keeping unknown accounting inputs out of profit.

alter table public.purchase_lots
  add column if not exists cost_basis_known boolean not null default true,
  add column if not exists acquired_at_known boolean not null default true;

alter table public.fifo_lot_allocations
  add column if not exists cost_basis_known boolean not null default true;

comment on column public.purchase_lots.cost_basis_known is
  'False when an imported source did not provide historical acquisition cost; numeric zero is storage-only and must not be reported as basis.';
comment on column public.purchase_lots.acquired_at_known is
  'False when acquired_at is an import ordering date because the source did not provide the historical acquisition date.';
comment on column public.fifo_lot_allocations.cost_basis_known is
  'Copies the source lot basis status so realized profit remains unknown after FIFO allocation.';

create or replace function public.create_collection_position(
  p_identity jsonb,
  p_card_id uuid,
  p_variant_id uuid,
  p_card_state text,
  p_raw_condition text,
  p_grader text,
  p_grade numeric,
  p_certification_number text,
  p_quantity integer,
  p_transaction_date date,
  p_unit_price numeric,
  p_tax numeric default 0,
  p_shipping numeric default 0,
  p_marketplace_fees numeric default 0,
  p_grading_fees numeric default 0,
  p_other_costs numeric default 0,
  p_currency text default 'USD',
  p_marketplace text default null,
  p_notes text default null,
  p_idempotency_key text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target_collection uuid;
  target_item uuid;
  target_transaction uuid;
  subtotal_amount numeric(14,2);
  total_amount numeric(14,2);
  basis_known boolean := case when p_identity->>'acquisitionCostKnown'='false' then false else true end;
  acquired_date_known boolean := case when p_identity->>'acquisitionDateKnown'='false' then false else true end;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_transaction_date > current_date then raise exception 'future_acquisition_date'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if p_unit_price is null or p_unit_price < 0 or least(coalesce(p_tax,0),coalesce(p_shipping,0),coalesce(p_marketplace_fees,0),coalesce(p_grading_fees,0),coalesce(p_other_costs,0)) < 0 then
    raise exception 'invalid_cost';
  end if;
  if p_card_state not in ('raw','graded','sealed') then raise exception 'invalid_card_state'; end if;
  if p_card_state='raw' and (p_raw_condition is null or p_grader is not null or p_grade is not null) then raise exception 'invalid_raw_state'; end if;
  if p_card_state='graded' and (p_raw_condition is not null or p_grader is null or p_grade is null) then raise exception 'invalid_graded_state'; end if;
  if p_card_state='sealed' and (p_raw_condition is not null or p_grader is not null or p_grade is not null) then raise exception 'invalid_sealed_state'; end if;

  select id into target_collection from public.collections where user_id=owner_id order by created_at,id limit 1;
  if target_collection is null then
    insert into public.collections(user_id,name) values(owner_id,'My collection') returning id into target_collection;
  end if;

  insert into public.collection_items(
    collection_id,user_id,card_id,variant_id,identity_snapshot,card_state,raw_condition,grader,grade,
    certification_number,quantity,notes,status,currency
  ) values(
    target_collection,owner_id,p_card_id,p_variant_id,coalesce(p_identity,'{}'::jsonb),p_card_state,p_raw_condition,upper(p_grader),p_grade,
    nullif(p_certification_number,''),p_quantity,p_notes,'owned',upper(p_currency)
  ) returning id into target_item;

  subtotal_amount := round(p_unit_price*p_quantity,2);
  total_amount := subtotal_amount+coalesce(p_tax,0)+coalesce(p_shipping,0)+coalesce(p_marketplace_fees,0)+coalesce(p_grading_fees,0)+coalesce(p_other_costs,0);
  insert into public.collection_transactions(
    user_id,collection_item_id,transaction_type,transaction_date,quantity,unit_price,subtotal,tax,shipping,
    marketplace_fees,grading_fees,other_costs,total_cost,currency,marketplace,notes,idempotency_key
  ) values(
    owner_id,target_item,'purchase',p_transaction_date,p_quantity,p_unit_price,subtotal_amount,coalesce(p_tax,0),coalesce(p_shipping,0),
    coalesce(p_marketplace_fees,0),coalesce(p_grading_fees,0),coalesce(p_other_costs,0),total_amount,upper(p_currency),p_marketplace,p_notes,p_idempotency_key
  ) returning id into target_transaction;

  insert into public.purchase_lots(
    user_id,collection_item_id,purchase_transaction_id,acquired_at,quantity_acquired,quantity_remaining,total_cost,remaining_cost,currency,cost_basis_known,acquired_at_known
  ) values(
    owner_id,target_item,target_transaction,p_transaction_date,p_quantity,p_quantity,total_amount,total_amount,upper(p_currency),basis_known,acquired_date_known
  );
  return target_item;
end $$;

create or replace function public.record_collection_sale(
  p_collection_item_id uuid,
  p_transaction_date date,
  p_quantity integer,
  p_unit_price numeric,
  p_marketplace_fees numeric default 0,
  p_shipping numeric default 0,
  p_other_costs numeric default 0,
  p_currency text default 'USD',
  p_marketplace text default null,
  p_notes text default null,
  p_idempotency_key text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  item_quantity integer;
  remaining integer := p_quantity;
  sale_id uuid;
  lot record;
  take_quantity integer;
  take_cost numeric(14,2);
  subtotal_amount numeric(14,2);
  proceeds_amount numeric(14,2);
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_transaction_date > current_date then raise exception 'future_transaction_date'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  select quantity into item_quantity from public.collection_items where id=p_collection_item_id and user_id=owner_id for update;
  if item_quantity is null then raise exception 'position_not_found'; end if;
  if p_quantity > item_quantity then raise exception 'insufficient_quantity'; end if;

  subtotal_amount := round(p_unit_price*p_quantity,2);
  proceeds_amount := greatest(0,subtotal_amount-coalesce(p_marketplace_fees,0)-coalesce(p_shipping,0)-coalesce(p_other_costs,0));
  insert into public.collection_transactions(
    user_id,collection_item_id,transaction_type,transaction_date,quantity,unit_price,subtotal,shipping,marketplace_fees,
    other_costs,total_cost,net_proceeds,currency,marketplace,notes,idempotency_key
  ) values(
    owner_id,p_collection_item_id,'sale',p_transaction_date,p_quantity,p_unit_price,subtotal_amount,coalesce(p_shipping,0),coalesce(p_marketplace_fees,0),
    coalesce(p_other_costs,0),0,proceeds_amount,upper(p_currency),p_marketplace,p_notes,p_idempotency_key
  ) returning id into sale_id;

  for lot in
    select * from public.purchase_lots
    where collection_item_id=p_collection_item_id and user_id=owner_id and quantity_remaining>0
    order by acquired_at,id for update
  loop
    exit when remaining=0;
    take_quantity := least(remaining,lot.quantity_remaining);
    take_cost := case when take_quantity=lot.quantity_remaining then lot.remaining_cost
      else round(lot.remaining_cost*take_quantity/lot.quantity_remaining,2) end;
    insert into public.fifo_lot_allocations(user_id,sale_transaction_id,purchase_lot_id,quantity,allocated_cost,cost_basis_known)
      values(owner_id,sale_id,lot.id,take_quantity,take_cost,lot.cost_basis_known);
    update public.purchase_lots set quantity_remaining=quantity_remaining-take_quantity,remaining_cost=remaining_cost-take_cost where id=lot.id;
    remaining := remaining-take_quantity;
  end loop;
  if remaining>0 then raise exception 'fifo_lots_incomplete'; end if;
  update public.collection_items set quantity=quantity-p_quantity,status=case when quantity-p_quantity=0 then 'sold' else status end,updated_at=now()
    where id=p_collection_item_id and user_id=owner_id;
  return sale_id;
end $$;

create or replace view public.portfolio_position_summary with (security_invoker=true) as
select
  item.id,item.user_id,item.identity_snapshot,item.card_id,item.variant_id,item.card_state,item.raw_condition,item.grader,item.grade,
  item.certification_number,item.quantity,item.status,item.currency,item.created_at,item.updated_at,
  lots.remaining_cost_basis::numeric(14,2) as remaining_cost_basis,
  sales.allocated_sold_cost::numeric(14,2) as allocated_sold_cost,
  coalesce(sales.net_sale_proceeds,0)::numeric(14,2) as net_sale_proceeds,
  lots.first_acquired_at
from public.collection_items item
left join lateral (
  select
    case
      when count(*) filter (where lot.quantity_remaining>0)=0 then 0
      when bool_and(lot.cost_basis_known) filter (where lot.quantity_remaining>0)
        then sum(lot.remaining_cost) filter (where lot.quantity_remaining>0)
      else null
    end remaining_cost_basis,
    min(lot.acquired_at) filter (where lot.acquired_at_known) first_acquired_at
  from public.purchase_lots lot where lot.collection_item_id=item.id and lot.user_id=item.user_id
) lots on true
left join lateral (
  select sum(sale.net_proceeds) net_sale_proceeds,
    (select case
      when count(*)=0 then 0
      when bool_and(allocation.cost_basis_known) then sum(allocation.allocated_cost)
      else null
    end from public.fifo_lot_allocations allocation
      where allocation.user_id=item.user_id and allocation.sale_transaction_id in
        (select transaction.id from public.collection_transactions transaction
         where transaction.collection_item_id=item.id and transaction.user_id=item.user_id and transaction.transaction_type='sale')) allocated_sold_cost
  from public.collection_transactions sale
  where sale.collection_item_id=item.id and sale.user_id=item.user_id and sale.transaction_type='sale'
) sales on true;

grant select on public.portfolio_position_summary to authenticated;
