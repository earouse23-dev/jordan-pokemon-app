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
