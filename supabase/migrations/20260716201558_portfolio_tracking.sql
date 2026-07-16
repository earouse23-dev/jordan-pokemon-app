-- Authenticated market portfolio tracking.
-- Purchases remain separate FIFO lots; future transaction dates are rejected.

alter table public.cards add column if not exists game text not null default 'pokemon';
alter table public.cards add column if not exists normalized_name text;
alter table public.cards add column if not exists printed_total text;
alter table public.cards add column if not exists release_date date;
alter table public.cards add column if not exists image_url_small text;
alter table public.cards add column if not exists image_url_large text;
alter table public.cards add column if not exists canonical_fingerprint text;
alter table public.cards add column if not exists created_at timestamptz not null default now();
alter table public.cards add column if not exists updated_at timestamptz not null default now();
create unique index if not exists cards_canonical_fingerprint_unique
  on public.cards(canonical_fingerprint) where canonical_fingerprint is not null;

alter table public.card_variants add column if not exists variant_type text;
alter table public.card_variants add column if not exists is_holo boolean not null default false;
alter table public.card_variants add column if not exists is_reverse_holo boolean not null default false;
alter table public.card_variants add column if not exists is_first_edition boolean not null default false;
alter table public.card_variants add column if not exists is_shadowless boolean not null default false;
alter table public.card_variants add column if not exists is_promo boolean not null default false;
alter table public.card_variants add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.card_variants add column if not exists created_at timestamptz not null default now();
alter table public.card_variants add column if not exists updated_at timestamptz not null default now();

create table if not exists public.card_provider_mappings (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  card_variant_id uuid references public.card_variants(id) on delete cascade,
  provider text not null,
  provider_card_id text not null,
  provider_variant_id text,
  provider_set_id text,
  provider_url text,
  match_status text not null default 'automatic'
    check (match_status in ('automatic','manually_verified','ambiguous','rejected','missing')),
  match_confidence numeric(5,4) check (match_confidence between 0 and 1),
  match_method text,
  raw_provider_metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists card_provider_mappings_provider_identity_unique
  on public.card_provider_mappings(provider,provider_card_id,coalesce(provider_variant_id,''));
create index if not exists card_provider_mappings_card_idx
  on public.card_provider_mappings(card_id,card_variant_id,provider,match_status);

create table if not exists public.price_observations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  card_variant_id uuid references public.card_variants(id) on delete cascade,
  provider text not null,
  market text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  valuation_type text not null
    check (valuation_type in ('market','last_sold','average_sale','median_sale','low','high','listing','provider_estimate')),
  card_state text not null check (card_state in ('raw','graded','sealed')),
  raw_condition text check (raw_condition is null or raw_condition in ('near_mint','lightly_played','moderately_played','heavily_played','damaged')),
  provider_condition text,
  grader text,
  grade numeric(4,1) check (grade is null or grade between 1 and 10),
  grade_label text,
  price_low numeric(14,2) check (price_low is null or price_low >= 0),
  price_mid numeric(14,2) check (price_mid is null or price_mid >= 0),
  price_high numeric(14,2) check (price_high is null or price_high >= 0),
  market_price numeric(14,2) check (market_price is null or market_price >= 0),
  last_sold_price numeric(14,2) check (last_sold_price is null or last_sold_price >= 0),
  listing_price numeric(14,2) check (listing_price is null or listing_price >= 0),
  sales_count integer check (sales_count is null or sales_count >= 0),
  sample_size integer check (sample_size is null or sample_size >= 0),
  confidence_score numeric(5,4) check (confidence_score is null or confidence_score between 0 and 1),
  observed_at timestamptz not null,
  provider_updated_at timestamptz,
  source_url text,
  raw_provider_payload jsonb not null default '{}'::jsonb,
  anomalous boolean not null default false,
  anomaly_reason text,
  created_at timestamptz not null default now(),
  check (
    (card_state='raw' and grader is null and grade is null)
    or (card_state='graded' and grader is not null and grade is not null and raw_condition is null)
    or card_state='sealed'
  ),
  check (coalesce(market_price,last_sold_price,listing_price,price_mid,price_low,price_high) is not null)
);
create unique index if not exists price_observations_dedupe_unique on public.price_observations(
  provider,card_id,coalesce(card_variant_id,'00000000-0000-0000-0000-000000000000'::uuid),market,currency,
  valuation_type,card_state,coalesce(raw_condition,''),coalesce(grader,''),coalesce(grade,-1),observed_at,
  coalesce(market_price,last_sold_price,listing_price,price_mid,price_low,price_high)
);
create index if not exists price_observations_latest_idx
  on public.price_observations(card_id,card_variant_id,card_state,raw_condition,grader,grade,observed_at desc);
create index if not exists price_observations_history_idx
  on public.price_observations(card_id,card_variant_id,provider,observed_at);
create index if not exists price_observations_comparison_idx
  on public.price_observations(card_id,card_variant_id,provider,market,card_state,grader,grade,observed_at desc);

