-- CLIENT-07F review candidate. Apply only to an owned disposable local database until separately approved.
-- Atomic single-run contract; do not add to automatic migrations.
begin;

-- Source: supabase/migrations/20260831235837_canonical_collectible_identity.sql
-- SHA256: 371caf29801162896b53cdc461616efe855c205f578d73bd6332d4bce8226af2

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
  mapping_external_id text;
  product_key text;
  product_id uuid;
  product_name text;
  product_language text;
  product_status text;
begin
  mapping_external_id:=nullif(btrim(snapshot#>>'{externalIds,pkmnpricesSealed}'),'');
  mapping_provider:=case when mapping_external_id is not null then 'pkmnprices' else null end;
  if mapping_external_id is null then
    mapping_external_id:=nullif(btrim(snapshot#>>'{externalIds,tcgplayerSealed}'),'');
    mapping_provider:=case when mapping_external_id is not null then 'tcgplayer' else null end;
  end if;
  product_name:=left(coalesce(nullif(btrim(snapshot->>'name'),''),'Unresolved sealed product'),300);
  product_language:=lower(coalesce(nullif(btrim(snapshot->>'language'),''),'en'));
  if product_language !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' then product_language:='und'; end if;
  product_key:=case
    when mapping_provider is not null then 'pokemon:'||product_language||':'||mapping_provider||':'||mapping_external_id
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
      product_id,mapping_provider,'sealed_product',mapping_external_id,'manually_verified',1,
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
-- Flush deferred backfill FK checks before ALTER TABLE inside this atomic transaction.
set constraints all immediate;
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

-- Source: supabase/migrations/20260901002305_canonical_identity_runtime.sql
-- SHA256: e41d85bcf728ecd4e28fc31fd074f8e56ce7f1ddec1f1f134cbdff544509148a

-- Keep the canonical identity contract true for every future write. These
-- trigger functions are security-definer because authenticated users can write
-- their own portfolio rows but cannot mutate the shared identity registry.

create or replace function identity_private.resolve_collectible_identity(
  p_collectible_id uuid
) returns uuid
language plpgsql
volatile
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
  return current_id;
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

-- Source: supabase/migrations/20260901014556_transparent_pricing_evidence.sql
-- SHA256: 8243330675e92b6d8cce7a24859b2c40566bd9abf69b552a7b57c2dfa0bf28a1

-- Step 4: preserve enough normalized evidence to explain every valuation.
-- This migration is additive. Existing observations remain readable and are
-- marked as legacy-normalized instead of being discarded or rewritten as zero.

alter table public.price_observations
  add column if not exists aggregator text,
  add column if not exists source_record_id text,
  add column if not exists source_variant_id text,
  add column if not exists region text,
  add column if not exists language text,
  add column if not exists finish text,
  add column if not exists printing text,
  add column if not exists retrieved_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists evidence_kind text,
  add column if not exists derivation text,
  add column if not exists fees_included boolean,
  add column if not exists shipping_included boolean,
  add column if not exists capability_status text,
  add column if not exists exclusion_status text,
  add column if not exists exclusion_reason text,
  add column if not exists evidence_rule_version text,
  add column if not exists confidence_reason jsonb,
  add column if not exists outlier_review jsonb;

update public.price_observations
set aggregator=coalesce(nullif(aggregator,''),provider),
    source_variant_id=coalesce(source_variant_id,raw_provider_payload->>'providerVariantId'),
    region=coalesce(nullif(region,''),case when market='cardmarket' or currency='EUR' then 'EU' else 'US' end),
    language=coalesce(nullif(language,''),'unknown'),
    finish=coalesce(nullif(finish,''),nullif(raw_provider_payload->>'printing',''),'unknown'),
    printing=coalesce(printing,raw_provider_payload->>'printing'),
    retrieved_at=coalesce(retrieved_at,created_at),
    evidence_kind=coalesce(nullif(evidence_kind,''),case
      when valuation_type in ('last_sold','average_sale','median_sale') then 'completed_sale'
      when valuation_type='listing' then 'asking_price'
      else 'market_index'
    end),
    derivation=coalesce(nullif(derivation,''),'aggregated'),
    fees_included=coalesce(fees_included,false),
    shipping_included=coalesce(shipping_included,false),
    capability_status=coalesce(nullif(capability_status,''),'live'),
    exclusion_status=coalesce(nullif(exclusion_status,''),case when anomalous then 'flagged' else 'included' end),
    exclusion_reason=coalesce(exclusion_reason,anomaly_reason),
    evidence_rule_version=coalesce(nullif(evidence_rule_version,''),'legacy-normalized-v1'),
    confidence_reason=coalesce(confidence_reason,'{}'::jsonb),
    outlier_review=coalesce(outlier_review,'{}'::jsonb)
where aggregator is null or aggregator='' or region is null or region=''
   or language is null or language='' or finish is null or finish=''
   or retrieved_at is null or evidence_kind is null or evidence_kind=''
   or derivation is null or derivation='' or fees_included is null
   or shipping_included is null or capability_status is null
   or capability_status='' or exclusion_status is null or exclusion_status=''
   or evidence_rule_version is null or evidence_rule_version=''
   or confidence_reason is null or outlier_review is null;

alter table public.price_observations
  alter column aggregator set default 'legacy',
  alter column aggregator set not null,
  alter column region set default 'unknown',
  alter column region set not null,
  alter column language set default 'unknown',
  alter column language set not null,
  alter column finish set default 'unknown',
  alter column finish set not null,
  alter column retrieved_at set default now(),
  alter column retrieved_at set not null,
  alter column evidence_kind set default 'market_index',
  alter column evidence_kind set not null,
  alter column derivation set default 'aggregated',
  alter column derivation set not null,
  alter column fees_included set default false,
  alter column fees_included set not null,
  alter column shipping_included set default false,
  alter column shipping_included set not null,
  alter column capability_status set default 'live',
  alter column capability_status set not null,
  alter column exclusion_status set default 'included',
  alter column exclusion_status set not null,
  alter column evidence_rule_version set default 'mica-price-evidence-v1',
  alter column evidence_rule_version set not null,
  alter column confidence_reason set default '{}'::jsonb,
  alter column confidence_reason set not null,
  alter column outlier_review set default '{}'::jsonb,
  alter column outlier_review set not null;

alter table public.price_observations
  add constraint price_observations_evidence_kind_check
    check (evidence_kind in ('market_index','completed_sale','asking_price','manual_override')),
  add constraint price_observations_derivation_check
    check (derivation in ('direct','aggregated','modeled','manual')),
  add constraint price_observations_capability_status_check
    check (capability_status in ('live','missing','unsupported','rate_limited','provider_error')),
  add constraint price_observations_exclusion_status_check
    check (exclusion_status in ('included','flagged','excluded')),
  add constraint price_observations_expiry_check
    check (expires_at is null or expires_at >= observed_at);

create index if not exists price_observations_comparable_current_idx
  on public.price_observations(
    collectible_id,currency,card_state,raw_condition,grader,grade,finish,observed_at desc
  ) include (market_price,last_sold_price,listing_price,price_mid,aggregator,market,confidence_score)
  where capability_status='live' and exclusion_status='included';

alter table public.position_price_observations
  add column if not exists market text,
  add column if not exists source_record_id text,
  add column if not exists source_url text,
  add column if not exists region text,
  add column if not exists language text,
  add column if not exists printing text,
  add column if not exists provider_updated_at timestamptz,
  add column if not exists retrieved_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists evidence_kind text,
  add column if not exists derivation text,
  add column if not exists fees_included boolean,
  add column if not exists shipping_included boolean,
  add column if not exists capability_status text,
  add column if not exists exclusion_status text,
  add column if not exists exclusion_reason text,
  add column if not exists evidence_rule_version text,
  add column if not exists confidence_score numeric(5,4),
  add column if not exists confidence_reason jsonb,
  add column if not exists outlier_review jsonb,
  add column if not exists source_metadata jsonb;

update public.position_price_observations
set market=coalesce(nullif(market,''),provider),
    region=coalesce(nullif(region,''),case when provider='cardmarket' or currency='EUR' then 'EU' else 'US' end),
    language=coalesce(nullif(language,''),'unknown'),
    printing=coalesce(printing,nullif(quality->>'printing','')),
    provider_updated_at=coalesce(provider_updated_at,observed_at),
    retrieved_at=coalesce(retrieved_at,created_at),
    evidence_kind=coalesce(nullif(evidence_kind,''),case
      when valuation_type='average_sale' then 'completed_sale'
      else 'market_index'
    end),
    derivation=coalesce(nullif(derivation,''),'aggregated'),
    fees_included=coalesce(fees_included,false),
    shipping_included=coalesce(shipping_included,false),
    capability_status=coalesce(nullif(capability_status,''),'live'),
    exclusion_status=coalesce(nullif(exclusion_status,''),'included'),
    evidence_rule_version=coalesce(nullif(evidence_rule_version,''),'legacy-normalized-v1'),
    confidence_score=coalesce(confidence_score,case
      when (quality->>'confidence') ~ '^(0(\.\d+)?|1(\.0+)?)$'
        then (quality->>'confidence')::numeric
      else null
    end),
    confidence_reason=coalesce(confidence_reason,'{}'::jsonb),
    outlier_review=coalesce(outlier_review,'{}'::jsonb),
    source_metadata=coalesce(source_metadata,quality,'{}'::jsonb)
where market is null or market='' or region is null or region=''
   or language is null or language='' or provider_updated_at is null
   or retrieved_at is null or evidence_kind is null or evidence_kind=''
   or derivation is null or derivation='' or fees_included is null
   or shipping_included is null or capability_status is null
   or capability_status='' or exclusion_status is null or exclusion_status=''
   or evidence_rule_version is null or evidence_rule_version=''
   or confidence_reason is null or outlier_review is null
   or source_metadata is null;

alter table public.position_price_observations
  alter column market set default 'unknown',
  alter column market set not null,
  alter column region set default 'unknown',
  alter column region set not null,
  alter column language set default 'unknown',
  alter column language set not null,
  alter column retrieved_at set default now(),
  alter column retrieved_at set not null,
  alter column evidence_kind set default 'market_index',
  alter column evidence_kind set not null,
  alter column derivation set default 'aggregated',
  alter column derivation set not null,
  alter column fees_included set default false,
  alter column fees_included set not null,
  alter column shipping_included set default false,
  alter column shipping_included set not null,
  alter column capability_status set default 'live',
  alter column capability_status set not null,
  alter column exclusion_status set default 'included',
  alter column exclusion_status set not null,
  alter column evidence_rule_version set default 'mica-price-evidence-v1',
  alter column evidence_rule_version set not null,
  alter column confidence_reason set default '{}'::jsonb,
  alter column confidence_reason set not null,
  alter column outlier_review set default '{}'::jsonb,
  alter column outlier_review set not null,
  alter column source_metadata set default '{}'::jsonb,
  alter column source_metadata set not null;

alter table public.position_price_observations
  add constraint position_prices_evidence_kind_check
    check (evidence_kind in ('market_index','completed_sale','asking_price','manual_override')),
  add constraint position_prices_derivation_check
    check (derivation in ('direct','aggregated','modeled','manual')),
  add constraint position_prices_capability_status_check
    check (capability_status in ('live','missing','unsupported','rate_limited','provider_error')),
  add constraint position_prices_exclusion_status_check
    check (exclusion_status in ('included','flagged','excluded')),
  add constraint position_prices_confidence_check
    check (confidence_score is null or confidence_score between 0 and 1),
  add constraint position_prices_expiry_check
    check (expires_at is null or expires_at >= observed_at);

create index if not exists position_prices_comparable_current_idx
  on public.position_price_observations(
    user_id,collectible_id,currency,card_state,raw_condition,grader,grade_label,finish,observed_at desc
  ) include (amount,price_low,price_high,aggregator,market,confidence_score)
  where capability_status='live' and exclusion_status='included';

alter table public.price_anomalies
  add column if not exists collectible_id uuid references public.collectible_identities(id) on delete no action,
  add column if not exists rule_version text,
  add column if not exists cohort_size integer,
  add column if not exists cohort_median numeric(14,2),
  add column if not exists cohort_mad numeric(14,2),
  add column if not exists reviewer_id uuid references auth.users(id) on delete set null,
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz;

update public.price_anomalies anomaly
set collectible_id=observation.collectible_id,
    rule_version=coalesce(anomaly.rule_version,'legacy-anomaly-v1')
from public.price_observations observation
where anomaly.price_observation_id=observation.id
  and (anomaly.collectible_id is null or anomaly.rule_version is null);

update public.price_anomalies
set rule_version='legacy-anomaly-v1'
where rule_version is null;

alter table public.price_anomalies
  alter column rule_version set default 'mica-price-evidence-v1',
  alter column rule_version set not null,
  drop constraint if exists price_anomalies_anomaly_type_check,
  add constraint price_anomalies_anomaly_type_check
    check (anomaly_type in (
      'price_jump','provider_disagreement','mapping_changed','price_disappeared',
      'robust_outlier','freshness_gap','capability_changed'
    )),
  add constraint price_anomalies_cohort_size_check
    check (cohort_size is null or cohort_size >= 0),
  add constraint price_anomalies_review_check
    check (reviewed_at is null or reviewer_id is not null);

create index if not exists price_anomalies_collectible_status_idx
  on public.price_anomalies(collectible_id,status,created_at desc);

alter table public.provider_sync_status
  add column if not exists daily_credit_budget integer,
  add column if not exists daily_credit_reserved integer not null default 0,
  add column if not exists daily_credit_day date,
  add column if not exists entitlement_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists entitlement_checked_at timestamptz;

alter table public.provider_sync_status
  add constraint provider_sync_credit_budget_check
    check (daily_credit_budget is null or daily_credit_budget >= 0),
  add constraint provider_sync_credit_reserved_check
    check (daily_credit_reserved >= 0);

create or replace function public.reserve_provider_daily_credits(
  p_provider text,
  p_daily_budget integer,
  p_requested integer
) returns integer language plpgsql security invoker set search_path='' as $$
declare
  current_reserved integer;
  granted integer;
begin
  if coalesce(trim(p_provider),'')='' or p_daily_budget<0 or p_requested<0 then
    raise exception 'invalid_provider_credit_reservation';
  end if;
  insert into public.provider_sync_status(
    provider,enabled,daily_credit_budget,daily_credit_reserved,daily_credit_day,
    updated_at
  ) values(
    lower(trim(p_provider)),true,p_daily_budget,0,current_date,now()
  ) on conflict(provider) do nothing;

  select case
    when status.daily_credit_day=current_date
      then status.daily_credit_reserved
    else 0
  end into current_reserved
  from public.provider_sync_status status
  where status.provider=lower(trim(p_provider))
  for update;

  granted=least(p_requested,greatest(p_daily_budget-current_reserved,0));
  update public.provider_sync_status
  set enabled=true,
      daily_credit_budget=p_daily_budget,
      daily_credit_reserved=current_reserved+granted,
      daily_credit_day=current_date,
      updated_at=now()
  where provider=lower(trim(p_provider));
  return granted;
end $$;

revoke all on function public.reserve_provider_daily_credits(text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.reserve_provider_daily_credits(text,integer,integer)
  to service_role;

comment on column public.price_observations.retrieved_at is
  'When Mica fetched the record. Freshness uses provider_updated_at/observed_at, never this retrieval timestamp.';
comment on column public.price_observations.exclusion_status is
  'Flagged observations remain visible. Only an explicit excluded status removes them from valuation.';
comment on column public.position_price_observations.source_metadata is
  'Allowlisted provider metadata needed to explain provenance; never a secret or unrestricted upstream payload.';
comment on column public.provider_sync_status.daily_credit_reserved is
  'Conservative returned-item upper bounds reserved atomically for the provider UTC day; actual provider usage may be lower.';

-- Source: supabase/migrations/20260902120000_reliable_collection_ingestion.sql
-- SHA256: e703322061ce3d3e3b9584a036a728676894978033dd84dc1d3ace8e7b18f864

-- Step 5: owner-scoped staging, atomic collection import, saved mappings, and
-- safe rollback. Staging may be retried without changing portfolio rows.

alter table public.import_jobs
  add column if not exists source_name text,
  add column if not exists file_sha256 text,
  add column if not exists header_signature text,
  add column if not exists mapping jsonb not null default '{}'::jsonb,
  add column if not exists preview jsonb not null default '{}'::jsonb,
  add column if not exists committed_at timestamptz,
  add column if not exists rolled_back_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.import_jobs
  drop constraint if exists import_jobs_source_name_length_check,
  add constraint import_jobs_source_name_length_check
    check (source_name is null or char_length(source_name) between 1 and 120),
  drop constraint if exists import_jobs_file_sha256_check,
  add constraint import_jobs_file_sha256_check
    check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$'),
  drop constraint if exists import_jobs_mapping_object_check,
  add constraint import_jobs_mapping_object_check
    check (jsonb_typeof(mapping)='object'),
  drop constraint if exists import_jobs_preview_object_check,
  add constraint import_jobs_preview_object_check
    check (jsonb_typeof(preview)='object'),
  drop constraint if exists import_jobs_id_user_key,
  add constraint import_jobs_id_user_key unique(id,user_id);

create table if not exists public.import_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text not null check (char_length(source_name) between 1 and 120),
  header_signature text not null check (char_length(header_signature) between 1 and 4000),
  mapping jsonb not null check (jsonb_typeof(mapping)='object'),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,header_signature)
);

create table if not exists public.import_staged_rows (
  import_job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  row_number integer not null check (row_number between 2 and 5001),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(import_job_id,row_number),
  unique(import_job_id,idempotency_key),
  foreign key(import_job_id,user_id)
    references public.import_jobs(id,user_id) on delete cascade
);

create table if not exists public.import_job_items (
  import_job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  row_number integer not null,
  collection_item_id uuid,
  idempotency_key text not null,
  action text not null check (action in ('created','reused')),
  item_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(item_snapshot)='object'),
  created_at timestamptz not null default now(),
  primary key(import_job_id,row_number),
  foreign key(import_job_id,user_id)
    references public.import_jobs(id,user_id) on delete cascade,
  foreign key(collection_item_id,user_id)
    references public.collection_items(id,user_id)
    on delete set null (collection_item_id)
);

create table if not exists public.ingestion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  channel text not null check (channel in ('camera','upload','search','manual','csv')),
  stage text not null check (stage in (
    'started','previewed','queued','confirmed','staged','committed','rolled_back','failed'
  )),
  outcome text not null check (outcome in (
    'success','failure','abandoned','recovered','correction','needs_confirmation'
  )),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create index if not exists import_mapping_profiles_owner_used_idx
  on public.import_mapping_profiles(user_id,last_used_at desc);
create index if not exists import_staged_rows_owner_job_idx
  on public.import_staged_rows(user_id,import_job_id,row_number);
create index if not exists import_job_items_owner_job_idx
  on public.import_job_items(user_id,import_job_id,row_number);
create index if not exists import_job_items_position_idx
  on public.import_job_items(collection_item_id) where collection_item_id is not null;
create index if not exists ingestion_events_owner_created_idx
  on public.ingestion_events(user_id,created_at desc);
create index if not exists ingestion_events_operational_idx
  on public.ingestion_events(channel,stage,outcome,created_at desc);

alter table public.import_mapping_profiles enable row level security;
alter table public.import_staged_rows enable row level security;
alter table public.import_job_items enable row level security;
alter table public.ingestion_events enable row level security;

create policy "import mappings own rows" on public.import_mapping_profiles
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "import staging own rows" on public.import_staged_rows
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "import results own rows" on public.import_job_items
  for select to authenticated
  using ((select auth.uid())=user_id);
create policy "ingestion events own rows" on public.ingestion_events
  for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.import_mapping_profiles,public.import_staged_rows,
  public.import_job_items,public.ingestion_events from public,anon,authenticated;
grant select,insert,update,delete on public.import_mapping_profiles,
  public.import_staged_rows to authenticated;
grant select on public.import_job_items to authenticated;
grant select on public.ingestion_events to authenticated;
grant all on public.import_mapping_profiles,public.import_staged_rows,
  public.import_job_items,public.ingestion_events to service_role;

create or replace function public.collection_import_row_error(p_payload jsonb)
returns text
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  state text := coalesce(p_payload->>'cardState','');
  quantity_text text := coalesce(p_payload->>'quantity','');
  date_text text := coalesce(p_payload->>'transactionDate','');
  amount_key text;
  amount_value text;
begin
  if jsonb_typeof(p_payload)<>'object' then return 'payload_not_object'; end if;
  if jsonb_typeof(p_payload->'identity')<>'object' then return 'identity_not_object'; end if;
  if state not in ('raw','graded','sealed') then return 'invalid_card_state'; end if;
  if quantity_text !~ '^\d{1,5}$' or quantity_text::integer not between 1 and 99999 then
    return 'invalid_quantity';
  end if;
  if date_text !~ '^\d{4}-\d{2}-\d{2}$' then return 'invalid_transaction_date'; end if;
  begin
    if date_text::date>current_date then return 'future_transaction_date'; end if;
  exception when others then
    return 'invalid_transaction_date';
  end;
  foreach amount_key in array array[
    'unitPrice','tax','shipping','marketplaceFees','gradingFees','otherCosts'
  ] loop
    amount_value := coalesce(p_payload->>amount_key,'0');
    if amount_value !~ '^\d+(\.\d{1,2})?$' or amount_value::numeric<0 then
      return 'invalid_'||lower(amount_key);
    end if;
  end loop;
  if coalesce(p_payload->>'currency','USD') !~ '^[A-Z]{3}$' then
    return 'invalid_currency';
  end if;
  if nullif(p_payload->>'cardId','') is not null
    and (p_payload->>'cardId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return 'invalid_card_id';
  end if;
  if nullif(p_payload->>'variantId','') is not null
    and (p_payload->>'variantId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return 'invalid_variant_id';
  end if;
  if state='raw' and (
    nullif(p_payload->>'grader','') is not null
    or nullif(p_payload->>'grade','') is not null
  ) then return 'invalid_raw_state'; end if;
  if state='graded' and (
    nullif(p_payload->>'grader','') is null
    or coalesce(p_payload->>'grade','') !~ '^\d+(\.\d)?$'
    or (p_payload->>'grade')::numeric not between 1 and 10
  ) then return 'invalid_graded_state'; end if;
  if state='sealed' and (
    nullif(p_payload->>'rawCondition','') is not null
    or nullif(p_payload->>'grader','') is not null
    or nullif(p_payload->>'grade','') is not null
  ) then return 'invalid_sealed_state'; end if;
  if char_length(coalesce(p_payload->>'notes',''))>10000 then return 'notes_too_long'; end if;
  if char_length(coalesce(p_payload->>'location',''))>250 then return 'location_too_long'; end if;
  if p_payload ? 'tags' and jsonb_typeof(p_payload->'tags')<>'array' then
    return 'tags_not_array';
  end if;
  if jsonb_array_length(coalesce(p_payload->'tags','[]'::jsonb))>50 then
    return 'too_many_tags';
  end if;
  if exists(
    select 1 from jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb)) tag
    where char_length(btrim(tag)) not between 1 and 40
  ) then return 'invalid_tag'; end if;
  return null;
end $$;

revoke all on function public.collection_import_row_error(jsonb)
  from public,anon;
grant execute on function public.collection_import_row_error(jsonb)
  to authenticated;

create or replace function public.record_ingestion_event(
  p_session_id uuid,
  p_channel text,
  p_stage text,
  p_outcome text,
  p_duration_ms integer,
  p_metadata jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_event uuid;
  safe_metadata jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_session_id is null then raise exception 'ingestion_session_required'; end if;
  if p_channel not in ('camera','upload','search','manual','csv') then
    raise exception 'invalid_ingestion_channel';
  end if;
  if p_stage not in (
    'started','previewed','queued','confirmed','staged','committed','rolled_back','failed'
  ) then raise exception 'invalid_ingestion_stage'; end if;
  if p_outcome not in (
    'success','failure','abandoned','recovered','correction','needs_confirmation'
  ) then raise exception 'invalid_ingestion_outcome'; end if;
  if p_duration_ms is not null and p_duration_ms not between 0 and 3600000 then
    raise exception 'invalid_ingestion_duration';
  end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object' then
    raise exception 'invalid_ingestion_metadata';
  end if;
  select coalesce(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb)
  into safe_metadata
  from jsonb_each(coalesce(p_metadata,'{}'::jsonb)) entry
  where entry.key in (
    'rowCount','stagedCount','invalidCount','duplicateCount','queuedCount',
    'language','reason','offline','retry','candidateStatus'
  );
  if pg_column_size(safe_metadata)>2048 then raise exception 'ingestion_metadata_too_large'; end if;
  insert into public.ingestion_events(
    user_id,session_id,channel,stage,outcome,duration_ms,metadata
  ) values(
    owner_id,p_session_id,p_channel,p_stage,p_outcome,p_duration_ms,safe_metadata
  ) returning id into target_event;
  return target_event;
end $$;

revoke all on function public.record_ingestion_event(uuid,text,text,text,integer,jsonb)
  from public,anon;
grant execute on function public.record_ingestion_event(uuid,text,text,text,integer,jsonb)
  to authenticated;

create or replace function public.begin_collection_import(
  p_source_name text,
  p_file_sha256 text,
  p_header_signature text,
  p_mapping jsonb,
  p_preview jsonb
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_job uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if char_length(btrim(coalesce(p_source_name,''))) not between 1 and 120 then
    raise exception 'invalid_source_name';
  end if;
  if coalesce(p_file_sha256,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_file_hash';
  end if;
  if char_length(coalesce(p_header_signature,'')) not between 1 and 4000 then
    raise exception 'invalid_header_signature';
  end if;
  if jsonb_typeof(coalesce(p_mapping,'{}'::jsonb))<>'object'
    or jsonb_typeof(coalesce(p_preview,'{}'::jsonb))<>'object' then
    raise exception 'invalid_import_metadata';
  end if;
  insert into public.import_jobs(
    user_id,status,totals,source_name,file_sha256,header_signature,mapping,preview
  ) values(
    owner_id,'staging','{}'::jsonb,btrim(p_source_name),p_file_sha256,
    p_header_signature,coalesce(p_mapping,'{}'::jsonb),coalesce(p_preview,'{}'::jsonb)
  ) returning id into target_job;
  return target_job;
end $$;

revoke all on function public.begin_collection_import(text,text,text,jsonb,jsonb)
  from public,anon;
grant execute on function public.begin_collection_import(text,text,text,jsonb,jsonb)
  to authenticated;

create or replace function public.stage_collection_import_rows(
  p_import_job_id uuid,
  p_rows jsonb
) returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  job_status text;
  staged_count integer;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'stage_between_1_and_500_rows';
  end if;
  select status into job_status from public.import_jobs
  where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status not in ('staging','ready') then raise exception 'import_not_stageable'; end if;

  insert into public.import_staged_rows(
    import_job_id,user_id,row_number,idempotency_key,payload,updated_at
  )
  select p_import_job_id,owner_id,(row->>'rowNumber')::integer,
    row->>'idempotencyKey',row->'payload',now()
  from jsonb_array_elements(p_rows) row
  on conflict(import_job_id,row_number) do update
  set idempotency_key=excluded.idempotency_key,payload=excluded.payload,updated_at=now()
  where public.import_staged_rows.user_id=owner_id;

  select count(*) into staged_count from public.import_staged_rows
  where import_job_id=p_import_job_id and user_id=owner_id;
  update public.import_jobs
  set status='ready',totals=jsonb_set(totals,'{stagedRows}',to_jsonb(staged_count),true),
    updated_at=now()
  where id=p_import_job_id and user_id=owner_id;
  return staged_count;
end $$;

revoke all on function public.stage_collection_import_rows(uuid,jsonb)
  from public,anon;
grant execute on function public.stage_collection_import_rows(uuid,jsonb)
  to authenticated;

create or replace function public.preview_collection_import(p_import_job_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  result jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if not exists(
    select 1 from public.import_jobs where id=p_import_job_id and user_id=owner_id
  ) then raise exception 'import_not_found'; end if;
  select jsonb_build_object(
    'stagedRows',count(*),
    'validRows',count(*) filter(where public.collection_import_row_error(payload) is null),
    'invalidRows',count(*) filter(where public.collection_import_row_error(payload) is not null),
    'totalQuantity',coalesce(sum((payload->>'quantity')::integer)
      filter(where coalesce(payload->>'quantity','') ~ '^\d{1,5}$'),0),
    'issues',coalesce(jsonb_agg(jsonb_build_object(
      'rowNumber',row_number,
      'code',public.collection_import_row_error(payload)
    ) order by row_number) filter(where public.collection_import_row_error(payload) is not null),'[]'::jsonb)
  ) into result
  from public.import_staged_rows
  where import_job_id=p_import_job_id and user_id=owner_id;
  return result;
end $$;

revoke all on function public.preview_collection_import(uuid) from public,anon;
grant execute on function public.preview_collection_import(uuid) to authenticated;

create or replace function public.commit_collection_import(p_import_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  job_status text;
  validation jsonb;
  staged record;
  row_payload jsonb;
  target_item uuid;
  existing_item uuid;
  action_name text;
  created_count integer := 0;
  reused_count integer := 0;
  result jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select status into job_status from public.import_jobs
  where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status='committed' then
    select totals into result from public.import_jobs
    where id=p_import_job_id and user_id=owner_id;
    return result;
  end if;
  if job_status<>'ready' then raise exception 'import_not_ready'; end if;
  validation := public.preview_collection_import(p_import_job_id);
  if coalesce((validation->>'stagedRows')::integer,0)=0 then
    raise exception 'import_has_no_rows';
  end if;
  if coalesce((validation->>'invalidRows')::integer,0)>0 then
    raise exception 'import_validation_failed';
  end if;

  for staged in
    select * from public.import_staged_rows
    where import_job_id=p_import_job_id and user_id=owner_id
    order by row_number for update
  loop
    row_payload := staged.payload;
    select transaction.collection_item_id into existing_item
    from public.collection_transactions transaction
    where transaction.user_id=owner_id
      and transaction.idempotency_key=staged.idempotency_key;
    target_item := public.create_collection_position(
      p_identity => row_payload->'identity',
      p_card_id => nullif(row_payload->>'cardId','')::uuid,
      p_variant_id => nullif(row_payload->>'variantId','')::uuid,
      p_card_state => row_payload->>'cardState',
      p_raw_condition => nullif(row_payload->>'rawCondition',''),
      p_grader => nullif(row_payload->>'grader',''),
      p_grade => nullif(row_payload->>'grade','')::numeric,
      p_certification_number => nullif(row_payload->>'certificationNumber',''),
      p_quantity => (row_payload->>'quantity')::integer,
      p_transaction_date => (row_payload->>'transactionDate')::date,
      p_unit_price => (row_payload->>'unitPrice')::numeric,
      p_tax => coalesce((row_payload->>'tax')::numeric,0),
      p_shipping => coalesce((row_payload->>'shipping')::numeric,0),
      p_marketplace_fees => coalesce((row_payload->>'marketplaceFees')::numeric,0),
      p_grading_fees => coalesce((row_payload->>'gradingFees')::numeric,0),
      p_other_costs => coalesce((row_payload->>'otherCosts')::numeric,0),
      p_currency => coalesce(row_payload->>'currency','USD'),
      p_marketplace => nullif(row_payload->>'marketplace',''),
      p_notes => nullif(row_payload->>'notes',''),
      p_idempotency_key => staged.idempotency_key,
      p_acquisition_method => coalesce(nullif(row_payload->>'acquisitionMethod',''),'unknown')
    );
    action_name := case when existing_item is null then 'created' else 'reused' end;
    if action_name='created' then
      update public.collection_items item
      set storage_location=nullif(row_payload->>'location',''),
        tags=array(
          select distinct btrim(tag)
          from jsonb_array_elements_text(coalesce(row_payload->'tags','[]'::jsonb)) tag
          order by btrim(tag)
        ),updated_at=now()
      where item.id=target_item and item.user_id=owner_id;
      created_count := created_count+1;
    else
      reused_count := reused_count+1;
    end if;
    insert into public.import_job_items(
      import_job_id,user_id,row_number,collection_item_id,idempotency_key,action,item_snapshot
    )
    select p_import_job_id,owner_id,staged.row_number,item.id,
      staged.idempotency_key,action_name,
      jsonb_build_object(
        'identitySnapshot',item.identity_snapshot,'quantity',item.quantity,
        'cardState',item.card_state,'rawCondition',item.raw_condition,
        'grader',item.grader,'grade',item.grade,
        'certificationNumber',item.certification_number,'notes',item.notes,
        'location',item.storage_location,'status',item.status,
        'currency',item.currency,'tags',to_jsonb(item.tags)
      )
    from public.collection_items item
    where item.id=target_item and item.user_id=owner_id
    on conflict(import_job_id,row_number) do nothing;
  end loop;

  delete from public.valuation_snapshots snapshot
  where snapshot.user_id=owner_id;
  result := validation||jsonb_build_object(
    'createdRows',created_count,'reusedRows',reused_count,'status','committed'
  );
  update public.import_jobs
  set status='committed',totals=result,committed_at=now(),updated_at=now()
  where id=p_import_job_id and user_id=owner_id;
  return result;
end $$;

revoke all on function public.commit_collection_import(uuid) from public,anon;
grant execute on function public.commit_collection_import(uuid) to authenticated;

create or replace function public.rollback_collection_import(p_import_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  job_status text;
  imported record;
  current_snapshot jsonb;
  transaction_count integer;
  removed_count integer := 0;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select status into job_status from public.import_jobs
  where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status='rolled_back' then
    return jsonb_build_object('status','rolled_back','removedRows',0);
  end if;
  if job_status<>'committed' then raise exception 'import_not_committed'; end if;

  for imported in
    select * from public.import_job_items
    where import_job_id=p_import_job_id and user_id=owner_id and action='created'
    order by row_number for update
  loop
    if imported.collection_item_id is null then continue; end if;
    select jsonb_build_object(
      'identitySnapshot',item.identity_snapshot,'quantity',item.quantity,
      'cardState',item.card_state,'rawCondition',item.raw_condition,
      'grader',item.grader,'grade',item.grade,
      'certificationNumber',item.certification_number,'notes',item.notes,
      'location',item.storage_location,'status',item.status,
      'currency',item.currency,'tags',to_jsonb(item.tags)
    ) into current_snapshot
    from public.collection_items item
    where item.id=imported.collection_item_id and item.user_id=owner_id;
    if current_snapshot is null then continue; end if;
    if current_snapshot is distinct from imported.item_snapshot then
      raise exception 'import_position_changed_after_commit';
    end if;
    select count(*) into transaction_count
    from public.collection_transactions transaction
    where transaction.collection_item_id=imported.collection_item_id
      and transaction.user_id=owner_id;
    if transaction_count<>1 or not exists(
      select 1 from public.collection_transactions transaction
      where transaction.collection_item_id=imported.collection_item_id
        and transaction.user_id=owner_id
        and transaction.idempotency_key=imported.idempotency_key
    ) then raise exception 'import_position_has_dependent_transactions'; end if;
    if exists(
      select 1 from public.grading_submissions submission
      where submission.collection_item_id=imported.collection_item_id
        and submission.user_id=owner_id
    ) or exists(
      select 1 from public.grading_scan_sessions session
      where session.collection_item_id=imported.collection_item_id
        and session.user_id=owner_id
    ) or exists(
      select 1 from public.digital_grade_assessments assessment
      where assessment.collection_item_id=imported.collection_item_id
        and assessment.user_id=owner_id
    ) or exists(
      select 1 from public.identity_corrections correction
      where correction.collection_item_id=imported.collection_item_id
        and correction.user_id=owner_id
    ) then raise exception 'import_position_has_dependent_activity'; end if;
  end loop;

  for imported in
    select * from public.import_job_items
    where import_job_id=p_import_job_id and user_id=owner_id and action='created'
    order by row_number desc
  loop
    if imported.collection_item_id is null then continue; end if;
    delete from public.collection_items item
    where item.id=imported.collection_item_id and item.user_id=owner_id;
    if found then removed_count := removed_count+1; end if;
  end loop;
  delete from public.valuation_snapshots snapshot where snapshot.user_id=owner_id;
  update public.import_jobs
  set status='rolled_back',rolled_back_at=now(),updated_at=now(),
    totals=totals||jsonb_build_object('status','rolled_back','removedRows',removed_count)
  where id=p_import_job_id and user_id=owner_id;
  return jsonb_build_object('status','rolled_back','removedRows',removed_count);
end $$;

revoke all on function public.rollback_collection_import(uuid) from public,anon;
grant execute on function public.rollback_collection_import(uuid) to authenticated;

-- Source: supabase/migrations/20260903021457_connect_grading_lifecycle.sql
-- SHA256: 842de409eda201d5cb42dc6b14cfc1be8458e6b7e7cb9b93eac4eb2a7452a34b

-- Connect Mica's evidence-first report, submission, professional return, and
-- disposition records without changing the original report or creating a
-- second owned position. All client-visible tables are owner scoped with RLS.

create table if not exists public.grading_submission_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grader text not null check (grader ~ '^[A-Z0-9 .&-]{2,40}$'),
  service_level text not null check (char_length(service_level) between 1 and 120),
  status text not null default 'planned'
    check (status in ('planned','submitted','closed','cancelled')),
  submitted_at date not null check (submitted_at<=current_date),
  expected_return_date date,
  submission_reference text check (char_length(submission_reference)<=120),
  economics_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(economics_snapshot)='object'),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  unique(user_id,idempotency_key),
  check (expected_return_date is null or expected_return_date>=submitted_at)
);

alter table public.grading_submissions
  add column if not exists batch_id uuid,
  add column if not exists scan_session_id uuid,
  add column if not exists economics_snapshot jsonb not null default '{}'::jsonb;

alter table public.grading_submissions
  drop constraint if exists grading_submissions_id_owner_unique,
  add constraint grading_submissions_id_owner_unique unique(id,user_id),
  drop constraint if exists grading_submissions_batch_owner_fkey,
  add constraint grading_submissions_batch_owner_fkey
    foreign key (batch_id,user_id)
    references public.grading_submission_batches(id,user_id) on delete restrict,
  drop constraint if exists grading_submissions_scan_owner_fkey,
  add constraint grading_submissions_scan_owner_fkey
    foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id)
    on delete set null (scan_session_id),
  drop constraint if exists grading_submissions_economics_object,
  add constraint grading_submissions_economics_object
    check (jsonb_typeof(economics_snapshot)='object');

create index if not exists grading_submissions_batch_idx
  on public.grading_submissions(batch_id,user_id,submitted_at)
  where batch_id is not null;
create index if not exists grading_submissions_scan_idx
  on public.grading_submissions(scan_session_id,user_id,submitted_at desc)
  where scan_session_id is not null;

create table if not exists public.grading_submission_status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null,
  status text not null check (
    status in ('submitted','received','grading','assembly','shipped','returned','cancelled')
  ),
  occurred_on date not null check (occurred_on<=current_date),
  source text not null check (
    source in ('submission','manual_update','grading_return','migration_backfill')
  ),
  note text check (note is null or char_length(note)<=1000),
  created_at timestamptz not null default now(),
  foreign key (submission_id,user_id)
    references public.grading_submissions(id,user_id) on delete cascade,
  unique(submission_id,status,occurred_on)
);

create index if not exists grading_submission_status_owner_idx
  on public.grading_submission_status_events(user_id,occurred_on desc,submission_id);

create table if not exists public.grading_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  scan_session_id uuid,
  submission_id uuid,
  state text not null check (
    state in (
      'candidate','capture_incomplete','analyzed','selected','submitted','received',
      'grading','shipped','returned','held','listed','traded','sold','rejected'
    )
  ),
  occurred_at timestamptz not null default now(),
  source text not null check (
    source in ('user','scan','submission','grading_return','inventory','migration_backfill')
  ),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now(),
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id) on delete cascade,
  foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id)
    on delete set null (scan_session_id),
  foreign key (submission_id,user_id)
    references public.grading_submissions(id,user_id)
    on delete set null (submission_id)
);

create index if not exists grading_lifecycle_owner_item_idx
  on public.grading_lifecycle_events(user_id,collection_item_id,occurred_at desc);
create index if not exists grading_lifecycle_submission_idx
  on public.grading_lifecycle_events(submission_id,user_id,occurred_at)
  where submission_id is not null;

create table if not exists public.grading_input_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  scan_session_id uuid not null,
  evidence_id uuid,
  correction_type text not null check (
    correction_type in ('defect','grade_range','subscore','economics')
  ),
  original_value jsonb not null check (jsonb_typeof(original_value)='object'),
  corrected_value jsonb not null check (jsonb_typeof(corrected_value)='object'),
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id) on delete cascade,
  foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id) on delete cascade,
  foreign key (evidence_id,user_id)
    references public.grading_evidence(id,user_id) on delete cascade
);

