-- Acquisition provenance and private, owner-scoped digital grading estimates.
-- Existing rows remain nullable so the migration never invents history.

alter table public.collection_transactions
  add column if not exists acquisition_method text
    check (acquisition_method is null or acquisition_method in (
      'direct_purchase','paid_pack','free_pack','trade','gift','prize','free_card','unknown'
    )),
  add column if not exists acquisition_context jsonb not null default '{}'::jsonb;

alter table public.purchase_lots
  add column if not exists acquisition_method text
    check (acquisition_method is null or acquisition_method in (
      'direct_purchase','paid_pack','free_pack','trade','gift','prize','free_card','unknown'
    )),
  add column if not exists acquisition_context jsonb not null default '{}'::jsonb;

comment on column public.collection_transactions.acquisition_method is
  'How this position was acquired. Null is retained for legacy records whose history is not known.';
comment on column public.collection_transactions.acquisition_context is
  'Noncash context such as exchanged-card value; never included in Paid.';
comment on column public.purchase_lots.acquisition_method is
  'Acquisition method copied from the purchase transaction for remaining-position reporting.';

alter table public.collection_items
  drop constraint if exists collection_items_market_state_check;
alter table public.collection_items
  add constraint collection_items_market_state_check
  check (
    (card_state='raw' and grader is null and grade is null)
    or (card_state='graded' and raw_condition is null and grader is not null and grade is not null)
    or (card_state='sealed' and raw_condition is null and grader is null and grade is null)
  ) not valid;
alter table public.collection_items validate constraint collection_items_market_state_check;

create table if not exists public.digital_grade_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  predicted_grade numeric(4,1) check (predicted_grade is null or predicted_grade between 1 and 10),
  predicted_grade_low numeric(4,1) not null check (predicted_grade_low between 1 and 10),
  predicted_grade_high numeric(4,1) not null check (predicted_grade_high between 1 and 10),
  derived_raw_condition text check (
    derived_raw_condition is null or derived_raw_condition in (
      'near_mint','lightly_played','moderately_played','heavily_played','damaged'
    )
  ),
  subscores jsonb not null default '{}'::jsonb,
  defects jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  photo_quality jsonb not null default '{}'::jsonb,
  model_version text not null,
  estimate_status text not null default 'confirmed'
    check (estimate_status in ('confirmed','abstained','superseded')),
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id) on delete cascade,
  check (predicted_grade_low <= predicted_grade_high),
  check (
    predicted_grade is null
    or predicted_grade between predicted_grade_low and predicted_grade_high
  )
);

create index if not exists digital_grade_assessments_owner_item_idx
  on public.digital_grade_assessments(user_id,collection_item_id,assessed_at desc);
create unique index if not exists digital_grade_assessments_one_confirmed_idx
  on public.digital_grade_assessments(collection_item_id)
  where estimate_status='confirmed';

alter table public.digital_grade_assessments enable row level security;
create policy "digital grades own rows" on public.digital_grade_assessments
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

revoke all on public.digital_grade_assessments from public,anon;
grant select,insert,update,delete on public.digital_grade_assessments to authenticated;
grant all on public.digital_grade_assessments to service_role;

drop function if exists public.create_collection_position(
  jsonb,uuid,uuid,text,text,text,numeric,text,integer,date,numeric,numeric,numeric,
  numeric,numeric,numeric,text,text,text,text
);

