-- Keep the amount paid separate from the matching market price near purchase.
-- Current value is never stored here; it continues to come from price providers.

alter table public.purchase_lots
  add column if not exists market_unit_price_at_purchase numeric(14,2)
    check (market_unit_price_at_purchase is null or market_unit_price_at_purchase > 0),
  add column if not exists market_price_currency text
    check (market_price_currency is null or market_price_currency ~ '^[A-Z]{3}$'),
  add column if not exists market_price_provider text
    check (
      market_price_provider is null
      or char_length(market_price_provider) between 1 and 80
    ),
  add column if not exists market_price_observed_at timestamptz;

comment on column public.purchase_lots.market_unit_price_at_purchase is
  'Matching provider market price for one item on, or within three days of, the recorded acquisition date. Never used as acquisition cost.';
comment on column public.purchase_lots.market_price_provider is
  'Provider that supplied the historical market reference.';
comment on column public.purchase_lots.market_price_observed_at is
  'Provider observation time for the historical market reference.';

create or replace function public.set_purchase_market_reference(
  p_purchase_lot_id uuid,
  p_market_unit_price numeric,
  p_currency text,
  p_provider text,
  p_observed_at timestamptz
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  purchase_date date;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_market_unit_price is null or p_market_unit_price <= 0
     or p_market_unit_price > 999999999999.99 then
    raise exception 'invalid_market_price';
  end if;
  if upper(coalesce(p_currency,'')) !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;
  if nullif(btrim(p_provider),'') is null
     or char_length(btrim(p_provider)) > 80 then
    raise exception 'invalid_provider';
  end if;
  if p_observed_at is null or p_observed_at > now() + interval '5 minutes' then
    raise exception 'invalid_observation_time';
  end if;

  select lot.acquired_at
  into purchase_date
  from public.purchase_lots lot
  where lot.id=p_purchase_lot_id
    and lot.user_id=owner_id
  for update;

  if purchase_date is null then raise exception 'purchase_lot_not_found'; end if;
  if abs(purchase_date - (p_observed_at at time zone 'UTC')::date) > 3 then
    raise exception 'market_reference_date_mismatch';
  end if;

  update public.purchase_lots
  set market_unit_price_at_purchase=round(p_market_unit_price,2),
      market_price_currency=upper(p_currency),
      market_price_provider=btrim(p_provider),
      market_price_observed_at=p_observed_at
  where id=p_purchase_lot_id
    and user_id=owner_id;

  return p_purchase_lot_id;
end
$$;

revoke all on function public.set_purchase_market_reference(
  uuid,numeric,text,text,timestamptz
) from public,anon;
grant execute on function public.set_purchase_market_reference(
  uuid,numeric,text,text,timestamptz
) to authenticated;