create index if not exists grading_input_corrections_owner_idx
  on public.grading_input_corrections(user_id,collection_item_id,created_at desc);
create index if not exists grading_input_corrections_session_idx
  on public.grading_input_corrections(scan_session_id,user_id,created_at desc);

alter table public.grading_submission_batches enable row level security;
alter table public.grading_submission_status_events enable row level security;
alter table public.grading_lifecycle_events enable row level security;
alter table public.grading_input_corrections enable row level security;

create policy "grading batches own select"
  on public.grading_submission_batches for select to authenticated
  using ((select auth.uid())=user_id);
create policy "grading batches own insert"
  on public.grading_submission_batches for insert to authenticated
  with check ((select auth.uid())=user_id);
create policy "grading batches own update"
  on public.grading_submission_batches for update to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create policy "grading status history own select"
  on public.grading_submission_status_events for select to authenticated
  using ((select auth.uid())=user_id);

create policy "grading lifecycle own select"
  on public.grading_lifecycle_events for select to authenticated
  using ((select auth.uid())=user_id);
create policy "grading lifecycle bounded user decisions"
  on public.grading_lifecycle_events for insert to authenticated
  with check (
    (select auth.uid())=user_id
    and source='user'
    and state in ('selected','rejected','held')
    and exists (
      select 1 from public.collection_items item
      where item.id=collection_item_id and item.user_id=(select auth.uid())
    )
  );

