-- Evidence-first grading records. Photos remain transient unless a user has
-- separately accepted the versioned research consent.

alter table public.usage_events
  add column if not exists idempotency_key text;
create unique index if not exists usage_events_owner_event_idempotency_idx
  on public.usage_events(user_id,event_type,idempotency_key)
  where idempotency_key is not null;

create or replace function public.claim_ai_usage(
  p_user_id uuid,
  p_event_type text,
  p_maximum integer,
  p_window_seconds integer,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  window_start timestamptz;
  oldest_in_window timestamptz;
  usage_count integer;
  retry_after integer;
  normalized_key text := nullif(trim(coalesce(p_idempotency_key,'')),'');
begin
  if p_user_id is null then raise exception 'user_required'; end if;
  if p_event_type not in ('vision_analysis','portfolio_advisor') then
    raise exception 'invalid_event_type';
  end if;
  if p_maximum is null or p_maximum<1 or p_maximum>100 then
    raise exception 'invalid_rate_limit';
  end if;
  if p_window_seconds is null or p_window_seconds<60 or p_window_seconds>86400 then
    raise exception 'invalid_rate_window';
  end if;
  if normalized_key is not null and char_length(normalized_key) not between 8 and 200
    then raise exception 'invalid_idempotency_key'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text||':'||p_event_type,0)
  );
  if normalized_key is not null and exists (
    select 1 from public.usage_events
    where user_id=p_user_id and event_type=p_event_type
      and idempotency_key=normalized_key
  ) then
    return jsonb_build_object('allowed',true,'retryAfter',0,'reused',true);
  end if;

  window_start := clock_timestamp()-make_interval(secs=>p_window_seconds);
  delete from public.usage_events
  where user_id=p_user_id and event_type=p_event_type
    and occurred_at<clock_timestamp()-interval '7 days';
  select count(*),min(occurred_at)
  into usage_count,oldest_in_window
  from public.usage_events
  where user_id=p_user_id and event_type=p_event_type
    and occurred_at>=window_start;
  if usage_count>=p_maximum then
    retry_after := greatest(
      1,
      ceil(extract(epoch from (
        oldest_in_window+make_interval(secs=>p_window_seconds)-clock_timestamp()
      )))::integer
    );
    return jsonb_build_object('allowed',false,'retryAfter',retry_after,'reused',false);
  end if;
  insert into public.usage_events(user_id,event_type,quantity,idempotency_key)
  values(p_user_id,p_event_type,1,normalized_key);
  return jsonb_build_object('allowed',true,'retryAfter',0,'reused',false);
end $$;

revoke all on function public.claim_ai_usage(uuid,text,integer,integer,text)
  from public,anon,authenticated;
grant execute on function public.claim_ai_usage(uuid,text,integer,integer,text)
  to service_role;

create table if not exists public.grading_research_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consented boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (consented and consent_version is not null and consented_at is not null and revoked_at is null)
    or
    (not consented)
  )
);

create table if not exists public.grading_scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid,
  identity_snapshot jsonb not null default '{}'::jsonb,
  workflow_status text not null default 'capturing' check (
    workflow_status in (
      'capturing','analyzing','completed','abstained','failed','cancelled'
    )
  ),
  target_grader text not null default 'PSA' check (target_grader='PSA'),
  consent_mode text not null default 'normal' check (
    consent_mode in ('normal','research')
  ),
  consent_version text,
  model_bundle_version text not null,
  rubric_version text not null default 'mica-condition-rubric-v1',
  idempotency_key text not null check (
    char_length(idempotency_key) between 8 and 200
  ),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  unique(user_id,idempotency_key),
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id) on delete cascade,
  check (
    consent_mode='normal'
    or (consent_version is not null and char_length(consent_version)>0)
  )
);

create table if not exists public.grading_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_session_id uuid not null,
  capture_type text not null check (
    capture_type in (
      'front','back','alternate_front','alternate_back','corner_closeup',
      'edge_closeup','angled_surface'
    )
  ),
  side text not null check (side in ('front','back')),
  normalized_width integer not null check (normalized_width between 1 and 12000),
  normalized_height integer not null check (normalized_height between 1 and 12000),
  quality_measurements jsonb not null default '{}'::jsonb,
  geometry_measurements jsonb not null default '{}'::jsonb,
  image_hash text not null check (char_length(image_hash) between 32 and 128),
  private_storage_path text,
  retained_for_research boolean not null default false,
  captured_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id) on delete cascade,
  check (
    (retained_for_research and private_storage_path is not null)
    or
    (not retained_for_research and private_storage_path is null)
  )
);

