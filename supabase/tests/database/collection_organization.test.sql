-- Step 8 owner isolation, automatic goals, indexed paging, recoverable bulk
-- changes, private attachment metadata, and organization-aware rollback gate.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select has_table('public','collection_custom_field_definitions','custom field definitions exist');
select has_table('public','collection_item_attachments','private attachment metadata exists');
select has_table('public','collection_goals','collection goals exist');
select has_table('public','collection_goal_events','goal completion history exists');
select has_table('public','collection_organization_operations','bulk operation receipts exist');
select has_column('public','collection_items','custom_fields','items retain custom field values');
select has_column('public','collection_items','organization_search','items have a generated search document');
select has_column('public','collection_items','organization_aliases','items have indexed exact-variant aliases');
select has_column('public','saved_views','configuration_version','saved views are versioned');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in(
    'public.collection_custom_field_definitions'::regclass,
    'public.collection_item_attachments'::regclass,
    'public.collection_goals'::regclass,
    'public.collection_goal_events'::regclass,
    'public.collection_organization_operations'::regclass
  )),
  'every Step 8 public table has RLS enabled'
);
select ok(
  not has_table_privilege('anon','public.collection_goals','SELECT')
  and not has_table_privilege('anon','public.collection_item_attachments','SELECT'),
  'anonymous users cannot read organization records'
);
select ok(
  has_table_privilege('authenticated','public.collection_goal_events','SELECT')
  and not has_table_privilege('authenticated','public.collection_goal_events','INSERT'),
  'goal history is automatic and owner-readable'
);
select ok(
  has_table_privilege('authenticated','public.collection_organization_operations','SELECT')
  and not has_table_privilege('authenticated','public.collection_organization_operations','INSERT'),
  'bulk receipts are RPC-written and owner-readable'
);
select ok(
  not has_function_privilege('authenticated','public.rollback_collection_import(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.rollback_collection_import_v2(uuid)','EXECUTE'),
  'only the organization-aware import rollback is client callable'
);
select ok(
  has_function_privilege('authenticated','public.search_collection_positions(text,jsonb,text,integer,text,uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.bulk_organize_collection_items_v2(uuid[],text,text,text,text,text,uuid,text,text,jsonb,text)','EXECUTE')
  and has_function_privilege('authenticated','public.undo_collection_organization_operation(uuid)','EXECUTE'),
  'signed-in users receive only the bounded organization RPCs'
);
select is(
  (select public from storage.buckets where id='collection-item-files'),
  false,
  'collection attachment storage is private'
);
select is(
  (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'collection file owners can %'),
  3::bigint,
  'private file storage has owner insert, read, and delete policies'
);

insert into auth.users(id,email) values
  ('81111111-1111-4111-8111-111111111111','mica-step8-user-1@example.invalid'),
  ('82222222-2222-4222-8222-222222222222','mica-step8-user-2@example.invalid');

create temporary table step8_ids(
  folder_a uuid,
  folder_b uuid,
  position_a uuid,
  position_b uuid,
  quantity_goal uuid,
  checklist_goal uuid,
  unsupported_goal uuid,
  operation_one uuid,
  operation_two uuid
);
insert into step8_ids default values;
grant select,update on step8_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',true);

with inserted as (
  insert into public.collections(user_id,name,description)
  values('81111111-1111-4111-8111-111111111111','Main binder','Primary collection')
  returning id
) update step8_ids set folder_a=inserted.id from inserted;
with inserted as (
  insert into public.collections(user_id,name,description)
  values('81111111-1111-4111-8111-111111111111','Trade case','Card-show inventory')
  returning id
) update step8_ids set folder_b=inserted.id from inserted;

insert into public.collection_custom_field_definitions(user_id,key,name,value_type)
values('81111111-1111-4111-8111-111111111111','insurance_code','Insurance code','text');
insert into public.saved_views(user_id,name,collection_id,configuration)
select '81111111-1111-4111-8111-111111111111','English binder',folder_a,
  '{"version":"mica-organization-v1","language":"en"}'::jsonb from step8_ids;
select is((select count(*) from public.saved_views),1::bigint,'an owner can save a versioned view');

with inserted as (
  insert into public.collection_goals(
    user_id,name,goal_type,dimension,criteria,target_count,metadata_status,catalog_source,catalog_version
  ) values(
    '81111111-1111-4111-8111-111111111111','Own two English cards','quantity','language',
    '{"language":"en"}'::jsonb,2,'verified','owned_collection','mica-organization-v1'
  ) returning id
) update step8_ids set quantity_goal=inserted.id from inserted;
select is(
  (select (last_progress->>'current')::integer from public.collection_goals where id=(select quantity_goal from step8_ids)),
  0,
  'a goal begins from current owned data rather than a separate checklist'
);

