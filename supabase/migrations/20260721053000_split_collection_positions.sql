-- Separate some copies from an aggregate position without recording a sale or
-- repurchase. Remaining FIFO basis moves to the new position exactly, and an
-- active grading submission is divided so mixed returned grades can be saved.

alter table public.collection_transactions
  drop constraint if exists collection_transactions_transaction_type_check;
alter table public.collection_transactions
  add constraint collection_transactions_transaction_type_check
  check (transaction_type in (
    'purchase','sale','trade_in','trade_out','grading_submission',
    'grading_return','fee','adjustment','position_split'
  ));

create or replace function public.prevent_position_change_during_grading()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if coalesce(current_setting('app.position_split',true),'')<>'allowed' and exists(
    select 1 from public.grading_submissions submission
    where submission.collection_item_id=old.id
      and submission.user_id=old.user_id
      and submission.status not in ('returned','cancelled')
  ) and (
    new.quantity is distinct from old.quantity
    or new.status is distinct from old.status
    or new.card_state is distinct from old.card_state
    or new.raw_condition is distinct from old.raw_condition
    or new.grader is distinct from old.grader
    or new.grade is distinct from old.grade
  ) then raise exception 'position_at_grader'; end if;
  return new;
end $$;
revoke all on function public.prevent_position_change_during_grading() from public,anon,authenticated;

