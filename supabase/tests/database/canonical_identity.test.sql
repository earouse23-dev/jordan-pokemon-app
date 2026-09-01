-- Step 3 integration gate for an isolated Supabase branch.
--
-- The entire test is transactional. It creates two disposable users, exercises
-- the authenticated and admin paths under RLS, and rolls every row back.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

select has_table(
  'public',
  'collectible_identities',
  'canonical identity registry exists'
);
select has_table(
  'public',
  'identity_corrections',
  'append-only correction history exists'
);
select has_table(
  'public',
  'identity_merge_events',
  'append-only merge history exists'
);
select col_not_null(
  'public',
  'collection_items',
  'collectible_id',
  'owned positions require a canonical identity'
);

insert into auth.users(id,email) values
  ('11111111-1111-4111-8111-111111111111','mica-step3-user-1@example.invalid'),
  ('22222222-2222-4222-8222-222222222222','mica-step3-user-2@example.invalid');

insert into public.card_sets(id,name,series,language) values(
  'a0000000-0000-4000-8000-000000000001',
  'Mica Step 3 Test Set',
  'Mica Test',
  'en'
);
insert into public.cards(id,set_id,name,collector_number,language) values
  (
    'a0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000001',
    'Mica Test Card A',
    '001',
    'en'
  ),
  (
    'a0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000001',
    'Mica Test Card B',
    '002',
    'en'
  );
insert into public.card_variants(id,card_id,finish,edition,language) values
  (
    'b0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000011',
    'holo',
    'unlimited',
    'en'
  ),
  (
    'b0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000012',
    'reverse_holo',
    'unlimited',
    'en'
  );

insert into public.collections(id,user_id,name) values
  (
    'c0000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'Step 3 User 1'
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'Step 3 User 2'
  );

insert into public.collection_items(
  id,collection_id,user_id,card_id,variant_id,identity_snapshot,card_state,
  raw_condition,status,currency,quantity
) values
  (
    'd0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a0000000-0000-4000-8000-000000000011',
    'b0000000-0000-4000-8000-000000000011',
    '{
      "name":"Mica Test Card A",
      "set":"Mica Step 3 Test Set",
      "number":"001",
      "variant":"Holo · Unlimited · English",
      "language":"en",
      "providerCardId":"mica-test-a",
      "externalIds":{},
      "acquisitionCostKnown":true,
      "acquisitionDateKnown":true
    }'::jsonb,
    'raw','near_mint','owned','USD',1
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000012',
    'b0000000-0000-4000-8000-000000000012',
    '{
      "name":"Mica Test Card B",
      "set":"Mica Step 3 Test Set",
      "number":"002",
      "variant":"Reverse holo · Unlimited · English",
      "language":"en",
      "providerCardId":"mica-test-b",
      "externalIds":{},
      "acquisitionCostKnown":true,
      "acquisitionDateKnown":true
    }'::jsonb,
    'raw','near_mint','owned','USD',1
  );

insert into public.collection_transactions(
  id,user_id,collection_item_id,transaction_type,transaction_date,quantity,
  unit_price,subtotal,total_cost,currency,idempotency_key
) values
  (
    'e0000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'purchase',current_date,1,10,10,10,'USD','mica-step3-user-1'
  ),
  (
    'e0000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'd0000000-0000-4000-8000-000000000002',
    'purchase',current_date,1,20,20,20,'USD','mica-step3-user-2'
  );

insert into public.card_watchlist(
  id,user_id,card_id,variant_id,provider_card_id,variant_key,
  identity_snapshot,card_state,raw_condition,currency
) values
  (
    'f0000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'a0000000-0000-4000-8000-000000000011',
    'b0000000-0000-4000-8000-000000000011',
    'mica-test-a','holo:unlimited:en',
    '{"name":"Mica Test Card A","variantId":"b0000000-0000-4000-8000-000000000011"}'::jsonb,
    'raw','near_mint','USD'
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000012',
    'b0000000-0000-4000-8000-000000000012',
    'mica-test-b','reverse_holo:unlimited:en',
    '{"name":"Mica Test Card B","variantId":"b0000000-0000-4000-8000-000000000012"}'::jsonb,
    'raw','near_mint','USD'
  );

