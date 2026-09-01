-- Keep the canonical identity contract true for every future write. These
-- trigger functions are security-definer because authenticated users can write
-- their own portfolio rows but cannot mutate the shared identity registry.

create or replace function identity_private.resolve_collectible_identity(
  p_collectible_id uuid
) returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  current_id uuid:=p_collectible_id;
  next_id uuid;
  hop_count integer:=0;
begin
  if current_id is null then return null; end if;
  loop
    select identity.merged_into_id into next_id
    from public.collectible_identities identity
    where identity.id=current_id;
    if not found then raise exception 'collectible_identity_not_found'; end if;
    if next_id is null then return current_id; end if;
    hop_count:=hop_count+1;
    if hop_count>20 then raise exception 'collectible_identity_merge_cycle'; end if;
    current_id:=next_id;
  end loop;
end $$;

create or replace function identity_private.derive_collection_item_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  target_id uuid;
begin
  target_id:=case
    when new.card_state='sealed' then
      identity_private.ensure_sealed_identity(
        new.identity_snapshot,'collection-item:'||new.id::text,new.user_id
      )
    when new.variant_id is not null or new.card_id is not null then
      identity_private.ensure_card_identity(new.card_id,new.variant_id)
    when new.collectible_id is not null and exists(
      select 1 from public.collectible_identities identity
      where identity.id=new.collectible_id
        and identity.identity_kind='unresolved'
        and identity.owner_id=new.user_id
        and identity.metadata->>'subjectId'=new.id::text
    ) then new.collectible_id
    else identity_private.ensure_unresolved_identity(
      'collection-item',new.id,new.identity_snapshot,new.user_id,new.id
    )
  end;
  new.collectible_id:=identity_private.resolve_collectible_identity(target_id);
  new.identity_snapshot:=jsonb_set(
    coalesce(new.identity_snapshot,'{}'::jsonb),
    '{collectibleId}',to_jsonb(new.collectible_id::text),true
  );
  return new;
end $$;

create or replace function identity_private.derive_identity_from_collection_item()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  select item.collectible_id into new.collectible_id
  from public.collection_items item
  where item.id=new.collection_item_id and item.user_id=new.user_id;
  if new.collectible_id is null then raise exception 'collection_item_identity_not_found'; end if;
  new.collectible_id:=identity_private.resolve_collectible_identity(new.collectible_id);
  return new;
end $$;

create or replace function identity_private.derive_identity_from_owned_copy()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  select copy.collectible_id into new.collectible_id
  from public.owned_copies copy
  where copy.id=new.owned_copy_id and copy.user_id=new.user_id;
  if new.collectible_id is null then raise exception 'owned_copy_identity_not_found'; end if;
  new.collectible_id:=identity_private.resolve_collectible_identity(new.collectible_id);
  return new;
end $$;

create or replace function identity_private.derive_watchlist_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  target_id uuid;
begin
  target_id:=case
    when new.card_state='sealed' then
      identity_private.ensure_sealed_identity(
        new.identity_snapshot,'watchlist:'||new.id::text,new.user_id
      )
    when new.variant_id is not null or new.card_id is not null then
      identity_private.ensure_card_identity(new.card_id,new.variant_id)
    when new.collectible_id is not null and exists(
      select 1 from public.collectible_identities identity
      where identity.id=new.collectible_id
        and identity.identity_kind='unresolved'
        and identity.owner_id=new.user_id
        and identity.metadata->>'subjectId'=new.id::text
    ) then new.collectible_id
    else identity_private.ensure_unresolved_identity(
      'watchlist',new.id,new.identity_snapshot,new.user_id,new.id
    )
  end;
  new.collectible_id:=identity_private.resolve_collectible_identity(target_id);
  new.identity_snapshot:=jsonb_set(
    coalesce(new.identity_snapshot,'{}'::jsonb),
    '{collectibleId}',to_jsonb(new.collectible_id::text),true
  );
  return new;
end $$;

create or replace function identity_private.derive_price_product_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.collectible_id:=identity_private.resolve_collectible_identity(
    identity_private.ensure_card_identity(null,new.variant_id)
  );
  return new;
end $$;

create or replace function identity_private.derive_price_observation_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.collectible_id:=identity_private.resolve_collectible_identity(
    identity_private.ensure_card_identity(new.card_id,new.card_variant_id)
  );
  return new;
end $$;