create table if not exists public.grading_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_session_id uuid not null,
  source_capture_id uuid,
  side text not null check (side in ('front','back','unknown')),
  defect_category text not null check (
    defect_category in (
      'centering','corners','edges','surface','crease','dent','other'
    )
  ),
  region jsonb,
  severity text not null check (
    severity in ('minor','moderate','major','critical')
  ),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  description text not null check (char_length(description) between 1 and 500),
  verification_status text not null check (
    verification_status in (
      'localized','region_inferred','user_confirmed','rejected'
    )
  ),
  created_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id) on delete cascade,
  foreign key (source_capture_id,user_id)
    references public.grading_captures(id,user_id) on delete cascade,
  check (
    region is null
    or (
      jsonb_typeof(region)='object'
      and (region->>'x')::numeric between 0 and 1
      and (region->>'y')::numeric between 0 and 1
      and (region->>'width')::numeric > 0
      and (region->>'height')::numeric > 0
      and (region->>'x')::numeric+(region->>'width')::numeric <= 1.0001
      and (region->>'y')::numeric+(region->>'height')::numeric <= 1.0001
    )
  )
);

create table if not exists public.grading_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_session_id uuid not null,
  collection_item_id uuid,
  target_grader text not null default 'PSA' check (target_grader='PSA'),
  most_likely_grade numeric(4,1) check (
    most_likely_grade is null or most_likely_grade between 1 and 10
  ),
  grade_probabilities jsonb not null default '[]'::jsonb,
  condition_low numeric(4,1) check (
    condition_low is null or condition_low between 1 and 10
  ),
  condition_high numeric(4,1) check (
    condition_high is null or condition_high between 1 and 10
  ),
  subscores jsonb not null default '[]'::jsonb,
  centering_measurements jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  abstention_reason text,
  model_bundle_version text not null,
  rubric_version text not null,
  calibration_version text not null,
  estimate_status text not null check (
    estimate_status in ('estimate','abstained','confirmed','superseded')
  ),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,user_id),
  unique(scan_session_id),
  foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id) on delete cascade,
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id) on delete cascade,
  check (
    condition_low is null or condition_high is null
    or condition_low<=condition_high
  ),
  check (
    (estimate_status='abstained' and most_likely_grade is null and abstention_reason is not null)
    or
    (estimate_status<>'abstained' and most_likely_grade is not null)
  )
);

create table if not exists public.grading_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_session_id uuid not null,
  collection_item_id uuid,
  professional_grader text not null check (
    professional_grader in ('PSA','CGC','BGS','TAG','SGC','OTHER')
  ),
  returned_grade numeric(4,1) not null check (returned_grade between 1 and 10),
  submission_date date,
  return_date date,
  certification_number text,
  proof_storage_path text,
  verification_status text not null default 'user_reported' check (
    verification_status in ('user_reported','proof_attached','verified')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,scan_session_id,professional_grader),
  foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id) on delete cascade,
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id) on delete cascade,
  check (return_date is null or submission_date is null or return_date>=submission_date)
);

create table if not exists public.grading_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_session_id uuid not null,
  evidence_id uuid,
  feedback_type text not null check (
    feedback_type in (
      'accepted_finding','false_defect','missed_defect','capture_problem','other'
    )
  ),
  notes text check (notes is null or char_length(notes)<=1000),
  created_at timestamptz not null default now(),
  foreign key (scan_session_id,user_id)
    references public.grading_scan_sessions(id,user_id) on delete cascade,
  foreign key (evidence_id,user_id)
    references public.grading_evidence(id,user_id) on delete cascade
);

create index if not exists grading_sessions_owner_status_idx
  on public.grading_scan_sessions(user_id,workflow_status,updated_at desc);
create index if not exists grading_sessions_item_idx
  on public.grading_scan_sessions(collection_item_id,user_id,updated_at desc);
create index if not exists grading_captures_session_idx
  on public.grading_captures(scan_session_id,user_id,captured_at);
create index if not exists grading_evidence_session_idx
  on public.grading_evidence(scan_session_id,user_id,created_at);
create index if not exists grading_evidence_capture_idx
  on public.grading_evidence(source_capture_id,user_id);
create index if not exists grading_predictions_item_idx
  on public.grading_predictions(collection_item_id,user_id,created_at desc);
create unique index if not exists grading_predictions_one_confirmed_item_idx
  on public.grading_predictions(collection_item_id)
  where estimate_status='confirmed';
create index if not exists grading_outcomes_session_idx
  on public.grading_outcomes(scan_session_id,user_id);
create index if not exists grading_outcomes_item_idx
  on public.grading_outcomes(collection_item_id,user_id,created_at desc);
create index if not exists grading_feedback_session_idx
  on public.grading_feedback(scan_session_id,user_id,created_at desc);
create index if not exists grading_feedback_evidence_idx
  on public.grading_feedback(evidence_id,user_id);

