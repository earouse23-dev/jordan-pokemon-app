-- Step 9 owner isolation, deterministic materialization, preferences,
-- idempotent delivery, leases, retries, caps, and audited outcome gate.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select has_table('public','notification_preferences','notification preferences exist');
select has_table('public','action_items','durable actions exist');
select has_table('public','notification_delivery_records','delivery receipts exist');
select has_table('public','action_audit_events','action audit events exist');
select has_table('public','web_push_subscriptions','private push subscriptions exist');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in(
    'public.notification_preferences'::regclass,
    'public.action_items'::regclass,
    'public.notification_delivery_records'::regclass,
    'public.action_audit_events'::regclass,
    'public.web_push_subscriptions'::regclass
  )),
  'every Step 9 public table has RLS enabled'
);
select ok(
  not has_table_privilege('anon','public.action_items','SELECT')
  and not has_table_privilege('anon','public.notification_delivery_records','SELECT'),
  'anonymous users cannot read actions or delivery history'
);
select ok(
  has_table_privilege('authenticated','public.action_items','SELECT')
  and not has_table_privilege('authenticated','public.action_items','INSERT')
  and not has_table_privilege('authenticated','public.action_items','UPDATE'),
  'signed-in users read actions but mutate them only through bounded RPCs'
);
select ok(
  has_function_privilege('authenticated','public.save_notification_preferences(jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.upsert_action_center_snapshot(jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.transition_action_item(uuid,text,timestamp with time zone)','EXECUTE'),
  'owner preference, snapshot, and outcome RPCs are callable'
);
select ok(
  not has_function_privilege('authenticated','public.materialize_action_center_service(text,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.claim_action_deliveries_service(text,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.complete_action_delivery_service(uuid,boolean,boolean,text,text,text)','EXECUTE'),
  'maintenance and delivery worker RPCs are service-only'
);

insert into auth.users(id,email) values
  ('91111111-1111-4111-8111-111111111111','mica-step9-user-1@example.invalid'),
  ('92222222-2222-4222-8222-222222222222','mica-step9-user-2@example.invalid');

create temporary table step9_ids(
  first_action uuid,
  second_action uuid,
  first_delivery uuid,
  position_id uuid
);
insert into step9_ids default values;
grant select,update on step9_ids to authenticated,service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"91111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',true);

select is(
  (public.save_notification_preferences('{
    "enabled":true,
    "channels":{"inApp":true,"email":true,"webPush":true},
    "quietHours":{"enabled":false,"start":"21:00","end":"08:00"},
    "timeZone":"UTC","dailyCap":1,"cooldownHours":24,"mutedKinds":[],
    "thresholds":{"priceMovePercent":10,"comparableMovePercent":10,"staleAfterHours":72,"inventoryAgingDays":180,"listingStaleDays":30,"gradingMinimumConfidence":0.8}
  }'::jsonb)).email_enabled,
  true,
  'an owner can explicitly opt into email'
);
select is((select web_push_enabled from public.notification_preferences),true,'web push also requires explicit opt in');

select lives_ok(
  $$select public.upsert_action_center_snapshot('[{
    "actionKey":"mica-actions-v1:watch_target:watchlist:watch-1:target_100",
    "kind":"watch_target","ruleVersion":"mica-actions-v1",
    "subject":{"type":"watchlist","id":"watch-1"},
    "title":"Pikachu reached your target",
    "reason":"The verified matching price is at or below the saved target.",
    "source":"PkmnPrices","observedAt":"2026-09-03T14:00:00Z",
    "confidence":1,"suggestedAction":"Review the exact evidence.",
    "destination":{"route":"watchlist","view":null,"id":"watch-1"},
    "evidence":{"currentPrice":90,"targetPrice":100,"pricingStatus":"live"},"priority":1
  }]'::jsonb)$$,
  'a bounded deterministic snapshot can create an action'
);
update step9_ids set first_action=(select id from public.action_items where kind='watch_target');
select is((select count(*) from public.action_items),1::bigint,'one action is stored');
select is((select count(*) from public.notification_delivery_records),3::bigint,'one receipt is queued for every opted-in channel');
select is((select count(*) from public.notification_delivery_records where channel='in_app' and status='sent'),1::bigint,'in-app delivery is immediately visible');

select lives_ok(
  $$select public.upsert_action_center_snapshot('[{
    "actionKey":"mica-actions-v1:watch_target:watchlist:watch-1:target_100",
    "kind":"watch_target","ruleVersion":"mica-actions-v1",
    "subject":{"type":"watchlist","id":"watch-1"},
    "title":"Pikachu reached your target",
    "reason":"The same verified matching price remains at or below the target.",
    "source":"PkmnPrices","observedAt":"2026-09-03T14:00:00Z",
    "confidence":1,"suggestedAction":"Review the exact evidence.",
    "destination":{"route":"watchlist","view":null,"id":"watch-1"},
    "evidence":{"currentPrice":90,"targetPrice":100,"pricingStatus":"live"},"priority":1
  }]'::jsonb)$$,
  're-evaluating the same occurrence is safe'
);
select is((select count(*) from public.action_items),1::bigint,'rule retries do not duplicate actions');
select is((select count(*) from public.notification_delivery_records),3::bigint,'rule retries do not duplicate deliveries');
select is((select occurrence_count from public.action_items),2,'repeat evaluation is auditable');

select is(
  public.transition_action_item((select first_action from step9_ids),'snooze',now()+interval '24 hours'),
  'snoozed',
  'an owner can snooze an action'
);
select is((select count(*) from public.action_audit_events where event_type='snoozed'),1::bigint,'snooze is audited');
select is(public.transition_action_item((select first_action from step9_ids),'reopen',null),'open','an owner can reopen an action');