create or replace function identity_private.derive_provider_mapping_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.collectible_id:=identity_private.resolve_collectible_identity(
    identity_private.ensure_card_identity(new.card_id,new.card_variant_id)
  );
  return new;
end $$;

create or replace function identity_private.derive_scan_candidate_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.collectible_id:=identity_private.resolve_collectible_identity(
    identity_private.ensure_card_identity(null,new.variant_id)
  );
  return new;
end $$;

create or replace function identity_private.derive_scan_feedback_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.selected_collectible_id:=case
    when new.selected_variant_id is null then null
    else identity_private.resolve_collectible_identity(
      identity_private.ensure_card_identity(null,new.selected_variant_id)
    )
  end;
  return new;
end $$;

create or replace function identity_private.derive_grading_physical_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.collection_item_id is not null then
    select item.collectible_id into new.collectible_id
    from public.collection_items item
    where item.id=new.collection_item_id and item.user_id=new.user_id;
  end if;
  if new.collectible_id is null then
    new.collectible_id:=identity_private.ensure_unresolved_identity(
      'grading-physical-card',new.id,new.identity_snapshot,new.user_id,new.id
    );
  end if;
  new.collectible_id:=identity_private.resolve_collectible_identity(new.collectible_id);
  new.identity_snapshot:=jsonb_set(
    coalesce(new.identity_snapshot,'{}'::jsonb),
    '{collectibleId}',to_jsonb(new.collectible_id::text),true
  );
  return new;
end $$;

create or replace function identity_private.derive_grading_session_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.collection_item_id is not null then
    select item.collectible_id into new.collectible_id
    from public.collection_items item
    where item.id=new.collection_item_id and item.user_id=new.user_id;
  end if;
  if new.collectible_id is null and new.physical_card_id is not null then
    select physical.collectible_id into new.collectible_id
    from public.grading_physical_cards physical
    where physical.id=new.physical_card_id and physical.user_id=new.user_id;
  end if;
  if new.collectible_id is null then
    new.collectible_id:=identity_private.ensure_unresolved_identity(
      'grading-scan-session',new.id,new.identity_snapshot,new.user_id,new.id
    );
  end if;
  new.collectible_id:=identity_private.resolve_collectible_identity(new.collectible_id);
  new.identity_snapshot:=jsonb_set(
    coalesce(new.identity_snapshot,'{}'::jsonb),
    '{collectibleId}',to_jsonb(new.collectible_id::text),true
  );
  return new;
end $$;

create or replace function identity_private.derive_grading_child_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  select session.collectible_id into new.collectible_id
  from public.grading_scan_sessions session
  where session.id=new.scan_session_id and session.user_id=new.user_id;
  if new.collectible_id is null then raise exception 'grading_session_identity_not_found'; end if;
  new.collectible_id:=identity_private.resolve_collectible_identity(new.collectible_id);
  return new;
end $$;

revoke all on function identity_private.resolve_collectible_identity(uuid)
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_collection_item_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_identity_from_collection_item()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_identity_from_owned_copy()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_watchlist_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_price_product_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_price_observation_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_provider_mapping_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_scan_candidate_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_scan_feedback_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_grading_physical_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_grading_session_identity()
  from public,anon,authenticated,service_role;
revoke all on function identity_private.derive_grading_child_identity()
  from public,anon,authenticated,service_role;

drop trigger if exists collection_item_collectible_identity_trigger
  on public.collection_items;
create trigger collection_item_collectible_identity_trigger
before insert or update of card_id,variant_id,card_state,identity_snapshot,collectible_id
on public.collection_items
for each row execute function identity_private.derive_collection_item_identity();

drop trigger if exists collection_transaction_collectible_identity_trigger
  on public.collection_transactions;
create trigger collection_transaction_collectible_identity_trigger
before insert or update of collection_item_id,user_id,collectible_id
on public.collection_transactions
for each row execute function identity_private.derive_identity_from_collection_item();

drop trigger if exists purchase_lot_collectible_identity_trigger
  on public.purchase_lots;
create trigger purchase_lot_collectible_identity_trigger
before insert or update of collection_item_id,user_id,collectible_id
on public.purchase_lots
for each row execute function identity_private.derive_identity_from_collection_item();

drop trigger if exists position_price_collectible_identity_trigger
  on public.position_price_observations;
create trigger position_price_collectible_identity_trigger
before insert or update of collection_item_id,user_id,collectible_id
on public.position_price_observations
for each row execute function identity_private.derive_identity_from_collection_item();

