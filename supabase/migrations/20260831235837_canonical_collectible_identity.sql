-- Canonical collectible identity foundation.
-- Additive only: existing catalog, portfolio, price, and grading records remain
-- intact. Card-variant identities reuse the existing variant UUID. Card-printing
-- identities reuse the existing card UUID. Sealed and unresolved identities are
-- allocated once and retained even after a reversible merge.

set lock_timeout = '5s';
set statement_timeout = '120s';

create schema if not exists identity_private;
revoke all on schema identity_private from public, anon, authenticated;

create table if not exists public.sealed_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  game text not null default 'pokemon',
  name text not null check (char_length(name) between 1 and 300),
  set_name text,
  product_type text,
  language text not null check (language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  release_date date,
  canonical_key text not null unique check (char_length(canonical_key) between 3 and 500),
  identity_status text not null default 'active'
    check (identity_status in ('active','needs_review','retired')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sealed_products_owner_idx
  on public.sealed_products(owner_id) where owner_id is not null;

create table if not exists public.collectible_identities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  identity_kind text not null
    check (identity_kind in ('card_variant','card_printing','sealed_product','unresolved')),
  card_id uuid references public.cards(id) on delete no action deferrable initially deferred,
  variant_id uuid references public.card_variants(id) on delete no action deferrable initially deferred,
  sealed_product_id uuid references public.sealed_products(id) on delete no action deferrable initially deferred,
  canonical_key text not null unique check (char_length(canonical_key) between 3 and 500),
  identity_status text not null default 'active'
    check (identity_status in ('active','needs_review','merged','retired')),
  identity_version integer not null default 1 check (identity_version > 0),
  merged_into_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merged_into_id is null or merged_into_id<>id),
  check (
    (identity_kind='card_variant' and variant_id is not null and card_id is null and sealed_product_id is null and owner_id is null)
    or (identity_kind='card_printing' and card_id is not null and variant_id is null and sealed_product_id is null and owner_id is null)
    or (identity_kind='sealed_product' and sealed_product_id is not null and card_id is null and variant_id is null)
    or (identity_kind='unresolved' and card_id is null and variant_id is null and sealed_product_id is null and owner_id is not null)
  ),
  check (
    (identity_status='merged' and merged_into_id is not null)
    or (identity_status<>'merged' and merged_into_id is null)
  )
);

create unique index if not exists collectible_identities_variant_uidx
  on public.collectible_identities(variant_id)
  where variant_id is not null;
create unique index if not exists collectible_identities_card_uidx
  on public.collectible_identities(card_id)
  where card_id is not null;
create unique index if not exists collectible_identities_sealed_uidx
  on public.collectible_identities(sealed_product_id)
  where sealed_product_id is not null;
create index if not exists collectible_identities_merge_idx
  on public.collectible_identities(merged_into_id)
  where merged_into_id is not null;
create index if not exists collectible_identities_owner_idx
  on public.collectible_identities(owner_id,identity_status)
  where owner_id is not null;

create table if not exists public.identity_match_rule_versions (
  version text primary key check (char_length(version) between 3 and 100),
  status text not null check (status in ('draft','active','retired')),
  rules jsonb not null check (jsonb_typeof(rules)='object'),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

insert into public.identity_match_rule_versions(
  version,status,rules,checksum,activated_at
) values (
  'identity-match-v1',
  'active',
  '{"requiredConfirmation":true,"hardDiscriminators":["name","set","collector_number","language","finish","edition","promo_type","product_type"],"gradedContext":["grader","grade"],"silentSubstitutionAllowed":false}'::jsonb,
  encode(digest('{"gradedContext":["grader","grade"],"hardDiscriminators":["name","set","collector_number","language","finish","edition","promo_type","product_type"],"requiredConfirmation":true,"silentSubstitutionAllowed":false}','sha256'),'hex'),
  now()
) on conflict (version) do nothing;

create table if not exists public.collectible_provider_mappings (
  id uuid primary key default gen_random_uuid(),
  collectible_id uuid not null references public.collectible_identities(id) on delete no action deferrable initially deferred,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{1,50}$'),
  provider_entity_type text not null
    check (provider_entity_type in ('card','variant','sealed_product')),
  external_id text not null check (char_length(external_id) between 1 and 300),
  external_variant_id text not null default '' check (char_length(external_variant_id) <= 300),
  provider_set_id text,
  provider_url text,
  match_status text not null default 'automatic'
    check (match_status in ('automatic','manually_verified','ambiguous','rejected','missing')),
  match_confidence numeric(5,4) check (match_confidence between 0 and 1),
  rule_version text not null default 'identity-match-v1'
    references public.identity_match_rule_versions(version),
  match_method text,
  raw_provider_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_provider_metadata)='object'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_entity_type,external_id,external_variant_id)
);
create index if not exists collectible_provider_mappings_identity_idx
  on public.collectible_provider_mappings(collectible_id,provider,match_status);