update step8_ids set position_a=public.create_collection_position(
  '{"name":"Pikachu","set":"Mica Set","setId":"mica-set","number":"001","language":"en","variant":"Holofoil","artist":"Mica Artist","rarity":"Rare","externalIds":{"tcgdex":"tcg-1"},"acquisitionCostKnown":true,"acquisitionDateKnown":true}'::jsonb,
  null,null,'raw','near_mint',null,null,null,1,current_date,10,0,0,0,0,0,
  'USD','Test','Step 8 purchase','mica-step8-position-a','direct_purchase'
);
update public.collection_items set
  collection_id=(select folder_a from step8_ids),
  storage_location='Room 1 · Shelf A · Binder 1 · Page 1',
  tags=array['Favorites','Binder'],
  custom_fields='{"insurance_code":"A-1"}'::jsonb
where id=(select position_a from step8_ids);

update step8_ids set position_b=public.create_collection_position(
  '{"name":"Charizard","set":"Mica Set","setId":"mica-set","number":"002","language":"en","variant":"Reverse Holofoil","artist":"Mica Artist","rarity":"Ultra Rare","externalIds":{"tcgdex":"tcg-2"},"acquisitionCostKnown":true,"acquisitionDateKnown":true}'::jsonb,
  null,null,'raw','lightly_played',null,null,null,1,current_date,20,0,0,0,0,0,
  'USD','Test','Step 8 purchase','mica-step8-position-b','direct_purchase'
);
update public.collection_items set
  collection_id=(select folder_a from step8_ids),
  storage_location='Room 1 · Shelf A · Binder 1 · Page 2',
  tags=array['Binder']
where id=(select position_b from step8_ids);

select is(
  (select (last_progress->>'current')::integer from public.collection_goals where id=(select quantity_goal from step8_ids)),
  2,
  'goal progress recomputes automatically after owned items change'
);
select is(
  (select (last_progress->>'complete')::boolean from public.collection_goals where id=(select quantity_goal from step8_ids)),
  true,
  'a quantity goal completes from live owned quantities'
);
select is(
  (select count(*) from public.collection_goal_events where goal_id=(select quantity_goal from step8_ids) and event_type='completed'),
  1::bigint,
  'goal completion is appended to history once'
);