create function public.create_collection_position(
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
  target_collection uuid;
  target_item uuid;
  target_transaction uuid;
  subtotal_amount numeric(14,2);
  total_amount numeric(14,2);
  normalized_method text := lower(coalesce(nullif(trim(p_acquisition_method),''),'unknown'));
  basis_known boolean := case when p_identity->>'acquisitionCostKnown'='false' then false else true end;
  acquired_date_known boolean := case when p_identity->>'acquisitionDateKnown'='false' then false else true end;
  acquisition_details jsonb := coalesce(p_identity->'acquisitionContext','{}'::jsonb);
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if normalized_method not in (
    'direct_purchase','paid_pack','free_pack','trade','gift','prize','free_card','unknown'
  ) then raise exception 'invalid_acquisition_method'; end if;
  if p_transaction_date is not null and p_transaction_date > current_date then raise exception 'future_acquisition_date'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if p_unit_price is null or p_unit_price < 0 or least(
    coalesce(p_tax,0),coalesce(p_shipping,0),coalesce(p_marketplace_fees,0),
    coalesce(p_grading_fees,0),coalesce(p_other_costs,0)
  ) < 0 then raise exception 'invalid_cost'; end if;
  if normalized_method in ('free_pack','gift','prize','free_card') and (
    p_unit_price<>0 or coalesce(p_tax,0)<>0 or coalesce(p_shipping,0)<>0
    or coalesce(p_marketplace_fees,0)<>0 or coalesce(p_grading_fees,0)<>0
    or coalesce(p_other_costs,0)<>0
  ) then raise exception 'free_acquisition_must_have_zero_cost'; end if;
  if p_card_state not in ('raw','graded','sealed') then raise exception 'invalid_card_state'; end if;
  if p_card_state='raw' and (p_grader is not null or p_grade is not null) then raise exception 'invalid_raw_state'; end if;
  if p_card_state='graded' and (p_raw_condition is not null or p_grader is null or p_grade is null) then raise exception 'invalid_graded_state'; end if;
  if p_card_state='sealed' and (p_raw_condition is not null or p_grader is not null or p_grade is not null) then raise exception 'invalid_sealed_state'; end if;

  if nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select collection_item_id into target_item
    from public.collection_transactions
    where user_id=owner_id and idempotency_key=p_idempotency_key;
    if target_item is not null then return target_item; end if;
  end if;

  select id into target_collection
  from public.collections
  where user_id=owner_id
  order by created_at,id
  limit 1;
  if target_collection is null then
    insert into public.collections(user_id,name)
    values(owner_id,'My collection')
    returning id into target_collection;
  end if;

  insert into public.collection_items(
    collection_id,user_id,card_id,variant_id,identity_snapshot,card_state,raw_condition,
    grader,grade,certification_number,quantity,notes,status,currency
  ) values(
    target_collection,owner_id,p_card_id,p_variant_id,coalesce(p_identity,'{}'::jsonb),
    p_card_state,nullif(p_raw_condition,''),upper(nullif(p_grader,'')),p_grade,
    nullif(p_certification_number,''),p_quantity,p_notes,'owned',upper(p_currency)
  ) returning id into target_item;

  subtotal_amount := round(p_unit_price*p_quantity,2);
  total_amount := subtotal_amount+coalesce(p_tax,0)+coalesce(p_shipping,0)
    +coalesce(p_marketplace_fees,0)+coalesce(p_grading_fees,0)+coalesce(p_other_costs,0);
  insert into public.collection_transactions(
    user_id,collection_item_id,transaction_type,transaction_date,quantity,unit_price,
    subtotal,tax,shipping,marketplace_fees,grading_fees,other_costs,total_cost,currency,
    marketplace,notes,idempotency_key,acquisition_method,acquisition_context
  ) values(
    owner_id,target_item,'purchase',coalesce(p_transaction_date,current_date),p_quantity,p_unit_price,
    subtotal_amount,coalesce(p_tax,0),coalesce(p_shipping,0),coalesce(p_marketplace_fees,0),
    coalesce(p_grading_fees,0),coalesce(p_other_costs,0),total_amount,upper(p_currency),
    p_marketplace,p_notes,p_idempotency_key,normalized_method,acquisition_details
  ) returning id into target_transaction;

  insert into public.purchase_lots(
    user_id,collection_item_id,purchase_transaction_id,acquired_at,quantity_acquired,
    quantity_remaining,total_cost,remaining_cost,currency,cost_basis_known,
    acquired_at_known,acquisition_method,acquisition_context
  ) values(
    owner_id,target_item,target_transaction,coalesce(p_transaction_date,current_date),
    p_quantity,p_quantity,total_amount,total_amount,upper(p_currency),basis_known,
    acquired_date_known,normalized_method,acquisition_details
  );
  return target_item;
end $$;

revoke all on function public.create_collection_position(
  jsonb,uuid,uuid,text,text,text,numeric,text,integer,date,numeric,numeric,numeric,
  numeric,numeric,numeric,text,text,text,text,text
) from public,anon;
grant execute on function public.create_collection_position(
  jsonb,uuid,uuid,text,text,text,numeric,text,integer,date,numeric,numeric,numeric,
  numeric,numeric,numeric,text,text,text,text,text
) to authenticated;

drop function if exists public.record_collection_purchase(
  uuid,date,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text
);

create function public.record_collection_purchase(
  p_collection_item_id uuid,
  p_transaction_date date,
  p_quantity integer,
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
  item_quantity integer;
  item_currency text;
  purchase_id uuid;
  subtotal_amount numeric(14,2);
  total_amount numeric(14,2);
  normalized_method text := lower(coalesce(nullif(trim(p_acquisition_method),''),'unknown'));
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if normalized_method not in (
    'direct_purchase','paid_pack','free_pack','trade','gift','prize','free_card','unknown'
  ) then raise exception 'invalid_acquisition_method'; end if;
  if p_transaction_date is not null and p_transaction_date > current_date then raise exception 'future_acquisition_date'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if p_unit_price is null or p_unit_price < 0 or least(
    coalesce(p_tax,0),coalesce(p_shipping,0),coalesce(p_marketplace_fees,0),
    coalesce(p_grading_fees,0),coalesce(p_other_costs,0)
  ) < 0 then raise exception 'invalid_cost'; end if;
  if normalized_method in ('free_pack','gift','prize','free_card') and (
    p_unit_price<>0 or coalesce(p_tax,0)<>0 or coalesce(p_shipping,0)<>0
    or coalesce(p_marketplace_fees,0)<>0 or coalesce(p_grading_fees,0)<>0
    or coalesce(p_other_costs,0)<>0
  ) then raise exception 'free_acquisition_must_have_zero_cost'; end if;

  if nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select id into purchase_id
    from public.collection_transactions
    where user_id=owner_id and idempotency_key=p_idempotency_key;
    if purchase_id is not null then return purchase_id; end if;
  end if;

  select quantity,currency into item_quantity,item_currency
  from public.collection_items
  where id=p_collection_item_id and user_id=owner_id
  for update;
  if item_quantity is null then raise exception 'position_not_found'; end if;
  if upper(p_currency)<>item_currency then raise exception 'currency_mismatch'; end if;

  subtotal_amount := round(p_unit_price*p_quantity,2);
  total_amount := subtotal_amount+coalesce(p_tax,0)+coalesce(p_shipping,0)
    +coalesce(p_marketplace_fees,0)+coalesce(p_grading_fees,0)+coalesce(p_other_costs,0);
  insert into public.collection_transactions(
    user_id,collection_item_id,transaction_type,transaction_date,quantity,unit_price,
    subtotal,tax,shipping,marketplace_fees,grading_fees,other_costs,total_cost,currency,
    marketplace,notes,idempotency_key,acquisition_method
  ) values(
    owner_id,p_collection_item_id,'purchase',coalesce(p_transaction_date,current_date),
    p_quantity,p_unit_price,subtotal_amount,coalesce(p_tax,0),coalesce(p_shipping,0),
    coalesce(p_marketplace_fees,0),coalesce(p_grading_fees,0),coalesce(p_other_costs,0),
    total_amount,item_currency,p_marketplace,p_notes,p_idempotency_key,normalized_method
  ) returning id into purchase_id;

  insert into public.purchase_lots(
    user_id,collection_item_id,purchase_transaction_id,acquired_at,quantity_acquired,
    quantity_remaining,total_cost,remaining_cost,currency,cost_basis_known,
    acquired_at_known,acquisition_method
  ) values(
    owner_id,p_collection_item_id,purchase_id,coalesce(p_transaction_date,current_date),
    p_quantity,p_quantity,total_amount,total_amount,item_currency,true,
    p_transaction_date is not null,normalized_method
  );
  update public.collection_items
  set quantity=item_quantity+p_quantity,status='owned',updated_at=now()
  where id=p_collection_item_id and user_id=owner_id;
  return purchase_id;
end $$;

revoke all on function public.record_collection_purchase(
  uuid,date,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text,text
) from public,anon;
grant execute on function public.record_collection_purchase(
  uuid,date,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text,text
) to authenticated;

create or replace view public.portfolio_position_summary with (security_invoker=true) as
select
  item.id,item.user_id,item.identity_snapshot,item.card_id,item.variant_id,item.card_state,
  item.raw_condition,item.grader,item.grade,item.certification_number,item.quantity,item.status,
  item.currency,item.created_at,item.updated_at,
  lots.remaining_cost_basis::numeric(14,2) as remaining_cost_basis,
  sales.allocated_sold_cost::numeric(14,2) as allocated_sold_cost,
  coalesce(sales.net_sale_proceeds,0)::numeric(14,2) as net_sale_proceeds,
  lots.first_acquired_at,
  lots.acquisition_method
from public.collection_items item
left join lateral (
  select
    case
      when count(*) filter (where lot.quantity_remaining>0)=0 then 0
      when bool_and(lot.cost_basis_known) filter (where lot.quantity_remaining>0)
        then sum(lot.remaining_cost) filter (where lot.quantity_remaining>0)
      else null
    end remaining_cost_basis,
    min(lot.acquired_at) filter (where lot.acquired_at_known) first_acquired_at,
    case
      when count(distinct lot.acquisition_method) filter (where lot.quantity_remaining>0)=1
        then min(lot.acquisition_method) filter (where lot.quantity_remaining>0)
      when count(*) filter (where lot.quantity_remaining>0 and lot.acquisition_method is not null)>1
        then 'mixed'
      else null
    end acquisition_method
  from public.purchase_lots lot
  where lot.collection_item_id=item.id and lot.user_id=item.user_id
) lots on true
left join lateral (
  select sum(sale.net_proceeds) net_sale_proceeds,
    (select case
      when count(*)=0 then 0
      when bool_and(allocation.cost_basis_known) then sum(allocation.allocated_cost)
      else null
    end
    from public.fifo_lot_allocations allocation
    where allocation.user_id=item.user_id
      and allocation.sale_transaction_id in (
        select transaction.id
        from public.collection_transactions transaction
        where transaction.collection_item_id=item.id
          and transaction.user_id=item.user_id
          and transaction.transaction_type='sale'
      )) allocated_sold_cost
  from public.collection_transactions sale
  where sale.collection_item_id=item.id
    and sale.user_id=item.user_id
    and sale.transaction_type='sale'
) sales on true;

grant select on public.portfolio_position_summary to authenticated;

-- Usage claims are server concerns. Replace the two client-callable
-- security-definer functions with one service-role-only function.
drop function if exists public.claim_vision_usage(integer,integer);
drop function if exists public.claim_advisor_usage(integer,integer);

create function public.claim_ai_usage(
  p_user_id uuid,
  p_event_type text,
  p_maximum integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  window_start timestamptz;
  oldest_in_window timestamptz;
  usage_count integer;
  retry_after integer;
begin
  if p_user_id is null then raise exception 'user_required'; end if;
  if p_event_type not in ('vision_analysis','portfolio_advisor') then
    raise exception 'invalid_event_type';
  end if;
  if p_maximum is null or p_maximum<1 or p_maximum>100 then
    raise exception 'invalid_rate_limit';
  end if;
  if p_window_seconds is null or p_window_seconds<60 or p_window_seconds>86400 then
    raise exception 'invalid_rate_window';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text||':'||p_event_type,0)
  );
  window_start := clock_timestamp()-make_interval(secs=>p_window_seconds);
  delete from public.usage_events
  where user_id=p_user_id
    and event_type=p_event_type
    and occurred_at<clock_timestamp()-interval '7 days';

  select count(*),min(occurred_at)
  into usage_count,oldest_in_window
  from public.usage_events
  where user_id=p_user_id
    and event_type=p_event_type
    and occurred_at>=window_start;

  if usage_count>=p_maximum then
    retry_after := greatest(
      1,
      ceil(extract(epoch from (
        oldest_in_window+make_interval(secs=>p_window_seconds)-clock_timestamp()
      )))::integer
    );
    return jsonb_build_object('allowed',false,'retryAfter',retry_after);
  end if;

  insert into public.usage_events(user_id,event_type,quantity)
  values(p_user_id,p_event_type,1);
  return jsonb_build_object('allowed',true,'retryAfter',0);
end $$;

revoke all on function public.claim_ai_usage(uuid,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.claim_ai_usage(uuid,text,integer,integer)
  to service_role;
