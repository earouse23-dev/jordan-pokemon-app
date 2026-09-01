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