with inserted as (
  insert into public.collection_goals(
    user_id,name,goal_type,dimension,criteria,targets,metadata_status,catalog_source,catalog_version
  ) values(
    '81111111-1111-4111-8111-111111111111','Complete Mica Set','checklist','set',
    '{"set":"Mica Set","language":"en"}'::jsonb,
    '[{"key":"tcg-1","label":"Pikachu 001"},{"key":"tcg-3","label":"Mew 003"}]'::jsonb,
    'verified','TCGdex','test-v1'
  ) returning id
) update step8_ids set checklist_goal=inserted.id from inserted;
select is(
  (select (last_progress->>'current')::integer from public.collection_goals where id=(select checklist_goal from step8_ids)),
  1,
  'exact checklist progress matches stable provider aliases'
);
select is(
  (select last_progress #>> '{missing,0,key}' from public.collection_goals where id=(select checklist_goal from step8_ids)),
  'tcg-3',
  'the exact missing variant remains visible'
);

with inserted as (
  insert into public.collection_goals(
    user_id,name,goal_type,dimension,targets,metadata_status,catalog_source
  ) values(
    '81111111-1111-4111-8111-111111111111','Unsupported subset','checklist','subset','[]'::jsonb,
    'unsupported','unavailable'
  ) returning id
) update step8_ids set unsupported_goal=inserted.id from inserted;
select is(
  (select last_progress->>'status' from public.collection_goals where id=(select unsupported_goal from step8_ids)),
  'unsupported',
  'unsupported metadata does not create false completion'
);
select is(
  (select (last_progress->>'complete')::boolean from public.collection_goals where id=(select unsupported_goal from step8_ids)),
  false,
  'unsupported goals remain incomplete'
);

select is(
  (select count(*) from public.search_collection_positions('Pikachu','{}','name',100,null,null)),
  1::bigint,
  'server-side identity search returns the exact owned position'
);
select is(
  (select count(*) from public.search_collection_positions('',jsonb_build_object('location','Page 2'),'location',100,null,null)),
  1::bigint,
  'server-side physical location filtering finds the item'
);
select is(
  (select count(*) from public.search_collection_positions('',jsonb_build_object('collectionId',(select folder_a from step8_ids)),'name',1,null,null)),
  1::bigint,
  'server-side folder filtering respects the requested page size'
);
select is(
  (select total_count from public.search_collection_positions('',jsonb_build_object('collectionId',(select folder_a from step8_ids)),'name',1,null,null) limit 1),
  2::bigint,
  'bounded server pages retain the full matching count'
);
select throws_ok(
  $$select * from public.search_collection_positions('','{"graded":"yes"}'::jsonb,'name',100,null,null)$$,
  'Graded must be a boolean.',
  'server filters reject ambiguous boolean values'
);

update step8_ids ids set operation_one=public.bulk_organize_collection_items_v2(
  array[ids.position_a,ids.position_b],
  'Card show','add','Table 4','set','archived',folder_b,'set',
  'insurance_code','"SHOW"'::jsonb,'set'
);
select is((select item_count from public.collection_organization_operations where id=(select operation_one from step8_ids)),2,'a bulk change writes one receipt');
select is((select count(*) from public.collection_items where id in((select position_a from step8_ids),(select position_b from step8_ids)) and collection_id=(select folder_b from step8_ids)),2::bigint,'bulk folder moves are atomic');
select is((select count(*) from public.collection_items where id in((select position_a from step8_ids),(select position_b from step8_ids)) and storage_location='Table 4'),2::bigint,'bulk physical locations change together');
select is((select count(*) from public.collection_items where id in((select position_a from step8_ids),(select position_b from step8_ids)) and tags @> array['Card show']),2::bigint,'bulk labels change together');
select is((select count(*) from public.collection_items where id in((select position_a from step8_ids),(select position_b from step8_ids)) and custom_fields->>'insurance_code'='SHOW'),2::bigint,'bulk custom fields change together');
select is((select count(*) from public.collection_transactions where collection_item_id in((select position_a from step8_ids),(select position_b from step8_ids))),2::bigint,'bulk organization never changes financial history');
select is(public.undo_collection_organization_operation((select operation_one from step8_ids)),2,'the complete bulk change can be undone');
select is((select count(*) from public.collection_items where id in((select position_a from step8_ids),(select position_b from step8_ids)) and collection_id=(select folder_a from step8_ids)),2::bigint,'undo restores both original folders');
select is((select count(*) from public.collection_organization_operations where id=(select operation_one from step8_ids) and undone_at is not null),1::bigint,'the original receipt is marked undone');
select throws_ok(
  $$select public.undo_collection_organization_operation((select operation_one from step8_ids))$$,
  'This change was already undone.',
  'an operation cannot be undone twice'
);

update step8_ids ids set operation_two=public.bulk_organize_collection_items_v2(
  array[ids.position_a,ids.position_b],null,'keep','Case C','set','keep',null,'keep',null,null,'keep'
);
update public.collection_items set tags=tags||array['Newer edit'] where id=(select position_a from step8_ids);
select throws_ok(
  $$select public.undo_collection_organization_operation((select operation_two from step8_ids))$$,
  'A changed item was edited again; undo would overwrite newer work.',
  'undo refuses to overwrite a later item edit'
);
select is(
  (select storage_location from public.collection_items where id=(select position_b from step8_ids)),
  'Case C',
  'a refused undo makes no partial changes'
);

insert into public.collection_item_attachments(
  user_id,collection_item_id,kind,storage_path,filename,mime_type,byte_size,sha256
) select
  '81111111-1111-4111-8111-111111111111',position_a,'photo',
  '81111111-1111-4111-8111-111111111111/position/photo.jpg','photo.jpg',
  'image/jpeg',100,repeat('a',64)
from step8_ids;
select is((select count(*) from public.collection_item_attachments),1::bigint,'owners can record private attachment metadata');

select set_config('request.jwt.claim.sub','82222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',true);
select is((select count(*) from public.collection_goals),0::bigint,'cross-owner organization reads are denied');
select is((select count(*) from public.collection_item_attachments),0::bigint,'cross-owner attachment metadata reads are denied');
select throws_ok(
  $$select public.undo_collection_organization_operation((select operation_two from step8_ids))$$,
  'Organization change is unavailable.',
  'another owner cannot undo an operation'
);

select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',true);
delete from public.collection_items where id=(select position_b from step8_ids);
select is(
  (select count(*) from public.collection_goal_events where goal_id=(select quantity_goal from step8_ids) and event_type='reopened'),
  1::bigint,
  'completion history records when live collection data reopens a goal'
);
select is(
  (select (last_progress->>'complete')::boolean from public.collection_goals where id=(select quantity_goal from step8_ids)),
  false,
  'goal progress automatically reflects the deleted owned position'
);
select ok(
  (select (public.get_collection_organization_summary()->>'positionCount')::integer)>=1,
  'the owner summary derives from the current collection'
);
select throws_ok(
  $$update public.collection_items set custom_fields='{"nested":{"not":"allowed"}}'::jsonb where id=(select position_a from step8_ids)$$,
  'invalid_custom_fields',
  'nested custom fields are rejected by the bounded scalar contract'
);
select throws_ok(
  $$update public.collection_items set custom_fields='{"missing_definition":"no"}'::jsonb where id=(select position_a from step8_ids)$$,
  'custom_field_definition_missing',
  'custom values require an owner-scoped definition'
);
select throws_ok(
  $$update public.collection_items set custom_fields='{"insurance_code":42}'::jsonb where id=(select position_a from step8_ids)$$,
  'custom_field_type_mismatch',
  'custom values must match the declared field type'
);

select * from finish();
rollback;