create policy "grading corrections own select"
  on public.grading_input_corrections for select to authenticated
  using ((select auth.uid())=user_id);
create policy "grading corrections own insert"
  on public.grading_input_corrections for insert to authenticated
  with check ((select auth.uid())=user_id);

revoke all on table public.grading_submission_batches from public,anon,authenticated;
revoke all on table public.grading_submission_status_events from public,anon,authenticated;
revoke all on table public.grading_lifecycle_events from public,anon,authenticated;
revoke all on table public.grading_input_corrections from public,anon,authenticated;
grant select,insert,update on table public.grading_submission_batches to authenticated;
grant select on table public.grading_submission_status_events to authenticated;
grant select,insert on table public.grading_lifecycle_events to authenticated;
grant select,insert on table public.grading_input_corrections to authenticated;
grant all on table public.grading_submission_batches to service_role;
grant all on table public.grading_submission_status_events to service_role;
grant all on table public.grading_lifecycle_events to service_role;
grant all on table public.grading_input_corrections to service_role;

create or replace function grading_private.connect_submission_report()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.scan_session_id is null then
    select session.id into new.scan_session_id
    from public.grading_scan_sessions session
    where session.collection_item_id=new.collection_item_id
      and session.user_id=new.user_id
      and session.workflow_status in ('completed','abstained')
    order by session.completed_at desc nulls last,session.updated_at desc
    limit 1;
  end if;
  return new;
end $$;

revoke all on function grading_private.connect_submission_report()
  from public,anon,authenticated;