alter table public.grading_research_consents enable row level security;
alter table public.grading_scan_sessions enable row level security;
alter table public.grading_captures enable row level security;
alter table public.grading_evidence enable row level security;
alter table public.grading_predictions enable row level security;
alter table public.grading_outcomes enable row level security;
alter table public.grading_feedback enable row level security;

create policy "grading consent own row" on public.grading_research_consents
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "grading sessions own rows" on public.grading_scan_sessions
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "grading captures own rows" on public.grading_captures
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "grading evidence own rows" on public.grading_evidence
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "grading predictions own rows" on public.grading_predictions
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "grading outcomes own rows" on public.grading_outcomes
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "grading feedback own rows" on public.grading_feedback
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

revoke all on public.grading_research_consents from public,anon;
revoke all on public.grading_scan_sessions from public,anon;
revoke all on public.grading_captures from public,anon;
revoke all on public.grading_evidence from public,anon;
revoke all on public.grading_predictions from public,anon;
revoke all on public.grading_outcomes from public,anon;
revoke all on public.grading_feedback from public,anon;
grant select,insert,update,delete on public.grading_research_consents to authenticated;
grant select,insert,update,delete on public.grading_scan_sessions to authenticated;
grant select,insert,update,delete on public.grading_captures to authenticated;
grant select,insert,update,delete on public.grading_evidence to authenticated;
grant select,insert,update,delete on public.grading_predictions to authenticated;
grant select,insert,update,delete on public.grading_outcomes to authenticated;
grant select,insert,update,delete on public.grading_feedback to authenticated;
grant all on public.grading_research_consents to service_role;
grant all on public.grading_scan_sessions to service_role;
grant all on public.grading_captures to service_role;
grant all on public.grading_evidence to service_role;
grant all on public.grading_predictions to service_role;
grant all on public.grading_outcomes to service_role;
grant all on public.grading_feedback to service_role;

create or replace function public.create_grading_scan_session(
  p_collection_item_id uuid,
  p_identity_snapshot jsonb,
  p_idempotency_key text,
  p_consent_mode text,
  p_consent_version text,
  p_model_bundle_version text
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  existing_id uuid;
  new_id uuid;
  requested_consent text := lower(coalesce(nullif(trim(p_consent_mode),''),'normal'));
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200
    then raise exception 'invalid_idempotency_key'; end if;
  if requested_consent not in ('normal','research')
    then raise exception 'invalid_consent_mode'; end if;
  if p_collection_item_id is not null and not exists (
    select 1 from public.collection_items
    where id=p_collection_item_id and user_id=owner_id and card_state='raw'
  ) then raise exception 'raw_position_not_found'; end if;
  if requested_consent='research' and not exists (
    select 1 from public.grading_research_consents
    where user_id=owner_id and consented
      and consent_version=p_consent_version and revoked_at is null
  ) then raise exception 'research_consent_required'; end if;

  select id into existing_id
  from public.grading_scan_sessions
  where user_id=owner_id and idempotency_key=p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  insert into public.grading_scan_sessions(
    user_id,collection_item_id,identity_snapshot,consent_mode,consent_version,
    model_bundle_version,idempotency_key
  ) values(
    owner_id,p_collection_item_id,coalesce(p_identity_snapshot,'{}'::jsonb),
    requested_consent,
    case when requested_consent='research' then p_consent_version else null end,
    p_model_bundle_version,p_idempotency_key
  ) returning id into new_id;
  return new_id;
end $$;

revoke all on function public.create_grading_scan_session(
  uuid,jsonb,text,text,text,text
) from public,anon;
grant execute on function public.create_grading_scan_session(
  uuid,jsonb,text,text,text,text
) to authenticated;

create or replace function public.save_grading_scan_report(
  p_scan_session_id uuid,
  p_capture_metadata jsonb,
  p_prediction jsonb,
  p_evidence jsonb
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  prediction_id uuid;
  session_consent text;
  report_status text;
  capture_row jsonb;
  evidence_row jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select consent_mode into session_consent
  from public.grading_scan_sessions
  where id=p_scan_session_id and user_id=owner_id
  for update;
  if session_consent is null then raise exception 'grading_session_not_found'; end if;
  if jsonb_typeof(coalesce(p_capture_metadata,'[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_evidence,'[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_prediction,'{}'::jsonb))<>'object'
    then raise exception 'invalid_grading_report'; end if;

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
      owner_id,p_scan_session_id,capture_row->>'captureType',
      capture_row->>'side',(capture_row->>'width')::integer,
      (capture_row->>'height')::integer,
      coalesce(capture_row->'qualityMeasurements','{}'::jsonb),
      coalesce(capture_row->'geometryMeasurements','{}'::jsonb),
      capture_row->>'imageHash',capture_row->>'privateStoragePath',
      coalesce((capture_row->>'retainedForResearch')::boolean,false)
    );
  end loop;

  report_status := case
    when p_prediction->>'status'='abstained' then 'abstained'
    else 'estimate'
  end;
  insert into public.grading_predictions(
    user_id,scan_session_id,collection_item_id,target_grader,most_likely_grade,
    grade_probabilities,condition_low,condition_high,subscores,
    centering_measurements,confidence,abstention_reason,model_bundle_version,
    rubric_version,calibration_version,estimate_status
  ) values(
    owner_id,p_scan_session_id,
    nullif(p_prediction->>'collectionItemId','')::uuid,'PSA',
    nullif(p_prediction->>'mostLikelyGrade','')::numeric,
    coalesce(p_prediction->'probabilities','[]'::jsonb),
    nullif(p_prediction->>'conditionLow','')::numeric,
    nullif(p_prediction->>'conditionHigh','')::numeric,
    coalesce(p_prediction->'subscores','[]'::jsonb),
    coalesce(p_prediction->'centering','{}'::jsonb),
    coalesce(nullif(p_prediction->>'confidence','')::numeric,0),
    nullif(p_prediction->>'abstentionReason',''),
    p_prediction->>'modelBundleVersion',
    p_prediction->>'rubricVersion',
    p_prediction->>'calibrationVersion',report_status
  )
  on conflict (scan_session_id) do update set
    most_likely_grade=excluded.most_likely_grade,
    grade_probabilities=excluded.grade_probabilities,
    condition_low=excluded.condition_low,
    condition_high=excluded.condition_high,
    subscores=excluded.subscores,
    centering_measurements=excluded.centering_measurements,
    confidence=excluded.confidence,
    abstention_reason=excluded.abstention_reason,
    model_bundle_version=excluded.model_bundle_version,
    rubric_version=excluded.rubric_version,
    calibration_version=excluded.calibration_version,
    estimate_status=excluded.estimate_status
  returning id into prediction_id;

  for evidence_row in
    select value from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb))
  loop
    insert into public.grading_evidence(
      user_id,scan_session_id,side,defect_category,region,severity,confidence,
      description,verification_status
    ) values(
      owner_id,p_scan_session_id,evidence_row->>'side',
      evidence_row->>'category',evidence_row->'region',
      evidence_row->>'severity',
      coalesce(nullif(evidence_row->>'confidence','')::numeric,0),
      evidence_row->>'evidence',evidence_row->>'verificationStatus'
    );
  end loop;

  update public.grading_scan_sessions
  set workflow_status=case when report_status='abstained' then 'abstained' else 'completed' end,
      completed_at=now(),updated_at=now(),error_code=null
  where id=p_scan_session_id and user_id=owner_id;
  return prediction_id;