alter table public.collection_items add column if not exists card_id uuid references public.cards(id);
alter table public.collection_items add column if not exists identity_snapshot jsonb not null default '{}'::jsonb;
alter table public.collection_items add column if not exists card_state text not null default 'raw'
  check (card_state in ('raw','graded'));
alter table public.collection_items add column if not exists raw_condition text
  check (raw_condition is null or raw_condition in ('near_mint','lightly_played','moderately_played','heavily_played','damaged'));
alter table public.collection_items add column if not exists grader text;
alter table public.collection_items add column if not exists grade numeric(4,1) check (grade is null or grade between 1 and 10);
alter table public.collection_items add column if not exists certification_number text;
alter table public.collection_items add column if not exists image_override_url text;
alter table public.collection_items add column if not exists status text not null default 'owned'
  check (status in ('owned','sold','listed','traded','archived'));
alter table public.collection_items add column if not exists currency text not null default 'USD'
  check (currency ~ '^[A-Z]{3}$');
alter table public.collection_items add constraint collection_items_market_state_check
  check (
    (card_state='raw' and raw_condition is not null and grader is null and grade is null)
    or (card_state='graded' and raw_condition is null and grader is not null and grade is not null)
  ) not valid;
create index if not exists collection_items_portfolio_idx
  on public.collection_items(user_id,status,card_state,grader,grade);

create table if not exists public.collection_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  transaction_type text not null
    check (transaction_type in ('purchase','sale','trade_in','trade_out','grading_submission','grading_return','fee','adjustment')),
  transaction_date date not null check (transaction_date <= current_date),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  shipping numeric(14,2) not null default 0 check (shipping >= 0),
  marketplace_fees numeric(14,2) not null default 0 check (marketplace_fees >= 0),
  grading_fees numeric(14,2) not null default 0 check (grading_fees >= 0),
  other_costs numeric(14,2) not null default 0 check (other_costs >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  net_proceeds numeric(14,2) check (net_proceeds is null or net_proceeds >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  marketplace text,
  counterparty text,
  notes text check (char_length(notes) <= 10000),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (collection_item_id,user_id) references public.collection_items(id,user_id) on delete cascade,
  unique(user_id,idempotency_key)
);
create index if not exists collection_transactions_item_date_idx
  on public.collection_transactions(collection_item_id,transaction_date,created_at);
create index if not exists collection_transactions_owner_date_idx
  on public.collection_transactions(user_id,transaction_date desc);

create table if not exists public.purchase_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  purchase_transaction_id uuid not null references public.collection_transactions(id) on delete cascade,
  acquired_at date not null check (acquired_at <= current_date),
  quantity_acquired integer not null check (quantity_acquired > 0),
  quantity_remaining integer not null check (quantity_remaining between 0 and quantity_acquired),
  total_cost numeric(14,2) not null check (total_cost >= 0),
  remaining_cost numeric(14,2) not null check (remaining_cost >= 0 and remaining_cost <= total_cost),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  foreign key (collection_item_id,user_id) references public.collection_items(id,user_id) on delete cascade,
  unique(purchase_transaction_id)
);
create index if not exists purchase_lots_fifo_idx
  on public.purchase_lots(collection_item_id,acquired_at,id) where quantity_remaining > 0;

create table if not exists public.fifo_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_transaction_id uuid not null references public.collection_transactions(id) on delete cascade,
  purchase_lot_id uuid not null references public.purchase_lots(id),
  quantity integer not null check (quantity > 0),
  allocated_cost numeric(14,2) not null check (allocated_cost >= 0),
  created_at timestamptz not null default now(),
  unique(sale_transaction_id,purchase_lot_id)
);
create index if not exists fifo_lot_allocations_owner_idx on public.fifo_lot_allocations(user_id,sale_transaction_id);

