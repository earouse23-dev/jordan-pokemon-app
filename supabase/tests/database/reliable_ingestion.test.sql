-- Step 5 integration gate for staging, atomic commit, RLS, and rollback.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

select has_table('public','import_mapping_profiles','saved import mappings exist');
select has_table('public','import_staged_rows','private staging rows exist');
select has_table('public','import_job_items','import result ledger exists');
select has_table('public','ingestion_events','privacy-bounded ingestion events exist');
select has_function('public','begin_collection_import',array['text','text','text','jsonb','jsonb'],'import draft RPC exists');
select has_function('public','stage_collection_import_rows',array['uuid','jsonb'],'staging RPC exists');
select has_function('public','preview_collection_import',array['uuid'],'server dry-check RPC exists');
select has_function('public','commit_collection_import',array['uuid'],'atomic commit RPC exists');
select has_function('public','rollback_collection_import_v2',array['uuid'],'organization-aware guarded rollback RPC exists');
select has_function(
  'public','record_ingestion_event',
  array['uuid','text','text','text','integer','jsonb'],
  'bounded ingestion event RPC exists'
);
select ok(
  not has_table_privilege('anon','public.import_staged_rows','SELECT'),
  'anonymous clients cannot read private staged rows'
);
select ok(
  has_table_privilege('authenticated','public.import_mapping_profiles','SELECT')
  and has_table_privilege('authenticated','public.import_staged_rows','INSERT')
  and not has_table_privilege('authenticated','public.import_job_items','INSERT'),
  'authenticated users can stage but cannot forge committed import results'
);

insert into auth.users(id,email) values
  ('51111111-1111-4111-8111-111111111111','mica-step5-user-1@example.invalid'),
  ('52222222-2222-4222-8222-222222222222','mica-step5-user-2@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',
  true
);

select set_config(
  'ingestion_test.job',
  public.begin_collection_import(
    'Mica test','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'name|quantity','{"name":"name","quantity":"quantity"}'::jsonb,
    '{"validRows":2}'::jsonb
  )::text,
  true
);

select is(
  public.stage_collection_import_rows(
    current_setting('ingestion_test.job')::uuid,
    '[
      {
        "rowNumber":2,
        "idempotencyKey":"mica-step5-row-0001",
        "payload":{
          "identity":{"name":"Pikachu","set":"Base Set","number":"58/102","language":"en","variant":"Normal","ingestion":{"version":"mica-ingestion-v1","channel":"csv"}},
          "cardId":null,"variantId":null,"cardState":"raw","rawCondition":"near_mint",
          "grader":null,"grade":null,"certificationNumber":null,"quantity":2,
          "transactionDate":"2026-09-01","unitPrice":"5.00","tax":"0.00",
          "shipping":"0.00","marketplaceFees":"0.00","gradingFees":"0.00",
          "otherCosts":"0.00","currency":"USD","acquisitionMethod":"unknown",
          "notes":"first import","location":"Binder A","tags":["Imported"]
        }
      },
      {
        "rowNumber":3,
        "idempotencyKey":"mica-step5-row-0002",
        "payload":{
          "identity":{"name":"Mew ex","set":"151","number":"151/165","language":"en","variant":"Holofoil","ingestion":{"version":"mica-ingestion-v1","channel":"csv"}},
          "cardId":null,"variantId":null,"cardState":"graded","rawCondition":null,
          "grader":"PSA","grade":"9","certificationNumber":"12345678","quantity":1,
          "transactionDate":"2026-09-01","unitPrice":"30.00","tax":"0.00",
          "shipping":"0.00","marketplaceFees":"0.00","gradingFees":"0.00",
          "otherCosts":"0.00","currency":"USD","acquisitionMethod":"unknown",
          "notes":null,"location":null,"tags":[]
        }
      }
    ]'::jsonb
  ),
  2,
  'two rows stage without touching the portfolio'
);
select is((select count(*) from public.collection_items),0::bigint,'staging changes no collection rows');
select is(
  (public.preview_collection_import(current_setting('ingestion_test.job')::uuid)->>'validRows')::integer,
  2,
  'server dry check validates every staged row'
);
select is(
  public.commit_collection_import(current_setting('ingestion_test.job')::uuid)->>'status',
  'committed',
  'all valid rows commit atomically'
);
select is((select count(*) from public.collection_items),2::bigint,'atomic commit creates both positions');
select is(
  (select storage_location from public.collection_items where notes='first import'),
  'Binder A',
  'commit preserves private organization fields'
);
select is(
  public.commit_collection_import(current_setting('ingestion_test.job')::uuid)->>'status',
  'committed',
  'repeating commit is idempotent'
);
select is((select count(*) from public.collection_items),2::bigint,'idempotent commit creates no duplicates');
select ok(
  public.record_ingestion_event(
    gen_random_uuid(),'csv','committed','success',120,
    '{"rowCount":2,"unsafeFreeText":"must be dropped"}'::jsonb
  ) is not null,
  'the owner can record a bounded operational event'
);
select is(
  (select count(*) from public.ingestion_events
    where metadata ? 'rowCount' and not metadata ? 'unsafeFreeText'),
  1::bigint,
  'event metadata keeps approved counters and drops arbitrary free text'
);

select set_config('request.jwt.claim.sub','52222222-2222-4222-8222-222222222222',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',
  true
);
select is((select count(*) from public.import_jobs),0::bigint,'RLS hides another owner import job');
select is((select count(*) from public.ingestion_events),0::bigint,'RLS hides another owner ingestion events');
select throws_ok(
  format('select public.rollback_collection_import_v2(%L::uuid)',current_setting('ingestion_test.job')),
  'P0001','import_not_found','another owner cannot roll back the import'
);

select set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',
  true
);
select is(
  public.rollback_collection_import_v2(current_setting('ingestion_test.job')::uuid)->>'status',
  'rolled_back',
  'untouched imported positions roll back together'
);
select is((select count(*) from public.collection_items),0::bigint,'rollback removes every created position');

select set_config(
  'ingestion_test.invalid_job',
  public.begin_collection_import(
    'Invalid test','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'name|quantity','{}'::jsonb,'{}'::jsonb
  )::text,
  true
);
select is(
  public.stage_collection_import_rows(
    current_setting('ingestion_test.invalid_job')::uuid,
    '[{"rowNumber":2,"idempotencyKey":"mica-step5-invalid-01","payload":{"identity":{},"cardState":"raw","quantity":0,"transactionDate":"2026-09-01","unitPrice":"0.00","currency":"USD","tags":[]}}]'::jsonb
  ),
  1,
  'an invalid row may be staged for a visible dry-run report'
);
select is(
  (public.preview_collection_import(current_setting('ingestion_test.invalid_job')::uuid)->>'invalidRows')::integer,
  1,
  'dry check reports the invalid staged row'
);
select throws_ok(
  format('select public.commit_collection_import(%L::uuid)',current_setting('ingestion_test.invalid_job')),
  'P0001','import_validation_failed','invalid rows abort before any portfolio mutation'
);
select is((select count(*) from public.collection_items),0::bigint,'failed validation leaves the portfolio unchanged');

select * from finish();
rollback;
