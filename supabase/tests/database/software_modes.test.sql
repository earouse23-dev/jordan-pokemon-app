-- Step 6 integration gate for reversible display modes and owner isolation.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

select has_table('public','software_mode_events','mode event table exists');
select has_column('public','profiles','preferences','mode remains a profile preference');
select ok(
  (select relrowsecurity from pg_class where oid='public.software_mode_events'::regclass),
  'mode events have RLS enabled'
);
select ok(
  not has_table_privilege('anon','public.software_mode_events','SELECT')
  and not has_table_privilege('anon','public.software_mode_events','INSERT'),
  'anonymous users have no mode-event access'
);
select ok(
  has_table_privilege('authenticated','public.software_mode_events','SELECT')
  and has_table_privilege('authenticated','public.software_mode_events','INSERT')
  and not has_table_privilege('authenticated','public.software_mode_events','UPDATE')
  and not has_table_privilege('authenticated','public.software_mode_events','DELETE'),
  'owners can append and read but cannot rewrite mode history'
);

insert into auth.users(id,email) values
  ('61111111-1111-4111-8111-111111111111','mica-step6-user-1@example.invalid'),
  ('62222222-2222-4222-8222-222222222222','mica-step6-user-2@example.invalid');
insert into public.profiles(id,preferences) values
  ('61111111-1111-4111-8111-111111111111','{"softwareMode":"collector"}'::jsonb),
  ('62222222-2222-4222-8222-222222222222','{"softwareMode":"seller"}'::jsonb);
insert into public.collections(id,user_id,name) values
  (
    '63333333-3333-4333-8333-333333333333',
    '61111111-1111-4111-8111-111111111111',
    'One shared collection'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{}}',
  true
);

select lives_ok(
  $$insert into public.software_mode_events(from_mode,to_mode,source)
    values('collector','investor','settings')$$,
  'an owner can append a valid transition'
);
select is(
  (select count(*) from public.software_mode_events),
  1::bigint,
  'the owner reads its one transition'
);
select lives_ok(
  $$update public.profiles
    set preferences=jsonb_set(preferences,'{softwareMode}','"investor"'::jsonb)
    where id=auth.uid()$$,
  'the owner can reverse its saved display preference'
);
select is(
  (select preferences->>'softwareMode' from public.profiles where id=auth.uid()),
  'investor',
  'the selected mode persists on the same profile'
);
select is(
  (select count(*) from public.collections),
  1::bigint,
  'switching modes creates no duplicate collection'
);
select is(
  (select count(*) from public.software_mode_events),
  1::bigint,
  'saving the preference does not duplicate the event'
);

select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"62222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{}}',
  true
);
select is(
  (select count(*) from public.software_mode_events),
  0::bigint,
  'another owner cannot read the transition'
);
select throws_ok(
  $$insert into public.software_mode_events(user_id,from_mode,to_mode,source)
    values('61111111-1111-4111-8111-111111111111','investor','seller','header')$$,
  '42501',
  'new row violates row-level security policy for table "software_mode_events"',
  'another owner cannot forge a transition'
);
select throws_ok(
  $$insert into public.software_mode_events(from_mode,to_mode,source)
    values('seller','speculator','settings')$$,
  '23514',
  null,
  'unknown modes fail closed'
);

reset role;
delete from auth.users where id='61111111-1111-4111-8111-111111111111';
select is(
  (select count(*) from public.software_mode_events
    where user_id='61111111-1111-4111-8111-111111111111'),
  0::bigint,
  'account deletion removes mode history'
);

select * from finish();
rollback;
