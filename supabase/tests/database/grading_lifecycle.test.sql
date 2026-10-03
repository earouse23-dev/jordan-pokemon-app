-- Step 7 integration gate for the owner-private grading-to-sale lifecycle.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(39);

select has_table('public','grading_submission_batches','submission batches exist');
select has_table('public','grading_submission_status_events','submission status history exists');
select has_table('public','grading_lifecycle_events','grading lifecycle history exists');
select has_table('public','grading_input_corrections','grading correction overlays exist');
select has_column('public','grading_submissions','batch_id','submissions link to a batch');
select has_column('public','grading_submissions','scan_session_id','submissions link to photo evidence');
select has_column('public','grading_submissions','economics_snapshot','submissions retain assumptions');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in (
     'public.grading_submission_batches'::regclass,
     'public.grading_submission_status_events'::regclass,
     'public.grading_lifecycle_events'::regclass,
     'public.grading_input_corrections'::regclass
   )),
  'every new public table has RLS enabled'
);
select ok(
  not has_table_privilege('anon','public.grading_submission_batches','SELECT')
  and not has_table_privilege('anon','public.grading_lifecycle_events','SELECT')
  and not has_table_privilege('anon','public.grading_input_corrections','SELECT'),
  'anonymous users cannot read grading lifecycle records'
);
select ok(
  has_table_privilege('authenticated','public.grading_input_corrections','SELECT')
  and has_table_privilege('authenticated','public.grading_input_corrections','INSERT')
  and not has_table_privilege('authenticated','public.grading_input_corrections','UPDATE')
  and not has_table_privilege('authenticated','public.grading_input_corrections','DELETE'),
  'corrections are append-only for signed-in owners'
);
select ok(
  has_table_privilege('authenticated','public.grading_submission_status_events','SELECT')
  and not has_table_privilege('authenticated','public.grading_submission_status_events','INSERT')
  and not has_table_privilege('authenticated','public.grading_submission_status_events','UPDATE')
  and not has_table_privilege('authenticated','public.grading_submission_status_events','DELETE'),
  'submission status history is trigger-written and owner-readable'
);

insert into auth.users(id,email) values
  ('71111111-1111-4111-8111-111111111111','mica-step7-user-1@example.invalid'),
  ('72222222-2222-4222-8222-222222222222','mica-step7-user-2@example.invalid');

insert into public.card_sets(id,name,series,language) values(
  '7a000000-0000-4000-8000-000000000001',
  'Mica Step 7 Test Set','Mica Test','en'
);
insert into public.cards(id,set_id,name,collector_number,language) values(
  '7a000000-0000-4000-8000-000000000011',
  '7a000000-0000-4000-8000-000000000001',
  'Mica Lifecycle Card','007','en'
);
insert into public.card_variants(id,card_id,finish,edition,language) values(
  '7b000000-0000-4000-8000-000000000011',
  '7a000000-0000-4000-8000-000000000011',
  'holo','unlimited','en'
);

create temporary table step7_ids(
  position_id uuid,
  scan_id uuid,
  prediction_id uuid,
  batch_id uuid,
  submission_id uuid,
  correction_id uuid
);
insert into step7_ids default values;
grant select, update on step7_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','71111111-1111-4111-8111-111111111111',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"71111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',
  true
);

update step7_ids set position_id=public.create_collection_position(
  '{
    "name":"Mica Lifecycle Card","set":"Mica Step 7 Test Set",
    "number":"007","variant":"Holo · Unlimited · English","language":"en",
    "providerCardId":"mica-step7-card","externalIds":{},
    "acquisitionCostKnown":true,"acquisitionDateKnown":true
  }'::jsonb,
  '7a000000-0000-4000-8000-000000000011',
  '7b000000-0000-4000-8000-000000000011',
  'raw','near_mint',null,null,null,1,current_date,25,0,0,0,0,0,
  'USD','Test','Step 7 purchase','mica-step7-purchase','direct_purchase'
);

select is(
  (select count(*) from public.grading_lifecycle_events where state='candidate'),
  1::bigint,
  'an owned raw position begins as a grading candidate'
);

update step7_ids set scan_id=public.create_grading_scan_session(
  position_id,
  '{"name":"Mica Lifecycle Card","number":"007","language":"en"}'::jsonb,
  'mica-step7-scan-0001','normal',null,'mica-step7-model-v1'
);