create table if not exists public.identity_match_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null
    check (source_type in ('search','scan','import','manual','provider_sync','correction')),
  source_id text,
  observed_identity jsonb not null check (jsonb_typeof(observed_identity)='object'),
  candidate_identities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(candidate_identities)='array'),
  selected_collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred,
  decision_status text not null
    check (decision_status in ('suggested','confirmed','ambiguous','rejected','unsupported')),
  confidence numeric(5,4) check (confidence between 0 and 1),
  rule_version text not null references public.identity_match_rule_versions(version),
  created_at timestamptz not null default now(),
  check (decision_status<>'confirmed' or selected_collectible_id is not null)
);
create index if not exists identity_match_decisions_owner_time_idx
  on public.identity_match_decisions(user_id,created_at desc);

create table if not exists public.identity_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  event_type text not null check (event_type in ('correction','reversal')),
  from_collectible_id uuid not null references public.collectible_identities(id) on delete no action deferrable initially deferred,
  to_collectible_id uuid not null references public.collectible_identities(id) on delete no action deferrable initially deferred,
  from_snapshot jsonb not null check (jsonb_typeof(from_snapshot)='object'),
  to_snapshot jsonb not null check (jsonb_typeof(to_snapshot)='object'),
  reason text check (reason is null or char_length(reason) <= 500),
  rule_version text not null references public.identity_match_rule_versions(version),
  reverses_correction_id uuid references public.identity_corrections(id) on delete no action deferrable initially deferred,
  created_at timestamptz not null default now(),
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id) on delete cascade,
  check (from_collectible_id<>to_collectible_id),
  check (
    (event_type='correction' and reverses_correction_id is null)
    or (event_type='reversal' and reverses_correction_id is not null)
  )
);
create index if not exists identity_corrections_owner_item_time_idx
  on public.identity_corrections(user_id,collection_item_id,created_at desc,id desc);
create unique index if not exists identity_corrections_one_reversal_uidx
  on public.identity_corrections(reverses_correction_id)
  where reverses_correction_id is not null;

create table if not exists public.identity_merge_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  source_collectible_id uuid not null references public.collectible_identities(id) on delete no action deferrable initially deferred,
  target_collectible_id uuid not null references public.collectible_identities(id) on delete no action deferrable initially deferred,
  status text not null default 'pending'
    check (status in ('pending','active','rejected','reversed')),
  source_status_before text not null
    check (source_status_before in ('active','needs_review','retired')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  reason text not null check (char_length(reason) between 1 and 500),
  proposed_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  reversed_at timestamptz,
  check (source_collectible_id<>target_collectible_id)
);
create unique index if not exists identity_merge_open_source_uidx
  on public.identity_merge_proposals(source_collectible_id)
  where status in ('pending','active');
create index if not exists identity_merge_review_idx
  on public.identity_merge_proposals(status,created_at desc);
create index if not exists identity_merge_owner_idx
  on public.identity_merge_proposals(owner_id)
  where owner_id is not null;

create table if not exists public.identity_merge_events (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.identity_merge_proposals(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('proposed','accepted','rejected','reversed')),
  state_snapshot jsonb not null check (jsonb_typeof(state_snapshot)='object'),
  occurred_at timestamptz not null default now()
);
create index if not exists identity_merge_events_proposal_idx
  on public.identity_merge_events(proposal_id,occurred_at,id);