select is(
  (
    select collectible_id
    from public.collection_items
    where id='d0000000-0000-4000-8000-000000000001'
  ),
  'b0000000-0000-4000-8000-000000000011'::uuid,
  'position writes derive the exact variant identity'
);
select is(
  (
    select collectible_id
    from public.collection_transactions
    where id='e0000000-0000-4000-8000-000000000001'
  ),
  'b0000000-0000-4000-8000-000000000011'::uuid,
  'transaction writes inherit the position identity'
);
select is(
  (
    select collectible_id
    from public.card_watchlist
    where id='f0000000-0000-4000-8000-000000000001'
  ),
  'b0000000-0000-4000-8000-000000000011'::uuid,
  'watchlist writes derive the exact variant identity'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',
  true
);

select is(
  (select count(*) from public.collection_items),
  1::bigint,
  'user 1 sees only their position'
);
select is(
  (select count(*) from public.collection_transactions),
  1::bigint,
  'user 1 sees only their transaction'
);
select is(
  (select count(*) from public.card_watchlist),
  1::bigint,
  'user 1 sees only their watch entry'
);
select is(
  (
    with affected as (
      update public.collection_items
      set notes='cross-owner update must be filtered'
      where id='d0000000-0000-4000-8000-000000000002'
      returning id
    )
    select count(*) from affected
  ),
  0::bigint,
  'RLS filters a cross-owner update'
);
select throws_ok(
  $$
    select public.remap_collection_position(
      'd0000000-0000-4000-8000-000000000002'::uuid,
      '{
        "name":"Blocked correction",
        "set":"Mica Step 3 Test Set",
        "number":"002",
        "variant":"Manual review",
        "language":"en",
        "providerCardId":"blocked-correction",
        "externalIds":{}
      }'::jsonb,
      null,
      null
    )
  $$,
  'P0001',
  'position_not_found',
  'owner-scoped correction RPC rejects another user position'
);
select lives_ok(
  $$
    select public.remap_collection_position(
      'd0000000-0000-4000-8000-000000000001'::uuid,
      '{
        "name":"Mica Test Card A corrected",
        "set":"Mica Step 3 Test Set",
        "number":"001a",
        "variant":"Manual review",
        "language":"en",
        "providerCardId":"mica-test-a-corrected",
        "externalIds":{}
      }'::jsonb,
      null,
      null
    )
  $$,
  'user 1 can create an explicit unresolved correction'
);
select set_config(
  'identity_test.user1_correction_id',
  (
    select id::text
    from public.identity_corrections
    where collection_item_id='d0000000-0000-4000-8000-000000000001'
      and event_type='correction'
  ),
  true
);
select set_config(
  'identity_test.user1_unresolved_id',
  (
    select collectible_id::text
    from public.collection_items
    where id='d0000000-0000-4000-8000-000000000001'
  ),
  true
);
select is(
  (
    select count(*)
    from public.identity_corrections
    where collection_item_id='d0000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'a correction appends one audit event'
);
select ok(
  exists(
    select 1
    from public.collectible_identities
    where id=current_setting('identity_test.user1_unresolved_id')::uuid
      and owner_id='11111111-1111-4111-8111-111111111111'
      and identity_kind='unresolved'
      and identity_status='needs_review'
  ),
  'an unresolved correction identity is owner-scoped'
);
select is(
  (
    select transaction.collectible_id=item.collectible_id
    from public.collection_transactions transaction
    join public.collection_items item
      on item.id=transaction.collection_item_id
    where transaction.id='e0000000-0000-4000-8000-000000000001'
  ),
  true,
  'correction propagates to dependent ledger rows'
);
select is(
  (
    select identity_snapshot->>'acquisitionCostKnown'
    from public.collection_items
    where id='d0000000-0000-4000-8000-000000000001'
  ),
  'true',
  'correction preserves acquisition knowledge'
);
select lives_ok(
  format(
    'select public.revert_collection_identity_correction(%L::uuid)',
    current_setting('identity_test.user1_correction_id')
  ),
  'the latest correction can be reversed'
);
select is(
  (
    select collectible_id
    from public.collection_items
    where id='d0000000-0000-4000-8000-000000000001'
  ),
  'b0000000-0000-4000-8000-000000000011'::uuid,
  'correction reversal restores the original identity'
);
select is(
  (
    select collectible_id
    from public.collection_transactions
    where id='e0000000-0000-4000-8000-000000000001'
  ),
  'b0000000-0000-4000-8000-000000000011'::uuid,
  'correction reversal restores dependent ledger identity'
);
select is(
  (
    select count(*)
    from public.identity_corrections
    where collection_item_id='d0000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'reversal appends history instead of deleting it'
);
select ok(
  exists(
    select 1
    from public.identity_corrections
    where reverses_correction_id=
      current_setting('identity_test.user1_correction_id')::uuid
      and event_type='reversal'
  ),
  'reversal points to the original correction event'
);
select throws_ok(
  format(
    'select public.revert_collection_identity_correction(%L::uuid)',
    current_setting('identity_test.user1_correction_id')
  ),
  'P0001',
  'correction_already_reversed',
  'a correction cannot be reversed twice'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',
  true
);

select is(
  (select count(*) from public.collection_items),
  1::bigint,
  'user 2 sees only their position'
);
select is(
  (
    select count(*)
    from public.identity_corrections
    where id=current_setting('identity_test.user1_correction_id')::uuid
  ),
  0::bigint,
  'user 2 cannot read user 1 correction history'
);
select is(
  (
    select count(*)
    from public.collectible_identities
    where id=current_setting('identity_test.user1_unresolved_id')::uuid
  ),
  0::bigint,
  'user 2 cannot read user 1 unresolved identity'
);
select throws_ok(
  format(
    'select public.revert_collection_identity_correction(%L::uuid)',
    current_setting('identity_test.user1_correction_id')
  ),
  'P0001',
  'correction_not_found',
  'user 2 cannot reverse user 1 correction'
);
select lives_ok(
  $$
    select public.remap_collection_position(
      'd0000000-0000-4000-8000-000000000002'::uuid,
      '{
        "name":"Mica Test Card B corrected",
        "set":"Mica Step 3 Test Set",
        "number":"002a",
        "variant":"Manual review",
        "language":"en",
        "providerCardId":"mica-test-b-corrected",
        "externalIds":{}
      }'::jsonb,
      null,
      null
    )
  $$,
  'user 2 can correct their own position'
);
select set_config(
  'identity_test.user2_unresolved_id',
  (
    select collectible_id::text
    from public.collection_items
    where id='d0000000-0000-4000-8000-000000000002'
  ),
  true
);
select ok(
  exists(
    select 1
    from public.collectible_identities
    where id=current_setting('identity_test.user2_unresolved_id')::uuid
      and owner_id='22222222-2222-4222-8222-222222222222'
  ),
  'user 2 unresolved identity belongs only to user 2'
);
select throws_ok(
  $$
    select public.propose_collectible_identity_merge(
      'b0000000-0000-4000-8000-000000000011'::uuid,
      'b0000000-0000-4000-8000-000000000012'::uuid,
      '{"source":"step3-test"}'::jsonb,
      'Non-admin attempt'
    )
  $$,
  'P0001',
  'admin_required',
  'a normal authenticated user cannot propose merges'
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);

select lives_ok(
  $$
    select public.propose_collectible_identity_merge(
      'b0000000-0000-4000-8000-000000000011'::uuid,
      'b0000000-0000-4000-8000-000000000012'::uuid,
      '{"source":"step3-test","reviewed":true}'::jsonb,
      'Reversible Step 3 integration test'
    )
  $$,
  'an administrator can propose a reviewed merge'
);
select set_config(
  'identity_test.merge_proposal_id',
  (
    select id::text
    from public.identity_merge_proposals
    where source_collectible_id='b0000000-0000-4000-8000-000000000011'
      and status='pending'
  ),
  true
);
select lives_ok(
  format(
    'select public.resolve_collectible_identity_merge(%L::uuid,%L)',
    current_setting('identity_test.merge_proposal_id'),
    'accepted'
  ),
  'an administrator can accept the proposal'
);
select ok(
  exists(
    select 1
    from public.collectible_identities
    where id='b0000000-0000-4000-8000-000000000011'
      and identity_status='merged'
      and merged_into_id='b0000000-0000-4000-8000-000000000012'
  ),
  'accepted merge is a reversible alias, not a deleted row'
);
select is(
  (
    select count(*)
    from public.identity_merge_events
    where proposal_id=current_setting('identity_test.merge_proposal_id')::uuid
  ),
  2::bigint,
  'proposal and acceptance are both audited'
);
select throws_ok(
  format(
    'select public.propose_collectible_identity_merge(%L::uuid,%L::uuid,%L::jsonb,%L)',
    current_setting('identity_test.user1_unresolved_id'),
    current_setting('identity_test.user2_unresolved_id'),
    '{"source":"step3-cross-owner-test"}',
    'Cross-owner identities must stay isolated'
  ),
  'P0001',
  'cross_owner_merge_not_allowed',
  'an administrator cannot merge identities across owners'
);
select lives_ok(
  format(
    'select public.reverse_collectible_identity_merge(%L::uuid)',
    current_setting('identity_test.merge_proposal_id')
  ),
  'an accepted merge can be reversed'
);
select ok(
  exists(
    select 1
    from public.collectible_identities
    where id='b0000000-0000-4000-8000-000000000011'
      and identity_status='active'
      and merged_into_id is null
  ),
  'merge reversal restores the source identity'
);
select is(
  (
    select count(*)
    from public.identity_merge_events
    where proposal_id=current_setting('identity_test.merge_proposal_id')::uuid
  ),
  3::bigint,
  'merge reversal appends a third audit event'
);
select throws_ok(
  format(
    'select public.reverse_collectible_identity_merge(%L::uuid)',
    current_setting('identity_test.merge_proposal_id')
  ),
  'P0001',
  'merge_not_active',
  'a merge cannot be reversed twice'
);
select ok(
  not has_table_privilege('authenticated','public.identity_corrections','INSERT')
  and not has_table_privilege('authenticated','public.identity_corrections','UPDATE')
  and not has_table_privilege('authenticated','public.identity_corrections','DELETE'),
  'authenticated clients cannot mutate correction history directly'
);
select ok(
  not has_table_privilege('authenticated','public.identity_merge_events','INSERT')
  and not has_table_privilege('authenticated','public.identity_merge_events','UPDATE')
  and not has_table_privilege('authenticated','public.identity_merge_events','DELETE'),
  'authenticated clients cannot mutate merge history directly'
);

reset role;

select lives_ok(
  $$
    delete from auth.users
    where id='22222222-2222-4222-8222-222222222222'
  $$,
  'account deletion can cascade through owner-specific identities'
);
select is(
  (
    select count(*)
    from public.collectible_identities
    where owner_id='22222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'account deletion removes the deleted owner identities'
);
select ok(
  exists(
    select 1
    from public.collectible_identities
    where id='b0000000-0000-4000-8000-000000000012'
      and owner_id is null
  ),
  'account deletion preserves shared catalog identities'
);
select is(
  (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname in (
        'sealed_products',
        'collectible_identities',
        'identity_match_rule_versions',
        'collectible_provider_mappings',
        'identity_match_decisions',
        'identity_corrections',
        'identity_merge_proposals',
        'identity_merge_events'
      )
      and relation.relrowsecurity
  ),
  8::bigint,
  'every Step 3 Data API table has RLS enabled'
);
select ok(
  has_table_privilege('authenticated','public.collectible_identities','SELECT')
  and has_table_privilege('authenticated','public.identity_match_rule_versions','SELECT')
  and has_table_privilege('authenticated','public.identity_corrections','SELECT'),
  'authenticated Data API reads are granted explicitly and remain RLS-bound'
);
select is(
  (
    with recursive aliases(id,next_id,path,cycle) as (
      select id,merged_into_id,array[id],false
      from public.collectible_identities
      where merged_into_id is not null
      union all
      select identity.id,identity.merged_into_id,
        aliases.path||identity.id,
        identity.id=any(aliases.path)
      from aliases
      join public.collectible_identities identity on identity.id=aliases.next_id
      where aliases.next_id is not null and not aliases.cycle
    )
    select count(*) from aliases where cycle
  ),
  0::bigint,
  'no collectible identity alias cycle exists after reversal'
);

select * from finish();
rollback;
