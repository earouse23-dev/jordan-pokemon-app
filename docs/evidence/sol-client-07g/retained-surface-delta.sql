-- CLIENT-07G additive retained-surface delta; apply after immutable 07F collector SQL.
-- Single local rehearsal transaction; hosted execution requires separate approval.
BEGIN;

-- Source: supabase/migrations/20260902130000_software_modes.sql
-- Step 6: make Collector, Investor, and Seller reversible display preferences.

update public.profiles
set preferences = jsonb_set(
  coalesce(preferences, '{}'::jsonb),
  '{softwareMode}',
  to_jsonb(
    case
      when preferences->>'collectorGoal' = 'selling'
        or preferences->>'experienceLevel' = 'professional' then 'seller'
      when preferences->>'collectorGoal' = 'trading' then 'investor'
      else 'collector'
    end
  ),
  true
)
where not coalesce(preferences, '{}'::jsonb) ? 'softwareMode';

alter table public.profiles
  drop constraint if exists profiles_software_mode_check;

alter table public.profiles
  add constraint profiles_software_mode_check
  check (
    coalesce(preferences->>'softwareMode', 'collector')
      in ('collector', 'investor', 'seller')
  );

create table if not exists public.software_mode_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  from_mode text not null
    check (from_mode in ('collector', 'investor', 'seller')),
  to_mode text not null
    check (to_mode in ('collector', 'investor', 'seller')),
  source text not null default 'settings'
    check (source in ('header', 'settings', 'onboarding', 'migration')),
  created_at timestamptz not null default now(),
  check (from_mode <> to_mode)
);

comment on table public.software_mode_events is
  'Owner-private, content-free evidence that a reversible display mode changed.';

create index if not exists software_mode_events_owner_created_idx
  on public.software_mode_events (user_id, created_at desc);

alter table public.software_mode_events enable row level security;

drop policy if exists software_mode_events_select_own
  on public.software_mode_events;
create policy software_mode_events_select_own
  on public.software_mode_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists software_mode_events_insert_own
  on public.software_mode_events;
create policy software_mode_events_insert_own
  on public.software_mode_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on table public.software_mode_events from anon, authenticated;
grant select, insert on table public.software_mode_events to authenticated;
grant usage, select on sequence public.software_mode_events_id_seq
  to authenticated;


-- Source: supabase/migrations/20260903120000_dependable_action_center.sql
-- Step 9: durable, owner-scoped actions and controlled notification delivery.
-- Decisions are deterministic and versioned. Optional email and web-push
-- channels remain off until a user opts in and a delivery adapter is configured.

create schema if not exists action_private;
revoke all on schema action_private from public,anon,authenticated;

create table if not exists public.notification_preferences(
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  web_push_enabled boolean not null default false,
  quiet_hours_enabled boolean not null default true,
  quiet_start time not null default '21:00',
  quiet_end time not null default '08:00',
  time_zone text not null default 'UTC' check(char_length(time_zone) between 1 and 100),
  daily_cap smallint not null default 5 check(daily_cap between 1 and 50),
  cooldown_hours smallint not null default 24 check(cooldown_hours between 1 and 720),
  muted_kinds text[] not null default '{}'::text[],
  thresholds jsonb not null default '{"priceMovePercent":10,"comparableMovePercent":10,"staleAfterHours":72,"inventoryAgingDays":180,"listingStaleDays":30,"gradingMinimumConfidence":0.8}'::jsonb,
  updated_at timestamptz not null default now(),
  check(cardinality(muted_kinds)<=10),
  check(jsonb_typeof(thresholds)='object' and pg_column_size(thresholds)<=4096)
);

create table if not exists public.action_items(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null check(char_length(action_key) between 10 and 700),
  kind text not null check(kind in(
    'watch_target','price_change','comparable_change','coverage_loss','stale_data',
    'collection_goal','grading_opportunity','grading_status','listing_review','inventory_aging'
  )),
  rule_version text not null check(char_length(rule_version) between 3 and 80),
  subject_type text not null check(char_length(subject_type) between 1 and 50),
  subject_id text not null check(char_length(subject_id) between 1 and 200),
  title text not null check(char_length(title) between 1 and 120),
  reason text not null check(char_length(reason) between 1 and 1000),
  source text not null check(char_length(source) between 1 and 120),
  observed_at timestamptz not null,
  confidence numeric(5,4) not null check(confidence between 0 and 1),
  suggested_action text not null check(char_length(suggested_action) between 1 and 300),
  destination jsonb not null check(
    jsonb_typeof(destination)='object'
    and destination->>'route' in('dashboard','collection','watchlist','goals','grading','listings','sales','settings')
    and pg_column_size(destination)<=4096
  ),
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object' and pg_column_size(evidence)<=32768),
  priority smallint not null default 5 check(priority between 1 and 10),
  status text not null default 'open' check(status in('open','snoozed','dismissed','completed')),
  snoozed_until timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check(occurrence_count between 1 and 1000000),
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,action_key),
  unique(id,user_id),
  check((status='snoozed' and snoozed_until is not null) or (status<>'snoozed' and snoozed_until is null))
);
create index if not exists action_items_owner_open_idx
  on public.action_items(user_id,priority,observed_at desc,id)
  where status in('open','snoozed');
create index if not exists action_items_owner_subject_idx
  on public.action_items(user_id,subject_type,subject_id,last_seen_at desc);

create table if not exists public.notification_delivery_records(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  kind text not null,
  channel text not null check(channel in('in_app','email','web_push')),
  idempotency_key text not null check(char_length(idempotency_key) between 10 and 900),
  status text not null default 'pending' check(status in('pending','processing','sent','failed','cancelled')),
  available_at timestamptz not null default now(),
  attempts smallint not null default 0 check(attempts between 0 and 5),
  worker_key text,
  lease_until timestamptz,
  provider_message_id text check(provider_message_id is null or char_length(provider_message_id)<=200),
  last_error_code text check(last_error_code is null or char_length(last_error_code)<=200),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(action_id,user_id) references public.action_items(id,user_id) on delete cascade,
  unique(user_id,idempotency_key),
  check((status='sent' and sent_at is not null) or status<>'sent')
);
create index if not exists notification_deliveries_due_idx
  on public.notification_delivery_records(available_at,created_at,id)
  where status in('pending','processing') and attempts<5;
