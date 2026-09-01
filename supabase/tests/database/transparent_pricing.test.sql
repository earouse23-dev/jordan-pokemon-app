-- Step 4 integration gate for normalized pricing evidence and owner isolation.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

select has_column('public','price_observations','aggregator','shared prices record the aggregator');
select has_column('public','price_observations','retrieved_at','shared prices separate retrieval time');
select has_column('public','price_observations','evidence_kind','shared prices classify the evidence');
select has_column('public','price_observations','capability_status','shared prices preserve capability state');
select has_column('public','price_observations','exclusion_status','shared prices preserve exclusion decisions');
select has_column('public','position_price_observations','market','position prices record the underlying market');
select has_column('public','position_price_observations','provider_updated_at','position prices preserve provider time');
select has_column('public','position_price_observations','confidence_reason','position prices explain confidence');
select has_column('public','position_price_observations','outlier_review','position prices retain outlier review');
select has_column('public','provider_sync_status','entitlement_snapshot','provider runtime entitlements are durable');
select has_column('public','provider_sync_status','daily_credit_reserved','provider daily credits are reserved durably');
select has_column('public','provider_sync_status','daily_credit_day','provider credit reservations reset by UTC day');
select has_function('public','reserve_provider_daily_credits',array['text','integer','integer'],'provider credit reservation is atomic');

select col_not_null('public','price_observations','evidence_rule_version','shared evidence always has a rule version');
select col_not_null('public','position_price_observations','capability_status','position evidence always has a capability state');
select has_index('public','price_observations','price_observations_comparable_current_idx','shared comparable lookup is indexed');
select has_index('public','position_price_observations','position_prices_comparable_current_idx','owner comparable lookup is indexed');
select ok(
  not has_table_privilege('authenticated','public.price_observations','INSERT'),
  'authenticated clients cannot forge shared price observations'
);
select ok(
  has_table_privilege('authenticated','public.position_price_observations','SELECT')
  and not has_table_privilege('authenticated','public.position_price_observations','INSERT'),
  'position history is client-readable but service-written'
);
select ok(
  not has_table_privilege('anon','public.position_price_observations','SELECT'),
  'anonymous clients cannot read private position history'
);
select is(
  (
    select count(*)
    from pg_constraint
    where conname in (
      'price_observations_evidence_kind_check',
      'price_observations_capability_status_check',
      'price_observations_exclusion_status_check',
      'position_prices_evidence_kind_check',
      'position_prices_capability_status_check',
      'position_prices_exclusion_status_check'
    )
  ),
  6::bigint,
  'pricing evidence enums are database constrained'
);
select ok(
  has_function_privilege('service_role','public.reserve_provider_daily_credits(text,integer,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.reserve_provider_daily_credits(text,integer,integer)','EXECUTE'),
  'only the service role can reserve provider credits'
);
select is(
  public.reserve_provider_daily_credits('mica-step4-provider',10,7),
  7,
  'the first reservation receives its requested allowance'
);
select is(
  public.reserve_provider_daily_credits('mica-step4-provider',10,7),
  3,
  'a second reservation cannot exceed the daily allowance'
);
select is(
  (select daily_credit_reserved from public.provider_sync_status where provider='mica-step4-provider'),
  10,
  'concurrent-safe reservations persist the bounded daily total'
);

insert into auth.users(id,email) values
  ('31111111-1111-4111-8111-111111111111','mica-step4-user-1@example.invalid'),
  ('32222222-2222-4222-8222-222222222222','mica-step4-user-2@example.invalid');

insert into public.card_sets(id,name,series,language) values(
  '3a000000-0000-4000-8000-000000000001',
  'Mica Step 4 Test Set',
  'Mica Test',
  'en'
);
insert into public.cards(id,set_id,name,collector_number,language) values
  ('3a000000-0000-4000-8000-000000000011','3a000000-0000-4000-8000-000000000001','Mica Price Card A','001','en'),
  ('3a000000-0000-4000-8000-000000000012','3a000000-0000-4000-8000-000000000001','Mica Price Card B','002','en');
insert into public.card_variants(id,card_id,finish,edition,language) values
  ('3b000000-0000-4000-8000-000000000011','3a000000-0000-4000-8000-000000000011','holo','unlimited','en'),
  ('3b000000-0000-4000-8000-000000000012','3a000000-0000-4000-8000-000000000012','holo','unlimited','en');
