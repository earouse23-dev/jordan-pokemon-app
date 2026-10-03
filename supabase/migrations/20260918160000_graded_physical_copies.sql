-- Keep quantity-one graded positions as the physical-copy source of truth.
-- This is additive: legacy aggregates remain unchanged and cannot use the
-- selected-copy sale wrapper until a user separates/corrects them.

-- Every currently exposed collection-item write is user-originated. Preserve
-- untouched legacy provenance, but never let a create or relevant correction
-- manufacture an official certificate claim. A future provider-only path must
-- persist trusted provider evidence before it can introduce official status.
create or replace function identity_private.enforce_user_grade_claim_provenance()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  claim_changed boolean;
begin
  claim_changed := case
    when tg_op='INSERT' then true
    else old.card_state is distinct from new.card_state
      or old.card_id is distinct from new.card_id
      or old.variant_id is distinct from new.variant_id
      or old.collectible_id is distinct from new.collectible_id
      or old.grader is distinct from new.grader
      or old.grade is distinct from new.grade
      or old.certification_number is distinct from new.certification_number
      or old.identity_snapshot is distinct from new.identity_snapshot
  end;

  if claim_changed and (
    new.card_state='graded'
    or pg_catalog.jsonb_exists(
      coalesce(new.identity_snapshot,'{}'::jsonb),'gradeClaimSource'
    )
  ) then
    new.identity_snapshot:=pg_catalog.jsonb_set(
      coalesce(new.identity_snapshot,'{}'::jsonb),
      '{gradeClaimSource}',pg_catalog.to_jsonb('user'::text),true
    );
  end if;
  return new;
end $$;

revoke all on function identity_private.enforce_user_grade_claim_provenance()
  from public,anon,authenticated,service_role;

drop trigger if exists collection_item_grade_claim_provenance_trigger
  on public.collection_items;
create trigger collection_item_grade_claim_provenance_trigger
before insert or update of card_state,card_id,variant_id,collectible_id,grader,grade,certification_number,identity_snapshot
on public.collection_items
for each row execute function identity_private.enforce_user_grade_claim_provenance();

create or replace function public.create_graded_copy_position(
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
  p_idempotency_key text default null,
  p_acquisition_method text default 'unknown'
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  existing_item uuid;
  request_key text := nullif(trim(coalesce(p_idempotency_key,'')),'');
  normalized_cert text := upper(nullif(trim(coalesce(p_certification_number,'')),''));
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_card_state<>'graded' or p_quantity<>1 then
    raise exception 'graded_copy_quantity_one_required';
  end if;
  if request_key is null then raise exception 'graded_copy_idempotency_key_required'; end if;

  select collection_item_id into existing_item
  from public.collection_transactions
  where user_id=owner_id and idempotency_key=request_key;
  if existing_item is not null then return existing_item; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      owner_id::text || ':graded-copy-create:' || request_key,
      0
    )
  );
  select collection_item_id into existing_item
  from public.collection_transactions
  where user_id=owner_id and idempotency_key=request_key;
  if existing_item is not null then return existing_item; end if;

  if normalized_cert is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        owner_id::text || ':' || upper(trim(p_grader)) || ':' || normalized_cert,
        0
      )
    );
    select id into existing_item
    from public.collection_items
    where user_id=owner_id
      and card_state='graded'
      and quantity>0
      and upper(trim(grader))=upper(trim(p_grader))
      and upper(trim(certification_number))=normalized_cert
    order by created_at,id
    limit 1;
    if existing_item is not null then
      raise exception using
        errcode='23505',
        message='duplicate_active_certificate:' || existing_item::text;
    end if;
  end if;

  return public.create_collection_position(
    p_identity,p_card_id,p_variant_id,'graded',null,p_grader,p_grade,
    p_certification_number,1,p_transaction_date,p_unit_price,p_tax,p_shipping,
    p_marketplace_fees,p_grading_fees,p_other_costs,p_currency,p_marketplace,
    p_notes,request_key,p_acquisition_method
  );
end $$;

create or replace function public.record_graded_copy_sale(
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
  target_copy record;
  existing_sale uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_quantity<>1 then raise exception 'graded_copy_sale_quantity_one_required'; end if;
  if p_transaction_date is null or p_transaction_date>current_date then
    raise exception 'invalid_transaction_date';
  end if;
  if p_unit_price is null or p_unit_price<0 or least(
    coalesce(p_marketplace_fees,0),coalesce(p_shipping,0),coalesce(p_other_costs,0)
  )<0 then raise exception 'invalid_sale_amount'; end if;

  if nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select id into existing_sale
    from public.collection_transactions
    where user_id=owner_id
      and idempotency_key=p_idempotency_key
      and transaction_type='sale'
      and collection_item_id=p_collection_item_id;
    if existing_sale is not null then return existing_sale; end if;
  end if;

  select id,card_state,quantity,currency into target_copy
  from public.collection_items
  where id=p_collection_item_id and user_id=owner_id
  for update;
  if target_copy.id is null then raise exception 'copy_not_found'; end if;

  if nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select id into existing_sale
    from public.collection_transactions
    where user_id=owner_id
      and idempotency_key=p_idempotency_key
      and transaction_type='sale'
      and collection_item_id=p_collection_item_id;
    if existing_sale is not null then return existing_sale; end if;
  end if;

  if target_copy.card_state<>'graded' or target_copy.quantity<>1 then
    raise exception 'graded_copy_sale_unavailable';
  end if;
  if p_currency is null or upper(p_currency)<>target_copy.currency then
    raise exception 'currency_mismatch';
  end if;

  return public.record_collection_sale(
    p_collection_item_id,p_transaction_date,1,p_unit_price,p_marketplace_fees,
    p_shipping,p_other_costs,p_currency,p_marketplace,p_notes,p_idempotency_key
  );
end $$;

revoke all on function public.create_graded_copy_position(
  jsonb,uuid,uuid,text,text,text,numeric,text,integer,date,numeric,numeric,numeric,
  numeric,numeric,numeric,text,text,text,text,text
) from public,anon;
grant execute on function public.create_graded_copy_position(
  jsonb,uuid,uuid,text,text,text,numeric,text,integer,date,numeric,numeric,numeric,
  numeric,numeric,numeric,text,text,text,text,text
) to authenticated,service_role;

revoke all on function public.record_graded_copy_sale(
  uuid,date,integer,numeric,numeric,numeric,numeric,text,text,text,text
) from public,anon;
grant execute on function public.record_graded_copy_sale(
  uuid,date,integer,numeric,numeric,numeric,numeric,text,text,text,text
) to authenticated,service_role;