drop trigger if exists connect_submission_report_trigger
  on public.grading_submissions;
create trigger connect_submission_report_trigger
before insert or update of collection_item_id,user_id,scan_session_id
on public.grading_submissions
for each row execute function grading_private.connect_submission_report();

update public.grading_submissions submission
set scan_session_id=(
  select session.id
  from public.grading_scan_sessions session
  where session.collection_item_id=submission.collection_item_id
    and session.user_id=submission.user_id
    and session.workflow_status in ('completed','abstained')
    and session.started_at<=submission.created_at
  order by session.completed_at desc nulls last,session.updated_at desc
  limit 1
)
where submission.scan_session_id is null
  and exists (
    select 1 from public.grading_scan_sessions session
    where session.collection_item_id=submission.collection_item_id
      and session.user_id=submission.user_id
      and session.workflow_status in ('completed','abstained')
      and session.started_at<=submission.created_at
  );

create or replace function grading_private.capture_submission_history()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  event_source text;
  lifecycle_state text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  event_source:=case
    when tg_op='INSERT' then 'submission'
    when new.status='returned' then 'grading_return'
    else 'manual_update'
  end;
  insert into public.grading_submission_status_events(
    user_id,submission_id,status,occurred_on,source
  ) values(
    new.user_id,new.id,new.status,new.status_updated_at,event_source
  ) on conflict (submission_id,status,occurred_on) do nothing;

  if tg_op='INSERT' and not exists (
    select 1 from public.grading_lifecycle_events event
    where event.user_id=new.user_id
      and event.collection_item_id=new.collection_item_id
      and event.state='selected'
      and event.occurred_at<=new.status_updated_at::timestamp at time zone 'UTC'
  ) then
    insert into public.grading_lifecycle_events(
      user_id,collection_item_id,scan_session_id,submission_id,state,
      occurred_at,source,details
    ) values(
      new.user_id,new.collection_item_id,new.scan_session_id,new.id,'selected',
      (new.status_updated_at::timestamp at time zone 'UTC')-interval '1 second',
      'submission',jsonb_build_object(
        'reason','Sending the item records the selection decision.',
        'automatic',true,
        'historyVersion','mica-grading-lifecycle-v1'
      )
    );
  end if;

  lifecycle_state:=case
    when new.status='assembly' then 'grading'
    when new.status='cancelled' then 'rejected'
    else new.status
  end;
  insert into public.grading_lifecycle_events(
    user_id,collection_item_id,scan_session_id,submission_id,state,
    occurred_at,source,details
  ) values(
    new.user_id,new.collection_item_id,new.scan_session_id,new.id,lifecycle_state,
    new.status_updated_at::timestamp at time zone 'UTC',
    case when new.status='returned' then 'grading_return' else 'submission' end,
    jsonb_build_object(
      'grader',new.grader,
      'submissionStatus',new.status,
      'batchId',new.batch_id,
      'historyVersion','mica-grading-lifecycle-v1'
    )
  );

  if new.batch_id is not null and new.status in ('returned','cancelled')
    and not exists (
      select 1 from public.grading_submissions submission
      where submission.batch_id=new.batch_id
        and submission.user_id=new.user_id
        and submission.id<>new.id
        and submission.status not in ('returned','cancelled')
    )
  then
    update public.grading_submission_batches batch
    set status=case
      when not exists (
        select 1 from public.grading_submissions submission
        where submission.batch_id=new.batch_id
          and submission.user_id=new.user_id
          and submission.status<>'cancelled'
      ) then 'cancelled'
      else 'closed'
    end,
    updated_at=now()
    where batch.id=new.batch_id and batch.user_id=new.user_id;
  end if;
  return new;
end $$;

revoke all on function grading_private.capture_submission_history()
  from public,anon,authenticated;

drop trigger if exists capture_submission_history_trigger
  on public.grading_submissions;
create trigger capture_submission_history_trigger
after insert or update of status on public.grading_submissions
for each row execute function grading_private.capture_submission_history();

create or replace function grading_private.capture_scan_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  lifecycle_state text;
begin
  if new.collection_item_id is null
    or (tg_op='UPDATE' and new.workflow_status is not distinct from old.workflow_status)
  then return new; end if;
  lifecycle_state:=case
    when new.workflow_status in ('capturing','failed') then 'capture_incomplete'
    when new.workflow_status in ('completed','abstained') then 'analyzed'
    when new.workflow_status='cancelled' then 'rejected'
    else null
  end;
  if lifecycle_state is not null then
    insert into public.grading_lifecycle_events(
      user_id,collection_item_id,scan_session_id,state,occurred_at,source,details
    ) values(
      new.user_id,new.collection_item_id,new.id,lifecycle_state,
      coalesce(new.completed_at,new.updated_at,new.started_at,now()),'scan',
      jsonb_build_object(
        'workflowStatus',new.workflow_status,
        'historyVersion','mica-grading-lifecycle-v1'
      )
    );
  end if;
  return new;
end $$;

revoke all on function grading_private.capture_scan_lifecycle()
  from public,anon,authenticated;

drop trigger if exists capture_scan_lifecycle_trigger
  on public.grading_scan_sessions;
create trigger capture_scan_lifecycle_trigger
after insert or update of workflow_status,collection_item_id
on public.grading_scan_sessions
for each row execute function grading_private.capture_scan_lifecycle();

create or replace function grading_private.capture_inventory_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  lifecycle_state text;
begin
  if tg_op='UPDATE'
    and new.status is not distinct from old.status
    and new.card_state is not distinct from old.card_state
  then return new; end if;
  lifecycle_state:=case
    when new.status='listed' then 'listed'
    when new.status='sold' then 'sold'
    when new.status='traded' then 'traded'
    when new.card_state='graded' and new.status='owned' then 'held'
    when new.card_state='raw' and new.status='owned' then 'candidate'
    else null
  end;
  if lifecycle_state is not null then
    insert into public.grading_lifecycle_events(
      user_id,collection_item_id,state,occurred_at,source,details
    ) values(
      new.user_id,new.id,lifecycle_state,coalesce(new.updated_at,now()),'inventory',
      jsonb_build_object(
        'inventoryStatus',new.status,
        'cardState',new.card_state,
        'historyVersion','mica-grading-lifecycle-v1'
      )
    );
  end if;
  return new;
end $$;

revoke all on function grading_private.capture_inventory_lifecycle()
  from public,anon,authenticated;

drop trigger if exists capture_inventory_lifecycle_trigger
  on public.collection_items;
create trigger capture_inventory_lifecycle_trigger
after insert or update of status,card_state on public.collection_items
for each row execute function grading_private.capture_inventory_lifecycle();

insert into public.grading_submission_status_events(
  user_id,submission_id,status,occurred_on,source,note
)
select submission.user_id,submission.id,submission.status,
  submission.status_updated_at,'migration_backfill',
  'Current status only; earlier stage dates were not reconstructable.'
from public.grading_submissions submission
on conflict (submission_id,status,occurred_on) do nothing;

insert into public.grading_lifecycle_events(
  user_id,collection_item_id,scan_session_id,submission_id,state,
  occurred_at,source,details
)
select submission.user_id,submission.collection_item_id,
  submission.scan_session_id,submission.id,
  case
    when submission.status='assembly' then 'grading'
    when submission.status='cancelled' then 'rejected'
    else submission.status
  end,
  submission.status_updated_at::timestamp at time zone 'UTC',
  'migration_backfill',
  jsonb_build_object(
    'grader',submission.grader,
    'submissionStatus',submission.status,
    'historyComplete',false,
    'historyVersion','mica-grading-lifecycle-v1'
  )
from public.grading_submissions submission
where not exists (
  select 1 from public.grading_lifecycle_events event
  where event.submission_id=submission.id
    and event.state=case
      when submission.status='assembly' then 'grading'
      when submission.status='cancelled' then 'rejected'
      else submission.status
    end
    and event.occurred_at::date=submission.status_updated_at
);

insert into public.grading_lifecycle_events(
  user_id,collection_item_id,scan_session_id,state,occurred_at,source,details
)
select session.user_id,session.collection_item_id,session.id,
  case
    when session.workflow_status in ('capturing','failed') then 'capture_incomplete'
    when session.workflow_status in ('completed','abstained') then 'analyzed'
    when session.workflow_status='cancelled' then 'rejected'
  end,
  coalesce(session.completed_at,session.updated_at,session.started_at),
  'migration_backfill',
  jsonb_build_object(
    'workflowStatus',session.workflow_status,
    'historyVersion','mica-grading-lifecycle-v1'
  )
from public.grading_scan_sessions session
where session.collection_item_id is not null
  and session.workflow_status<>'analyzing'
  and not exists (
    select 1 from public.grading_lifecycle_events event
    where event.scan_session_id=session.id
      and event.state=case
        when session.workflow_status in ('capturing','failed') then 'capture_incomplete'
        when session.workflow_status in ('completed','abstained') then 'analyzed'
        when session.workflow_status='cancelled' then 'rejected'
      end
  );

insert into public.grading_lifecycle_events(
  user_id,collection_item_id,state,occurred_at,source,details
)
select item.user_id,item.id,
  case
    when item.status='listed' then 'listed'
    when item.status='sold' then 'sold'
    when item.status='traded' then 'traded'
    when item.card_state='graded' and item.status='owned' then 'held'
    else 'candidate'
  end,
  item.updated_at,'migration_backfill',
  jsonb_build_object(
    'inventoryStatus',item.status,
    'cardState',item.card_state,
    'historyVersion','mica-grading-lifecycle-v1'
  )
from public.collection_items item
where item.status in ('owned','listed','sold','traded')
  and not exists (
    select 1 from public.grading_lifecycle_events event
    where event.collection_item_id=item.id
      and event.user_id=item.user_id
      and event.source in ('inventory','migration_backfill')
  );