drop trigger if exists owned_copy_collectible_identity_trigger
  on public.owned_copies;
create trigger owned_copy_collectible_identity_trigger
before insert or update of collection_item_id,user_id,collectible_id
on public.owned_copies
for each row execute function identity_private.derive_identity_from_collection_item();

drop trigger if exists digital_grade_collectible_identity_trigger
  on public.digital_grade_assessments;
create trigger digital_grade_collectible_identity_trigger
before insert or update of collection_item_id,user_id,collectible_id
on public.digital_grade_assessments
for each row execute function identity_private.derive_identity_from_collection_item();

drop trigger if exists grading_submission_collectible_identity_trigger
  on public.grading_submissions;
create trigger grading_submission_collectible_identity_trigger
before insert or update of collection_item_id,user_id,collectible_id
on public.grading_submissions
for each row execute function identity_private.derive_identity_from_collection_item();

drop trigger if exists purchase_transaction_collectible_identity_trigger
  on public.purchase_transactions;
create trigger purchase_transaction_collectible_identity_trigger
before insert or update of owned_copy_id,user_id,collectible_id
on public.purchase_transactions
for each row execute function identity_private.derive_identity_from_owned_copy();

drop trigger if exists sale_transaction_collectible_identity_trigger
  on public.sale_transactions;
create trigger sale_transaction_collectible_identity_trigger
before insert or update of owned_copy_id,user_id,collectible_id
on public.sale_transactions
for each row execute function identity_private.derive_identity_from_owned_copy();

drop trigger if exists watchlist_collectible_identity_trigger
  on public.card_watchlist;
create trigger watchlist_collectible_identity_trigger
before insert or update of card_id,variant_id,card_state,identity_snapshot,collectible_id
on public.card_watchlist
for each row execute function identity_private.derive_watchlist_identity();

drop trigger if exists price_product_collectible_identity_trigger
  on public.price_products;
create trigger price_product_collectible_identity_trigger
before insert or update of variant_id,collectible_id
on public.price_products
for each row execute function identity_private.derive_price_product_identity();

drop trigger if exists price_observation_collectible_identity_trigger
  on public.price_observations;
create trigger price_observation_collectible_identity_trigger
before insert or update of card_id,card_variant_id,collectible_id
on public.price_observations
for each row execute function identity_private.derive_price_observation_identity();

drop trigger if exists provider_mapping_collectible_identity_trigger
  on public.card_provider_mappings;
create trigger provider_mapping_collectible_identity_trigger
before insert or update of card_id,card_variant_id,collectible_id
on public.card_provider_mappings
for each row execute function identity_private.derive_provider_mapping_identity();

drop trigger if exists scan_candidate_collectible_identity_trigger
  on public.scan_candidates;
create trigger scan_candidate_collectible_identity_trigger
before insert or update of variant_id,collectible_id
on public.scan_candidates
for each row execute function identity_private.derive_scan_candidate_identity();

drop trigger if exists scan_feedback_collectible_identity_trigger
  on public.scan_feedback;
create trigger scan_feedback_collectible_identity_trigger
before insert or update of selected_variant_id,selected_collectible_id
on public.scan_feedback
for each row execute function identity_private.derive_scan_feedback_identity();

drop trigger if exists grading_physical_collectible_identity_trigger
  on public.grading_physical_cards;
create trigger grading_physical_collectible_identity_trigger
before insert or update of collection_item_id,identity_snapshot,collectible_id
on public.grading_physical_cards
for each row execute function identity_private.derive_grading_physical_identity();

-- The zz prefix makes this run after assign_grading_physical_card on INSERT.
drop trigger if exists zz_grading_session_collectible_identity_trigger
  on public.grading_scan_sessions;
create trigger zz_grading_session_collectible_identity_trigger
before insert or update of collection_item_id,physical_card_id,identity_snapshot,collectible_id
on public.grading_scan_sessions
for each row execute function identity_private.derive_grading_session_identity();

drop trigger if exists grading_capture_collectible_identity_trigger
  on public.grading_captures;
create trigger grading_capture_collectible_identity_trigger
before insert or update of scan_session_id,user_id,collectible_id
on public.grading_captures
for each row execute function identity_private.derive_grading_child_identity();

drop trigger if exists grading_evidence_collectible_identity_trigger
  on public.grading_evidence;