select is(
  (select count(*) from public.grading_lifecycle_events where state='capture_incomplete'),
  1::bigint,
  'starting the linked scan records capture incomplete'
);

update step7_ids set prediction_id=public.save_grading_scan_report(
  scan_id,
  '[
    {"captureType":"front","side":"front","width":1200,"height":1680,"imageHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","qualityMeasurements":{"sharpness":9},"geometryMeasurements":{}},
    {"captureType":"back","side":"back","width":1200,"height":1680,"imageHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","qualityMeasurements":{"sharpness":9},"geometryMeasurements":{}},
    {"captureType":"alternate_front","side":"front","width":1200,"height":1680,"imageHash":"cccccccccccccccccccccccccccccccc","qualityMeasurements":{"sharpness":9},"geometryMeasurements":{}},
    {"captureType":"alternate_back","side":"back","width":1200,"height":1680,"imageHash":"dddddddddddddddddddddddddddddddd","qualityMeasurements":{"sharpness":9},"geometryMeasurements":{}}
  ]'::jsonb,
  jsonb_build_object(
    'collectionItemId',position_id,
    'pregradeScore',8.5,'pregradeBasis','visible_condition_measurement',
    'evidenceProfile',jsonb_build_object('complete',true,'evidenceCoverage',0.9),
    'conditionScore',8.5,'conditionStatus','estimate',
    'professionalPredictionStatus','unavailable',
    'conditionLow',8,'conditionHigh',9,
    'subscores',jsonb_build_array(jsonb_build_object(
      'category','surface','scoreLow',8,'scoreHigh',9,'confidence',0.9
    )),
    'confidence',0.9,'modelBundleVersion','mica-step7-model-v1',
    'rubricVersion','mica-condition-rubric-v4',
    'calibrationVersion','psa-held-out-calibration-required-v1',
    'stability',jsonb_build_object('stable',true,'status','stable'),
    'reportSnapshot',jsonb_build_object(
      'quality',jsonb_build_object('usable',true,'confidence',0.9)
    ),
    'financialSnapshot',jsonb_build_object('version','mica-grading-ev-v1')
  ),
  '[{
    "side":"front","category":"surface","region":{"x":0.2,"y":0.2,"width":0.2,"height":0.2},
    "severity":"minor","confidence":0.9,"evidence":"Small visible mark.",
    "verificationStatus":"localized"
  }]'::jsonb
);

select is(
  (select count(*) from public.grading_lifecycle_events where state='analyzed'),
  1::bigint,
  'a completed evidence report records analyzed state'
);
select lives_ok(
  $$select public.record_grading_lifecycle_decision(
    (select position_id from step7_ids),'selected',
    (select scan_id from step7_ids),'Reviewed the evidence and assumptions.'
  )$$,
  'the owner can explicitly select the same item for submission'
);

update step7_ids set correction_id=public.record_grading_input_correction(
  scan_id,
  (select id from public.grading_evidence where scan_session_id=step7_ids.scan_id limit 1),
  'defect','{"severity":"minor"}'::jsonb,'{"statement":"Not a defect"}'::jsonb,
  'Verified under angled light.'
);
select is(
  (select count(*) from public.grading_input_corrections),
  1::bigint,
  'the user can correct an automated defect without overwriting the report'
);
select is(
  (select count(*) from public.grading_predictions where id=(select prediction_id from step7_ids)),
  1::bigint,
  'the original prediction remains intact after correction'
);

update step7_ids set batch_id=public.record_grading_submission_batch(
  jsonb_build_array(jsonb_build_object(
    'collectionItemId',position_id,
    'scanSessionId',scan_id,
    'estimatedTotalCost','35.00',
    'economics',jsonb_build_object(
      'version','mica-grading-ev-v1','rawValue',25,
      'expectedGradedValue',80,'valuesAreEstimates',true
    )
  )),
  current_date,'PSA','Value',current_date,null,
  '{"version":"mica-grading-batch-v1","valuesAreEstimates":true}'::jsonb,
  'USD','mica-step7-batch-0001'
);
update step7_ids set submission_id=(
  select id from public.grading_submissions
  where batch_id=step7_ids.batch_id
);