insert into public.collections(id,user_id,name) values
  ('3c000000-0000-4000-8000-000000000001','31111111-1111-4111-8111-111111111111','Step 4 User 1'),
  ('3c000000-0000-4000-8000-000000000002','32222222-2222-4222-8222-222222222222','Step 4 User 2');
insert into public.collection_items(
  id,collection_id,user_id,card_id,variant_id,identity_snapshot,card_state,
  raw_condition,status,currency,quantity
) values
  (
    '3d000000-0000-4000-8000-000000000001','3c000000-0000-4000-8000-000000000001',
    '31111111-1111-4111-8111-111111111111','3a000000-0000-4000-8000-000000000011',
    '3b000000-0000-4000-8000-000000000011',
    '{"name":"Mica Price Card A","variant":"Holofoil","language":"en","externalIds":{"pkmnprices":"41"}}'::jsonb,
    'raw','near_mint','owned','USD',1
  ),
  (
    '3d000000-0000-4000-8000-000000000002','3c000000-0000-4000-8000-000000000002',
    '32222222-2222-4222-8222-222222222222','3a000000-0000-4000-8000-000000000012',
    '3b000000-0000-4000-8000-000000000012',
    '{"name":"Mica Price Card B","variant":"Holofoil","language":"en","externalIds":{"pkmnprices":"42"}}'::jsonb,
    'raw','near_mint','owned','USD',1
  );

insert into public.price_observations(
  card_id,card_variant_id,provider,aggregator,market,currency,valuation_type,
  card_state,raw_condition,market_price,observed_at,provider_updated_at,
  retrieved_at,region,language,finish,capability_status,exclusion_status,
  evidence_rule_version
) values(
  '3a000000-0000-4000-8000-000000000011','3b000000-0000-4000-8000-000000000011',
  'pkmnprices','pkmnprices','tcgplayer','USD','market','raw','near_mint',100,
  now()-interval '1 hour',now()-interval '1 hour',now(),'US','English','holofoil',
  'live','included','mica-price-evidence-v1'
);

insert into public.position_price_observations(
  user_id,collection_item_id,aggregator,provider,market,provider_variant_id,
  currency,valuation_type,finish,card_state,raw_condition,grader,grade_label,
  amount,granularity,observed_at,provider_updated_at,retrieved_at,region,
  language,capability_status,exclusion_status,evidence_rule_version
) values
  (
    '31111111-1111-4111-8111-111111111111','3d000000-0000-4000-8000-000000000001',
    'pkmnprices','tcgplayer','tcgplayer','41:nm:holo','USD','market','holofoil',
    'raw','near_mint','','',100,'observation',now()-interval '1 hour',
    now()-interval '1 hour',now(),'US','English','live','included','mica-price-evidence-v1'
  ),
  (
    '32222222-2222-4222-8222-222222222222','3d000000-0000-4000-8000-000000000002',
    'pkmnprices','tcgplayer','tcgplayer','42:nm:holo','USD','market','holofoil',
    'raw','near_mint','','',120,'observation',now()-interval '1 hour',
    now()-interval '1 hour',now(),'US','English','live','included','mica-price-evidence-v1'
  );

insert into public.price_anomalies(
  price_observation_id,card_id,anomaly_type,status,rule_version
) select id,card_id,'robust_outlier','open','mica-price-evidence-v1'
  from public.price_observations
  where card_id='3a000000-0000-4000-8000-000000000011';

select is(
  (select collectible_id from public.price_observations where card_id='3a000000-0000-4000-8000-000000000011'),
  '3b000000-0000-4000-8000-000000000011'::uuid,
  'shared observations retain canonical variant identity'
);
select is(
  (select collectible_id from public.position_price_observations where collection_item_id='3d000000-0000-4000-8000-000000000001'),
  '3b000000-0000-4000-8000-000000000011'::uuid,
  'position observations derive canonical identity'
);
select is(
  (select count(*) from public.price_observations where exclusion_status='included' and capability_status='live'),
  1::bigint,
  'a live included observation remains valuation eligible'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','31111111-1111-4111-8111-111111111111',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',
  true
);

select is(
  (select count(*) from public.position_price_observations),
  1::bigint,
  'RLS exposes only the signed-in owner position evidence'
);
select is(
  (select count(*) from public.price_observations),
  1::bigint,
  'authenticated users can read shared market evidence'
);
select is(
  (select count(*) from public.price_anomalies),
  0::bigint,
  'non-admin users cannot read anomaly review records'
);
select is(
  (select count(*) from public.provider_sync_status),
  0::bigint,
  'non-admin users cannot read provider entitlement operations'
);

select * from finish();
rollback;