create trigger grading_evidence_collectible_identity_trigger
before insert or update of scan_session_id,user_id,collectible_id
on public.grading_evidence
for each row execute function identity_private.derive_grading_child_identity();

drop trigger if exists grading_prediction_collectible_identity_trigger
  on public.grading_predictions;
create trigger grading_prediction_collectible_identity_trigger
before insert or update of scan_session_id,user_id,collectible_id
on public.grading_predictions
for each row execute function identity_private.derive_grading_child_identity();

drop trigger if exists grading_outcome_collectible_identity_trigger
  on public.grading_outcomes;
create trigger grading_outcome_collectible_identity_trigger
before insert or update of scan_session_id,user_id,collectible_id
on public.grading_outcomes
for each row execute function identity_private.derive_grading_child_identity();

drop trigger if exists grading_feedback_collectible_identity_trigger
  on public.grading_feedback;
create trigger grading_feedback_collectible_identity_trigger
before insert or update of scan_session_id,user_id,collectible_id
on public.grading_feedback
for each row execute function identity_private.derive_grading_child_identity();

create or replace function identity_private.propagate_collection_item_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.collectible_id is not distinct from old.collectible_id then return null; end if;

  update public.collection_transactions row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.purchase_lots row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.position_price_observations row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.owned_copies row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.purchase_transactions transaction
  set collectible_id=new.collectible_id
  from public.owned_copies copy
  where transaction.owned_copy_id=copy.id and transaction.user_id=copy.user_id
    and copy.collection_item_id=new.id and copy.user_id=new.user_id;
  update public.sale_transactions transaction
  set collectible_id=new.collectible_id
  from public.owned_copies copy
  where transaction.owned_copy_id=copy.id and transaction.user_id=copy.user_id
    and copy.collection_item_id=new.id and copy.user_id=new.user_id;
  update public.digital_grade_assessments row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.grading_submissions row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.grading_physical_cards row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.grading_scan_sessions row
  set collectible_id=new.collectible_id
  where row.collection_item_id=new.id and row.user_id=new.user_id;
  update public.grading_scan_sessions session
  set collectible_id=new.collectible_id
  from public.grading_physical_cards physical
  where session.physical_card_id=physical.id and session.user_id=physical.user_id
    and physical.collection_item_id=new.id and physical.user_id=new.user_id;
  update public.grading_captures row
  set collectible_id=session.collectible_id
  from public.grading_scan_sessions session
  where row.scan_session_id=session.id and row.user_id=session.user_id
    and session.collectible_id=new.collectible_id;
  update public.grading_evidence row
  set collectible_id=session.collectible_id
  from public.grading_scan_sessions session
  where row.scan_session_id=session.id and row.user_id=session.user_id
    and session.collectible_id=new.collectible_id;
  update public.grading_predictions row
  set collectible_id=session.collectible_id
  from public.grading_scan_sessions session
  where row.scan_session_id=session.id and row.user_id=session.user_id
    and session.collectible_id=new.collectible_id;
  update public.grading_outcomes row
  set collectible_id=session.collectible_id
  from public.grading_scan_sessions session
  where row.scan_session_id=session.id and row.user_id=session.user_id
    and session.collectible_id=new.collectible_id;
  update public.grading_feedback row
  set collectible_id=session.collectible_id
  from public.grading_scan_sessions session
  where row.scan_session_id=session.id and row.user_id=session.user_id
    and session.collectible_id=new.collectible_id;
  return null;
end $$;

revoke all on function identity_private.propagate_collection_item_identity()
  from public,anon,authenticated,service_role;

drop trigger if exists collection_item_identity_propagation_trigger
  on public.collection_items;
create trigger collection_item_identity_propagation_trigger
after update of collectible_id on public.collection_items
for each row execute function identity_private.propagate_collection_item_identity();