select lives_ok(
  $$select public.save_notification_preferences('{
    "enabled":true,"channels":{"inApp":true,"email":false,"webPush":false},
    "quietHours":{"enabled":true,"start":"21:00","end":"08:00"},
    "timeZone":"UTC","dailyCap":5,"cooldownHours":24,"mutedKinds":[]
  }'::jsonb)$$,
  'an owner can unsubscribe from every optional channel'
);
select is((select count(*) from public.notification_delivery_records where channel in('email','web_push') and status='cancelled'),2::bigint,'unsubscribe cancels queued optional delivery');
select throws_ok(
  $$select public.save_notification_preferences('{"timeZone":"Not/A_Real_Zone"}'::jsonb)$$,
  'invalid_time_zone',
  'invalid timezones cannot break the worker'
);

select throws_ok(
  $$insert into public.action_items(user_id,action_key,kind,rule_version,subject_type,subject_id,title,reason,source,observed_at,confidence,suggested_action,destination)
    values('91111111-1111-4111-8111-111111111111','direct-action','stale_data','v1','account','account','Bad direct write','Not allowed','test',now(),1,'None','{"route":"dashboard"}')$$,
  '42501',null,
  'clients cannot bypass the action RPC contract'
);

update step9_ids set position_id=public.create_collection_position(
  '{"name":"Mew","set":"Mica Set","setId":"mica-set","number":"001","language":"en","variant":"Holofoil","externalIds":{"tcgdex":"step9-1"},"acquisitionCostKnown":true,"acquisitionDateKnown":true}'::jsonb,
  null,null,'raw','near_mint',null,null,null,1,current_date,10,0,0,0,0,0,
  'USD','Test','Step 9 purchase','mica-step9-position','direct_purchase'
);
insert into public.collection_goals(
  user_id,name,goal_type,dimension,criteria,target_count,metadata_status,catalog_source,catalog_version
) values(
  '91111111-1111-4111-8111-111111111111','Own one English card','quantity','language',
  '{"language":"en"}'::jsonb,1,'verified','owned_collection','mica-actions-v1'
);
select is((select (last_progress->>'complete')::boolean from public.collection_goals),true,'materializer input is based on verified goal progress');

reset role;
set local role service_role;
select ok(
  (public.materialize_action_center_service('worker:step9-database-test',100)->>'generated')::integer>=1,
  'the service worker materializes deterministic time and lifecycle actions'
);
select is((select count(*) from public.action_items where kind='collection_goal'),1::bigint,'goal completion has a durable action');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','92222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"92222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',true);
select is((select count(*) from public.action_items),0::bigint,'a second user cannot read another owner action');
select is((select count(*) from public.notification_delivery_records),0::bigint,'a second user cannot read another owner delivery history');
select throws_ok(
  format('select public.transition_action_item(%L,''complete'',null)',(select first_action from step9_ids)),
  'action_not_found',
  'a second user cannot mutate another owner action'
);

select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"91111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',true);
select lives_ok(
  $$select public.save_notification_preferences('{
    "enabled":true,"channels":{"inApp":true,"email":true,"webPush":false},
    "quietHours":{"enabled":false,"start":"21:00","end":"08:00"},
    "timeZone":"UTC","dailyCap":1,"cooldownHours":24,"mutedKinds":[]
  }'::jsonb)$$,
  'email can be re-enabled explicitly'
);
select lives_ok(
  $$select public.upsert_action_center_snapshot('[{
    "actionKey":"mica-actions-v1:inventory_aging:position:position-2:threshold_180",
    "kind":"inventory_aging","ruleVersion":"mica-actions-v1",
    "subject":{"type":"position","id":"position-2"},
    "title":"Inventory needs review","reason":"The saved age threshold was reached.",
    "source":"collection transaction history","observedAt":"2026-09-03T14:00:00Z",
    "confidence":1,"suggestedAction":"Review whether to hold or sell.",
    "destination":{"route":"collection","view":null,"id":"position-2"},
    "evidence":{"heldDays":180,"thresholdDays":180},"priority":5
  }]'::jsonb)$$,
  'a second action queues a new idempotency key'
);
update step9_ids set second_action=(select id from public.action_items where subject_id='position-2');

reset role;
set local role service_role;
with claimed as(
  select public.claim_action_deliveries_service('worker:step9-delivery-test',25) value
) update step9_ids set first_delivery=(select (entry->>'deliveryId')::uuid from claimed,jsonb_array_elements(claimed.value) entry limit 1);
select isnt((select first_delivery from step9_ids),null::uuid,'one optional delivery is claimed with a lease');
select is(
  public.complete_action_delivery_service((select first_delivery from step9_ids),false,false,null,'temporary_provider_error','worker:step9-delivery-test'),
  'pending',
  'a temporary failure schedules a retry'
);
select is(jsonb_array_length(public.claim_action_deliveries_service('worker:step9-delivery-test',25)),0,'a future retry cannot send immediately again');
update public.notification_delivery_records set available_at=now()-interval '1 minute'
where id=(select first_delivery from step9_ids);
select is(jsonb_array_length(public.claim_action_deliveries_service('worker:step9-delivery-test',25)),1,'the same delivery can be reclaimed after its backoff');
select is(
  public.complete_action_delivery_service((select first_delivery from step9_ids),true,false,'provider-message-1',null,'worker:step9-delivery-test'),
  'sent',
  'the retried delivery records one success'
);
select is((select count(*) from public.notification_delivery_records where id=(select first_delivery from step9_ids) and status='sent'),1::bigint,'retry updates one receipt instead of inserting another send');
select is(jsonb_array_length(public.claim_action_deliveries_service('worker:step9-delivery-test',25)),0,'the per-channel daily cap suppresses additional sends');

select * from finish();
rollback;
