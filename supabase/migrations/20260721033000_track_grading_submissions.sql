-- Track the real period between an owned raw card leaving for grading and its
-- return. Estimated submission cost remains planning data; only the actual
-- all-in cost recorded on return is capitalized into FIFO basis.

create table if not exists public.grading_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  quantity integer not null check (quantity > 0),
  grader text not null check (grader ~ '^[A-Z0-9 .&-]{2,40}$'),
  submitted_at date not null check (submitted_at <= current_date),
  expected_return_date date,
  status text not null default 'submitted'
    check (status in ('submitted','received','grading','assembly','shipped','returned','cancelled')),
  status_updated_at date not null default current_date check (status_updated_at <= current_date),
  submission_reference text check (char_length(submission_reference) <= 120),
  estimated_total_cost numeric(14,2) check (estimated_total_cost is null or estimated_total_cost >= 0),
  notes text check (char_length(notes) <= 10000),
  returned_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (collection_item_id,user_id) references public.collection_items(id,user_id) on delete cascade,
  check (expected_return_date is null or expected_return_date >= submitted_at),
  check (returned_at is null or returned_at >= submitted_at),
  check ((status='returned')=(returned_at is not null))
);

create unique index if not exists grading_submissions_one_active_position_idx
  on public.grading_submissions(collection_item_id)
  where status not in ('returned','cancelled');
create index if not exists grading_submissions_owner_status_idx
  on public.grading_submissions(user_id,status,expected_return_date,submitted_at);

alter table public.grading_submissions enable row level security;
create policy "grading submissions own rows" on public.grading_submissions
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.grading_submissions to authenticated;
grant all on public.grading_submissions to service_role;

create or replace function public.prevent_inventory_change_during_grading()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.transaction_type in ('purchase','sale','trade_in','trade_out') and exists(
    select 1 from public.grading_submissions submission
    where submission.collection_item_id=new.collection_item_id
      and submission.user_id=new.user_id
      and submission.status not in ('returned','cancelled')
  ) then raise exception 'position_at_grader'; end if;
  return new;
end $$;
drop trigger if exists prevent_inventory_change_during_grading on public.collection_transactions;
create trigger prevent_inventory_change_during_grading before insert on public.collection_transactions
for each row execute function public.prevent_inventory_change_during_grading();
revoke all on function public.prevent_inventory_change_during_grading() from public,anon,authenticated;