alter table public.sealed_products enable row level security;
alter table public.collectible_identities enable row level security;
alter table public.identity_match_rule_versions enable row level security;
alter table public.collectible_provider_mappings enable row level security;
alter table public.identity_match_decisions enable row level security;
alter table public.identity_corrections enable row level security;
alter table public.identity_merge_proposals enable row level security;
alter table public.identity_merge_events enable row level security;

create policy "authenticated sealed products read" on public.sealed_products
  for select to authenticated using (
    owner_id is null or owner_id=(select auth.uid())
    or coalesce((select auth.jwt())->'app_metadata'->>'role','')='admin'
  );
create policy "authenticated collectible identities read" on public.collectible_identities
  for select to authenticated using (
    owner_id is null or owner_id=(select auth.uid())
    or coalesce((select auth.jwt())->'app_metadata'->>'role','')='admin'
  );
create policy "authenticated identity rules read" on public.identity_match_rule_versions
  for select to authenticated using (true);
create policy "authenticated collectible mappings read" on public.collectible_provider_mappings
  for select to authenticated using (true);
create policy "identity decisions own rows" on public.identity_match_decisions
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "identity corrections own rows" on public.identity_corrections
  for select to authenticated using ((select auth.uid())=user_id);
create policy "identity merge admins read" on public.identity_merge_proposals
  for select to authenticated
  using (coalesce((select auth.jwt())->'app_metadata'->>'role','')='admin');
create policy "identity merge event admins read" on public.identity_merge_events
  for select to authenticated
  using (coalesce((select auth.jwt())->'app_metadata'->>'role','')='admin');

revoke all on public.sealed_products,public.collectible_identities,
  public.identity_match_rule_versions,public.collectible_provider_mappings,
  public.identity_match_decisions,public.identity_corrections,
  public.identity_merge_proposals,public.identity_merge_events
from public,anon,authenticated;
grant select on public.sealed_products,public.collectible_identities,
  public.identity_match_rule_versions,public.collectible_provider_mappings,
  public.identity_corrections,public.identity_merge_proposals,
  public.identity_merge_events to authenticated;
grant select,insert,update,delete on public.identity_match_decisions to authenticated;
grant all on public.sealed_products,public.collectible_identities,
  public.identity_match_rule_versions,public.collectible_provider_mappings,
  public.identity_match_decisions,public.identity_corrections,
  public.identity_merge_proposals,public.identity_merge_events to service_role;
grant usage,select on sequence public.identity_merge_events_id_seq to service_role;