end $$;

revoke all on function public.save_grading_scan_report(
  uuid,jsonb,jsonb,jsonb
) from public,anon;
grant execute on function public.save_grading_scan_report(
  uuid,jsonb,jsonb,jsonb
) to authenticated;

create or replace function public.confirm_grading_prediction(
  p_scan_session_id uuid,
  p_collection_item_id uuid
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  prediction_id uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.collection_items
    where id=p_collection_item_id and user_id=owner_id and card_state='raw'
  ) then raise exception 'raw_position_not_found'; end if;

  select id into prediction_id
  from public.grading_predictions
  where scan_session_id=p_scan_session_id and user_id=owner_id
    and estimate_status='estimate'
  for update;
  if prediction_id is null then raise exception 'prediction_not_confirmable'; end if;

  update public.grading_predictions
  set estimate_status='superseded'
  where user_id=owner_id and collection_item_id=p_collection_item_id
    and estimate_status='confirmed';
  update public.grading_predictions
  set collection_item_id=p_collection_item_id,estimate_status='confirmed',
      confirmed_at=now()
  where id=prediction_id and user_id=owner_id;
  update public.grading_scan_sessions
  set collection_item_id=p_collection_item_id,updated_at=now()
  where id=p_scan_session_id and user_id=owner_id;
  return prediction_id;
end $$;

revoke all on function public.confirm_grading_prediction(uuid,uuid)
  from public,anon;
grant execute on function public.confirm_grading_prediction(uuid,uuid)
  to authenticated;

-- A private bucket is created ahead of launch, but normal scans never write to it.
insert into storage.buckets(
  id,name,public,file_size_limit,allowed_mime_types
) values(
  'grading-research','grading-research',false,15728640,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "research captures own consented objects"
on storage.objects for insert to authenticated
with check (
  bucket_id='grading-research'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1 from public.grading_research_consents consent
    where consent.user_id=(select auth.uid())
      and consent.consented and consent.revoked_at is null
  )
);
create policy "research captures owners can read"
on storage.objects for select to authenticated
using (
  bucket_id='grading-research'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "research captures owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id='grading-research'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
