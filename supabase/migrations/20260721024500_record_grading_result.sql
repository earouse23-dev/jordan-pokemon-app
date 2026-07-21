-- Convert an owned raw position to its returned graded state without inventing
-- a sale and repurchase. The original purchase lots remain intact and the
-- all-in grading cost is capitalized across the copies that were actually
-- graded, preserving exact FIFO basis to the cent.

alter table public.collection_transactions
  add column if not exists grading_company text,
  add column if not exists grade numeric(4,1) check (grade is null or grade between 1 and 10),
  add column if not exists certification_number text,
  add column if not exists previous_raw_condition text
    check (previous_raw_condition is null or previous_raw_condition in ('near_mint','lightly_played','moderately_played','heavily_played','damaged'));

alter table public.collection_transactions
  drop constraint if exists collection_transactions_grading_result_check;
alter table public.collection_transactions
  add constraint collection_transactions_grading_result_check check (
    transaction_type<>'grading_return'
    or (
      grading_company is not null
      and grade is not null
      and previous_raw_condition is not null
    )
  ) not valid;

create or replace function public.record_grading_result(
  p_collection_item_id uuid,
  p_transaction_date date,
  p_grader text,
  p_grade numeric,
  p_total_grading_cost numeric,
  p_certification_number text default null,
  p_notes text default null,
  p_idempotency_key text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target_item public.collection_items%rowtype;
  target_transaction uuid;
  active_quantity integer;
  latest_known_acquisition date;
  lot_count integer;
  lot_number integer := 0;
  grading_cost_allocated numeric(14,2) := 0;
  lot_grading_cost numeric(14,2);
  normalized_grader text := upper(trim(coalesce(p_grader,'')));
  active_lot record;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_transaction_date is null or p_transaction_date > current_date then
    raise exception 'invalid_grading_date';
  end if;
  if normalized_grader !~ '^[A-Z0-9 .&-]{2,40}$' then raise exception 'invalid_grader'; end if;
  if p_grade is null or p_grade < 1 or p_grade > 10 or round(p_grade*10)<>p_grade*10 then
    raise exception 'invalid_grade';
  end if;
  if p_total_grading_cost is null or p_total_grading_cost < 0 or p_total_grading_cost > 999999999999.99 then
    raise exception 'invalid_grading_cost';
  end if;
  if char_length(coalesce(p_certification_number,'')) > 120 then raise exception 'invalid_certification_number'; end if;
  if char_length(coalesce(p_notes,'')) > 10000 then raise exception 'invalid_notes'; end if;

  select item.* into target_item
  from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id
  for update;
  if not found then raise exception 'position_not_found'; end if;
  if target_item.card_state<>'raw' then raise exception 'position_not_raw'; end if;
  if target_item.status<>'owned' or target_item.quantity<=0 then raise exception 'position_not_owned'; end if;

  select coalesce(sum(purchase_lot.quantity_remaining),0),count(*),
         max(purchase_lot.acquired_at) filter (where purchase_lot.acquired_at_known)
  into active_quantity,lot_count,latest_known_acquisition
  from public.purchase_lots purchase_lot
  where purchase_lot.collection_item_id=target_item.id
    and purchase_lot.user_id=owner_id
    and purchase_lot.quantity_remaining>0;
  if active_quantity<>target_item.quantity or lot_count=0 then raise exception 'fifo_lots_incomplete'; end if;
  if exists(
    select 1 from public.purchase_lots purchase_lot
    where purchase_lot.collection_item_id=target_item.id
      and purchase_lot.user_id=owner_id
      and purchase_lot.quantity_remaining>0
      and not purchase_lot.cost_basis_known
  ) then raise exception 'acquisition_cost_required'; end if;
  if latest_known_acquisition is not null and p_transaction_date<latest_known_acquisition then
    raise exception 'grading_before_acquisition';
  end if;

  insert into public.collection_transactions(
    user_id,collection_item_id,transaction_type,transaction_date,quantity,
    unit_price,subtotal,grading_fees,total_cost,currency,marketplace,notes,
    idempotency_key,grading_company,grade,certification_number,previous_raw_condition
  ) values(
    owner_id,target_item.id,'grading_return',p_transaction_date,target_item.quantity,
    0,0,p_total_grading_cost,p_total_grading_cost,target_item.currency,normalized_grader,p_notes,
    p_idempotency_key,normalized_grader,p_grade,nullif(trim(coalesce(p_certification_number,'')),''),target_item.raw_condition
  ) returning id into target_transaction;

  for active_lot in
    select purchase_lot.id,purchase_lot.quantity_remaining
    from public.purchase_lots purchase_lot
    where purchase_lot.collection_item_id=target_item.id
      and purchase_lot.user_id=owner_id
      and purchase_lot.quantity_remaining>0
    order by purchase_lot.acquired_at,purchase_lot.id
    for update
  loop
    lot_number := lot_number+1;
    lot_grading_cost := case
      when lot_number=lot_count then p_total_grading_cost-grading_cost_allocated
      else round(p_total_grading_cost*active_lot.quantity_remaining/active_quantity,2)
    end;
    update public.purchase_lots purchase_lot
    set total_cost=purchase_lot.total_cost+lot_grading_cost,
        remaining_cost=purchase_lot.remaining_cost+lot_grading_cost
    where purchase_lot.id=active_lot.id and purchase_lot.user_id=owner_id;
    grading_cost_allocated := grading_cost_allocated+lot_grading_cost;
  end loop;
  if grading_cost_allocated<>p_total_grading_cost then raise exception 'grading_cost_allocation_incomplete'; end if;

  update public.collection_items item
  set card_state='graded',raw_condition=null,grader=normalized_grader,grade=p_grade,
      certification_number=nullif(trim(coalesce(p_certification_number,'')),''),
      asking_price=null,listing_venue=null,listed_at=null,price_reviewed_at=null,
      updated_at=now()
  where item.id=target_item.id and item.user_id=owner_id;

  delete from public.position_price_observations observation
  where observation.collection_item_id=target_item.id and observation.user_id=owner_id;

  return target_item.id;
end $$;

revoke all on function public.record_grading_result(uuid,date,text,numeric,numeric,text,text,text) from public,anon;
grant execute on function public.record_grading_result(uuid,date,text,numeric,numeric,text,text,text) to authenticated;