create or replace function identity_private.ensure_card_identity(
  p_card_id uuid,
  p_variant_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  target_id uuid;
  stored_card_id uuid;
  stored_kind text;
begin
  if p_variant_id is not null then
    select variant.card_id into stored_card_id
    from public.card_variants variant where variant.id=p_variant_id;
    if stored_card_id is null then raise exception 'variant_not_found'; end if;
    if p_card_id is not null and p_card_id<>stored_card_id then
      raise exception 'variant_card_mismatch';
    end if;
    target_id:=p_variant_id;
    insert into public.collectible_identities(
      id,identity_kind,variant_id,canonical_key,identity_status
    ) values(
      target_id,'card_variant',p_variant_id,'card-variant:'||p_variant_id::text,'active'
    ) on conflict (id) do nothing;
    select identity_kind into stored_kind
    from public.collectible_identities where id=target_id;
    if stored_kind is distinct from 'card_variant' then
      raise exception 'collectible_identity_collision';
    end if;
    return target_id;
  end if;
  if p_card_id is null then raise exception 'card_identity_required'; end if;
  if not exists(select 1 from public.cards card where card.id=p_card_id) then
    raise exception 'card_not_found';
  end if;
  target_id:=p_card_id;
  insert into public.collectible_identities(
    id,identity_kind,card_id,canonical_key,identity_status
  ) values(
    target_id,'card_printing',p_card_id,'card-printing:'||p_card_id::text,'needs_review'
  ) on conflict (id) do nothing;
  select identity_kind into stored_kind
  from public.collectible_identities where id=target_id;
  if stored_kind is distinct from 'card_printing' then
    raise exception 'collectible_identity_collision';
  end if;
  return target_id;
end $$;

create or replace function identity_private.ensure_sealed_identity(
  p_snapshot jsonb,
  p_source_key text,
  p_owner_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  snapshot jsonb:=coalesce(p_snapshot,'{}'::jsonb);
  mapping_provider text;
  external_id text;
  product_key text;
  product_id uuid;
  product_name text;
  product_language text;
  product_status text;
begin
  external_id:=nullif(btrim(snapshot#>>'{externalIds,pkmnpricesSealed}'),'');
  mapping_provider:=case when external_id is not null then 'pkmnprices' else null end;
  if external_id is null then
    external_id:=nullif(btrim(snapshot#>>'{externalIds,tcgplayerSealed}'),'');
    mapping_provider:=case when external_id is not null then 'tcgplayer' else null end;
  end if;
  product_name:=left(coalesce(nullif(btrim(snapshot->>'name'),''),'Unresolved sealed product'),300);
  product_language:=lower(coalesce(nullif(btrim(snapshot->>'language'),''),'en'));
  if product_language !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' then product_language:='und'; end if;
  product_key:=case
    when mapping_provider is not null then 'pokemon:'||product_language||':'||mapping_provider||':'||external_id
    else 'legacy:'||left(regexp_replace(coalesce(p_source_key,'unknown'),'[^A-Za-z0-9:_-]','','g'),400)
  end;
  product_status:=case when mapping_provider is null then 'needs_review' else 'active' end;
  if mapping_provider is null and p_owner_id is null then raise exception 'sealed_owner_required'; end if;
  insert into public.sealed_products(
    owner_id,name,set_name,product_type,language,canonical_key,identity_status,metadata
  ) values(
    case when mapping_provider is null then p_owner_id else null end,
    product_name,nullif(snapshot->>'set',''),nullif(snapshot->>'productType',''),
    product_language,product_key,product_status,
    jsonb_build_object('source','canonical_identity_backfill')
  ) on conflict (canonical_key) do update set
    updated_at=now()
  returning id into product_id;
  insert into public.collectible_identities(
    id,owner_id,identity_kind,sealed_product_id,canonical_key,identity_status
  ) values(
    product_id,case when mapping_provider is null then p_owner_id else null end,
    'sealed_product',product_id,'sealed-product:'||product_id::text,product_status
  ) on conflict (id) do nothing;
  if mapping_provider is not null then
    insert into public.collectible_provider_mappings(
      collectible_id,provider,provider_entity_type,external_id,match_status,
      match_confidence,match_method
    ) values(
      product_id,mapping_provider,'sealed_product',external_id,'manually_verified',1,
      'legacy_exact_provider_id'
    ) on conflict (provider,provider_entity_type,external_id,external_variant_id)
      do nothing;
  end if;
  return product_id;
end $$;

create or replace function identity_private.ensure_unresolved_identity(
  p_source_type text,
  p_source_id uuid,
  p_snapshot jsonb,
  p_owner_id uuid default null,
  p_subject_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  target_id uuid;
  target_key text:='unresolved:'||lower(regexp_replace(p_source_type,'[^A-Za-z0-9_-]','','g'))||':'||p_source_id::text;
begin
  if p_owner_id is null then raise exception 'unresolved_owner_required'; end if;
  select id into target_id from public.collectible_identities
  where canonical_key=target_key and owner_id=p_owner_id;
  if target_id is not null then return target_id; end if;
  insert into public.collectible_identities(
    owner_id,identity_kind,canonical_key,identity_status,metadata
  ) values(
    p_owner_id,'unresolved',target_key,'needs_review',
    jsonb_build_object(
      'sourceType',p_source_type,
      'subjectId',coalesce(p_subject_id,p_source_id)
    )
  ) on conflict (canonical_key) do update set updated_at=now()
  returning id into target_id;
  return target_id;
end $$;

revoke all on function identity_private.ensure_card_identity(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function identity_private.ensure_sealed_identity(jsonb,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function identity_private.ensure_unresolved_identity(text,uuid,jsonb,uuid,uuid)
  from public,anon,authenticated,service_role;

-- Attach one canonical identity to every identity-bearing record. Columns are
-- nullable during backfill and made NOT NULL only after reconciliation.
alter table public.collection_items add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.collection_transactions add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.purchase_lots add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.position_price_observations add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.card_watchlist add column if not exists variant_id uuid references public.card_variants(id) on delete restrict;
alter table public.card_watchlist add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.price_products add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.price_observations add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.card_provider_mappings add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.scan_candidates add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.scan_feedback add column if not exists selected_collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.owned_copies add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.purchase_transactions add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.sale_transactions add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.digital_grade_assessments add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_submissions add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_physical_cards add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_scan_sessions add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_captures add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_evidence add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_predictions add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_outcomes add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;
alter table public.grading_feedback add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action deferrable initially deferred;

update public.card_watchlist watch
set variant_id=(watch.identity_snapshot->>'variantId')::uuid
where watch.variant_id is null
  and coalesce(watch.identity_snapshot->>'variantId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists(
    select 1 from public.card_variants variant
    where variant.id=(watch.identity_snapshot->>'variantId')::uuid
      and (watch.card_id is null or variant.card_id=watch.card_id)
  );

update public.collection_items item
set collectible_id=case
  when item.card_state='sealed' then
    identity_private.ensure_sealed_identity(item.identity_snapshot,'collection-item:'||item.id::text,item.user_id)
  when item.variant_id is not null or item.card_id is not null then
    identity_private.ensure_card_identity(item.card_id,item.variant_id)
  else identity_private.ensure_unresolved_identity('collection-item',item.id,item.identity_snapshot,item.user_id,item.id)
end
where item.collectible_id is null;

update public.collection_transactions transaction
set collectible_id=item.collectible_id
from public.collection_items item
where transaction.collection_item_id=item.id and transaction.user_id=item.user_id
  and transaction.collectible_id is null;
update public.purchase_lots lot
set collectible_id=item.collectible_id
from public.collection_items item
where lot.collection_item_id=item.id and lot.user_id=item.user_id
  and lot.collectible_id is null;
update public.position_price_observations observation
set collectible_id=item.collectible_id
from public.collection_items item
where observation.collection_item_id=item.id and observation.user_id=item.user_id
  and observation.collectible_id is null;
update public.owned_copies copy
set collectible_id=item.collectible_id
from public.collection_items item
where copy.collection_item_id=item.id and copy.user_id=item.user_id
  and copy.collectible_id is null;
update public.purchase_transactions transaction
set collectible_id=copy.collectible_id
from public.owned_copies copy
where transaction.owned_copy_id=copy.id and transaction.user_id=copy.user_id
  and transaction.collectible_id is null;
update public.sale_transactions transaction
set collectible_id=copy.collectible_id
from public.owned_copies copy
where transaction.owned_copy_id=copy.id and transaction.user_id=copy.user_id
  and transaction.collectible_id is null;

update public.card_watchlist watch
set collectible_id=case
  when watch.card_state='sealed' then
    identity_private.ensure_sealed_identity(watch.identity_snapshot,'watchlist:'||watch.id::text,watch.user_id)
  when watch.variant_id is not null or watch.card_id is not null then
    identity_private.ensure_card_identity(watch.card_id,watch.variant_id)
  else identity_private.ensure_unresolved_identity('watchlist',watch.id,watch.identity_snapshot,watch.user_id,watch.id)
end
where watch.collectible_id is null;

update public.price_products product
set collectible_id=identity_private.ensure_card_identity(null,product.variant_id)
where product.collectible_id is null;
update public.price_observations observation
set collectible_id=identity_private.ensure_card_identity(
  observation.card_id,observation.card_variant_id
)
where observation.collectible_id is null;
update public.card_provider_mappings mapping
set collectible_id=identity_private.ensure_card_identity(
  mapping.card_id,mapping.card_variant_id
)
where mapping.collectible_id is null;
update public.scan_candidates candidate
set collectible_id=identity_private.ensure_card_identity(null,candidate.variant_id)
where candidate.collectible_id is null;
update public.scan_feedback feedback
set selected_collectible_id=identity_private.ensure_card_identity(null,feedback.selected_variant_id)
where feedback.selected_variant_id is not null
  and feedback.selected_collectible_id is null;

update public.digital_grade_assessments assessment
set collectible_id=item.collectible_id
from public.collection_items item
where assessment.collection_item_id=item.id and assessment.user_id=item.user_id
  and assessment.collectible_id is null;
update public.grading_submissions submission
set collectible_id=item.collectible_id
from public.collection_items item
where submission.collection_item_id=item.id and submission.user_id=item.user_id
  and submission.collectible_id is null;
update public.grading_physical_cards physical
set collectible_id=item.collectible_id
from public.collection_items item
where physical.collection_item_id=item.id and physical.user_id=item.user_id
  and physical.collectible_id is null;
update public.grading_physical_cards physical
set collectible_id=identity_private.ensure_unresolved_identity(
  'grading-physical-card',physical.id,physical.identity_snapshot,physical.user_id,physical.id
)
where physical.collectible_id is null;
update public.grading_scan_sessions session
set collectible_id=item.collectible_id
from public.collection_items item
where session.collection_item_id=item.id and session.user_id=item.user_id
  and session.collectible_id is null;
update public.grading_scan_sessions session
set collectible_id=physical.collectible_id
from public.grading_physical_cards physical
where session.physical_card_id=physical.id and session.user_id=physical.user_id
  and session.collectible_id is null;
update public.grading_scan_sessions session
set collectible_id=identity_private.ensure_unresolved_identity(
  'grading-scan-session',session.id,session.identity_snapshot,session.user_id,session.id
)
where session.collectible_id is null;
update public.grading_captures capture
set collectible_id=session.collectible_id
from public.grading_scan_sessions session
where capture.scan_session_id=session.id and capture.user_id=session.user_id
  and capture.collectible_id is null;
update public.grading_evidence evidence
set collectible_id=session.collectible_id
from public.grading_scan_sessions session
where evidence.scan_session_id=session.id and evidence.user_id=session.user_id
  and evidence.collectible_id is null;
update public.grading_predictions prediction
set collectible_id=session.collectible_id
from public.grading_scan_sessions session
where prediction.scan_session_id=session.id and prediction.user_id=session.user_id
  and prediction.collectible_id is null;
update public.grading_outcomes outcome
set collectible_id=session.collectible_id
from public.grading_scan_sessions session
where outcome.scan_session_id=session.id and outcome.user_id=session.user_id
  and outcome.collectible_id is null;
update public.grading_feedback feedback
set collectible_id=session.collectible_id
from public.grading_scan_sessions session
where feedback.scan_session_id=session.id and feedback.user_id=session.user_id
  and feedback.collectible_id is null;

insert into public.collectible_provider_mappings(
  collectible_id,provider,provider_entity_type,external_id,external_variant_id,
  provider_set_id,provider_url,match_status,match_confidence,match_method,
  raw_provider_metadata,verified_at,created_at,updated_at
)
select mapping.collectible_id,lower(mapping.provider),
  case when mapping.card_variant_id is null then 'card' else 'variant' end,
  mapping.provider_card_id,coalesce(mapping.provider_variant_id,''),
  mapping.provider_set_id,mapping.provider_url,mapping.match_status,
  mapping.match_confidence,mapping.match_method,mapping.raw_provider_metadata,
  mapping.verified_at,mapping.created_at,mapping.updated_at
from public.card_provider_mappings mapping
where mapping.collectible_id is not null
on conflict (provider,provider_entity_type,external_id,external_variant_id) do nothing;

insert into public.collectible_provider_mappings(
  collectible_id,provider,provider_entity_type,external_id,match_status,
  match_confidence,match_method
)
select identity_private.ensure_card_identity(external.card_id,null),
  lower(external.provider),'card',external.external_id,'automatic',1,
  'legacy_card_external_id'
from public.card_external_ids external
on conflict (provider,provider_entity_type,external_id,external_variant_id) do nothing;

insert into public.collectible_provider_mappings(
  collectible_id,provider,provider_entity_type,external_id,match_status,
  match_confidence,match_method,verified_at
)
select identity_private.ensure_card_identity(null,external.variant_id),
  lower(external.provider),'variant',external.external_id,
  case when external.reviewed_at is null then 'automatic' else 'manually_verified' end,
  external.mapping_confidence,external.mapping_method,external.reviewed_at
from public.variant_external_ids external
on conflict (provider,provider_entity_type,external_id,external_variant_id) do nothing;

-- Backfill succeeded only if no identity-bearing row remains unresolved at the
-- column level. “Unresolved” is an explicit identity status, not a null pointer.
alter table public.collection_items alter column collectible_id set not null;
alter table public.collection_transactions alter column collectible_id set not null;
alter table public.purchase_lots alter column collectible_id set not null;
alter table public.position_price_observations alter column collectible_id set not null;
alter table public.card_watchlist alter column collectible_id set not null;
alter table public.price_products alter column collectible_id set not null;
alter table public.price_observations alter column collectible_id set not null;
alter table public.card_provider_mappings alter column collectible_id set not null;
alter table public.scan_candidates alter column collectible_id set not null;
alter table public.owned_copies alter column collectible_id set not null;
alter table public.purchase_transactions alter column collectible_id set not null;
alter table public.sale_transactions alter column collectible_id set not null;
alter table public.digital_grade_assessments alter column collectible_id set not null;
alter table public.grading_submissions alter column collectible_id set not null;
alter table public.grading_physical_cards alter column collectible_id set not null;
alter table public.grading_scan_sessions alter column collectible_id set not null;
alter table public.grading_captures alter column collectible_id set not null;
alter table public.grading_evidence alter column collectible_id set not null;
alter table public.grading_predictions alter column collectible_id set not null;
alter table public.grading_outcomes alter column collectible_id set not null;
alter table public.grading_feedback alter column collectible_id set not null;

create index if not exists collection_items_collectible_idx on public.collection_items(collectible_id,user_id);
create index if not exists collection_transactions_collectible_idx on public.collection_transactions(collectible_id,user_id,transaction_date desc);
create index if not exists purchase_lots_collectible_idx on public.purchase_lots(collectible_id,user_id,acquired_at);
create index if not exists position_prices_collectible_idx on public.position_price_observations(collectible_id,user_id,observed_at desc);
create index if not exists card_watchlist_collectible_idx on public.card_watchlist(collectible_id,user_id);
create index if not exists price_products_collectible_idx on public.price_products(collectible_id);
create index if not exists price_observations_collectible_idx on public.price_observations(collectible_id,observed_at desc);
create index if not exists card_provider_mappings_collectible_idx on public.card_provider_mappings(collectible_id,provider,match_status);
create index if not exists scan_candidates_collectible_idx on public.scan_candidates(collectible_id,scan_id);
create index if not exists owned_copies_collectible_idx on public.owned_copies(collectible_id,user_id);
create index if not exists purchase_transactions_collectible_idx on public.purchase_transactions(collectible_id,user_id,transacted_at);
create index if not exists sale_transactions_collectible_idx on public.sale_transactions(collectible_id,user_id,transacted_at);
create index if not exists digital_grades_collectible_idx on public.digital_grade_assessments(collectible_id,user_id,assessed_at desc);
create index if not exists grading_submissions_collectible_idx on public.grading_submissions(collectible_id,user_id,submitted_at desc);
create index if not exists grading_physical_collectible_idx on public.grading_physical_cards(collectible_id,user_id);
create index if not exists grading_sessions_collectible_idx on public.grading_scan_sessions(collectible_id,user_id,started_at desc);
create index if not exists grading_captures_collectible_idx on public.grading_captures(collectible_id,user_id,captured_at);
create index if not exists grading_evidence_collectible_idx on public.grading_evidence(collectible_id,user_id,created_at);
create index if not exists grading_predictions_collectible_idx on public.grading_predictions(collectible_id,user_id,created_at desc);
create index if not exists grading_outcomes_collectible_idx on public.grading_outcomes(collectible_id,user_id,created_at desc);
create index if not exists grading_feedback_collectible_idx on public.grading_feedback(collectible_id,user_id,created_at desc);