create or replace function public.prevent_position_change_during_grading()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if exists(
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
drop trigger if exists prevent_position_change_during_grading on public.collection_items;
create trigger prevent_position_change_during_grading before update on public.collection_items
for each row execute function public.prevent_position_change_during_grading();
revoke all on function public.prevent_position_change_during_grading() from public,anon,authenticated;

create or replace function public.record_grading_submission(
  p_collection_item_id uuid,
  p_submitted_at date,
  p_grader text,
  p_expected_return_date date default null,
  p_submission_reference text default null,
  p_estimated_total_cost numeric default null,
  p_notes text default null,
  p_idempotency_key text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target_item public.collection_items%rowtype;
  latest_known_acquisition date;
  normalized_grader text := upper(trim(coalesce(p_grader,'')));
  target_submission uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_submitted_at is null or p_submitted_at>current_date then raise exception 'invalid_submission_date'; end if;
  if p_expected_return_date is not null and p_expected_return_date<p_submitted_at then raise exception 'invalid_expected_return_date'; end if;
  if normalized_grader !~ '^[A-Z0-9 .&-]{2,40}$' then raise exception 'invalid_grader'; end if;
  if p_estimated_total_cost is not null and (p_estimated_total_cost<0 or p_estimated_total_cost>999999999999.99) then raise exception 'invalid_estimated_cost'; end if;
  if char_length(coalesce(p_submission_reference,''))>120 then raise exception 'invalid_submission_reference'; end if;
  if char_length(coalesce(p_notes,''))>10000 then raise exception 'invalid_notes'; end if;

  select item.* into target_item from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id for update;
  if not found then raise exception 'position_not_found'; end if;
  if target_item.card_state<>'raw' then raise exception 'position_not_raw'; end if;
  if target_item.status<>'owned' or target_item.quantity<=0 then raise exception 'position_not_owned'; end if;
  if exists(select 1 from public.grading_submissions submission where submission.collection_item_id=target_item.id and submission.user_id=owner_id and submission.status not in ('returned','cancelled')) then
    raise exception 'active_submission_exists';
  end if;
  select max(lot.acquired_at) filter (where lot.acquired_at_known)
  into latest_known_acquisition from public.purchase_lots lot
  where lot.collection_item_id=target_item.id and lot.user_id=owner_id and lot.quantity_remaining>0;
  if latest_known_acquisition is not null and p_submitted_at<latest_known_acquisition then raise exception 'submission_before_acquisition'; end if;

  insert into public.grading_submissions(
    user_id,collection_item_id,quantity,grader,submitted_at,expected_return_date,status,status_updated_at,
    submission_reference,estimated_total_cost,notes
  ) values(
    owner_id,target_item.id,target_item.quantity,normalized_grader,p_submitted_at,p_expected_return_date,'submitted',p_submitted_at,
    nullif(trim(coalesce(p_submission_reference,'')),''),p_estimated_total_cost,p_notes
  ) returning id into target_submission;

  insert into public.collection_transactions(
    user_id,collection_item_id,transaction_type,transaction_date,quantity,unit_price,subtotal,total_cost,
    currency,marketplace,notes,idempotency_key,grading_company,previous_raw_condition
  ) values(
    owner_id,target_item.id,'grading_submission',p_submitted_at,target_item.quantity,0,0,0,
    target_item.currency,normalized_grader,p_notes,p_idempotency_key,normalized_grader,target_item.raw_condition
  );
  return target_submission;
end $$;

create or replace function public.update_grading_submission(
  p_submission_id uuid,
  p_status text,
  p_status_updated_at date,
  p_expected_return_date date default null,
  p_submission_reference text default null,
  p_notes text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target public.grading_submissions%rowtype;
  current_rank integer;
  next_rank integer;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_status not in ('submitted','received','grading','assembly','shipped','cancelled') then raise exception 'invalid_submission_status'; end if;
  if p_status_updated_at is null or p_status_updated_at>current_date then raise exception 'invalid_status_date'; end if;
  if char_length(coalesce(p_submission_reference,''))>120 then raise exception 'invalid_submission_reference'; end if;
  if char_length(coalesce(p_notes,''))>10000 then raise exception 'invalid_notes'; end if;
  select submission.* into target from public.grading_submissions submission
  where submission.id=p_submission_id and submission.user_id=owner_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if target.status in ('returned','cancelled') then raise exception 'submission_closed'; end if;
  if p_status_updated_at<target.submitted_at then raise exception 'status_before_submission'; end if;
  if p_expected_return_date is not null and p_expected_return_date<target.submitted_at then raise exception 'invalid_expected_return_date'; end if;
  current_rank := case target.status when 'submitted' then 0 when 'received' then 1 when 'grading' then 2 when 'assembly' then 3 when 'shipped' then 4 else 5 end;
  next_rank := case p_status when 'submitted' then 0 when 'received' then 1 when 'grading' then 2 when 'assembly' then 3 when 'shipped' then 4 else 5 end;
  if p_status<>'cancelled' and next_rank<current_rank then raise exception 'status_cannot_move_backward'; end if;
  update public.grading_submissions submission
  set status=p_status,status_updated_at=p_status_updated_at,
      expected_return_date=p_expected_return_date,
      submission_reference=nullif(trim(coalesce(p_submission_reference,'')),''),
      notes=p_notes,updated_at=now()
  where submission.id=target.id and submission.user_id=owner_id;
  return target.id;
end $$;

revoke all on function public.record_grading_submission(uuid,date,text,date,text,numeric,text,text) from public,anon;
grant execute on function public.record_grading_submission(uuid,date,text,date,text,numeric,text,text) to authenticated;
revoke all on function public.update_grading_submission(uuid,text,date,date,text,text) from public,anon;
grant execute on function public.update_grading_submission(uuid,text,date,date,text,text) to authenticated;

-- Close an active submission automatically when the existing return workflow
-- converts the raw position and capitalizes the actual all-in grading cost.
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
  owner_id uuid := (select auth.uid()); target_item public.collection_items%rowtype; target_transaction uuid;
  active_quantity integer; latest_known_acquisition date; lot_count integer; lot_number integer := 0;
  grading_cost_allocated numeric(14,2) := 0; lot_grading_cost numeric(14,2);
  normalized_grader text := upper(trim(coalesce(p_grader,''))); active_lot record;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_transaction_date is null or p_transaction_date>current_date then raise exception 'invalid_grading_date'; end if;
  if normalized_grader !~ '^[A-Z0-9 .&-]{2,40}$' then raise exception 'invalid_grader'; end if;
  if p_grade is null or p_grade<1 or p_grade>10 or round(p_grade*10)<>p_grade*10 then raise exception 'invalid_grade'; end if;
  if p_total_grading_cost is null or p_total_grading_cost<0 or p_total_grading_cost>999999999999.99 then raise exception 'invalid_grading_cost'; end if;
  if char_length(coalesce(p_certification_number,''))>120 then raise exception 'invalid_certification_number'; end if;
  if char_length(coalesce(p_notes,''))>10000 then raise exception 'invalid_notes'; end if;
  select item.* into target_item from public.collection_items item where item.id=p_collection_item_id and item.user_id=owner_id for update;
  if not found then raise exception 'position_not_found'; end if;
  if target_item.card_state<>'raw' then raise exception 'position_not_raw'; end if;
  if target_item.status<>'owned' or target_item.quantity<=0 then raise exception 'position_not_owned'; end if;
  select coalesce(sum(purchase_lot.quantity_remaining),0),count(*),max(purchase_lot.acquired_at) filter (where purchase_lot.acquired_at_known)
  into active_quantity,lot_count,latest_known_acquisition from public.purchase_lots purchase_lot
  where purchase_lot.collection_item_id=target_item.id and purchase_lot.user_id=owner_id and purchase_lot.quantity_remaining>0;
  if active_quantity<>target_item.quantity or lot_count=0 then raise exception 'fifo_lots_incomplete'; end if;
  if exists(select 1 from public.purchase_lots purchase_lot where purchase_lot.collection_item_id=target_item.id and purchase_lot.user_id=owner_id and purchase_lot.quantity_remaining>0 and not purchase_lot.cost_basis_known) then raise exception 'acquisition_cost_required'; end if;
  if latest_known_acquisition is not null and p_transaction_date<latest_known_acquisition then raise exception 'grading_before_acquisition'; end if;
  if exists(select 1 from public.grading_submissions submission where submission.collection_item_id=target_item.id and submission.user_id=owner_id and submission.status not in ('returned','cancelled') and submission.grader<>normalized_grader) then raise exception 'submission_grader_mismatch'; end if;
  insert into public.collection_transactions(user_id,collection_item_id,transaction_type,transaction_date,quantity,unit_price,subtotal,grading_fees,total_cost,currency,marketplace,notes,idempotency_key,grading_company,grade,certification_number,previous_raw_condition)
  values(owner_id,target_item.id,'grading_return',p_transaction_date,target_item.quantity,0,0,p_total_grading_cost,p_total_grading_cost,target_item.currency,normalized_grader,p_notes,p_idempotency_key,normalized_grader,p_grade,nullif(trim(coalesce(p_certification_number,'')),''),target_item.raw_condition)
  returning id into target_transaction;
  for active_lot in select purchase_lot.id,purchase_lot.quantity_remaining from public.purchase_lots purchase_lot where purchase_lot.collection_item_id=target_item.id and purchase_lot.user_id=owner_id and purchase_lot.quantity_remaining>0 order by purchase_lot.acquired_at,purchase_lot.id for update loop
    lot_number:=lot_number+1;
    lot_grading_cost:=case when lot_number=lot_count then p_total_grading_cost-grading_cost_allocated else round(p_total_grading_cost*active_lot.quantity_remaining/active_quantity,2) end;
    update public.purchase_lots purchase_lot set total_cost=purchase_lot.total_cost+lot_grading_cost,remaining_cost=purchase_lot.remaining_cost+lot_grading_cost where purchase_lot.id=active_lot.id and purchase_lot.user_id=owner_id;
    grading_cost_allocated:=grading_cost_allocated+lot_grading_cost;
  end loop;
  if grading_cost_allocated<>p_total_grading_cost then raise exception 'grading_cost_allocation_incomplete'; end if;
  update public.grading_submissions submission set status='returned',status_updated_at=p_transaction_date,returned_at=p_transaction_date,updated_at=now()
  where submission.collection_item_id=target_item.id and submission.user_id=owner_id and submission.status not in ('returned','cancelled');
  update public.collection_items item set card_state='graded',raw_condition=null,grader=normalized_grader,grade=p_grade,certification_number=nullif(trim(coalesce(p_certification_number,'')),''),asking_price=null,listing_venue=null,listed_at=null,price_reviewed_at=null,updated_at=now()
  where item.id=target_item.id and item.user_id=owner_id;
  delete from public.position_price_observations observation where observation.collection_item_id=target_item.id and observation.user_id=owner_id;
  return target_item.id;
end $$;

revoke all on function public.record_grading_result(uuid,date,text,numeric,numeric,text,text,text) from public,anon;
grant execute on function public.record_grading_result(uuid,date,text,numeric,numeric,text,text,text) to authenticated;