create or replace function public.split_collection_position(
  p_collection_item_id uuid,
  p_quantity integer,
  p_lot_order text default 'oldest',
  p_idempotency_key text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target_item public.collection_items%rowtype;
  target_submission public.grading_submissions%rowtype;
  target_item_id uuid;
  marker_transaction_id uuid;
  lot_marker_id uuid;
  split_key text := nullif(trim(coalesce(p_idempotency_key,'')),'');
  remaining_quantity integer := p_quantity;
  active_lot record;
  take_quantity integer;
  take_cost numeric(14,2);
  transferred_quantity integer := 0;
  transferred_cost numeric(14,2) := 0;
  original_lot_cost numeric(14,2);
  original_lot_quantity integer;
  split_estimate numeric(14,2);
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_quantity is null or p_quantity<1 then raise exception 'invalid_split_quantity'; end if;
  if p_lot_order not in ('oldest','newest') then raise exception 'invalid_lot_order'; end if;

  if split_key is not null then
    select transaction.collection_item_id into target_item_id
    from public.collection_transactions transaction
    where transaction.user_id=owner_id
      and transaction.idempotency_key=split_key
      and transaction.transaction_type='position_split';
    if target_item_id is not null then return target_item_id; end if;
  end if;

  select item.* into target_item
  from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id
  for update;
  if not found then raise exception 'position_not_found'; end if;
  if target_item.status not in ('owned','archived') then raise exception 'position_cannot_be_split'; end if;
  if p_quantity>=target_item.quantity then raise exception 'invalid_split_quantity'; end if;
  if (
    select coalesce(sum(lot.quantity_remaining),0)
    from public.purchase_lots lot
    where lot.collection_item_id=target_item.id and lot.user_id=owner_id
  )<>target_item.quantity then raise exception 'fifo_lots_incomplete'; end if;

  perform set_config('app.position_split','allowed',true);

  insert into public.collection_items(
    collection_id,user_id,card_id,variant_id,identity_snapshot,card_state,
    raw_condition,grader,grade,certification_number,quantity,valuation_basis,
    manual_value,notes,storage_location,image_override_url,status,currency,tags,
    asking_price,listing_venue,listed_at,price_reviewed_at
  ) values(
    target_item.collection_id,target_item.user_id,target_item.card_id,
    target_item.variant_id,target_item.identity_snapshot,target_item.card_state,
    target_item.raw_condition,target_item.grader,target_item.grade,null,p_quantity,
    target_item.valuation_basis,target_item.manual_value,target_item.notes,
    target_item.storage_location,target_item.image_override_url,target_item.status,
    target_item.currency,target_item.tags,target_item.asking_price,
    target_item.listing_venue,target_item.listed_at,target_item.price_reviewed_at
  ) returning id into target_item_id;

  update public.collection_items item
  set quantity=item.quantity-p_quantity,updated_at=now()
  where item.id=target_item.id and item.user_id=owner_id;

  insert into public.collection_transactions(
    user_id,collection_item_id,transaction_type,transaction_date,quantity,
    unit_price,subtotal,total_cost,currency,notes,idempotency_key
  ) values(
    owner_id,target_item_id,'position_split',current_date,p_quantity,
    0,0,0,target_item.currency,
    case when p_lot_order='oldest'
      then 'Separated from another position using oldest remaining FIFO lots.'
      else 'Separated from another position using newest remaining FIFO lots.' end,
    split_key
  ) returning id into marker_transaction_id;

  for active_lot in
    select lot.* from public.purchase_lots lot
    where lot.collection_item_id=target_item.id
      and lot.user_id=owner_id and lot.quantity_remaining>0
    order by
      case when p_lot_order='oldest' then lot.acquired_at end asc,
      case when p_lot_order='oldest' then lot.id end asc,
      case when p_lot_order='newest' then lot.acquired_at end desc,
      case when p_lot_order='newest' then lot.id end desc
    for update
  loop
    exit when remaining_quantity=0;
    take_quantity:=least(remaining_quantity,active_lot.quantity_remaining);
    take_cost:=case
      when take_quantity=active_lot.quantity_remaining then active_lot.remaining_cost
      else round(active_lot.remaining_cost*take_quantity/active_lot.quantity_remaining,2)
    end;
    original_lot_cost:=active_lot.total_cost-take_cost;
    original_lot_quantity:=active_lot.quantity_acquired-take_quantity;
    if original_lot_quantity=0 then
      delete from public.purchase_lots lot
      where lot.id=active_lot.id and lot.user_id=owner_id;
    else
      update public.purchase_lots lot
      set quantity_acquired=original_lot_quantity,
          quantity_remaining=lot.quantity_remaining-take_quantity,
          total_cost=original_lot_cost,
          remaining_cost=lot.remaining_cost-take_cost
      where lot.id=active_lot.id and lot.user_id=owner_id;
    end if;

    if transferred_quantity=0 then
      lot_marker_id:=marker_transaction_id;
    else
      insert into public.collection_transactions(
        user_id,collection_item_id,transaction_type,transaction_date,quantity,
        unit_price,subtotal,total_cost,currency,notes
      ) values(
        owner_id,target_item_id,'position_split',current_date,take_quantity,
        0,0,0,target_item.currency,'Additional FIFO lot transferred during position split.'
      ) returning id into lot_marker_id;
    end if;

    insert into public.purchase_lots(
      user_id,collection_item_id,purchase_transaction_id,acquired_at,
      quantity_acquired,quantity_remaining,total_cost,remaining_cost,currency,
      cost_basis_known,acquired_at_known
    ) values(
      owner_id,target_item_id,lot_marker_id,active_lot.acquired_at,
      take_quantity,take_quantity,take_cost,take_cost,active_lot.currency,
      active_lot.cost_basis_known,active_lot.acquired_at_known
    );

    transferred_quantity:=transferred_quantity+take_quantity;
    transferred_cost:=transferred_cost+take_cost;
    remaining_quantity:=remaining_quantity-take_quantity;
  end loop;
  if remaining_quantity<>0 or transferred_quantity<>p_quantity then
    raise exception 'fifo_lots_incomplete';
  end if;

  select submission.* into target_submission
  from public.grading_submissions submission
  where submission.collection_item_id=target_item.id
    and submission.user_id=owner_id
    and submission.status not in ('returned','cancelled')
  for update;
  if found then
    if target_submission.quantity<>target_item.quantity then
      raise exception 'grading_submission_quantity_mismatch';
    end if;
    split_estimate:=case when target_submission.estimated_total_cost is null then null
      else round(target_submission.estimated_total_cost*p_quantity/target_submission.quantity,2) end;
    update public.grading_submissions submission
    set quantity=submission.quantity-p_quantity,
        estimated_total_cost=case when submission.estimated_total_cost is null then null
          else submission.estimated_total_cost-split_estimate end,
        updated_at=now()
    where submission.id=target_submission.id and submission.user_id=owner_id;
    insert into public.grading_submissions(
      user_id,collection_item_id,quantity,grader,submitted_at,
      expected_return_date,status,status_updated_at,submission_reference,
      estimated_total_cost,notes
    ) values(
      owner_id,target_item_id,p_quantity,target_submission.grader,
      target_submission.submitted_at,target_submission.expected_return_date,
      target_submission.status,target_submission.status_updated_at,
      target_submission.submission_reference,split_estimate,target_submission.notes
    );
  end if;

  return target_item_id;
end $$;

revoke all on function public.split_collection_position(uuid,integer,text,text) from public,anon;
grant execute on function public.split_collection_position(uuid,integer,text,text) to authenticated;

comment on function public.split_collection_position(uuid,integer,text,text) is
  'Owner-scoped atomic split of remaining FIFO lots and any active grading submission; records no cash flow.';