create index if not exists notification_deliveries_owner_idx
  on public.notification_delivery_records(user_id,created_at desc,id);

create table if not exists public.action_audit_events(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid,
  event_type text not null check(event_type in(
    'created','refreshed','dismissed','snoozed','completed','reopened',
    'delivery_claimed','delivery_sent','delivery_failed','delivery_cancelled','preferences_updated'
  )),
  actor_type text not null check(actor_type in('user','rule_engine','delivery_worker')),
  actor_key text not null check(char_length(actor_key) between 3 and 120),
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object' and pg_column_size(details)<=8192),
  occurred_at timestamptz not null default now(),
  foreign key(action_id,user_id) references public.action_items(id,user_id) on delete cascade
);
create index if not exists action_audit_owner_idx
  on public.action_audit_events(user_id,occurred_at desc,id desc);

create table if not exists public.web_push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check(char_length(endpoint) between 20 and 2000 and endpoint like 'https://%'),
  p256dh text not null check(char_length(p256dh) between 40 and 200),
  auth_secret text not null check(char_length(auth_secret) between 10 and 100),
  user_agent text check(user_agent is null or char_length(user_agent)<=500),
  enabled boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,endpoint),
  unique(id,user_id)
);
create index if not exists web_push_subscriptions_owner_enabled_idx
  on public.web_push_subscriptions(user_id,enabled,updated_at desc);

alter table public.notification_preferences enable row level security;
alter table public.action_items enable row level security;
alter table public.notification_delivery_records enable row level security;
alter table public.action_audit_events enable row level security;
alter table public.web_push_subscriptions enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using((select auth.uid())=user_id);
create policy action_items_select_own on public.action_items
  for select to authenticated using((select auth.uid())=user_id);
create policy notification_delivery_records_select_own on public.notification_delivery_records
  for select to authenticated using((select auth.uid())=user_id);
create policy action_audit_events_select_own on public.action_audit_events
  for select to authenticated using((select auth.uid())=user_id);
create policy web_push_subscriptions_select_own on public.web_push_subscriptions
  for select to authenticated using((select auth.uid())=user_id);
create policy web_push_subscriptions_insert_own on public.web_push_subscriptions
  for insert to authenticated with check((select auth.uid())=user_id);
create policy web_push_subscriptions_update_own on public.web_push_subscriptions
  for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy web_push_subscriptions_delete_own on public.web_push_subscriptions
  for delete to authenticated using((select auth.uid())=user_id);

revoke all on public.notification_preferences,public.action_items,
  public.notification_delivery_records,public.action_audit_events,
  public.web_push_subscriptions from public,anon,authenticated;
grant select on public.notification_preferences,public.action_items,
  public.notification_delivery_records,public.action_audit_events,
  public.web_push_subscriptions to authenticated;
grant insert,update,delete on public.web_push_subscriptions to authenticated;
grant all on public.notification_preferences,public.action_items,
  public.notification_delivery_records,public.action_audit_events,
  public.web_push_subscriptions to service_role;
grant usage,select on sequence public.action_audit_events_id_seq to service_role;

create or replace function action_private.action_storage_key(
  p_kind text,p_subject_type text,p_subject_id text,p_occurrence text
)
returns text language sql immutable set search_path='' as $$
  select 'mica-actions-v1:'||
    regexp_replace(coalesce(p_kind,''),'[^A-Za-z0-9_.-]+','_','g')||':'||
    regexp_replace(coalesce(p_subject_type,'account'),'[^A-Za-z0-9_.-]+','_','g')||':'||
    regexp_replace(coalesce(p_subject_id,'account'),'[^A-Za-z0-9_.-]+','_','g')||':'||
    regexp_replace(coalesce(p_occurrence,'current'),'[^A-Za-z0-9_.-]+','_','g');
$$;

create or replace function action_private.enqueue_deliveries(
  p_action_id uuid,p_user_id uuid
)
returns void language plpgsql security definer set search_path='' as $$
declare
  target public.action_items%rowtype;
  preferences public.notification_preferences%rowtype;
begin
  select * into target from public.action_items
  where id=p_action_id and user_id=p_user_id and status='open';
  if not found then return; end if;
  select * into preferences from public.notification_preferences where user_id=p_user_id;
  if not found then
    insert into public.notification_preferences(user_id) values(p_user_id)
    on conflict(user_id) do nothing;
    select * into preferences from public.notification_preferences where user_id=p_user_id;
  end if;
  if not preferences.enabled or target.kind=any(preferences.muted_kinds) then return; end if;
  if preferences.in_app_enabled then
    insert into public.notification_delivery_records(
      user_id,action_id,kind,channel,idempotency_key,status,sent_at
    ) values(
      p_user_id,p_action_id,target.kind,'in_app',target.action_key||':in_app','sent',now()
    ) on conflict(user_id,idempotency_key) do nothing;
  end if;
  if preferences.email_enabled then
    insert into public.notification_delivery_records(
      user_id,action_id,kind,channel,idempotency_key,status
    ) values(
      p_user_id,p_action_id,target.kind,'email',target.action_key||':email','pending'
    ) on conflict(user_id,idempotency_key) do nothing;
  end if;
  if preferences.web_push_enabled then
    insert into public.notification_delivery_records(
      user_id,action_id,kind,channel,idempotency_key,status
    ) values(
      p_user_id,p_action_id,target.kind,'web_push',target.action_key||':web_push','pending'
    ) on conflict(user_id,idempotency_key) do nothing;
  end if;
end $$;