select is(
  (select count(*) from public.grading_submission_batches),
  1::bigint,
  'the batch is saved once'
);
select is(
  (select count(*) from public.grading_submissions where batch_id=(select batch_id from step7_ids)),
  1::bigint,
  'the submission links to its batch'
);
select is(
  (select scan_session_id from public.grading_submissions where id=(select submission_id from step7_ids)),
  (select scan_id from step7_ids),
  'the submission links to its exact evidence report'
);
select is(
  (select count(*) from public.grading_submission_status_events where status='submitted'),
  1::bigint,
  'submission status is appended automatically'
);
select is(
  public.record_grading_submission_batch(
    jsonb_build_array(jsonb_build_object(
      'collectionItemId',(select position_id from step7_ids)
    )),
    current_date,'PSA','Value',current_date,null,'{}'::jsonb,'USD',
    'mica-step7-batch-0001'
  ),
  (select batch_id from step7_ids),
  'batch creation is idempotent'
);

select lives_ok(
  $$select public.update_grading_submission(
    (select submission_id from step7_ids),'received',current_date,
    current_date,null,'Confirmed received.'
  )$$,
  'manual grader status advances through the existing validated RPC'
);
select is(
  (select count(*) from public.grading_submission_status_events),
  2::bigint,
  'every submission stage is retained in append-only history'
);
select throws_ok(
  $$delete from public.grading_submission_status_events$$,
  '42501',null,
  'owners cannot delete submission history'
);
select throws_ok(
  $$update public.grading_input_corrections set reason='rewritten'$$,
  '42501',null,
  'owners cannot rewrite corrections'
);

insert into public.grading_outcomes(
  user_id,scan_session_id,collection_item_id,professional_grader,
  returned_grade,outcome_kind,returned_label,submission_date,return_date,
  certification_number,verification_status
) values(
  auth.uid(),(select scan_id from step7_ids),(select position_id from step7_ids),
  'PSA',9,'numeric','9',current_date,current_date,'STEP7CERT','user_reported'
);
select is(
  (select outcome_count from public.grading_calibration_summary()
   where grader='PSA' and capture_quality='high'),
  1::bigint,
  'calibration groups linked outcomes by grader and capture quality'
);
select is(
  (select mean_absolute_error from public.grading_calibration_summary()
   where grader='PSA' and capture_quality='high'),
  0.500::numeric,
  'calibration measures prediction error'
);

select lives_ok(
  $$select public.record_grading_result(
    (select position_id from step7_ids),current_date,'PSA',9,30,
    'STEP7CERT','Returned in test','mica-step7-return-0001'
  )$$,
  'returned grades update the same owned item'
);
select is(
  (select count(*) from public.collection_items where id=(select position_id from step7_ids)),
  1::bigint,
  'the return creates no duplicate owned item'
);
select is(
  (select jsonb_build_array(card_state,grader,grade)
   from public.collection_items
   where id=(select position_id from step7_ids)),
  '["graded","PSA",9.0]'::jsonb,
  'the same item now carries the professional grade'
);
select is(
  (select status from public.grading_submissions where id=(select submission_id from step7_ids)),
  'returned',
  'the return closes the linked submission'
);
select is(
  (select status from public.grading_submission_batches where id=(select batch_id from step7_ids)),
  'closed',
  'the return closes the completed batch'
);
select is(
  (select count(*) from public.grading_lifecycle_events where state='held'),
  1::bigint,
  'the returned graded item enters held disposition'
);

select set_config('request.jwt.claim.sub','72222222-2222-4222-8222-222222222222',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"72222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',
  true
);
select is(
  (select count(*) from public.grading_submission_batches),
  0::bigint,
  'another owner cannot read batches'
);
select is(
  (select count(*) from public.grading_lifecycle_events),
  0::bigint,
  'another owner cannot read lifecycle history'
);
select is(
  (select count(*) from public.grading_input_corrections),
  0::bigint,
  'another owner cannot read corrections'
);
select throws_ok(
  $$select public.record_grading_input_correction(
    (select scan_id from step7_ids),null,'economics','{}'::jsonb,
    '{"statement":"forged"}'::jsonb,'Not mine.'
  )$$,
  'P0001','owned_grading_report_required',
  'another owner cannot correct the first owner report'
);

reset role;
delete from auth.users where id='71111111-1111-4111-8111-111111111111';
select is(
  (select count(*) from public.grading_lifecycle_events
   where user_id='71111111-1111-4111-8111-111111111111'),
  0::bigint,
  'account deletion removes grading lifecycle history'
);

select * from finish();
rollback;
