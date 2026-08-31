drop function if exists public.record_collection_purchase(
  uuid,date,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text,text
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
  p_acquisition_method text default 'unknown',
  p_cost_basis_known boolean default true,
  p_acquisition_date_known boolean default true
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  item_quantity integer;
  item_currency text;
  purchase_id uuid;
  subtotal_amount numeric(14,2);
  total_amount numeric(14,2);
  normalized_method text := lower(coalesce(nullif(trim(p_acquisition_method),''),'unknown'));
  basis_known boolean := coalesce(p_cost_basis_known,true);
  acquired_date_known boolean := coalesce(p_acquisition_date_known,true);
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if normalized_method not in (
    'direct_purchase','paid_pack','free_pack','trade','gift','prize','free_card','unknown'
  ) then raise exception 'invalid_acquisition_method'; end if;
  if p_transaction_date is not null and p_transaction_date > current_date then
    raise exception 'future_acquisition_date';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if p_unit_price is null or p_unit_price < 0 or least(
    coalesce(p_tax,0),coalesce(p_shipping,0),coalesce(p_marketplace_fees,0),
    coalesce(p_grading_fees,0),coalesce(p_other_costs,0)
  ) < 0 then raise exception 'invalid_cost'; end if;
  if normalized_method in ('free_pack','gift','prize','free_card') then
    basis_known := true;
    if (
      p_unit_price<>0 or coalesce(p_tax,0)<>0 or coalesce(p_shipping,0)<>0
      or coalesce(p_marketplace_fees,0)<>0 or coalesce(p_grading_fees,0)<>0
      or coalesce(p_other_costs,0)<>0
    ) then raise exception 'free_acquisition_must_have_zero_cost'; end if;
  end if;

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
    p_quantity,p_quantity,total_amount,total_amount,item_currency,basis_known,
    acquired_date_known,normalized_method
  );
  update public.collection_items
  set quantity=item_quantity+p_quantity,status='owned',updated_at=now()
  where id=p_collection_item_id and user_id=owner_id;
  return purchase_id;
end $$;

revoke all on function public.record_collection_purchase(
  uuid,date,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text,text,boolean,boolean
) from public,anon;
grant execute on function public.record_collection_purchase(
  uuid,date,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text,text,boolean,boolean
) to authenticated;