create or replace function action_private.upsert_action(
  p_user_id uuid,p_action jsonb,p_actor_key text default 'rule:mica-actions-v1'
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  target_id uuid;
  existing_id uuid;
  target_key text:=p_action->>'actionKey';
  target_kind text:=p_action->>'kind';
  target_destination jsonb:=p_action->'destination';
  target_evidence jsonb:=coalesce(p_action->'evidence','{}'::jsonb);
begin
  if p_user_id is null then raise exception 'owner_required'; end if;
  if jsonb_typeof(p_action)<>'object' then raise exception 'invalid_action'; end if;
  if target_kind not in(
    'watch_target','price_change','comparable_change','coverage_loss','stale_data',
    'collection_goal','grading_opportunity','grading_status','listing_review','inventory_aging'
  ) then raise exception 'invalid_action_kind'; end if;
  if char_length(coalesce(target_key,'')) not between 10 and 700 then raise exception 'invalid_action_key'; end if;
  if jsonb_typeof(target_destination)<>'object'
    or target_destination->>'route' not in('dashboard','collection','watchlist','goals','grading','listings','sales','settings')
  then raise exception 'invalid_action_destination'; end if;
  if jsonb_typeof(target_evidence)<>'object' or pg_column_size(target_evidence)>32768
  then raise exception 'invalid_action_evidence'; end if;
  select id into existing_id from public.action_items
  where user_id=p_user_id and action_key=target_key;
  insert into public.action_items(
    user_id,action_key,kind,rule_version,subject_type,subject_id,title,reason,
    source,observed_at,confidence,suggested_action,destination,evidence,priority
  ) values(
    p_user_id,target_key,target_kind,coalesce(nullif(p_action->>'ruleVersion',''),'mica-actions-v1'),
    coalesce(nullif(p_action#>>'{subject,type}',''),'account'),
    coalesce(nullif(p_action#>>'{subject,id}',''),'account'),
    left(p_action->>'title',120),left(p_action->>'reason',1000),
    left(p_action->>'source',120),(p_action->>'observedAt')::timestamptz,
    least(1,greatest(0,(p_action->>'confidence')::numeric)),
    left(p_action->>'suggestedAction',300),target_destination,target_evidence,
    least(10,greatest(1,coalesce((p_action->>'priority')::integer,5)))
  ) on conflict(user_id,action_key) do update set
    title=excluded.title,reason=excluded.reason,source=excluded.source,
    observed_at=excluded.observed_at,confidence=excluded.confidence,
    suggested_action=excluded.suggested_action,destination=excluded.destination,
    evidence=excluded.evidence,priority=excluded.priority,last_seen_at=now(),
    occurrence_count=least(public.action_items.occurrence_count+1,1000000),updated_at=now()
  returning id into target_id;
  insert into public.action_audit_events(
    user_id,action_id,event_type,actor_type,actor_key,details
  ) values(
    p_user_id,target_id,case when existing_id is null then 'created' else 'refreshed' end,
    'rule_engine',left(coalesce(nullif(p_actor_key,''),'rule:mica-actions-v1'),120),
    jsonb_build_object('kind',target_kind,'ruleVersion',coalesce(p_action->>'ruleVersion','mica-actions-v1'))
  );
  perform action_private.enqueue_deliveries(target_id,p_user_id);
  return target_id;
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  raise exception 'invalid_action_value';
end $$;

create or replace function public.save_notification_preferences(p_preferences jsonb)
returns public.notification_preferences
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid:=(select auth.uid());
  result public.notification_preferences%rowtype;
  requested_zone text:=coalesce(nullif(p_preferences->>'timeZone',''),'UTC');
  allowed_kinds constant text[]:=array[
    'watch_target','price_change','comparable_change','coverage_loss','stale_data',
    'collection_goal','grading_opportunity','grading_status','listing_review','inventory_aging'
  ];
  requested_muted text[];
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_preferences)<>'object' or pg_column_size(p_preferences)>8192 then
    raise exception 'invalid_notification_preferences';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=requested_zone) then
    raise exception 'invalid_time_zone';
  end if;
  select coalesce(array_agg(distinct value order by value),'{}'::text[])
  into requested_muted
  from jsonb_array_elements_text(
    case when jsonb_typeof(p_preferences->'mutedKinds')='array'
      then p_preferences->'mutedKinds'
      else '[]'::jsonb
    end
  ) value
  where value=any(allowed_kinds);
  insert into public.notification_preferences(
    user_id,enabled,in_app_enabled,email_enabled,web_push_enabled,
    quiet_hours_enabled,quiet_start,quiet_end,time_zone,daily_cap,cooldown_hours,
    muted_kinds,thresholds,updated_at
  ) values(
    owner_id,coalesce((p_preferences->>'enabled')::boolean,true),
    coalesce((p_preferences#>>'{channels,inApp}')::boolean,true),
    coalesce((p_preferences#>>'{channels,email}')::boolean,false),
    coalesce((p_preferences#>>'{channels,webPush}')::boolean,false),
    coalesce((p_preferences#>>'{quietHours,enabled}')::boolean,true),
    coalesce((p_preferences#>>'{quietHours,start}')::time,'21:00'),
    coalesce((p_preferences#>>'{quietHours,end}')::time,'08:00'),requested_zone,
    least(50,greatest(1,coalesce((p_preferences->>'dailyCap')::integer,5))),
    least(720,greatest(1,coalesce((p_preferences->>'cooldownHours')::integer,24))),
    requested_muted,
    coalesce(p_preferences->'thresholds','{"priceMovePercent":10,"comparableMovePercent":10,"staleAfterHours":72,"inventoryAgingDays":180,"listingStaleDays":30,"gradingMinimumConfidence":0.8}'::jsonb),now()
  ) on conflict(user_id) do update set
    enabled=excluded.enabled,in_app_enabled=excluded.in_app_enabled,
    email_enabled=excluded.email_enabled,web_push_enabled=excluded.web_push_enabled,
    quiet_hours_enabled=excluded.quiet_hours_enabled,quiet_start=excluded.quiet_start,
    quiet_end=excluded.quiet_end,time_zone=excluded.time_zone,daily_cap=excluded.daily_cap,
    cooldown_hours=excluded.cooldown_hours,muted_kinds=excluded.muted_kinds,
    thresholds=excluded.thresholds,updated_at=now()
  returning * into result;
  insert into public.action_audit_events(user_id,event_type,actor_type,actor_key,details)
  values(owner_id,'preferences_updated','user','user:self',jsonb_build_object(
    'enabled',result.enabled,'inApp',result.in_app_enabled,'email',result.email_enabled,
    'webPush',result.web_push_enabled,'dailyCap',result.daily_cap
  ));
  if not result.enabled or not result.email_enabled then
    update public.notification_delivery_records set status='cancelled',updated_at=now()
    where user_id=owner_id and channel='email' and status='pending';
  end if;
  if not result.enabled or not result.web_push_enabled then
    update public.notification_delivery_records set status='cancelled',updated_at=now()
    where user_id=owner_id and channel='web_push' and status='pending';
  end if;
  return result;
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  raise exception 'invalid_notification_preferences';
end $$;

create or replace function public.upsert_action_center_snapshot(p_actions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid:=(select auth.uid());
  entry jsonb;
  result jsonb:='[]'::jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_actions)<>'array' or jsonb_array_length(p_actions)>250 or pg_column_size(p_actions)>1048576
  then raise exception 'invalid_action_snapshot'; end if;
  for entry in select value from jsonb_array_elements(p_actions) loop
    result:=result||jsonb_build_array(action_private.upsert_action(owner_id,entry,'rule:browser'));
  end loop;
  return result;
end $$;

create or replace function public.transition_action_item(
  p_action_id uuid,p_transition text,p_snoozed_until timestamptz default null
)
returns text language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid:=(select auth.uid());
  next_status text;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_transition not in('dismiss','snooze','complete','reopen') then raise exception 'invalid_action_transition'; end if;
  next_status:=case p_transition when 'dismiss' then 'dismissed' when 'snooze' then 'snoozed' when 'complete' then 'completed' else 'open' end;
  if p_transition='snooze' and (p_snoozed_until is null or p_snoozed_until<=now()) then raise exception 'invalid_snooze'; end if;
  update public.action_items set
    status=next_status,snoozed_until=case when next_status='snoozed' then p_snoozed_until else null end,
    acted_at=case when next_status in('dismissed','completed') then now() else null end,updated_at=now()
  where id=p_action_id and user_id=owner_id;
  if not found then raise exception 'action_not_found'; end if;
  insert into public.action_audit_events(user_id,action_id,event_type,actor_type,actor_key)
  values(owner_id,p_action_id,case p_transition when 'dismiss' then 'dismissed' when 'snooze' then 'snoozed' when 'complete' then 'completed' else 'reopened' end,'user','user:self');
  if next_status in('dismissed','completed') then
    update public.notification_delivery_records set status='cancelled',updated_at=now()
    where action_id=p_action_id and user_id=owner_id and status='pending';
  elsif next_status='open' then
    perform action_private.enqueue_deliveries(p_action_id,owner_id);
  end if;
  return next_status;
end $$;

create or replace function public.materialize_action_center_service(
  p_worker_key text,p_limit integer default 100
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  candidate record;
  generated integer:=0;
  bounded_limit integer:=least(500,greatest(1,coalesce(p_limit,100)));
  stale_hours numeric;
  aging_days integer;
  listing_days integer;
  move_percent numeric;
begin
  if p_worker_key is null or char_length(p_worker_key) not between 10 and 120 then raise exception 'worker_key_required'; end if;

  for candidate in
    select goal.*,coalesce(preferences.thresholds,'{}'::jsonb) thresholds
    from public.collection_goals goal
    left join public.notification_preferences preferences on preferences.user_id=goal.user_id
    where goal.archived_at is null and goal.metadata_status='verified'
      and coalesce((goal.last_progress->>'complete')::boolean,false)
    order by goal.updated_at limit bounded_limit
  loop
    perform action_private.upsert_action(candidate.user_id,jsonb_build_object(
      'actionKey',action_private.action_storage_key('collection_goal','goal',candidate.id::text,'current-completion'),
      'kind','collection_goal','ruleVersion','mica-actions-v1',
      'subject',jsonb_build_object('type','goal','id',candidate.id),
      'title',left(candidate.name||' is complete',120),
      'reason','Verified owned variants now satisfy the saved goal definition.',
      'source',coalesce(candidate.catalog_source,'owned collection'),'observedAt',candidate.updated_at,
      'confidence',1,'suggestedAction','Review the exact completion evidence.',
      'destination',jsonb_build_object('route','goals','view',null,'id',candidate.id),
      'evidence',jsonb_build_object('catalogVersion',candidate.catalog_version,'progress',candidate.last_progress,'metadataStatus',candidate.metadata_status),
      'priority',2
    ),p_worker_key);
    generated:=generated+1; exit when generated>=bounded_limit;
  end loop;

  if generated<bounded_limit then
    for candidate in
      select submission.*,item.identity_snapshot
      from public.grading_submissions submission
      join public.collection_items item on item.id=submission.collection_item_id and item.user_id=submission.user_id
      order by submission.updated_at desc limit bounded_limit-generated
    loop
      perform action_private.upsert_action(candidate.user_id,jsonb_build_object(
        'actionKey',action_private.action_storage_key('grading_status','grading_submission',candidate.id::text,candidate.status),
        'kind','grading_status','ruleVersion','mica-actions-v1',
        'subject',jsonb_build_object('type','grading_submission','id',candidate.id),
        'title','Grading submission is now '||replace(candidate.status,'_',' '),
        'reason','The saved submission status changed.',
        'source','grading submission record','observedAt',candidate.updated_at,
        'confidence',1,'suggestedAction','Open the submission timeline and review the next step.',
        'destination',jsonb_build_object('route','grading','view',null,'id',candidate.id),
        'evidence',jsonb_build_object('status',candidate.status,'statusUpdatedAt',candidate.status_updated_at),
        'priority',2
      ),p_worker_key);
      generated:=generated+1; exit when generated>=bounded_limit;
    end loop;
  end if;

  if generated<bounded_limit then
    for candidate in
      select item.id,item.user_id,item.identity_snapshot,item.status,
        min(transaction.transaction_date) filter(where transaction.transaction_type in('purchase','trade_in')) acquired_at,
        coalesce((preferences.thresholds->>'inventoryAgingDays')::integer,180) threshold_days
      from public.collection_items item
      join public.collection_transactions transaction on transaction.collection_item_id=item.id and transaction.user_id=item.user_id
      left join public.notification_preferences preferences on preferences.user_id=item.user_id
      where item.status in('owned','listed')
      group by item.id,item.user_id,item.identity_snapshot,item.status,preferences.thresholds
      having min(transaction.transaction_date) filter(where transaction.transaction_type in('purchase','trade_in'))
        <=current_date-make_interval(days=>coalesce((preferences.thresholds->>'inventoryAgingDays')::integer,180))
      order by acquired_at limit bounded_limit-generated
    loop
      aging_days:=current_date-candidate.acquired_at;
      perform action_private.upsert_action(candidate.user_id,jsonb_build_object(
        'actionKey',action_private.action_storage_key('inventory_aging','position',candidate.id::text,'threshold_'||candidate.threshold_days),
        'kind','inventory_aging','ruleVersion','mica-actions-v1',
        'subject',jsonb_build_object('type','position','id',candidate.id),
        'title',left(coalesce(candidate.identity_snapshot->>'name','Collection item')||' reached your inventory-age threshold',120),
        'reason','This position has been held for '||aging_days||' days; the saved review threshold is '||candidate.threshold_days||' days.',
        'source','collection transaction history','observedAt',now(),
        'confidence',1,'suggestedAction','Review whether to hold, grade, reprice, or sell.',
        'destination',jsonb_build_object('route','collection','view',null,'id',candidate.id),
        'evidence',jsonb_build_object('heldDays',aging_days,'thresholdDays',candidate.threshold_days,'purchaseDate',candidate.acquired_at),
        'priority',5
      ),p_worker_key);
      generated:=generated+1; exit when generated>=bounded_limit;
    end loop;
  end if;

  if generated<bounded_limit then
    for candidate in
      select item.*,
        coalesce((preferences.thresholds->>'listingStaleDays')::integer,30) threshold_days
      from public.collection_items item
      left join public.notification_preferences preferences on preferences.user_id=item.user_id
      where item.status='listed' and (
        item.asking_price is null or item.listing_venue is null or item.listed_at is null
        or coalesce(item.price_reviewed_at,item.listed_at)<=current_date-make_interval(days=>coalesce((preferences.thresholds->>'listingStaleDays')::integer,30))
      ) order by item.updated_at limit bounded_limit-generated
    loop
      perform action_private.upsert_action(candidate.user_id,jsonb_build_object(
        'actionKey',action_private.action_storage_key('listing_review','listing',candidate.id::text,'current'),
        'kind','listing_review','ruleVersion','mica-actions-v1',
        'subject',jsonb_build_object('type','listing','id',candidate.id),
        'title',left(coalesce(candidate.identity_snapshot->>'name','Listing')||' needs review',120),
        'reason',concat_ws(' · ',case when candidate.asking_price is null then 'asking price missing' end,case when candidate.listing_venue is null then 'listing venue missing' end,case when candidate.listed_at is null then 'listing date missing' end,case when coalesce(candidate.price_reviewed_at,candidate.listed_at)<=current_date-make_interval(days=>candidate.threshold_days) then 'price review is stale' end),
        'source','saved listing state','observedAt',candidate.updated_at,
        'confidence',1,'suggestedAction','Repair the listing details before relying on it.',
        'destination',jsonb_build_object('route','listings','view',null,'id',candidate.id),
        'evidence',jsonb_strip_nulls(jsonb_build_object('askingPrice',candidate.asking_price,'venue',candidate.listing_venue,'listedAt',candidate.listed_at,'reviewedAt',candidate.price_reviewed_at,'thresholdDays',candidate.threshold_days)),
        'priority',3
      ),p_worker_key);
      generated:=generated+1; exit when generated>=bounded_limit;
    end loop;
  end if;

  if generated<bounded_limit then
    for candidate in
      select watch.*,observation.amount,observation.provider,observation.observed_at,
        coalesce((preferences.thresholds->>'staleAfterHours')::numeric,72) stale_hours
      from public.card_watchlist watch
      left join public.notification_preferences preferences on preferences.user_id=watch.user_id
      join lateral(
        select coalesce(price.market_price,price.last_sold_price,price.price_mid,price.price_low,price.price_high,price.listing_price) amount,
          price.provider,price.observed_at
        from public.price_observations price
        where price.card_id=watch.card_id
          and (watch.variant_id is null or price.card_variant_id=watch.variant_id)
          and price.card_state=watch.card_state
          and coalesce(price.raw_condition,'')=coalesce(watch.raw_condition,'')
          and coalesce(price.grader,'')=coalesce(watch.grader,'')
          and coalesce(price.grade,-1)=coalesce(watch.grade,-1)
          and price.capability_status='live' and price.exclusion_status='included'
          and not price.anomalous and (price.expires_at is null or price.expires_at>now())
        order by price.observed_at desc,price.id desc limit 1
      ) observation on true
      where watch.target_price is not null and observation.amount<=watch.target_price
        and observation.observed_at>=now()-make_interval(hours=>coalesce((preferences.thresholds->>'staleAfterHours')::integer,72))
      order by observation.observed_at desc limit bounded_limit-generated
    loop
      perform action_private.upsert_action(candidate.user_id,jsonb_build_object(
        'actionKey',action_private.action_storage_key('watch_target','watchlist',candidate.id::text,'target_'||candidate.target_price),
        'kind','watch_target','ruleVersion','mica-actions-v1',
        'subject',jsonb_build_object('type','watchlist','id',candidate.id),
        'title',left(coalesce(candidate.identity_snapshot->>'name','Watched item')||' reached your target',120),
        'reason','The verified matching price is at or below your saved '||candidate.currency||' target.',
        'source',candidate.provider,'observedAt',candidate.observed_at,
        'confidence',1,'suggestedAction','Review the exact variant and current market evidence.',
        'destination',jsonb_build_object('route','watchlist','view',null,'id',candidate.id),
        'evidence',jsonb_build_object('currency',candidate.currency,'currentPrice',candidate.amount,'targetPrice',candidate.target_price,'pricingStatus','live','provider',candidate.provider),
        'priority',1
      ),p_worker_key);
      generated:=generated+1; exit when generated>=bounded_limit;
    end loop;
  end if;

  if generated<bounded_limit then
    for candidate in
      with ranked as(
        select observation.*,item.identity_snapshot,
          coalesce((preferences.thresholds->>'priceMovePercent')::numeric,10) threshold_percent,
          row_number() over(partition by observation.collection_item_id order by observation.observed_at desc,observation.id desc) rank
        from public.position_price_observations observation
        join public.collection_items item on item.id=observation.collection_item_id and item.user_id=observation.user_id
        left join public.notification_preferences preferences on preferences.user_id=item.user_id
        where item.status in('owned','listed') and observation.capability_status='live'
          and observation.exclusion_status='included' and observation.evidence_kind='market_index'
          and observation.observed_at>=now()-interval '30 days'
      ),paired as(
        select current.user_id,current.collection_item_id,current.identity_snapshot,current.amount,
          current.observed_at,current.aggregator,current.threshold_percent,previous.amount previous_amount
        from ranked current join ranked previous on previous.collection_item_id=current.collection_item_id and previous.rank=2
        where current.rank=1 and previous.amount>0
      ) select *,((amount-previous_amount)/previous_amount)*100 movement_percent from paired
      where abs(((amount-previous_amount)/previous_amount)*100)>=threshold_percent
      order by observed_at desc limit bounded_limit-generated
    loop
      perform action_private.upsert_action(candidate.user_id,jsonb_build_object(
        'actionKey',action_private.action_storage_key('price_change','position',candidate.collection_item_id::text,candidate.observed_at::text||case when candidate.movement_percent>=0 then '_up' else '_down' end),
        'kind','price_change','ruleVersion','mica-actions-v1',
        'subject',jsonb_build_object('type','position','id',candidate.collection_item_id),
        'title',left(coalesce(candidate.identity_snapshot->>'name','Collection item')||' matching price moved '||round(abs(candidate.movement_percent),1)||'%',120),
        'reason','Verified matching price moved '||case when candidate.movement_percent>=0 then 'up' else 'down' end||' beyond your saved threshold.',
        'source',candidate.aggregator,'observedAt',candidate.observed_at,
        'confidence',1,'suggestedAction','Review the underlying observations before acting.',
        'destination',jsonb_build_object('route','collection','view',null,'id',candidate.collection_item_id),
        'evidence',jsonb_build_object('percent',candidate.movement_percent,'amount',candidate.amount,'previousAmount',candidate.previous_amount,'status','live'),
        'priority',2
      ),p_worker_key);
      generated:=generated+1; exit when generated>=bounded_limit;
    end loop;
  end if;

  update public.action_items set status='open',snoozed_until=null,updated_at=now()
  where status='snoozed' and snoozed_until<=now();
  return jsonb_build_object('generated',generated,'ruleVersion','mica-actions-v1');
end $$;

create or replace function public.claim_action_deliveries_service(
  p_worker_key text,p_limit integer default 25
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  result jsonb;
  bounded_limit integer:=least(100,greatest(1,coalesce(p_limit,25)));
begin
  if p_worker_key is null or char_length(p_worker_key) not between 10 and 120 then raise exception 'worker_key_required'; end if;
  with selected as(
    select delivery.id
    from public.notification_delivery_records delivery
    join public.action_items action on action.id=delivery.action_id and action.user_id=delivery.user_id
    join public.notification_preferences preferences on preferences.user_id=delivery.user_id
    where delivery.channel in('email','web_push') and delivery.attempts<5
      and ((delivery.status='pending' and delivery.available_at<=now())
        or (delivery.status='processing' and delivery.lease_until<now()))
      and action.status='open' and preferences.enabled
      and not action.kind=any(preferences.muted_kinds)
      and ((delivery.channel='email' and preferences.email_enabled)
        or (delivery.channel='web_push' and preferences.web_push_enabled))
      and not (
        preferences.quiet_hours_enabled and
        case when preferences.quiet_start<preferences.quiet_end then
          (now() at time zone preferences.time_zone)::time>=preferences.quiet_start
          and (now() at time zone preferences.time_zone)::time<preferences.quiet_end
        else
          (now() at time zone preferences.time_zone)::time>=preferences.quiet_start
          or (now() at time zone preferences.time_zone)::time<preferences.quiet_end
        end
      )
      and (select count(*) from public.notification_delivery_records sent
        where sent.user_id=delivery.user_id and sent.channel=delivery.channel and sent.status='sent'
          and (sent.sent_at at time zone preferences.time_zone)::date=(now() at time zone preferences.time_zone)::date
      )<preferences.daily_cap
    order by delivery.available_at,delivery.created_at
    for update of delivery skip locked limit bounded_limit
  ),claimed as(
    update public.notification_delivery_records delivery set
      status='processing',attempts=delivery.attempts+1,worker_key=p_worker_key,
      lease_until=now()+interval '5 minutes',last_error_code=null,updated_at=now()
    from selected where delivery.id=selected.id
    returning delivery.*
  ),audited as(
    insert into public.action_audit_events(user_id,action_id,event_type,actor_type,actor_key,details)
    select claimed.user_id,claimed.action_id,'delivery_claimed','delivery_worker',p_worker_key,
      jsonb_build_object('channel',claimed.channel,'attempt',claimed.attempts)
    from claimed returning id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'deliveryId',claimed.id,'recipientUserId',claimed.user_id,
    'recipientEmail',users.email,'channel',claimed.channel,
    'idempotencyKey',claimed.idempotency_key,
    'action',jsonb_build_object(
      'title',action.title,'reason',action.reason,'suggestedAction',action.suggested_action,
      'destination',action.destination
    )
  ) order by claimed.created_at),'[]'::jsonb) into result
  from claimed join public.action_items action on action.id=claimed.action_id
  join auth.users users on users.id=claimed.user_id;
  return result;
end $$;

create or replace function public.complete_action_delivery_service(
  p_delivery_id uuid,p_succeeded boolean,p_permanent boolean,
  p_provider_message_id text,p_error_code text,p_worker_key text
)
returns text language plpgsql security invoker set search_path='' as $$
declare
  target public.notification_delivery_records%rowtype;
  next_status text;
  retry_minutes integer;
begin
  if p_worker_key is null or char_length(p_worker_key) not between 10 and 120 then raise exception 'worker_key_required'; end if;
  select * into target from public.notification_delivery_records
  where id=p_delivery_id and status='processing' and worker_key=p_worker_key for update;
  if not found then raise exception 'delivery_not_claimed'; end if;
  next_status:=case when p_succeeded then 'sent' when p_permanent or target.attempts>=5 then 'failed' else 'pending' end;
  retry_minutes:=least(360,power(2,target.attempts)::integer*5);
  update public.notification_delivery_records set
    status=next_status,available_at=case when next_status='pending' then now()+make_interval(mins=>retry_minutes) else available_at end,
    lease_until=null,worker_key=null,provider_message_id=left(p_provider_message_id,200),
    last_error_code=case when p_succeeded then null else left(coalesce(p_error_code,'delivery_failed'),200) end,
    sent_at=case when p_succeeded then now() else null end,updated_at=now()
  where id=target.id;
  insert into public.action_audit_events(user_id,action_id,event_type,actor_type,actor_key,details)
  values(target.user_id,target.action_id,case when p_succeeded then 'delivery_sent' else 'delivery_failed' end,
    'delivery_worker',p_worker_key,jsonb_build_object('channel',target.channel,'attempt',target.attempts,'permanent',coalesce(p_permanent,false),'nextStatus',next_status));
  return next_status;
end $$;

revoke all on function public.save_notification_preferences(jsonb) from public,anon;
revoke all on function public.upsert_action_center_snapshot(jsonb) from public,anon;
revoke all on function public.transition_action_item(uuid,text,timestamptz) from public,anon;
grant execute on function public.save_notification_preferences(jsonb),
  public.upsert_action_center_snapshot(jsonb),
  public.transition_action_item(uuid,text,timestamptz) to authenticated;

revoke all on function public.materialize_action_center_service(text,integer),
  public.claim_action_deliveries_service(text,integer),
  public.complete_action_delivery_service(uuid,boolean,boolean,text,text,text)
  from public,anon,authenticated;
grant execute on function public.materialize_action_center_service(text,integer),
  public.claim_action_deliveries_service(text,integer),
  public.complete_action_delivery_service(uuid,boolean,boolean,text,text,text)
  to service_role;

revoke all on function action_private.action_storage_key(text,text,text,text),
  action_private.enqueue_deliveries(uuid,uuid),
  action_private.upsert_action(uuid,jsonb,text)
  from public,anon,authenticated;

comment on table public.action_items is
  'Owner-private, versioned deterministic recommendations with evidence and a working in-app destination.';
comment on table public.notification_delivery_records is
  'Idempotent delivery queue and receipt history. Recipient email is resolved transiently from Auth and is not copied here.';
comment on table public.web_push_subscriptions is
  'Owner-private web-push delivery material. The optional delivery adapter remains disabled until configured and verified.';


-- Source: supabase/migrations/20260819194052_withdraw_account_training_before_deletion.sql
-- Account erasure must use the same lineage-aware withdrawal path as an
-- individual research-consent withdrawal. Direct FK cascades would otherwise
-- remove examples without tombstoning sources or quarantining derived models.
create or replace function public.grading_withdraw_account_training_service(
  p_owner_id uuid,
  p_actor_key text
)
returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  subject record;
  removed integer:=0;
begin
  if p_owner_id is null then raise exception 'owner_id_required'; end if;
  if p_actor_key is null or char_length(p_actor_key) not between 10 and 120 then
    raise exception 'actor_key_required';
  end if;
  for subject in
    select example.scan_session_id
    from grading_private.training_examples example
    where example.owner_id=p_owner_id
    order by example.created_at,example.id
  loop
    if grading_private.delete_training_subject(
      subject.scan_session_id,'account_deleted',p_actor_key
    ) then
      removed:=removed+1;
    end if;
  end loop;
  return removed;
end $$;

revoke all on function public.grading_withdraw_account_training_service(uuid,text)
  from public,anon,authenticated;
grant execute on function public.grading_withdraw_account_training_service(uuid,text)
  to service_role;


-- Source: supabase/migrations/20260819193524_preserve_confirmed_grading_reports.sql
create or replace function public.save_grading_scan_report(
  p_scan_session_id uuid,
  p_capture_metadata jsonb,
  p_prediction jsonb,
  p_evidence jsonb
) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid:=(select auth.uid());
  prediction_id uuid;
  capture_row jsonb;
  evidence_row jsonb;
  session_consent text;
  condition_state text;
  professional_state text;
  lifecycle_status text;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select consent_mode into session_consent from public.grading_scan_sessions
  where id=p_scan_session_id and user_id=owner_id for update;
  if not found then raise exception 'grading_session_not_found'; end if;

  select prediction.id into prediction_id
  from public.grading_predictions prediction
  where prediction.scan_session_id=p_scan_session_id
    and prediction.user_id=owner_id
    and prediction.estimate_status='confirmed'
  for update;
  if prediction_id is not null then return prediction_id; end if;

  condition_state:=case when p_prediction->>'conditionStatus'='estimate'
    then 'estimate' else 'abstained' end;
  professional_state:=case
    when p_prediction->>'professionalPredictionStatus'='validated' then 'validated'
    when p_prediction->>'professionalPredictionStatus'='abstained' then 'abstained'
    else 'unavailable' end;
  lifecycle_status:=case when condition_state='estimate' then 'estimate' else 'abstained' end;

  if jsonb_array_length(coalesce(p_capture_metadata,'[]'::jsonb))<4
    then raise exception 'four_views_required'; end if;

  delete from public.grading_evidence
  where scan_session_id=p_scan_session_id and user_id=owner_id;
  delete from public.grading_captures
  where scan_session_id=p_scan_session_id and user_id=owner_id;

  for capture_row in
    select value from jsonb_array_elements(coalesce(p_capture_metadata,'[]'::jsonb))
  loop
    if session_consent='normal' and capture_row->>'privateStoragePath' is not null
      then raise exception 'normal_scan_cannot_retain_image'; end if;
    insert into public.grading_captures(
      user_id,scan_session_id,capture_type,side,normalized_width,
      normalized_height,quality_measurements,geometry_measurements,image_hash,
      private_storage_path,retained_for_research
    ) values(
      owner_id,p_scan_session_id,capture_row->>'captureType',capture_row->>'side',
      (capture_row->>'width')::integer,(capture_row->>'height')::integer,
      coalesce(capture_row->'qualityMeasurements','{}'::jsonb),
      coalesce(capture_row->'geometryMeasurements','{}'::jsonb),
      capture_row->>'imageHash',capture_row->>'privateStoragePath',
      coalesce((capture_row->>'retainedForResearch')::boolean,false)
    );
  end loop;

  insert into public.grading_predictions(
    user_id,scan_session_id,collection_item_id,target_grader,
    pregrade_score,pregrade_basis,evidence_profile,outcome_risks,
    condition_score,condition_status,professional_prediction_status,
    most_likely_grade,grade_probabilities,condition_low,condition_high,
    subscores,centering_measurements,review_consensus,confidence,
    abstention_reason,model_bundle_version,rubric_version,calibration_version,
    estimate_status,stability,report_snapshot,submission_decision,
    financial_snapshot,card_family
  ) values(
    owner_id,p_scan_session_id,nullif(p_prediction->>'collectionItemId','')::uuid,'PSA',
    nullif(p_prediction->>'pregradeScore','')::numeric,
    coalesce(nullif(p_prediction->>'pregradeBasis',''),'insufficient_evidence'),
    coalesce(p_prediction->'evidenceProfile','{}'::jsonb),
    coalesce(p_prediction->'outcomeRisks','{}'::jsonb),
    case when condition_state='estimate' then nullif(p_prediction->>'conditionScore','')::numeric else null end,
    condition_state,professional_state,
    case when professional_state='validated' then nullif(p_prediction->>'mostLikelyGrade','')::numeric else null end,
    case when professional_state='validated' then coalesce(p_prediction->'probabilities','[]'::jsonb) else '[]'::jsonb end,
    case when condition_state='estimate' then nullif(p_prediction->>'conditionLow','')::numeric else null end,
    case when condition_state='estimate' then nullif(p_prediction->>'conditionHigh','')::numeric else null end,
    coalesce(p_prediction->'subscores','[]'::jsonb),
    coalesce(p_prediction->'centering','{}'::jsonb),
    coalesce(p_prediction->'consensus','{}'::jsonb),
    coalesce(nullif(p_prediction->>'confidence','')::numeric,0),
    nullif(p_prediction->>'abstentionReason',''),p_prediction->>'modelBundleVersion',
    p_prediction->>'rubricVersion',p_prediction->>'calibrationVersion',lifecycle_status,
    coalesce(p_prediction->'stability','{}'::jsonb),
    coalesce(p_prediction->'reportSnapshot','{}'::jsonb),
    coalesce(p_prediction->'submissionDecision','{}'::jsonb),
    coalesce(p_prediction->'financialSnapshot','{}'::jsonb),
    nullif(p_prediction->>'cardFamily','')
  )
  on conflict (scan_session_id) do update set
    collection_item_id=excluded.collection_item_id,
    pregrade_score=excluded.pregrade_score,
    pregrade_basis=excluded.pregrade_basis,
    evidence_profile=excluded.evidence_profile,
    outcome_risks=excluded.outcome_risks,
    condition_score=excluded.condition_score,
    condition_status=excluded.condition_status,
    professional_prediction_status=excluded.professional_prediction_status,
    most_likely_grade=excluded.most_likely_grade,
    grade_probabilities=excluded.grade_probabilities,
    condition_low=excluded.condition_low,condition_high=excluded.condition_high,
    subscores=excluded.subscores,centering_measurements=excluded.centering_measurements,
    review_consensus=excluded.review_consensus,confidence=excluded.confidence,
    abstention_reason=excluded.abstention_reason,
    model_bundle_version=excluded.model_bundle_version,rubric_version=excluded.rubric_version,
    calibration_version=excluded.calibration_version,estimate_status=excluded.estimate_status,
    stability=excluded.stability,report_snapshot=excluded.report_snapshot,
    submission_decision=excluded.submission_decision,
    financial_snapshot=excluded.financial_snapshot,card_family=excluded.card_family
  returning id into prediction_id;

  for evidence_row in
    select value from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb))
  loop
    insert into public.grading_evidence(
      user_id,scan_session_id,side,defect_category,region,severity,confidence,
      description,verification_status
    ) values(
      owner_id,p_scan_session_id,coalesce(nullif(evidence_row->>'side',''),'unknown'),
      coalesce(nullif(evidence_row->>'category',''),'other'),evidence_row->'region',
      coalesce(nullif(evidence_row->>'severity',''),'minor'),
      greatest(0,least(1,coalesce(nullif(evidence_row->>'confidence','')::numeric,0))),
      left(coalesce(nullif(evidence_row->>'evidence',''),'Visible finding requires review.'),500),
      coalesce(nullif(evidence_row->>'verificationStatus',''),'region_inferred')
    );
  end loop;

  update public.grading_scan_sessions
  set workflow_status=case when condition_state='estimate' then 'completed' else 'abstained' end,
      capture_progress=jsonb_build_object(
        'completedCaptureTypes',jsonb_build_array('front','back','alternate_front','alternate_back'),
        'nextCaptureType',null,'totalRequired',4,'pixelsStored',false,'updatedAt',now()
      ),
      completed_at=now(),updated_at=now(),error_code=null
  where id=p_scan_session_id and user_id=owner_id;
  return prediction_id;
end $$;

revoke all on function public.save_grading_scan_report(uuid,jsonb,jsonb,jsonb)
  from public,anon;
grant execute on function public.save_grading_scan_report(uuid,jsonb,jsonb,jsonb)
  to authenticated;

comment on column public.grading_predictions.pregrade_score is
  'One-decimal Mica pregrade. It is not a PSA-issued decimal label.';
comment on column public.grading_predictions.pregrade_basis is
  'Whether the decimal is a calibrated expected PSA outcome or visible-condition measurement.';

-- Existing service-only delivery claim reads recipient ID/email from Auth.
-- Grant only these columns to service_role; never to anon/authenticated.
grant select(id,email) on auth.users to service_role;
COMMIT;