-- Replace destructive remapping with an append-only, owner-scoped correction
-- event. The financial ledger remains intact; only stale price observations are
-- removed because they describe the previous collectible.
create or replace function public.remap_collection_position(
  p_collection_item_id uuid,
  p_identity jsonb,
  p_card_id uuid default null,
  p_variant_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  previous_identity jsonb;
  previous_collectible_id uuid;
  position_state text;
  next_identity jsonb;
  next_collectible_id uuid;
  correction_id uuid:=gen_random_uuid();
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_identity is null or jsonb_typeof(p_identity)<>'object'
     or octet_length(p_identity::text)>10000 then
    raise exception 'invalid_identity';
  end if;
  if char_length(trim(coalesce(p_identity->>'name',''))) not between 1 and 200
     or char_length(trim(coalesce(p_identity->>'set',''))) not between 1 and 200
     or char_length(trim(coalesce(p_identity->>'number',''))) not between 1 and 80
     or char_length(trim(coalesce(p_identity->>'variant',''))) not between 1 and 120
     or coalesce(p_identity->>'language','') !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'
     or char_length(coalesce(p_identity->>'providerCardId','')) not between 1 and 160
     or jsonb_typeof(coalesce(p_identity->'externalIds','{}'::jsonb))<>'object' then
    raise exception 'invalid_identity';
  end if;

  select item.identity_snapshot,item.card_state,item.collectible_id
  into previous_identity,position_state,previous_collectible_id
  from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id
  for update;
  if not found then raise exception 'position_not_found'; end if;
  if position_state='sealed' then raise exception 'sealed_position_remap_not_supported'; end if;

  next_collectible_id:=identity_private.resolve_collectible_identity(
    case
      when p_card_id is not null or p_variant_id is not null then
        identity_private.ensure_card_identity(p_card_id,p_variant_id)
      else identity_private.ensure_unresolved_identity(
        'collection-correction',correction_id,p_identity,owner_id,
        p_collection_item_id
      )
    end
  );
  previous_collectible_id:=identity_private.resolve_collectible_identity(
    previous_collectible_id
  );
  if next_collectible_id=previous_collectible_id then
    raise exception 'identity_unchanged';
  end if;

  next_identity:=p_identity;
  if previous_identity ? 'acquisitionCostKnown' then
    next_identity:=jsonb_set(
      next_identity,'{acquisitionCostKnown}',
      previous_identity->'acquisitionCostKnown',true
    );
  end if;
  if previous_identity ? 'acquisitionDateKnown' then
    next_identity:=jsonb_set(
      next_identity,'{acquisitionDateKnown}',
      previous_identity->'acquisitionDateKnown',true
    );
  end if;
  next_identity:=jsonb_set(
    next_identity,'{collectibleId}',to_jsonb(next_collectible_id::text),true
  );

  update public.collection_items item
  set identity_snapshot=next_identity,
      card_id=p_card_id,
      variant_id=p_variant_id,
      collectible_id=next_collectible_id,
      updated_at=now()
  where item.id=p_collection_item_id and item.user_id=owner_id;

  insert into public.identity_corrections(
    id,user_id,collection_item_id,event_type,from_collectible_id,to_collectible_id,
    from_snapshot,to_snapshot,rule_version
  ) values(
    correction_id,owner_id,p_collection_item_id,'correction',previous_collectible_id,
    next_collectible_id,previous_identity,next_identity,'identity-match-v1'
  );

  delete from public.position_price_observations observation
  where observation.collection_item_id=p_collection_item_id
    and observation.user_id=owner_id;

  return p_collection_item_id;
end $$;

create or replace function public.revert_collection_identity_correction(
  p_correction_id uuid
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  correction public.identity_corrections%rowtype;
  current_collectible_id uuid;
  restored_card_id uuid;
  restored_variant_id uuid;
  restored_snapshot jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;

  select event.* into correction
  from public.identity_corrections event
  where event.id=p_correction_id and event.user_id=owner_id
    and event.event_type='correction'
  for update;
  if not found then raise exception 'correction_not_found'; end if;
  if exists(
    select 1 from public.identity_corrections reversal
    where reversal.reverses_correction_id=correction.id
  ) then raise exception 'correction_already_reversed'; end if;
  if exists(
    select 1 from public.identity_corrections later
    where later.collection_item_id=correction.collection_item_id
      and later.user_id=owner_id
      and (later.created_at,later.id)>(correction.created_at,correction.id)
  ) then raise exception 'only_latest_correction_can_be_reversed'; end if;

  select item.collectible_id into current_collectible_id
  from public.collection_items item
  where item.id=correction.collection_item_id and item.user_id=owner_id
  for update;
  if not found then raise exception 'position_not_found'; end if;
  if identity_private.resolve_collectible_identity(current_collectible_id)
     <>identity_private.resolve_collectible_identity(correction.to_collectible_id) then
    raise exception 'position_identity_changed';
  end if;

  select identity.card_id,identity.variant_id
  into restored_card_id,restored_variant_id
  from public.collectible_identities identity
  where identity.id=correction.from_collectible_id;
  if restored_variant_id is not null then
    select variant.card_id into restored_card_id
    from public.card_variants variant where variant.id=restored_variant_id;
  end if;
  restored_snapshot:=jsonb_set(
    correction.from_snapshot,'{collectibleId}',
    to_jsonb(correction.from_collectible_id::text),true
  );

  update public.collection_items item
  set identity_snapshot=restored_snapshot,
      card_id=restored_card_id,
      variant_id=restored_variant_id,
      collectible_id=correction.from_collectible_id,
      updated_at=now()
  where item.id=correction.collection_item_id and item.user_id=owner_id;

  insert into public.identity_corrections(
    user_id,collection_item_id,event_type,from_collectible_id,to_collectible_id,
    from_snapshot,to_snapshot,reason,rule_version,reverses_correction_id
  ) values(
    owner_id,correction.collection_item_id,'reversal',
    correction.to_collectible_id,correction.from_collectible_id,
    correction.to_snapshot,restored_snapshot,'User reversed latest correction',
    correction.rule_version,correction.id
  );

  delete from public.position_price_observations observation
  where observation.collection_item_id=correction.collection_item_id
    and observation.user_id=owner_id;

  return correction.collection_item_id;
end $$;

revoke all on function public.remap_collection_position(uuid,jsonb,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.remap_collection_position(uuid,jsonb,uuid,uuid)
  to authenticated;
revoke all on function public.revert_collection_identity_correction(uuid)
  from public,anon,authenticated;
grant execute on function public.revert_collection_identity_correction(uuid)
  to authenticated;

create or replace function identity_private.require_identity_admin()
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if coalesce((select auth.jwt())->'app_metadata'->>'role','')<>'admin' then
    raise exception 'admin_required';
  end if;
end $$;

revoke all on function identity_private.require_identity_admin()
  from public,anon,authenticated,service_role;

create or replace function public.propose_collectible_identity_merge(
  p_source_collectible_id uuid,
  p_target_collectible_id uuid,
  p_evidence jsonb,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid:=(select auth.uid());
  proposal_id uuid;
  source_status text;
  source_owner_id uuid;
  target_owner_id uuid;
begin
  perform identity_private.require_identity_admin();
  if p_source_collectible_id=p_target_collectible_id then
    raise exception 'merge_identity_same';
  end if;
  if jsonb_typeof(coalesce(p_evidence,'{}'::jsonb))<>'object'
     or char_length(trim(coalesce(p_reason,''))) not between 1 and 500 then
    raise exception 'invalid_merge_proposal';
  end if;
  select identity.identity_status,identity.owner_id
  into source_status,source_owner_id
  from public.collectible_identities identity
  where identity.id=p_source_collectible_id;
  if source_status is null then raise exception 'source_identity_not_found'; end if;
  if source_status='merged' then raise exception 'source_identity_already_merged'; end if;
  select identity.owner_id into target_owner_id
  from public.collectible_identities identity
  where identity.id=p_target_collectible_id
    and identity.identity_status in ('active','needs_review');
  if not found then raise exception 'target_identity_not_available'; end if;
  if target_owner_id is not null
     and target_owner_id is distinct from source_owner_id then
    raise exception 'cross_owner_merge_not_allowed';
  end if;

  insert into public.identity_merge_proposals(
    owner_id,source_collectible_id,target_collectible_id,status,
    source_status_before,evidence,reason,proposed_by
  ) values(
    source_owner_id,p_source_collectible_id,p_target_collectible_id,'pending',
    source_status,p_evidence,trim(p_reason),actor_id
  ) returning id into proposal_id;
  insert into public.identity_merge_events(
    proposal_id,actor_id,event_type,state_snapshot
  ) values(
    proposal_id,actor_id,'proposed',jsonb_build_object(
      'sourceCollectibleId',p_source_collectible_id,
      'targetCollectibleId',p_target_collectible_id,
      'sourceStatusBefore',source_status,
      'evidence',p_evidence,'reason',trim(p_reason)
    )
  );
  return proposal_id;
end $$;

create or replace function public.resolve_collectible_identity_merge(
  p_proposal_id uuid,
  p_resolution text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid:=(select auth.uid());
  proposal public.identity_merge_proposals%rowtype;
  resolved_target uuid;
begin
  perform identity_private.require_identity_admin();
  if p_resolution not in ('accepted','rejected') then
    raise exception 'invalid_merge_resolution';
  end if;
  select candidate.* into proposal
  from public.identity_merge_proposals candidate
  where candidate.id=p_proposal_id
  for update;
  if not found then raise exception 'merge_proposal_not_found'; end if;
  if proposal.status<>'pending' then raise exception 'merge_proposal_not_pending'; end if;

  perform 1 from public.collectible_identities identity
  where identity.id in (
    proposal.source_collectible_id,proposal.target_collectible_id
  ) order by identity.id for update;

  if p_resolution='rejected' then
    update public.identity_merge_proposals candidate
    set status='rejected',resolved_by=actor_id,resolved_at=now()
    where candidate.id=proposal.id;
    insert into public.identity_merge_events(
      proposal_id,actor_id,event_type,state_snapshot
    ) values(
      proposal.id,actor_id,'rejected',jsonb_build_object(
        'sourceCollectibleId',proposal.source_collectible_id,
        'targetCollectibleId',proposal.target_collectible_id
      )
    );
    return proposal.id;
  end if;

  resolved_target:=identity_private.resolve_collectible_identity(
    proposal.target_collectible_id
  );
  if resolved_target=proposal.source_collectible_id then
    raise exception 'collectible_identity_merge_cycle';
  end if;
  if not exists(
    select 1 from public.collectible_identities identity
    where identity.id=proposal.source_collectible_id
      and identity.identity_status=proposal.source_status_before
      and identity.merged_into_id is null
  ) then raise exception 'source_identity_changed'; end if;

  update public.collectible_identities identity
  set identity_status='merged',merged_into_id=resolved_target,
      identity_version=identity_version+1,updated_at=now()
  where identity.id=proposal.source_collectible_id;
  update public.identity_merge_proposals candidate
  set status='active',target_collectible_id=resolved_target,
      resolved_by=actor_id,resolved_at=now()
  where candidate.id=proposal.id;
  insert into public.identity_merge_events(
    proposal_id,actor_id,event_type,state_snapshot
  ) values(
    proposal.id,actor_id,'accepted',jsonb_build_object(
      'sourceCollectibleId',proposal.source_collectible_id,
      'targetCollectibleId',resolved_target,
      'sourceStatusBefore',proposal.source_status_before
    )
  );
  return proposal.id;
end $$;

create or replace function public.reverse_collectible_identity_merge(
  p_proposal_id uuid
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid:=(select auth.uid());
  proposal public.identity_merge_proposals%rowtype;
begin
  perform identity_private.require_identity_admin();
  select candidate.* into proposal
  from public.identity_merge_proposals candidate
  where candidate.id=p_proposal_id
  for update;
  if not found then raise exception 'merge_proposal_not_found'; end if;
  if proposal.status<>'active' then raise exception 'merge_not_active'; end if;

  perform 1 from public.collectible_identities identity
  where identity.id=proposal.source_collectible_id for update;
  if not exists(
    select 1 from public.collectible_identities identity
    where identity.id=proposal.source_collectible_id
      and identity.identity_status='merged'
      and identity.merged_into_id=proposal.target_collectible_id
  ) then raise exception 'source_merge_state_changed'; end if;

  update public.collectible_identities identity
  set identity_status=proposal.source_status_before,merged_into_id=null,
      identity_version=identity_version+1,updated_at=now()
  where identity.id=proposal.source_collectible_id;
  update public.identity_merge_proposals candidate
  set status='reversed',reversed_at=now(),resolved_by=actor_id
  where candidate.id=proposal.id;
  insert into public.identity_merge_events(
    proposal_id,actor_id,event_type,state_snapshot
  ) values(
    proposal.id,actor_id,'reversed',jsonb_build_object(
      'sourceCollectibleId',proposal.source_collectible_id,
      'targetCollectibleId',proposal.target_collectible_id,
      'restoredStatus',proposal.source_status_before
    )
  );
  return proposal.id;
end $$;

revoke all on function public.propose_collectible_identity_merge(uuid,uuid,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.propose_collectible_identity_merge(uuid,uuid,jsonb,text)
  to authenticated;
revoke all on function public.resolve_collectible_identity_merge(uuid,text)
  from public,anon,authenticated;
grant execute on function public.resolve_collectible_identity_merge(uuid,text)
  to authenticated;
revoke all on function public.reverse_collectible_identity_merge(uuid)
  from public,anon,authenticated;
grant execute on function public.reverse_collectible_identity_merge(uuid)
  to authenticated;
