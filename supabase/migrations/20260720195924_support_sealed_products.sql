-- Sealed products reuse the existing private portfolio ledger, FIFO lots, and RLS.
-- Product identity remains in identity_snapshot; card_id and variant_id are null.

alter table public.collection_items
  drop constraint if exists collection_items_card_state_check;

alter table public.collection_items
  add constraint collection_items_card_state_check
  check (card_state in ('raw','graded','sealed'));

alter table public.collection_items
  drop constraint if exists collection_items_market_state_check;

alter table public.collection_items
  add constraint collection_items_market_state_check
  check (
    (card_state='raw' and raw_condition is not null and grader is null and grade is null)
    or (card_state='graded' and raw_condition is null and grader is not null and grade is not null)
    or (card_state='sealed' and raw_condition is null and grader is null and grade is null)
  ) not valid;

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
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_transaction_date > current_date then raise exception 'future_acquisition_date'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if p_unit_price < 0 or least(coalesce(p_tax,0),coalesce(p_shipping,0),coalesce(p_marketplace_fees,0),coalesce(p_grading_fees,0),coalesce(p_other_costs,0)) < 0 then
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
    user_id,collection_item_id,purchase_transaction_id,acquired_at,quantity_acquired,quantity_remaining,total_cost,remaining_cost,currency
  ) values(owner_id,target_item,target_transaction,p_transaction_date,p_quantity,p_quantity,total_amount,total_amount,upper(p_currency));
  return target_item;
end $$;

comment on constraint collection_items_card_state_check on public.collection_items is
  'Portfolio positions may be raw cards, graded cards, or sealed products.';