create or replace function public.record_grading_submission_batch(
  p_entries jsonb,
  p_submitted_at date,
  p_grader text,
  p_service_level text,
  p_expected_return_date date default null,
  p_submission_reference text default null,
  p_economics_snapshot jsonb default '{}'::jsonb,
  p_currency text default 'USD',
  p_idempotency_key text default null
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  normalized_grader text := upper(trim(coalesce(p_grader,'')));
  normalized_currency text := upper(trim(coalesce(p_currency,'')));
  normalized_key text := nullif(trim(coalesce(p_idempotency_key,'')),'');
  target_batch_id uuid;
  submission_id uuid;
  entry jsonb;
  entry_number integer := 0;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 100
    then raise exception 'invalid_batch_entries'; end if;
  if p_submitted_at is null or p_submitted_at>current_date
    then raise exception 'invalid_submission_date'; end if;
  if p_expected_return_date is not null and p_expected_return_date<p_submitted_at
    then raise exception 'invalid_expected_return_date'; end if;
  if normalized_grader !~ '^[A-Z0-9 .&-]{2,40}$'
    then raise exception 'invalid_grader'; end if;
  if char_length(trim(coalesce(p_service_level,''))) not between 1 and 120
    then raise exception 'invalid_service_level'; end if;
  if char_length(coalesce(p_submission_reference,''))>120
    then raise exception 'invalid_submission_reference'; end if;
  if normalized_currency !~ '^[A-Z]{3}$'
    then raise exception 'invalid_currency'; end if;
  if normalized_key is null or char_length(normalized_key) not between 8 and 200
    then raise exception 'invalid_idempotency_key'; end if;
  if jsonb_typeof(coalesce(p_economics_snapshot,'{}'::jsonb))<>'object'
    or octet_length(coalesce(p_economics_snapshot,'{}'::jsonb)::text)>50000
    then raise exception 'invalid_economics_snapshot'; end if;

  select batch.id into target_batch_id
  from public.grading_submission_batches batch
  where batch.user_id=owner_id and batch.idempotency_key=normalized_key;
  if target_batch_id is not null then return target_batch_id; end if;

  insert into public.grading_submission_batches(
    user_id,grader,service_level,status,submitted_at,expected_return_date,
    submission_reference,economics_snapshot,currency,idempotency_key
  ) values(
    owner_id,normalized_grader,trim(p_service_level),'planned',p_submitted_at,
    p_expected_return_date,nullif(trim(coalesce(p_submission_reference,'')),''),
    coalesce(p_economics_snapshot,'{}'::jsonb),normalized_currency,normalized_key
  ) returning id into target_batch_id;

  for entry in select value from jsonb_array_elements(p_entries) loop
    entry_number:=entry_number+1;
    if jsonb_typeof(entry)<>'object'
      or coalesce(entry->>'collectionItemId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(coalesce(entry->'economics','{}'::jsonb))<>'object'
      or octet_length(coalesce(entry->'economics','{}'::jsonb)::text)>20000
    then raise exception 'invalid_batch_entry'; end if;
    submission_id:=public.record_grading_submission(
      (entry->>'collectionItemId')::uuid,
      p_submitted_at,
      normalized_grader,
      p_expected_return_date,
      p_submission_reference,
      case
        when (entry->>'estimatedTotalCost') ~ '^[0-9]+(?:\.[0-9]{1,2})?$'
          then (entry->>'estimatedTotalCost')::numeric
        else null
      end,
      nullif(trim(coalesce(entry->>'notes','')),''),
      normalized_key||':'||entry_number::text
    );
    update public.grading_submissions submission
    set batch_id=target_batch_id,
        scan_session_id=case
          when coalesce(entry->>'scanSessionId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (entry->>'scanSessionId')::uuid
          else submission.scan_session_id
        end,
        economics_snapshot=coalesce(entry->'economics','{}'::jsonb),
        updated_at=now()
    where submission.id=submission_id and submission.user_id=owner_id;
  end loop;

  update public.grading_submission_batches batch
  set status='submitted',updated_at=now()
  where batch.id=target_batch_id and batch.user_id=owner_id;
  return target_batch_id;
end $$;

revoke all on function public.record_grading_submission_batch(
  jsonb,date,text,text,date,text,jsonb,text,text
) from public,anon;
grant execute on function public.record_grading_submission_batch(
  jsonb,date,text,text,date,text,jsonb,text,text
) to authenticated;

create or replace function public.record_grading_lifecycle_decision(
  p_collection_item_id uuid,
  p_state text,
  p_scan_session_id uuid default null,
  p_reason text default null
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  event_id uuid;
  item_state text;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_state not in ('selected','rejected','held')
    then raise exception 'invalid_lifecycle_decision'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 1 and 1000
    then raise exception 'decision_reason_required'; end if;
  select item.card_state into item_state
  from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id;
  if not found then raise exception 'position_not_found'; end if;
  if p_state in ('selected','rejected') and item_state<>'raw'
    then raise exception 'decision_requires_raw_position'; end if;
  if p_state='held' and item_state<>'graded'
    then raise exception 'held_requires_returned_grade'; end if;
  if p_scan_session_id is not null and not exists (
    select 1 from public.grading_scan_sessions session
    where session.id=p_scan_session_id
      and session.user_id=owner_id
      and session.collection_item_id=p_collection_item_id
  ) then raise exception 'grading_session_not_found'; end if;
  if p_state='selected' and not exists (
    select 1 from public.grading_scan_sessions session
    where session.user_id=owner_id
      and session.collection_item_id=p_collection_item_id
      and session.workflow_status in ('completed','abstained')
  ) then raise exception 'grading_report_required'; end if;
  insert into public.grading_lifecycle_events(
    user_id,collection_item_id,scan_session_id,state,source,details
  ) values(
    owner_id,p_collection_item_id,p_scan_session_id,p_state,'user',
    jsonb_build_object(
      'reason',trim(p_reason),
      'historyVersion','mica-grading-lifecycle-v1'
    )
  ) returning id into event_id;
  return event_id;
end $$;

revoke all on function public.record_grading_lifecycle_decision(uuid,text,uuid,text)
  from public,anon;
grant execute on function public.record_grading_lifecycle_decision(uuid,text,uuid,text)
  to authenticated;

create or replace function public.record_grading_input_correction(
  p_scan_session_id uuid,
  p_evidence_id uuid,
  p_correction_type text,
  p_original_value jsonb,
  p_corrected_value jsonb,
  p_reason text
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_item_id uuid;
  correction_id uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_correction_type not in ('defect','grade_range','subscore','economics')
    then raise exception 'invalid_correction_type'; end if;
  if jsonb_typeof(p_original_value)<>'object'
    or jsonb_typeof(p_corrected_value)<>'object'
    or octet_length(p_original_value::text)>10000
    or octet_length(p_corrected_value::text)>10000
    then raise exception 'invalid_correction_value'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 1 and 1000
    then raise exception 'correction_reason_required'; end if;
  select session.collection_item_id into target_item_id
  from public.grading_scan_sessions session
  where session.id=p_scan_session_id and session.user_id=owner_id;
  if target_item_id is null then raise exception 'owned_grading_report_required'; end if;
  if p_evidence_id is not null and not exists (
    select 1 from public.grading_evidence evidence
    where evidence.id=p_evidence_id
      and evidence.scan_session_id=p_scan_session_id
      and evidence.user_id=owner_id
  ) then raise exception 'grading_evidence_not_found'; end if;
  insert into public.grading_input_corrections(
    user_id,collection_item_id,scan_session_id,evidence_id,correction_type,
    original_value,corrected_value,reason
  ) values(
    owner_id,target_item_id,p_scan_session_id,p_evidence_id,p_correction_type,
    p_original_value,p_corrected_value,trim(p_reason)
  ) returning id into correction_id;
  return correction_id;
end $$;

revoke all on function public.record_grading_input_correction(
  uuid,uuid,text,jsonb,jsonb,text
) from public,anon;
grant execute on function public.record_grading_input_correction(
  uuid,uuid,text,jsonb,jsonb,text
) to authenticated;

create or replace function public.grading_calibration_summary()
returns table(
  grader text,
  capture_quality text,
  outcome_count bigint,
  mean_absolute_error numeric,
  mean_bias numeric,
  exact_rate numeric,
  within_one_rate numeric
)
language sql
stable
security invoker
set search_path=''
as $$
  with linked as (
    select
      outcome.professional_grader as grader,
      coalesce(
        prediction.pregrade_score,
        prediction.condition_score,
        prediction.most_likely_grade
      )::numeric as predicted_grade,
      outcome.returned_grade::numeric as returned_grade,
      case
        when jsonb_typeof(prediction.report_snapshot#>'{quality,confidence}')='number'
          then (prediction.report_snapshot#>>'{quality,confidence}')::numeric
        else null
      end as quality_confidence
    from public.grading_outcomes outcome
    join public.grading_predictions prediction
      on prediction.scan_session_id=outcome.scan_session_id
      and prediction.user_id=outcome.user_id
    where outcome.user_id=(select auth.uid())
      and outcome.returned_grade is not null
      and coalesce(
        prediction.pregrade_score,
        prediction.condition_score,
        prediction.most_likely_grade
      ) is not null
  ), bucketed as (
    select *,case
      when quality_confidence>=0.8 then 'high'
      when quality_confidence>=0.6 then 'medium'
      when quality_confidence is not null then 'low'
      else 'unknown'
    end as capture_quality
    from linked
  )
  select grader,capture_quality,count(*) as outcome_count,
    round(avg(abs(predicted_grade-returned_grade)),3) as mean_absolute_error,
    round(avg(predicted_grade-returned_grade),3) as mean_bias,
    round(avg(case when predicted_grade=returned_grade then 1 else 0 end),4) as exact_rate,
    round(avg(case when abs(predicted_grade-returned_grade)<=1 then 1 else 0 end),4) as within_one_rate
  from bucketed
  group by grader,capture_quality
  order by grader,capture_quality;
$$;

revoke all on function public.grading_calibration_summary() from public,anon;
grant execute on function public.grading_calibration_summary() to authenticated;

comment on table public.grading_submission_status_events is
  'Append-only, owner-visible history. Rows present before this migration preserve only their latest reconstructable stage.';
comment on table public.grading_input_corrections is
  'Append-only user corrections. Original grading reports remain immutable and auditable.';
comment on function public.grading_calibration_summary() is
  'Owner-only predicted-versus-returned accuracy grouped by professional grader and capture-quality cohort.';

-- Source: supabase/migrations/20260903065732_organize_collection_depth.sql
-- SHA256: bc6212eddaa2e7702d599591206212d49fdc978171a983a36072b32c617f3d22

-- Step 8: one owner-scoped organization model for folders, labels, physical
-- locations, saved views, exact goals, attachments, custom fields, and
-- recoverable bulk changes. This migration is staged only; production remains
-- unchanged until the Step 12 release gate.

create schema if not exists organization_private;
revoke all on schema organization_private from public,anon,authenticated;

alter table public.collections
  add column if not exists description text,
  add column if not exists color text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.saved_views
  add column if not exists collection_id uuid,
  add column if not exists configuration_version text not null default 'mica-organization-v1',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists(select 1 from pg_constraint where conname='saved_views_collection_owner_fk') then
    alter table public.saved_views add constraint saved_views_collection_owner_fk
      foreign key(collection_id,user_id) references public.collections(id,user_id) on delete cascade;
  end if;
  if not exists(select 1 from pg_constraint where conname='saved_views_name_length_check') then
    alter table public.saved_views add constraint saved_views_name_length_check
      check(char_length(btrim(name)) between 1 and 100);
  end if;
  if not exists(select 1 from pg_constraint where conname='saved_views_configuration_object_check') then
    alter table public.saved_views add constraint saved_views_configuration_object_check
      check(jsonb_typeof(configuration)='object' and pg_column_size(configuration)<=16384);
  end if;
end
$$;

create index if not exists saved_views_owner_name_idx
  on public.saved_views(user_id,lower(name));
create index if not exists saved_views_owner_collection_idx
  on public.saved_views(user_id,collection_id,updated_at desc);

create or replace function organization_private.valid_custom_fields(p_value jsonb)
returns boolean
language sql
immutable
set search_path=''
as $$
  select jsonb_typeof(coalesce(p_value,'{}'::jsonb))='object'
    and pg_column_size(coalesce(p_value,'{}'::jsonb))<=16384
    and (select count(*)<=20 from jsonb_each(coalesce(p_value,'{}'::jsonb)))
    and not exists(
      select 1 from jsonb_each(coalesce(p_value,'{}'::jsonb)) field
      where char_length(field.key) not between 1 and 40
        or field.key !~ '^[a-z0-9][a-z0-9_-]*$'
        or jsonb_typeof(field.value) not in ('string','number','boolean')
        or (jsonb_typeof(field.value)='string' and char_length(field.value #>> '{}')>500)
    );
$$;

create or replace function organization_private.searchable_labels(p_value text[])
returns text
language sql
immutable
set search_path=''
as $$
  select array_to_string(coalesce(p_value,'{}'::text[]),' ');
$$;

create or replace function organization_private.indexed_item_aliases(
  p_collectible_id uuid,
  p_variant_id uuid,
  p_identity jsonb
)
returns text[]
language sql
immutable
set search_path=''
as $$
  select array_remove(array[
    p_collectible_id::text,
    p_variant_id::text,
    p_identity #>> '{externalIds,tcgdex}',
    p_identity #>> '{externalIds,pkmnprices}',
    p_identity #>> '{externalIds,tcgplayer}',
    p_identity #>> '{externalIds,justtcg}',
    case when
      p_collectible_id is null and p_variant_id is null
      and nullif(p_identity #>> '{externalIds,tcgdex}','') is null
      and nullif(p_identity #>> '{externalIds,pkmnprices}','') is null
      and nullif(p_identity #>> '{externalIds,tcgplayer}','') is null
      and nullif(p_identity #>> '{externalIds,justtcg}','') is null
      and nullif(p_identity->>'language','') is not null
      and nullif(coalesce(p_identity->>'setId',p_identity->>'set'),'') is not null
      and nullif(coalesce(p_identity->>'number',p_identity->>'collectorNumber'),'') is not null
      and nullif(coalesce(p_identity->>'variant',p_identity->>'finish'),'') is not null
    then 'identity:'||lower(p_identity->>'language')||':'||
      lower(coalesce(p_identity->>'setId',p_identity->>'set'))||':'||
      lower(coalesce(p_identity->>'number',p_identity->>'collectorNumber'))||':'||
      lower(coalesce(p_identity->>'variant',p_identity->>'finish'))
    end
  ],null);
$$;

alter table public.collection_items
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add column if not exists organization_version text not null default 'mica-organization-v1',
  add column if not exists organization_aliases text[] generated always as (
    organization_private.indexed_item_aliases(collectible_id,variant_id,identity_snapshot)
  ) stored;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='collection_items_custom_fields_check') then
    alter table public.collection_items add constraint collection_items_custom_fields_check
      check(organization_private.valid_custom_fields(custom_fields));
  end if;
end
$$;

alter table public.collection_items
  add column if not exists organization_search tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(identity_snapshot->>'name','') || ' ' ||
      coalesce(identity_snapshot->>'set','') || ' ' ||
      coalesce(identity_snapshot->>'setName','') || ' ' ||
      coalesce(identity_snapshot->>'number','') || ' ' ||
      coalesce(identity_snapshot->>'collectorNumber','') || ' ' ||
      coalesce(identity_snapshot->>'artist','') || ' ' ||
      coalesce(identity_snapshot->>'rarity','') || ' ' ||
      coalesce(storage_location,'') || ' ' ||
      organization_private.searchable_labels(tags)
    )
  ) stored;

create index if not exists collection_items_organization_search_idx
  on public.collection_items using gin(organization_search);
create index if not exists collection_items_organization_aliases_idx
  on public.collection_items using gin(organization_aliases);
create index if not exists collection_items_owner_updated_idx
  on public.collection_items(user_id,updated_at desc,id desc);
create index if not exists collection_items_owner_name_idx
  on public.collection_items(user_id,lower(coalesce(identity_snapshot->>'name','')),id);
create index if not exists collection_items_owner_location_idx
  on public.collection_items(user_id,lower(coalesce(storage_location,'')),id);
create index if not exists collection_items_owner_set_idx
  on public.collection_items(user_id,lower(coalesce(identity_snapshot->>'set',identity_snapshot->>'setName','')),id);
create index if not exists collection_items_owner_language_idx
  on public.collection_items(user_id,lower(coalesce(identity_snapshot->>'language','')),id);

-- Preserve any early normalized tag records in the now-canonical item labels.
update public.collection_items item
set tags=(
  select coalesce(array_agg(value order by value),'{}'::text[])
  from (
    select distinct on (lower(value)) value
    from (
      select unnest(item.tags) value
      union all
      select tag.name
      from public.collection_item_tags link
      join public.collection_tags tag on tag.id=link.tag_id and tag.user_id=link.user_id
      where link.collection_item_id=item.id and link.user_id=item.user_id
    ) source
    where nullif(btrim(value),'') is not null and char_length(btrim(value))<=40
    order by lower(value),value
  ) labels
)
where exists(
  select 1 from public.collection_item_tags link
  where link.collection_item_id=item.id and link.user_id=item.user_id
);

comment on table public.collections is
  'Owner digital folders. Each position belongs to one folder; labels remain flexible many-to-one organization.';
comment on column public.collection_items.tags is
  'Canonical flexible labels. collection_tags and collection_item_tags are retained only for legacy migration compatibility.';
comment on column public.collection_items.storage_location is
  'Owner-entered physical path such as room, shelf, box, binder, page, or display.';
comment on table public.saved_views is
  'Versioned reusable filters/sorts. Saved views are dynamic queries and never duplicate or move inventory.';
comment on table public.card_watchlist is
  'Buying intent and price-alert state; not a collection folder, label, or saved view.';

create table if not exists public.collection_custom_field_definitions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check(key ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  name text not null check(char_length(btrim(name)) between 1 and 80),
  value_type text not null check(value_type in ('text','number','boolean','date')),
  help_text text check(char_length(help_text)<=300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,key),
  unique(id,user_id)
);
create index if not exists collection_custom_fields_owner_idx
  on public.collection_custom_field_definitions(user_id,lower(name));

create or replace function organization_private.validate_item_custom_fields()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  field record;
  expected_type text;
begin
  if not organization_private.valid_custom_fields(new.custom_fields) then
    raise exception 'invalid_custom_fields';
  end if;
  for field in select key,value from jsonb_each(new.custom_fields) loop
    select definition.value_type into expected_type
    from public.collection_custom_field_definitions definition
    where definition.user_id=new.user_id and definition.key=field.key;
    if expected_type is null then raise exception 'custom_field_definition_missing'; end if;
    if (expected_type='text' and jsonb_typeof(field.value)<>'string')
      or (expected_type='number' and jsonb_typeof(field.value)<>'number')
      or (expected_type='boolean' and jsonb_typeof(field.value)<>'boolean')
      or (expected_type='date' and (
        jsonb_typeof(field.value)<>'string'
        or (field.value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$'
      ))
    then raise exception 'custom_field_type_mismatch'; end if;
    if expected_type='date' then
      begin
        perform (field.value #>> '{}')::date;
      exception when others then
        raise exception 'custom_field_type_mismatch';
      end;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function organization_private.protect_used_custom_field_definition()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(
    select 1 from public.collection_items item
    where item.user_id=old.user_id and item.custom_fields ? old.key
  ) then raise exception 'custom_field_definition_in_use'; end if;
  return old;
end;
$$;

drop trigger if exists collection_items_validate_custom_fields on public.collection_items;
create trigger collection_items_validate_custom_fields
before insert or update of custom_fields on public.collection_items
for each row execute function organization_private.validate_item_custom_fields();

drop trigger if exists collection_custom_field_definition_delete_guard on public.collection_custom_field_definitions;
create trigger collection_custom_field_definition_delete_guard
before delete on public.collection_custom_field_definitions
for each row execute function organization_private.protect_used_custom_field_definition();

create table if not exists public.collection_item_attachments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  kind text not null check(kind in ('photo','document')),
  storage_path text not null check(char_length(storage_path) between 1 and 500),
  filename text not null check(char_length(filename) between 1 and 255),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  byte_size integer not null check(byte_size between 1 and 10485760),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  caption text check(char_length(caption)<=500),
  created_at timestamptz not null default now(),
  foreign key(collection_item_id,user_id) references public.collection_items(id,user_id) on delete cascade,
  unique(user_id,storage_path),
  unique(id,user_id)
);
create index if not exists collection_attachments_item_idx
  on public.collection_item_attachments(user_id,collection_item_id,created_at desc);

create table if not exists public.collection_goals(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid,
  name text not null check(char_length(btrim(name)) between 1 and 120),
  goal_type text not null check(goal_type in ('checklist','quantity')),
  dimension text not null check(dimension in ('set','subset','artist','character','rarity','language','finish','condition')),
  criteria jsonb not null default '{}'::jsonb check(jsonb_typeof(criteria)='object' and pg_column_size(criteria)<=8192),
  targets jsonb not null default '[]'::jsonb check(jsonb_typeof(targets)='array' and jsonb_array_length(targets)<=2000 and pg_column_size(targets)<=524288),
  target_count integer check(target_count between 1 and 1000000),
  metadata_status text not null default 'incomplete' check(metadata_status in ('verified','incomplete','unsupported')),
  catalog_source text,
  catalog_version text,
  last_progress jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(collection_id,user_id) references public.collections(id,user_id) on delete cascade,
  unique(id,user_id),
  check((goal_type='checklist' and target_count is null) or (goal_type='quantity' and target_count is not null))
);
create index if not exists collection_goals_owner_idx
  on public.collection_goals(user_id,archived_at,updated_at desc);

create table if not exists public.collection_goal_events(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  event_type text not null check(event_type in ('created','completed','reopened','archived','restored')),
  progress jsonb not null check(jsonb_typeof(progress)='object'),
  occurred_at timestamptz not null default now(),
  foreign key(goal_id,user_id) references public.collection_goals(id,user_id) on delete cascade
);
create index if not exists collection_goal_events_owner_idx
  on public.collection_goal_events(user_id,goal_id,occurred_at desc);

create table if not exists public.collection_organization_operations(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null check(operation_type in ('bulk_edit','undo')),
  item_count integer not null check(item_count between 1 and 500),
  requested_changes jsonb not null check(jsonb_typeof(requested_changes)='object'),
  item_snapshots jsonb not null check(jsonb_typeof(item_snapshots)='array'),
  reverses_operation_id uuid,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key(reverses_operation_id,user_id) references public.collection_organization_operations(id,user_id)
);
create index if not exists collection_org_operations_owner_idx
  on public.collection_organization_operations(user_id,created_at desc);

create or replace function organization_private.item_aliases(p_item public.collection_items)
returns text[]
language sql
stable
set search_path=''
as $$
  select p_item.organization_aliases;
$$;

create or replace function organization_private.item_matches_criteria(
  p_item public.collection_items,
  p_criteria jsonb
)
returns boolean
language sql
stable
set search_path=''
as $$
  select
    (not p_criteria ? 'set' or lower(coalesce(p_item.identity_snapshot->>'set',p_item.identity_snapshot->>'setName',''))=lower(p_criteria->>'set'))
    and (not p_criteria ? 'subset' or lower(coalesce(p_item.identity_snapshot->>'subset',p_item.identity_snapshot->>'set',''))=lower(p_criteria->>'subset'))
    and (not p_criteria ? 'artist' or lower(coalesce(p_item.identity_snapshot->>'artist',''))=lower(p_criteria->>'artist'))
    and (not p_criteria ? 'character' or lower(coalesce(p_item.identity_snapshot->>'character',p_item.identity_snapshot->>'name',''))=lower(p_criteria->>'character'))
    and (not p_criteria ? 'rarity' or lower(coalesce(p_item.identity_snapshot->>'rarity',''))=lower(p_criteria->>'rarity'))
    and (not p_criteria ? 'language' or lower(coalesce(p_item.identity_snapshot->>'language',''))=lower(p_criteria->>'language'))
    and (not p_criteria ? 'finish' or lower(coalesce(p_item.identity_snapshot->>'finish',p_item.identity_snapshot->>'variant',''))=lower(p_criteria->>'finish'))
    and (not p_criteria ? 'condition' or lower(case when p_item.card_state='graded' then coalesce(p_item.grader,'')||' '||coalesce(p_item.grade::text,'') else coalesce(p_item.raw_condition,'') end)=lower(p_criteria->>'condition'));
$$;

create or replace function organization_private.calculate_goal(p_goal public.collection_goals)
returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare
  owned integer:=0;
  target integer:=0;
  missing jsonb:='[]'::jsonb;
begin
  if p_goal.metadata_status<>'verified' then
    return jsonb_build_object(
      'status',p_goal.metadata_status,'current',null,'target',null,
      'percent',null,'complete',false,'missing','[]'::jsonb
    );
  end if;
  if p_goal.goal_type='checklist' then
    target:=jsonb_array_length(p_goal.targets);
    if target=0 then
      return jsonb_build_object(
        'status','incomplete','current',null,'target',null,
        'percent',null,'complete',false,'missing','[]'::jsonb
      );
    end if;
    with target_rows as (
      select value as target_value
      from jsonb_array_elements(p_goal.targets)
    ), unmatched as (
      select target.target_value
      from target_rows target
      where not exists(
        select 1 from public.collection_items item
        where item.user_id=p_goal.user_id
          and (p_goal.collection_id is null or item.collection_id=p_goal.collection_id)
          and item.status not in ('sold','deleted') and item.quantity>0
          and (
            p_goal.criteria='{}'::jsonb
            or organization_private.item_matches_criteria(item,p_goal.criteria)
          )
          and item.organization_aliases && array(
            select alias from (
              select target.target_value->>'key' alias
              union all
              select jsonb_array_elements_text(coalesce(target.target_value->'aliases','[]'::jsonb))
            ) aliases where nullif(alias,'') is not null
          )
      )
    )
    select count(*),coalesce(jsonb_agg(target_value order by target_value->>'label'),'[]'::jsonb)
      into owned,missing from unmatched;
    owned:=target-owned;
  else
    target:=p_goal.target_count;
    select coalesce(sum(item.quantity),0)::integer into owned
    from public.collection_items item
    where item.user_id=p_goal.user_id
      and (p_goal.collection_id is null or item.collection_id=p_goal.collection_id)
      and item.status not in ('sold','deleted') and item.quantity>0
      and organization_private.item_matches_criteria(item,p_goal.criteria);
  end if;
  return jsonb_build_object(
    'status','ready','current',owned,'target',target,
    'percent',least(100,round((owned::numeric/nullif(target,0))*100,1)),
    'complete',owned>=target,'missing',missing
  );
end;
$$;

create or replace function organization_private.refresh_goals(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  goal_row public.collection_goals%rowtype;
  progress jsonb;
  was_complete boolean;
  is_complete boolean;
begin
  if p_user_id is null then return; end if;
  for goal_row in
    select * from public.collection_goals
    where user_id=p_user_id and archived_at is null
    for update
  loop
    progress:=organization_private.calculate_goal(goal_row);
    was_complete:=coalesce((goal_row.last_progress->>'complete')::boolean,false);
    is_complete:=coalesce((progress->>'complete')::boolean,false);
    update public.collection_goals
      set last_progress=progress,updated_at=now()
      where id=goal_row.id and user_id=p_user_id;
    if goal_row.last_progress<>'{}'::jsonb and was_complete is distinct from is_complete then
      insert into public.collection_goal_events(user_id,goal_id,event_type,progress)
      values(p_user_id,goal_row.id,case when is_complete then 'completed' else 'reopened' end,progress);
    end if;
  end loop;
end;
$$;

create or replace function organization_private.refresh_goal_definition()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='INSERT' then
    insert into public.collection_goal_events(user_id,goal_id,event_type,progress)
    values(new.user_id,new.id,'created','{}'::jsonb);
  elsif old.archived_at is distinct from new.archived_at then
    insert into public.collection_goal_events(user_id,goal_id,event_type,progress)
    values(new.user_id,new.id,case when new.archived_at is null then 'restored' else 'archived' end,new.last_progress);
  end if;
  perform organization_private.refresh_goals(new.user_id);
  return new;
end;
$$;

drop trigger if exists collection_goal_definition_refresh on public.collection_goals;
create trigger collection_goal_definition_refresh
after insert or update of goal_type,dimension,criteria,targets,target_count,metadata_status,collection_id,archived_at
on public.collection_goals for each row execute function organization_private.refresh_goal_definition();

create or replace function organization_private.refresh_goals_from_new_rows()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid;
begin
  for owner_id in select distinct user_id from new_rows loop
    perform organization_private.refresh_goals(owner_id);
  end loop;
  return null;
end;
$$;
create or replace function organization_private.refresh_goals_from_old_rows()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid;
begin
  for owner_id in select distinct user_id from old_rows loop
    perform organization_private.refresh_goals(owner_id);
  end loop;
  return null;
end;
$$;
create or replace function organization_private.refresh_goals_from_updated_rows()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid;
begin
  for owner_id in
    select distinct changed.user_id
    from (
      select new_item.user_id
      from new_rows new_item
      join old_rows old_item on old_item.id=new_item.id
      where (
        new_item.quantity,new_item.status,new_item.collection_id,
        new_item.identity_snapshot,new_item.collectible_id,new_item.variant_id,
        new_item.raw_condition,new_item.grader,new_item.grade
      ) is distinct from (
        old_item.quantity,old_item.status,old_item.collection_id,
        old_item.identity_snapshot,old_item.collectible_id,old_item.variant_id,
        old_item.raw_condition,old_item.grader,old_item.grade
      )
    ) changed
  loop
    perform organization_private.refresh_goals(owner_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists collection_items_goal_insert on public.collection_items;
drop trigger if exists collection_items_goal_update on public.collection_items;
drop trigger if exists collection_items_goal_delete on public.collection_items;
create trigger collection_items_goal_insert after insert on public.collection_items
  referencing new table as new_rows for each statement
  execute function organization_private.refresh_goals_from_new_rows();
create trigger collection_items_goal_update after update
  on public.collection_items referencing old table as old_rows new table as new_rows for each statement
  execute function organization_private.refresh_goals_from_updated_rows();
create trigger collection_items_goal_delete after delete on public.collection_items
  referencing old table as old_rows for each statement
  execute function organization_private.refresh_goals_from_old_rows();

create or replace function organization_private.apply_import_organization()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  imported record;
  folder_id uuid;
  folder_name text;
  custom_values jsonb;
  field record;
  field_type text;
begin
  if new.status<>'committed' or old.status='committed' then return new; end if;
  for imported in
    select item.row_number,item.collection_item_id,staged.payload
    from public.import_job_items item
    join public.import_staged_rows staged
      on staged.import_job_id=item.import_job_id
      and staged.user_id=item.user_id
      and staged.row_number=item.row_number
    where item.import_job_id=new.id and item.user_id=new.user_id and item.action='created'
    order by item.row_number
  loop
    folder_name:=nullif(btrim(imported.payload->>'folder'),'');
    custom_values:=coalesce(imported.payload->'customFields','{}'::jsonb);
    if folder_name is not null and char_length(folder_name)>100 then raise exception 'import_folder_too_long'; end if;
    if not organization_private.valid_custom_fields(custom_values) then raise exception 'invalid_import_custom_fields'; end if;
    folder_id:=null;
    if folder_name is not null then
      select id into folder_id from public.collections
      where user_id=new.user_id and lower(name)=lower(folder_name)
      order by created_at,id limit 1;
      if folder_id is null then
        insert into public.collections(user_id,name)
        values(new.user_id,folder_name) returning id into folder_id;
      end if;
    end if;
    for field in select key,value from jsonb_each(custom_values) loop
      field_type:=case jsonb_typeof(field.value)
        when 'number' then 'number' when 'boolean' then 'boolean' else 'text' end;
      insert into public.collection_custom_field_definitions(user_id,key,name,value_type)
      values(new.user_id,field.key,initcap(replace(field.key,'_',' ')),field_type)
      on conflict(user_id,key) do nothing;
    end loop;
    update public.collection_items set
      collection_id=coalesce(folder_id,collection_id),
      custom_fields=custom_values,
      updated_at=now()
    where id=imported.collection_item_id and user_id=new.user_id;
    update public.import_job_items job_item set item_snapshot=(
      select jsonb_build_object(
        'identitySnapshot',item.identity_snapshot,'quantity',item.quantity,
        'cardState',item.card_state,'rawCondition',item.raw_condition,
        'grader',item.grader,'grade',item.grade,
        'certificationNumber',item.certification_number,'notes',item.notes,
        'location',item.storage_location,'status',item.status,
        'currency',item.currency,'tags',to_jsonb(item.tags),
        'collectionId',item.collection_id,'customFields',item.custom_fields
      ) from public.collection_items item
      where item.id=imported.collection_item_id and item.user_id=new.user_id
    ) where job_item.import_job_id=new.id
      and job_item.row_number=imported.row_number
      and job_item.user_id=new.user_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists collection_import_organization on public.import_jobs;
create trigger collection_import_organization
after update of status on public.import_jobs for each row
execute function organization_private.apply_import_organization();

create or replace function public.rollback_collection_import_v2(p_import_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  job_status text;
  imported record;
  current_snapshot jsonb;
  transaction_count integer;
  removed_count integer:=0;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select status into job_status from public.import_jobs
    where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status='rolled_back' then return jsonb_build_object('status','rolled_back','removedRows',0); end if;
  if job_status<>'committed' then raise exception 'import_not_committed'; end if;
  for imported in
    select * from public.import_job_items
    where import_job_id=p_import_job_id and user_id=owner_id and action='created'
    order by row_number for update
  loop
    if imported.collection_item_id is null then continue; end if;
    select jsonb_build_object(
      'identitySnapshot',item.identity_snapshot,'quantity',item.quantity,
      'cardState',item.card_state,'rawCondition',item.raw_condition,
      'grader',item.grader,'grade',item.grade,
      'certificationNumber',item.certification_number,'notes',item.notes,
      'location',item.storage_location,'status',item.status,
      'currency',item.currency,'tags',to_jsonb(item.tags),
      'collectionId',item.collection_id,'customFields',item.custom_fields
    ) into current_snapshot from public.collection_items item
    where item.id=imported.collection_item_id and item.user_id=owner_id;
    if current_snapshot is null then continue; end if;
    if current_snapshot is distinct from imported.item_snapshot then raise exception 'import_position_changed_after_commit'; end if;
    select count(*) into transaction_count from public.collection_transactions transaction
    where transaction.collection_item_id=imported.collection_item_id and transaction.user_id=owner_id;
    if transaction_count<>1 or not exists(
      select 1 from public.collection_transactions transaction
      where transaction.collection_item_id=imported.collection_item_id
        and transaction.user_id=owner_id and transaction.idempotency_key=imported.idempotency_key
    ) then raise exception 'import_position_has_dependent_transactions'; end if;
    if exists(select 1 from public.grading_submissions submission where submission.collection_item_id=imported.collection_item_id and submission.user_id=owner_id)
      or exists(select 1 from public.grading_scan_sessions session where session.collection_item_id=imported.collection_item_id and session.user_id=owner_id)
      or exists(select 1 from public.digital_grade_assessments assessment where assessment.collection_item_id=imported.collection_item_id and assessment.user_id=owner_id)
      or exists(select 1 from public.identity_corrections correction where correction.collection_item_id=imported.collection_item_id and correction.user_id=owner_id)
      or exists(select 1 from public.collection_item_attachments attachment where attachment.collection_item_id=imported.collection_item_id and attachment.user_id=owner_id)
    then raise exception 'import_position_has_dependent_activity'; end if;
  end loop;
  for imported in
    select * from public.import_job_items
    where import_job_id=p_import_job_id and user_id=owner_id and action='created'
    order by row_number desc
  loop
    if imported.collection_item_id is null then continue; end if;
    delete from public.collection_items item
      where item.id=imported.collection_item_id and item.user_id=owner_id;
    if found then removed_count:=removed_count+1; end if;
  end loop;
  delete from public.valuation_snapshots snapshot where snapshot.user_id=owner_id;
  update public.import_jobs set
    status='rolled_back',rolled_back_at=now(),updated_at=now(),
    totals=totals||jsonb_build_object('status','rolled_back','removedRows',removed_count)
  where id=p_import_job_id and user_id=owner_id;
  return jsonb_build_object('status','rolled_back','removedRows',removed_count);
end;
$$;

create or replace function public.get_collection_organization_summary()
returns jsonb
language sql
security invoker
stable
set search_path=''
as $$
  select jsonb_build_object(
    'version','mica-organization-v1',
    'positionCount',count(*),
    'quantity',coalesce(sum(item.quantity),0),
    'missingLocationCount',count(*) filter(where nullif(btrim(item.storage_location),'') is null),
    'folderCount',(select count(*) from public.collections folder where folder.user_id=(select auth.uid()) and folder.archived_at is null),
    'labelCount',(select count(distinct lower(tag.value)) from public.collection_items labeled cross join lateral unnest(labeled.tags) as tag(value) where labeled.user_id=(select auth.uid())),
    'customFieldCount',(select count(*) from public.collection_custom_field_definitions field where field.user_id=(select auth.uid())),
    'attachmentCount',(select count(*) from public.collection_item_attachments attachment where attachment.user_id=(select auth.uid()))
  )
  from public.collection_items item
  where item.user_id=(select auth.uid()) and item.status not in ('sold','deleted');
$$;

create or replace function public.get_collection_goal_progress(p_goal_id uuid default null)
returns table(goal_id uuid,progress jsonb)
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid:=(select auth.uid());
begin
  if owner_id is null then raise exception 'Sign in is required.'; end if;
  perform organization_private.refresh_goals(owner_id);
  return query select goal.id,goal.last_progress
    from public.collection_goals goal
    where goal.user_id=owner_id and (p_goal_id is null or goal.id=p_goal_id)
    order by goal.updated_at desc,goal.id;
end;
$$;

create or replace function public.search_collection_positions(
  p_query text default '',
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'name',
  p_limit integer default 100,
  p_after_value text default null,
  p_after_id uuid default null
)
returns table(position_row jsonb,total_count bigint,sort_value text)
language plpgsql
security invoker
stable
set search_path=''
as $$
begin
  if jsonb_typeof(coalesce(p_filters,'{}'::jsonb))<>'object' then raise exception 'Filters must be an object.'; end if;
  if p_filters ? 'labels' and jsonb_typeof(p_filters->'labels')<>'array' then raise exception 'Labels must be an array.'; end if;
  if p_filters ? 'graded' and jsonb_typeof(p_filters->'graded')<>'boolean' then raise exception 'Graded must be a boolean.'; end if;
  if p_sort not in ('name','updated-desc','created-desc','location') then raise exception 'Unsupported sort.'; end if;
  if p_limit not between 1 and 200 then raise exception 'Choose between 1 and 200 results.'; end if;
  if char_length(coalesce(p_query,''))>200 then raise exception 'Search is too long.'; end if;
  if (p_after_value is null) is distinct from (p_after_id is null) then raise exception 'Both cursor values are required.'; end if;
  return query
  with base as (
    select
      to_jsonb(item)-'organization_search' as row_json,
      item.id,
      case p_sort
        when 'updated-desc' then item.updated_at::text
        when 'created-desc' then item.created_at::text
        when 'location' then lower(coalesce(item.storage_location,''))
        else lower(coalesce(item.identity_snapshot->>'name',''))
      end as row_sort
    from public.collection_items item
    where item.user_id=(select auth.uid())
      and (nullif(btrim(p_query),'') is null or item.organization_search @@ websearch_to_tsquery('simple'::regconfig,p_query))
      and (not p_filters ? 'collectionId' or item.collection_id=(p_filters->>'collectionId')::uuid)
      and (not p_filters ? 'status' or item.status=p_filters->>'status')
      and (not p_filters ? 'cardState' or item.card_state=p_filters->>'cardState')
      and (not p_filters ? 'graded' or (
        (coalesce((p_filters->>'graded')::boolean,false) and (item.card_state='graded' or item.grader is not null))
        or (not coalesce((p_filters->>'graded')::boolean,false) and item.card_state<>'graded' and item.grader is null)
      ))
      and (not p_filters ? 'rawCondition' or item.raw_condition=p_filters->>'rawCondition')
      and (not p_filters ? 'grader' or lower(coalesce(item.grader,''))=lower(p_filters->>'grader'))
      and (not p_filters ? 'grade' or item.grade::text=p_filters->>'grade')
      and (not p_filters ? 'set' or lower(coalesce(item.identity_snapshot->>'set',item.identity_snapshot->>'setName',''))=lower(p_filters->>'set'))
      and (not p_filters ? 'language' or lower(coalesce(item.identity_snapshot->>'language',''))=lower(p_filters->>'language'))
      and (not p_filters ? 'rarity' or lower(coalesce(item.identity_snapshot->>'rarity',''))=lower(p_filters->>'rarity'))
      and (not p_filters ? 'artist' or lower(coalesce(item.identity_snapshot->>'artist',''))=lower(p_filters->>'artist'))
      and (not p_filters ? 'location' or lower(coalesce(item.storage_location,'')) like '%'||lower(p_filters->>'location')||'%')
      and (not p_filters ? 'labels' or item.tags @> array(select jsonb_array_elements_text(p_filters->'labels')))
  ), tallied as (
    select base.*,count(*) over() as matched_count from base
  ), paged as (
    select * from tallied
    where p_after_id is null
      or (p_sort in ('name','location') and (row_sort,id)>(p_after_value,p_after_id))
      or (p_sort in ('updated-desc','created-desc') and (row_sort,id)<(p_after_value,p_after_id))
    order by
      case when p_sort in ('name','location') then row_sort end asc,
      case when p_sort in ('updated-desc','created-desc') then row_sort end desc,
      case when p_sort in ('name','location') then id end asc,
      case when p_sort in ('updated-desc','created-desc') then id end desc
    limit p_limit
  )
  select row_json,matched_count,row_sort from paged;
end;
$$;

create or replace function public.bulk_organize_collection_items_v2(
  p_ids uuid[],
  p_label text default null,
  p_label_mode text default 'keep',
  p_location text default null,
  p_location_mode text default 'keep',
  p_status text default 'keep',
  p_collection_id uuid default null,
  p_collection_mode text default 'keep',
  p_custom_field_key text default null,
  p_custom_field_value jsonb default null,
  p_custom_field_mode text default 'keep'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  operation_id uuid:=gen_random_uuid();
  before_rows jsonb;
  after_rows jsonb;
  requested jsonb;
  custom_field_type text;
begin
  if owner_id is null then raise exception 'Sign in is required.'; end if;
  if coalesce(array_length(p_ids,1),0) not between 1 and 500 then raise exception 'Choose between 1 and 500 positions.'; end if;
  if (select count(distinct id) from public.collection_items where user_id=owner_id and id=any(p_ids))<>array_length(p_ids,1) then
    raise exception 'Some selected positions are unavailable.';
  end if;
  if p_label_mode not in ('keep','add','remove') or p_location_mode not in ('keep','set','clear')
    or p_status not in ('keep','owned','archived') or p_collection_mode not in ('keep','set')
    or p_custom_field_mode not in ('keep','set','clear') then raise exception 'Unsupported organization action.'; end if;
  if p_label_mode<>'keep' and (nullif(btrim(p_label),'') is null or char_length(btrim(p_label))>40) then raise exception 'Labels must contain 1 to 40 characters.'; end if;
  if p_location_mode='set' and (nullif(btrim(p_location),'') is null or char_length(btrim(p_location))>250) then raise exception 'Storage locations must contain 1 to 250 characters.'; end if;
  if p_collection_mode='set' and not exists(select 1 from public.collections where id=p_collection_id and user_id=owner_id and archived_at is null) then raise exception 'Folder is unavailable.'; end if;
  if p_custom_field_mode<>'keep' and (p_custom_field_key is null or p_custom_field_key !~ '^[a-z0-9][a-z0-9_-]{0,39}$') then raise exception 'Custom field is unavailable.'; end if;
  if p_custom_field_mode<>'keep' then
    select definition.value_type into custom_field_type
    from public.collection_custom_field_definitions definition
    where definition.user_id=owner_id and definition.key=p_custom_field_key;
    if custom_field_type is null then raise exception 'Custom field is unavailable.'; end if;
  end if;
  if p_custom_field_mode='set' and (p_custom_field_value is null or jsonb_typeof(p_custom_field_value) not in ('string','number','boolean')) then raise exception 'Custom field value is invalid.'; end if;
  if p_custom_field_mode='set' and (
    (custom_field_type='text' and jsonb_typeof(p_custom_field_value)<>'string')
    or (custom_field_type='number' and jsonb_typeof(p_custom_field_value)<>'number')
    or (custom_field_type='boolean' and jsonb_typeof(p_custom_field_value)<>'boolean')
    or (custom_field_type='date' and (jsonb_typeof(p_custom_field_value)<>'string' or (p_custom_field_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$'))
  ) then raise exception 'Custom field value does not match its definition.'; end if;
  if p_label_mode='keep' and p_location_mode='keep' and p_status='keep' and p_collection_mode='keep' and p_custom_field_mode='keep' then raise exception 'Choose at least one change.'; end if;

  perform 1 from public.collection_items item
    where item.user_id=owner_id and item.id=any(p_ids)
    order by item.id for update;
  select jsonb_agg(jsonb_build_object(
    'id',item.id,'before',jsonb_build_object(
      'collectionId',item.collection_id,'labels',to_jsonb(item.tags),
      'location',item.storage_location,'status',item.status,'customFields',item.custom_fields
    )
  ) order by item.id) into before_rows
  from public.collection_items item where item.user_id=owner_id and item.id=any(p_ids);

  update public.collection_items item set
    collection_id=case when p_collection_mode='set' then p_collection_id else item.collection_id end,
    tags=case p_label_mode
      when 'add' then case when exists(select 1 from unnest(item.tags) tag where lower(tag)=lower(btrim(p_label))) then item.tags else item.tags||btrim(p_label) end
      when 'remove' then array(select tag from unnest(item.tags) tag where lower(tag)<>lower(btrim(p_label)))
      else item.tags end,
    storage_location=case p_location_mode when 'set' then btrim(p_location) when 'clear' then null else item.storage_location end,
    status=case when p_status='keep' then item.status else p_status end,
    asking_price=case when p_status='keep' then item.asking_price else null end,
    listing_venue=case when p_status='keep' then item.listing_venue else null end,
    listed_at=case when p_status='keep' then item.listed_at else null end,
    price_reviewed_at=case when p_status='keep' then item.price_reviewed_at else null end,
    custom_fields=case p_custom_field_mode
      when 'set' then jsonb_set(item.custom_fields,array[p_custom_field_key],p_custom_field_value,true)
      when 'clear' then item.custom_fields-p_custom_field_key
      else item.custom_fields end,
    updated_at=now()
  where item.user_id=owner_id and item.id=any(p_ids);

  select jsonb_agg(entry||jsonb_build_object('after',jsonb_build_object(
    'collectionId',item.collection_id,'labels',to_jsonb(item.tags),
    'location',item.storage_location,'status',item.status,'customFields',item.custom_fields
  )) order by item.id) into after_rows
  from jsonb_array_elements(before_rows) entry
  join public.collection_items item on item.id=(entry->>'id')::uuid and item.user_id=owner_id;
  requested:=jsonb_build_object(
    'label',p_label,'labelMode',p_label_mode,'location',p_location,
    'locationMode',p_location_mode,'status',p_status,'collectionId',p_collection_id,
    'collectionMode',p_collection_mode,'customFieldKey',p_custom_field_key,
    'customFieldMode',p_custom_field_mode
  );
  insert into public.collection_organization_operations(id,user_id,operation_type,item_count,requested_changes,item_snapshots)
  values(operation_id,owner_id,'bulk_edit',array_length(p_ids,1),requested,after_rows);
  return operation_id;
end;
$$;

create or replace function public.undo_collection_organization_operation(p_operation_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  operation public.collection_organization_operations%rowtype;
  snapshot jsonb;
  item public.collection_items%rowtype;
  current_state jsonb;
  restored integer:=0;
  undo_id uuid:=gen_random_uuid();
begin
  if owner_id is null then raise exception 'Sign in is required.'; end if;
  select * into operation from public.collection_organization_operations
    where id=p_operation_id and user_id=owner_id for update;
  if operation.id is null or operation.operation_type<>'bulk_edit' then raise exception 'Organization change is unavailable.'; end if;
  if operation.undone_at is not null then raise exception 'This change was already undone.'; end if;
  for snapshot in select value from jsonb_array_elements(operation.item_snapshots) loop
    select * into item from public.collection_items
      where id=(snapshot->>'id')::uuid and user_id=owner_id for update;
    if item.id is null then raise exception 'A changed item no longer exists.'; end if;
    current_state:=jsonb_build_object(
      'collectionId',item.collection_id,'labels',to_jsonb(item.tags),
      'location',item.storage_location,'status',item.status,'customFields',item.custom_fields
    );
    if current_state<>snapshot->'after' then raise exception 'A changed item was edited again; undo would overwrite newer work.'; end if;
  end loop;
  for snapshot in select value from jsonb_array_elements(operation.item_snapshots) loop
    update public.collection_items set
      collection_id=(snapshot #>> '{before,collectionId}')::uuid,
      tags=array(select jsonb_array_elements_text(snapshot #> '{before,labels}')),
      storage_location=nullif(snapshot #>> '{before,location}',''),
      status=snapshot #>> '{before,status}',
      custom_fields=snapshot #> '{before,customFields}',
      updated_at=now()
    where id=(snapshot->>'id')::uuid and user_id=owner_id;
    restored:=restored+1;
  end loop;
  update public.collection_organization_operations set undone_at=now()
    where id=operation.id and user_id=owner_id;
  insert into public.collection_organization_operations(
    id,user_id,operation_type,item_count,requested_changes,item_snapshots,reverses_operation_id
  ) values(
    undo_id,owner_id,'undo',restored,
    jsonb_build_object('reversesOperationId',operation.id),operation.item_snapshots,operation.id
  );
  return restored;
end;
$$;

alter table public.collection_custom_field_definitions enable row level security;
alter table public.collection_item_attachments enable row level security;
alter table public.collection_goals enable row level security;
alter table public.collection_goal_events enable row level security;
alter table public.collection_organization_operations enable row level security;

drop policy if exists "custom field definitions own rows" on public.collection_custom_field_definitions;
drop policy if exists "collection attachments own rows" on public.collection_item_attachments;
drop policy if exists "collection goals own rows" on public.collection_goals;
drop policy if exists "collection goal events own rows" on public.collection_goal_events;
drop policy if exists "collection operations own rows" on public.collection_organization_operations;
create policy "custom field definitions own rows" on public.collection_custom_field_definitions for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "collection attachments own rows" on public.collection_item_attachments for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "collection goals own rows" on public.collection_goals for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "collection goal events own rows" on public.collection_goal_events for select to authenticated
  using((select auth.uid())=user_id);
create policy "collection operations own rows" on public.collection_organization_operations for select to authenticated
  using((select auth.uid())=user_id);

revoke all on public.collection_custom_field_definitions,public.collection_item_attachments,public.collection_goals,public.collection_goal_events,public.collection_organization_operations from anon,authenticated;
grant select,insert,update,delete on public.collection_custom_field_definitions,public.collection_goals to authenticated;
grant select,insert,delete on public.collection_item_attachments to authenticated;
grant select on public.collection_goal_events,public.collection_organization_operations to authenticated;
-- Preserve existing public-sequence grants from the hosted baseline. The
-- reviewed migration's blanket REVOKE would break unrelated existing writes.
revoke all on sequence public.collection_goal_events_id_seq from anon,authenticated;
grant usage,select on sequence public.collection_goal_events_id_seq to authenticated;

revoke all on function public.get_collection_organization_summary() from public,anon;
revoke all on function public.get_collection_goal_progress(uuid) from public,anon;
revoke all on function public.search_collection_positions(text,jsonb,text,integer,text,uuid) from public,anon;
revoke all on function public.bulk_organize_collection_items_v2(uuid[],text,text,text,text,text,uuid,text,text,jsonb,text) from public,anon;
revoke all on function public.undo_collection_organization_operation(uuid) from public,anon;
revoke all on function public.rollback_collection_import(uuid) from public,anon,authenticated;
revoke all on function public.rollback_collection_import_v2(uuid) from public,anon;
grant execute on function public.get_collection_organization_summary() to authenticated,service_role;
grant execute on function public.get_collection_goal_progress(uuid) to authenticated,service_role;
grant execute on function public.search_collection_positions(text,jsonb,text,integer,text,uuid) to authenticated,service_role;
grant execute on function public.bulk_organize_collection_items_v2(uuid[],text,text,text,text,text,uuid,text,text,jsonb,text) to authenticated,service_role;
grant execute on function public.undo_collection_organization_operation(uuid) to authenticated,service_role;
grant execute on function public.rollback_collection_import_v2(uuid) to authenticated,service_role;

revoke all on function organization_private.valid_custom_fields(jsonb) from public,anon,authenticated;
revoke all on function organization_private.searchable_labels(text[]) from public,anon,authenticated;
revoke all on function organization_private.indexed_item_aliases(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function organization_private.item_aliases(public.collection_items) from public,anon,authenticated;
revoke all on function organization_private.item_matches_criteria(public.collection_items,jsonb) from public,anon,authenticated;
revoke all on function organization_private.calculate_goal(public.collection_goals) from public,anon,authenticated;
revoke all on function organization_private.refresh_goals(uuid) from public,anon,authenticated;
revoke all on function organization_private.refresh_goal_definition() from public,anon,authenticated;
revoke all on function organization_private.refresh_goals_from_new_rows() from public,anon,authenticated;
revoke all on function organization_private.refresh_goals_from_old_rows() from public,anon,authenticated;
revoke all on function organization_private.refresh_goals_from_updated_rows() from public,anon,authenticated;
revoke all on function organization_private.apply_import_organization() from public,anon,authenticated;
revoke all on function organization_private.validate_item_custom_fields() from public,anon,authenticated;
revoke all on function organization_private.protect_used_custom_field_definition() from public,anon,authenticated;

-- These two immutable scalar helpers are evaluated by collection_items
-- constraints/generated columns during an authenticated write. The schema is
-- not exposed through the Data API and no table or user data is readable.
grant usage on schema organization_private to authenticated,service_role;
grant execute on function organization_private.valid_custom_fields(jsonb) to authenticated,service_role;
grant execute on function organization_private.searchable_labels(text[]) to authenticated,service_role;
grant execute on function organization_private.indexed_item_aliases(uuid,uuid,jsonb) to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'collection-item-files','collection-item-files',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "collection file owners can insert" on storage.objects;
drop policy if exists "collection file owners can read" on storage.objects;
drop policy if exists "collection file owners can delete" on storage.objects;
create policy "collection file owners can insert" on storage.objects for insert to authenticated
  with check(bucket_id='collection-item-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "collection file owners can read" on storage.objects for select to authenticated
  using(bucket_id='collection-item-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "collection file owners can delete" on storage.objects for delete to authenticated
  using(bucket_id='collection-item-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Source: supabase/migrations/20260918160000_graded_physical_copies.sql
-- SHA256: 304d980863f55a59b153c24010dd9dbd38e64a0f800fea0dfdeaa5d4f1d606c3

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

-- Source: supabase/migrations/20260920200000_complete_graded_physical_copy_sale.sql
-- SHA256: c2e88ec2d1012eb04f0d79d4b36d3ecd4d1a9b5b1769af9d70d7ab6e3e77298e

-- The existing sale ledger sets a fully disposed position to quantity zero,
-- but the launch constraint still required one. Permit the modeled sold state
-- without rewriting any position or changing the upper inventory bound.
alter table public.collection_items
  drop constraint if exists collection_items_quantity_check;
alter table public.collection_items
  add constraint collection_items_quantity_check
  check (quantity between 0 and 99999) not valid;
alter table public.collection_items
  validate constraint collection_items_quantity_check;

-- Source: docs/evidence/sol-client-06c/20260926030038_persist_verified_graded_valuation.sql
-- SHA256: 12c7bb3dceaf86a3bd0ebc23718667a2ff692393823d8877a4c036b044cba814

-- CLIENT-06C LOCAL VALIDATION. Review artifact; not approved for shared/hosted use.
-- Existing tables/columns suffice. This one service-only RPC closes the
-- demonstrated read/insert race and rechecks the authenticated Auth session.
-- Server code must still authenticate getUser(jwt), compute with the actual
-- adapter/estimator, and send only its allowlisted observation.


create or replace function public.persist_verified_graded_valuation(
  p_owner_id uuid,
  p_session_id uuid,
  p_position_id uuid,
  p_expected jsonb,
  p_observation jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  target public.collection_items%rowtype;
  observation public.position_price_observations%rowtype;
  current_contract jsonb;
  current_context jsonb;
  stored public.position_price_observations%rowtype;
begin
  perform 1 from auth.sessions
  where id=p_session_id and user_id=p_owner_id
    and (not_after is null or not_after>now())
  for share;
  if not found then raise exception 'valuation_session_expired'; end if;

  select * into target from public.collection_items
  where id=p_position_id and user_id=p_owner_id for update;
  if not found or target.card_state<>'graded'
    or target.status not in ('owned','listed') or target.quantity<=0 then
    raise exception 'valuation_context_changed';
  end if;
  current_contract:=jsonb_build_object(
    'user_id',target.user_id,'id',target.id,'status',target.status,
    'card_state',target.card_state,'identity_snapshot',target.identity_snapshot,
    'grader',target.grader,'grade',target.grade,'currency',target.currency,
    'collectible_id',target.collectible_id
  );
  if current_contract is distinct from p_expected then
    raise exception 'valuation_context_changed';
  end if;
  -- Capability/session/context preflight: no credits or price rows are written.
  if p_observation is null then return null; end if;

  current_context:=jsonb_build_object(
    'canonicalId',coalesce(target.identity_snapshot->>'providerCardId',''),
    'identityStatus',coalesce(target.identity_snapshot->>'identityStatus','needs_review'),
    'name',coalesce(target.identity_snapshot->>'name',''),
    'set',coalesce(target.identity_snapshot->>'set',target.identity_snapshot->>'setName',''),
    'number',coalesce(target.identity_snapshot->>'number',target.identity_snapshot->>'collectorNumber',''),
    'language',coalesce(target.identity_snapshot->>'language',''),
    'variant',coalesce(target.identity_snapshot->>'variant',''),
    'finish',coalesce(target.identity_snapshot->>'finish',''),
    'edition',coalesce(target.identity_snapshot->>'edition',''),
    'promoType',coalesce(target.identity_snapshot->>'promoType',''),
    'grader',target.grader,'grade',target.grade,
    'qualifier',coalesce(target.identity_snapshot->>'gradeQualifier',''),
    'currency',target.currency
  );
  observation:=jsonb_populate_record(null::public.position_price_observations,p_observation);
  if observation.id is null or observation.user_id is distinct from p_owner_id
    or observation.collection_item_id is distinct from target.id
    or observation.collectible_id is distinct from target.collectible_id
    or observation.currency is distinct from target.currency
    or observation.grader is distinct from target.grader
    or observation.grade is distinct from target.grade
    or observation.finish is distinct from current_context->>'finish'
    or observation.language is distinct from current_context->>'language'
    or observation.printing is distinct from current_context->>'variant'
    or observation.provider_variant_id is distinct from target.identity_snapshot#>>'{externalIds,pkmnprices}'
    or observation.source_metadata->>'providerCardId' is distinct from observation.provider_variant_id
    or observation.card_state is distinct from 'graded'
    or observation.provider is distinct from 'pkmnprices'
    or observation.capability_status is distinct from 'live'
    or observation.exclusion_status is distinct from 'included'
    or observation.valuation_type is distinct from 'provider_estimate'
    or observation.evidence_kind is distinct from 'completed_sale'
    or observation.derivation is distinct from 'aggregated'
    or observation.evidence_rule_version is distinct from 'mica-exact-sold-v1'
    or observation.quality->>'producer' is distinct from 'mica-server-exact-sold-v1'
    or observation.source_metadata->>'producer' is distinct from 'mica-server-exact-sold-v1'
    or observation.quality->'context' is distinct from current_context
    or jsonb_typeof(observation.source_metadata->'sales') is distinct from 'array'
    or jsonb_typeof(observation.source_metadata->'contributingEvidenceIds') is distinct from 'array'
    or observation.observed_at is null or observation.observed_at>now()
    or observation.retrieved_at is null or observation.retrieved_at>now()
    or observation.retrieved_at>observation.observed_at
    or observation.retrieved_at<observation.provider_updated_at
    or observation.provider_updated_at is null
    or observation.provider_updated_at>observation.observed_at
    or observation.observed_at-observation.provider_updated_at>interval '30 days'
    or coalesce(observation.sales_count,0)<3 then
    raise exception 'invalid_verified_valuation';
  end if;

  insert into public.position_price_observations(
    id,user_id,collection_item_id,collectible_id,aggregator,provider,
    provider_variant_id,currency,valuation_type,finish,card_state,raw_condition,
    grader,grade,grade_label,amount,price_low,price_high,sales_count,granularity,
    quality,observed_at,retrieved_at,provider_updated_at,market,region,language,
    printing,evidence_kind,derivation,capability_status,exclusion_status,
    evidence_rule_version,source_metadata
  ) values (
    observation.id,observation.user_id,observation.collection_item_id,
    observation.collectible_id,observation.aggregator,observation.provider,
    observation.provider_variant_id,observation.currency,observation.valuation_type,
    observation.finish,observation.card_state,observation.raw_condition,
    observation.grader,observation.grade,observation.grade_label,observation.amount,
    observation.price_low,observation.price_high,observation.sales_count,
    observation.granularity,observation.quality,observation.observed_at,
    observation.retrieved_at,observation.provider_updated_at,observation.market,
    observation.region,observation.language,observation.printing,
    observation.evidence_kind,observation.derivation,observation.capability_status,
    observation.exclusion_status,observation.evidence_rule_version,
    observation.source_metadata
  ) on conflict(id) do nothing;
  select * into stored from public.position_price_observations where id=observation.id;
  if not found or stored.provider_updated_at is distinct from observation.provider_updated_at or not ((to_jsonb(stored)-'source_metadata') @> (p_observation - array['observed_at','retrieved_at','provider_updated_at','source_metadata'])) or (stored.source_metadata-'sales') is distinct from (observation.source_metadata-'sales')
    or (select jsonb_agg(value-'retrievedAt' order by (value-'retrievedAt')::text) from jsonb_array_elements(stored.source_metadata->'sales'))
      is distinct from (select jsonb_agg(value-'retrievedAt' order by (value-'retrievedAt')::text) from jsonb_array_elements(observation.source_metadata->'sales')) then
    raise exception 'valuation_observation_conflict';
  end if;
  return to_jsonb(stored);
end $$;

revoke all on function public.persist_verified_graded_valuation(uuid,uuid,uuid,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.persist_verified_graded_valuation(uuid,uuid,uuid,jsonb,jsonb)
  to service_role;

commit;