create table if not exists public.price_anomalies (
  id bigint generated always as identity primary key,
  price_observation_id uuid references public.price_observations(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  anomaly_type text not null check (anomaly_type in ('price_jump','provider_disagreement','mapping_changed','price_disappeared')),
  threshold_percent numeric(7,2),
  measured_percent numeric(9,2),
  status text not null default 'open' check (status in ('open','accepted','excluded','resolved')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists price_anomalies_status_idx on public.price_anomalies(status,created_at desc);

create table if not exists public.provider_sync_status (
  provider text primary key,
  enabled boolean not null default false,
  disabled_reason text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error_code text,
  rate_limit_remaining integer,
  rate_limit_resets_at timestamptz,
  sync_cursor text,
  updated_at timestamptz not null default now()
);
insert into public.provider_sync_status(provider,enabled,disabled_reason) values
  ('pkmnprices',true,null),('tcgdex',true,null),
  ('alt',false,'Licensed API access is not configured.'),
  ('cardladder',false,'Licensed API access is not configured.')
on conflict(provider) do update set enabled=excluded.enabled,disabled_reason=excluded.disabled_reason,updated_at=now();

alter table public.card_provider_mappings enable row level security;
alter table public.price_observations enable row level security;
alter table public.collection_transactions enable row level security;
alter table public.purchase_lots enable row level security;
alter table public.fifo_lot_allocations enable row level security;
alter table public.price_anomalies enable row level security;
alter table public.provider_sync_status enable row level security;

create policy "authenticated catalog mappings read" on public.card_provider_mappings
  for select to authenticated using (true);
create policy "authenticated price observations read" on public.price_observations
  for select to authenticated using (true);
create policy "collection transactions own rows" on public.collection_transactions
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "purchase lots own rows" on public.purchase_lots
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "fifo allocations own rows" on public.fifo_lot_allocations
  for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "admins read price anomalies" on public.price_anomalies
  for select to authenticated using (coalesce((select auth.jwt())->'app_metadata'->>'role','')='admin');
create policy "admins read provider sync status" on public.provider_sync_status
  for select to authenticated using (coalesce((select auth.jwt())->'app_metadata'->>'role','')='admin');

grant select on public.card_provider_mappings,public.price_observations to authenticated;
grant select,insert,update,delete on public.collection_transactions,public.purchase_lots,public.fifo_lot_allocations to authenticated;
grant select,insert,update,delete on public.collections,public.collection_items to authenticated;
grant select on public.cards,public.card_sets,public.card_variants,public.card_images to authenticated;
grant select on public.price_anomalies,public.provider_sync_status to authenticated;
grant all on public.card_provider_mappings,public.price_observations,public.collection_transactions,public.purchase_lots,
  public.fifo_lot_allocations,public.price_anomalies,public.provider_sync_status to service_role;
grant usage,select on all sequences in schema public to authenticated,service_role;

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
  if p_card_state='raw' and (p_raw_condition is null or p_grader is not null or p_grade is not null) then raise exception 'invalid_raw_state'; end if;
  if p_card_state='graded' and (p_raw_condition is not null or p_grader is null or p_grade is null) then raise exception 'invalid_graded_state'; end if;

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
    insert into public.fifo_lot_allocations(user_id,sale_transaction_id,purchase_lot_id,quantity,allocated_cost)
      values(owner_id,sale_id,lot.id,take_quantity,take_cost);
    update public.purchase_lots set quantity_remaining=quantity_remaining-take_quantity,remaining_cost=remaining_cost-take_cost where id=lot.id;
    remaining := remaining-take_quantity;
  end loop;
  if remaining>0 then raise exception 'fifo_lots_incomplete'; end if;
  update public.collection_items set quantity=quantity-p_quantity,status=case when quantity-p_quantity=0 then 'sold' else status end,updated_at=now()
    where id=p_collection_item_id and user_id=owner_id;
  return sale_id;
end $$;

revoke all on function public.create_collection_position(jsonb,uuid,uuid,text,text,text,numeric,text,integer,date,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text) from public,anon;
grant execute on function public.create_collection_position(jsonb,uuid,uuid,text,text,text,numeric,text,integer,date,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text,text) to authenticated;
revoke all on function public.record_collection_sale(uuid,date,integer,numeric,numeric,numeric,numeric,text,text,text,text) from public,anon;
grant execute on function public.record_collection_sale(uuid,date,integer,numeric,numeric,numeric,numeric,text,text,text,text) to authenticated;

create or replace view public.portfolio_position_summary with (security_invoker=true) as
select
  item.id,item.user_id,item.identity_snapshot,item.card_id,item.variant_id,item.card_state,item.raw_condition,item.grader,item.grade,
  item.certification_number,item.quantity,item.status,item.currency,item.created_at,item.updated_at,
  coalesce(lots.remaining_cost_basis,0)::numeric(14,2) as remaining_cost_basis,
  coalesce(sales.allocated_sold_cost,0)::numeric(14,2) as allocated_sold_cost,
  coalesce(sales.net_sale_proceeds,0)::numeric(14,2) as net_sale_proceeds,
  lots.first_acquired_at
from public.collection_items item
left join lateral (
  select sum(lot.remaining_cost) remaining_cost_basis,min(lot.acquired_at) first_acquired_at
  from public.purchase_lots lot where lot.collection_item_id=item.id and lot.user_id=item.user_id
) lots on true
left join lateral (
  select sum(sale.net_proceeds) net_sale_proceeds,
    (select sum(allocation.allocated_cost) from public.fifo_lot_allocations allocation
      where allocation.user_id=item.user_id and allocation.sale_transaction_id in
        (select transaction.id from public.collection_transactions transaction
         where transaction.collection_item_id=item.id and transaction.user_id=item.user_id and transaction.transaction_type='sale')) allocated_sold_cost
  from public.collection_transactions sale
  where sale.collection_item_id=item.id and sale.user_id=item.user_id and sale.transaction_type='sale'
) sales on true;
grant select on public.portfolio_position_summary to authenticated;
