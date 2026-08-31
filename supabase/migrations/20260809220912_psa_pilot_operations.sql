-- Operational controls for the prospective PSA instrumentation pilot. All
-- objects remain service-only in the unexposed grading_private schema.

alter table grading_private.model_registry
  drop constraint if exists model_registry_status_check,
  add constraint model_registry_status_check check (
    status in ('candidate','shadow','champion','retired','rejected','quarantined')
  );

alter table grading_private.training_examples
  drop constraint if exists training_examples_physical_card_id_owner_id_dataset_partit_fkey,
  add constraint training_examples_physical_card_partition_fkey
    foreign key (physical_card_id,owner_id,dataset_partition)
    references grading_private.physical_card_partitions(
      physical_card_id,owner_id,dataset_partition
    ) on update cascade on delete restrict;

create table if not exists grading_private.outcome_verification_reviews (
  id uuid primary key default gen_random_uuid(),
  outcome_id uuid not null,
  owner_id uuid not null,
  reviewer_key text not null check (char_length(reviewer_key) between 3 and 120),
  decision text not null check (decision in ('approve','reject')),
  returned_label_snapshot text not null,
  proof_sha256_snapshot text not null check (
    proof_sha256_snapshot ~ '^[a-f0-9]{64}$'
  ),
  certification_number_snapshot text not null,
  notes text check (notes is null or char_length(notes)<=2000),
  created_at timestamptz not null default now(),
  unique(outcome_id,reviewer_key),
  foreign key (outcome_id,owner_id)
    references public.grading_outcomes(id,user_id) on delete cascade
);

create table if not exists grading_private.dataset_manifest_examples (
  manifest_id uuid not null references grading_private.dataset_manifests(id) on delete restrict,
  example_id uuid references grading_private.training_examples(id) on delete set null,
  physical_card_id uuid not null,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  dataset_partition text not null check (
    dataset_partition in ('train','validation','calibration','test','external_holdout')
  ),
  label_snapshot jsonb not null check (jsonb_typeof(label_snapshot)='object'),
  cohort_snapshot jsonb not null check (jsonb_typeof(cohort_snapshot)='object'),
  created_at timestamptz not null default now(),
  primary key (manifest_id,source_hash),
  unique(manifest_id,physical_card_id)
);

create table if not exists grading_private.data_deletion_tombstones (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  physical_card_partition_key text not null,
  manifest_ids uuid[] not null default '{}',
  model_ids uuid[] not null default '{}',
  reason text not null,
  created_at timestamptz not null default now(),
  unique(source_hash,reason)
);

create table if not exists grading_private.data_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  storage_paths text[] not null default '{}',
  status text not null default 'pending' check (
    status in ('pending','processing','complete','failed')
  ),
  attempts integer not null default 0 check (attempts between 0 and 20),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status='complete' and completed_at is not null) or status<>'complete')
);

create table if not exists grading_private.pilot_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_key text not null,
  subject_hash text,
  object_type text not null,
  object_id text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);

alter table grading_private.outcome_verification_reviews enable row level security;
alter table grading_private.dataset_manifest_examples enable row level security;
alter table grading_private.data_deletion_tombstones enable row level security;
alter table grading_private.data_deletion_jobs enable row level security;
alter table grading_private.pilot_audit_events enable row level security;

create index if not exists outcome_reviews_outcome_idx
  on grading_private.outcome_verification_reviews(outcome_id,decision,created_at);
create index if not exists manifest_examples_physical_idx
  on grading_private.dataset_manifest_examples(physical_card_id,manifest_id);
create index if not exists deletion_jobs_status_idx
  on grading_private.data_deletion_jobs(status,created_at);
create index if not exists pilot_audit_event_idx
  on grading_private.pilot_audit_events(event_type,created_at desc);

create or replace function grading_private.delete_training_subject(
  p_scan_session_id uuid,
  p_reason text,
  p_actor_key text default 'consent-engine'
)
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
declare
  example grading_private.training_examples%rowtype;
  manifests uuid[];
  models uuid[];
  paths text[];
  subject_hash text;
  source_count integer;
begin
  select * into example
  from grading_private.training_examples
  where scan_session_id=p_scan_session_id
  for update;
  if example.id is null then return false; end if;

  select coalesce(array_agg(distinct membership.manifest_id),'{}'::uuid[])
  into manifests
  from grading_private.dataset_manifest_examples membership
  where membership.physical_card_id=example.physical_card_id;

  select coalesce(array_agg(distinct model.id),'{}'::uuid[])
  into models
  from grading_private.model_registry model
  where model.dataset_manifest_id=any(manifests);

  with affected_sources as (
    select example.source_hash
    union
    select membership.source_hash
    from grading_private.dataset_manifest_examples membership
    where membership.physical_card_id=example.physical_card_id
  )
  insert into grading_private.data_deletion_tombstones(
    source_hash,physical_card_partition_key,manifest_ids,model_ids,reason
  )
  select source_hash,example.physical_card_id::text,manifests,models,p_reason
  from affected_sources
  on conflict (source_hash,reason) do nothing;
  get diagnostics source_count=row_count;

  update grading_private.model_registry
  set status='quarantined'
  where id=any(models) and status not in ('retired','rejected');
  update grading_private.calibration_registry
  set validated=false
  where model_id=any(models) and validated;

  select coalesce(array_agg(capture.private_storage_path) filter (
    where capture.private_storage_path is not null
  ),'{}'::text[])
  into paths
  from public.grading_captures capture
  where capture.scan_session_id=p_scan_session_id;

  subject_hash:=encode(extensions.digest(
    example.owner_id::text || ':mica-research-deletion-v1','sha256'
  ),'hex');
  insert into grading_private.data_deletion_jobs(
    subject_hash,storage_paths,status,completed_at
  ) values(
    subject_hash,paths,
    case when cardinality(paths)=0 then 'complete' else 'pending' end,
    case when cardinality(paths)=0 then now() else null end
  );
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,subject_hash,object_type,object_id,details
  ) values(
    'training_subject_deleted',p_actor_key,subject_hash,'scan_session',
    p_scan_session_id::text,
    jsonb_build_object(
      'reason',p_reason,'manifestCount',cardinality(manifests),
      'modelsQuarantined',cardinality(models),'storageObjects',cardinality(paths),
      'sourceHashesTombstoned',source_count
    )
  );

  delete from grading_private.training_examples where id=example.id;
  return true;
end $$;

create or replace function grading_private.refresh_training_example(
  p_scan_session_id uuid,
  p_actor_key text default 'eligibility-engine'
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  session_row public.grading_scan_sessions%rowtype;
  consent_row public.grading_research_consents%rowtype;
  outcome_row public.grading_outcomes%rowtype;
  example_id uuid;
  current_review_status text;
  current_partition text:='unassigned';
  capture_count integer:=0;
  required_capture_count integer:=0;
  all_retained boolean:=false;
  latest_capture timestamptz;
  capture_manifest jsonb:='{}'::jsonb;
  capture_hash_material text:='';
  source_hash text;
  captured_before boolean:=false;
  cohort jsonb;
  label_snapshot jsonb:='{}'::jsonb;
  reasons text[]:='{}'::text[];
  eligibility text:='pending';
begin
  select * into session_row
  from public.grading_scan_sessions
  where id=p_scan_session_id;
  if session_row.id is null then return null; end if;

  select * into consent_row
  from public.grading_research_consents
  where user_id=session_row.user_id;
  if consent_row.user_id is null
    or not consent_row.consented
    or consent_row.revoked_at is not null
    or not consent_row.training_allowed
    or not consent_row.outcome_linkage_allowed
    or consent_row.consent_version<>'mica-grading-research-v2' then
    perform grading_private.delete_training_subject(
      p_scan_session_id,'consent_missing_or_revoked',p_actor_key
    );
    return null;
  end if;

  select * into outcome_row
  from public.grading_outcomes outcome
  where outcome.scan_session_id=p_scan_session_id
    and outcome.user_id=session_row.user_id
    and outcome.professional_grader='PSA'
  order by outcome.created_at desc
  limit 1;

  select count(*),
    count(distinct capture.capture_type) filter (
      where capture.capture_type in ('front','back','alternate_front','alternate_back')
    ),
    coalesce(bool_and(capture.retained_for_research),false),
    max(capture.captured_at),
    jsonb_build_object(
      'captures',coalesce(jsonb_agg(jsonb_build_object(
        'captureId',capture.id,'type',capture.capture_type,'side',capture.side,
        'imageHash',capture.image_hash,'capturedAt',capture.captured_at,
        'quality',capture.quality_measurements,'geometry',capture.geometry_measurements,
        'retained',capture.retained_for_research
      ) order by capture.captured_at),'[]'::jsonb),
      'captureCount',count(*),
      'requiredCaptureTypes',count(distinct capture.capture_type) filter (
        where capture.capture_type in ('front','back','alternate_front','alternate_back')
      )
    ),
    coalesce(string_agg(
      capture.capture_type || ':' || capture.image_hash,',' order by capture.capture_type,capture.image_hash
    ),'')
  into capture_count,required_capture_count,all_retained,latest_capture,
    capture_manifest,capture_hash_material
  from public.grading_captures capture
  where capture.scan_session_id=p_scan_session_id
    and capture.user_id=session_row.user_id;

  source_hash:=encode(extensions.digest(
    session_row.id::text || ':' || capture_hash_material || ':' ||
    coalesce(outcome_row.proof_sha256,'no-outcome-proof'),'sha256'
  ),'hex');
  cohort:=jsonb_build_object(
    'targetGrader','PSA',
    'name',coalesce(session_row.identity_snapshot->>'name',''),
    'set',coalesce(session_row.identity_snapshot->>'set',''),
    'collectorNumber',coalesce(session_row.identity_snapshot->>'number',''),
    'language',coalesce(session_row.identity_snapshot->>'language',''),
    'finish',coalesce(session_row.identity_snapshot->>'variant',''),
    'gradingMode',coalesce(session_row.identity_snapshot->>'gradingMode','')
  );
  if outcome_row.id is not null then
    label_snapshot:=jsonb_build_object(
      'outcomeId',outcome_row.id,'grader','PSA','kind',outcome_row.outcome_kind,
      'returnedLabel',outcome_row.returned_label,'returnedGrade',outcome_row.returned_grade,
      'qualifier',outcome_row.qualifier,'noGradeCode',outcome_row.no_grade_code,
      'verificationStatus',outcome_row.verification_status,
      'certificationNumber',outcome_row.certification_number,
      'proofSha256',outcome_row.proof_sha256
    );
  end if;

  if session_row.consent_mode<>'research'
    or session_row.consent_version<>'mica-grading-research-v2' then
    reasons:=array_append(reasons,'session_not_research_v2');
  end if;
  if coalesce(session_row.identity_snapshot->>'name','')=''
    or coalesce(session_row.identity_snapshot->>'set','')=''
    or coalesce(session_row.identity_snapshot->>'number','')=''
    or coalesce(session_row.identity_snapshot->>'language','')=''
    or coalesce(session_row.identity_snapshot->>'variant','')='' then
    reasons:=array_append(reasons,'exact_print_identity_incomplete');
  end if;
  if required_capture_count<4 then reasons:=array_append(reasons,'required_captures_missing'); end if;
  if capture_count=0 or not all_retained then reasons:=array_append(reasons,'research_captures_not_retained'); end if;
  if outcome_row.id is null then
    reasons:=array_append(reasons,'psa_outcome_missing');
  else
    if outcome_row.verification_status<>'independently_verified' then
      reasons:=array_append(reasons,'psa_outcome_not_independently_verified');
    end if;
    if outcome_row.proof_sha256 is null or outcome_row.proof_storage_path is null then
      reasons:=array_append(reasons,'psa_proof_missing');
    end if;
    if outcome_row.certification_number is null then
      reasons:=array_append(reasons,'psa_certification_missing');
    end if;
  end if;
  captured_before:=latest_capture is not null
    and outcome_row.submission_date is not null
    and latest_capture::date<=outcome_row.submission_date;
  if not captured_before then reasons:=array_append(reasons,'capture_not_proven_before_submission'); end if;

  insert into grading_private.physical_card_partitions(
    physical_card_id,owner_id,dataset_partition,assigned_by
  ) values(
    session_row.physical_card_id,session_row.user_id,'unassigned',p_actor_key
  ) on conflict (physical_card_id) do nothing;
  select dataset_partition into current_partition
  from grading_private.physical_card_partitions
  where physical_card_id=session_row.physical_card_id;

  select reviewer_status into current_review_status
  from grading_private.training_examples
  where scan_session_id=p_scan_session_id;
  current_review_status:=coalesce(current_review_status,'unreviewed');
  if current_review_status not in ('double_review','adjudicated') then
    reasons:=array_append(reasons,'annotation_review_incomplete');
  end if;
  if outcome_row.verification_status='rejected'
    or current_review_status='rejected' then eligibility:='excluded';
  elsif cardinality(reasons)=0 then eligibility:='eligible';
  else eligibility:='pending';
  end if;

  insert into grading_private.training_examples(
    physical_card_id,scan_session_id,outcome_id,owner_id,eligibility_status,
    exclusion_reasons,dataset_partition,cohort,label_snapshot,capture_manifest,
    source_hash,consent_version,captured_before_outcome,reviewer_status
  ) values(
    session_row.physical_card_id,session_row.id,outcome_row.id,session_row.user_id,
    eligibility,reasons,current_partition,cohort,label_snapshot,capture_manifest,
    source_hash,consent_row.consent_version,captured_before,current_review_status
  )
  on conflict (scan_session_id) do update set
    outcome_id=excluded.outcome_id,
    eligibility_status=excluded.eligibility_status,
    exclusion_reasons=excluded.exclusion_reasons,
    dataset_partition=excluded.dataset_partition,
    cohort=excluded.cohort,
    label_snapshot=excluded.label_snapshot,
    capture_manifest=excluded.capture_manifest,
    source_hash=excluded.source_hash,
    consent_version=excluded.consent_version,
    captured_before_outcome=excluded.captured_before_outcome,
    updated_at=now()
  returning id into example_id;

  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'training_example_refreshed',p_actor_key,'training_example',example_id::text,
    jsonb_build_object('eligibility',eligibility,'reasons',to_jsonb(reasons))
  );
  return example_id;
end $$;

create or replace function grading_private.record_outcome_verification_review(
  p_outcome_id uuid,
  p_reviewer_key text,
  p_decision text,
  p_notes text default null
)
returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  outcome_row public.grading_outcomes%rowtype;
  approvals integer;
  result_status text;
begin
  select * into outcome_row from public.grading_outcomes where id=p_outcome_id for update;
  if outcome_row.id is null then raise exception 'outcome_not_found'; end if;
  if outcome_row.professional_grader<>'PSA' then raise exception 'psa_outcome_required'; end if;
  if outcome_row.proof_sha256 is null or outcome_row.proof_storage_path is null
    or outcome_row.certification_number is null then
    raise exception 'proof_and_certification_required';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid_review_decision'; end if;

  insert into grading_private.outcome_verification_reviews(
    outcome_id,owner_id,reviewer_key,decision,returned_label_snapshot,
    proof_sha256_snapshot,certification_number_snapshot,notes
  ) values(
    outcome_row.id,outcome_row.user_id,p_reviewer_key,p_decision,
    outcome_row.returned_label,outcome_row.proof_sha256,
    outcome_row.certification_number,p_notes
  );

  if p_decision='reject' then result_status:='rejected';
  else
    select count(distinct review.reviewer_key) into approvals
    from grading_private.outcome_verification_reviews review
    where review.outcome_id=outcome_row.id and review.decision='approve'
      and review.returned_label_snapshot=outcome_row.returned_label
      and review.proof_sha256_snapshot=outcome_row.proof_sha256
      and review.certification_number_snapshot=outcome_row.certification_number;
    result_status:=case when approvals>=2 then 'independently_verified' else 'cert_verified' end;
  end if;
  update public.grading_outcomes set verification_status=result_status,updated_at=now()
  where id=outcome_row.id;
  perform grading_private.refresh_training_example(outcome_row.scan_session_id,p_reviewer_key);
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'outcome_verification_reviewed',p_reviewer_key,'grading_outcome',p_outcome_id::text,
    jsonb_build_object('decision',p_decision,'resultStatus',result_status)
  );
  return result_status;
end $$;

create or replace function grading_private.record_annotation_review(
  p_example_id uuid,
  p_reviewer_key text,
  p_review_round integer,
  p_decision text,
  p_labels jsonb
)
returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  example grading_private.training_examples%rowtype;
  reviewer_count integer;
  approval_count integer;
  distinct_labels integer;
  rejection_count integer;
  adjudication_count integer;
  result_status text;
begin
  select * into example from grading_private.training_examples
  where id=p_example_id for update;
  if example.id is null then raise exception 'training_example_not_found'; end if;
  if p_review_round not between 1 and 3 then raise exception 'invalid_review_round'; end if;
  if jsonb_typeof(p_labels)<>'object' then raise exception 'labels_must_be_object'; end if;
  if p_review_round=3 and p_decision<>'adjudicate' then
    raise exception 'round_three_requires_adjudication';
  end if;
  if exists(
    select 1 from grading_private.annotation_reviews
    where training_example_id=p_example_id and reviewer_key=p_reviewer_key
  ) then raise exception 'reviewer_must_be_independent'; end if;

  insert into grading_private.annotation_reviews(
    training_example_id,reviewer_key,review_round,decision,labels
  ) values(p_example_id,p_reviewer_key,p_review_round,p_decision,p_labels);

  select count(distinct reviewer_key),
    count(*) filter (where decision='approve'),
    count(distinct labels) filter (where decision='approve'),
    count(*) filter (where decision='reject'),
    count(*) filter (where decision='adjudicate')
  into reviewer_count,approval_count,distinct_labels,rejection_count,adjudication_count
  from grading_private.annotation_reviews
  where training_example_id=p_example_id;

  result_status:=case
    when rejection_count>0 then 'rejected'
    when adjudication_count>0 then 'adjudicated'
    when reviewer_count>=2 and approval_count>=2 and distinct_labels=1 then 'double_review'
    when reviewer_count>=1 then 'single_review'
    else 'unreviewed'
  end;
  update grading_private.training_examples
  set reviewer_status=result_status,updated_at=now()
  where id=p_example_id;
  perform grading_private.refresh_training_example(example.scan_session_id,p_reviewer_key);
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'annotation_reviewed',p_reviewer_key,'training_example',p_example_id::text,
    jsonb_build_object('round',p_review_round,'decision',p_decision,'resultStatus',result_status)
  );
  return result_status;
end $$;

create or replace function grading_private.assign_physical_card_partition(
  p_physical_card_id uuid,
  p_partition text,
  p_actor_key text
)
returns text
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_partition not in ('train','validation','calibration','test','external_holdout') then
    raise exception 'invalid_dataset_partition';
  end if;
  update grading_private.physical_card_partitions
  set dataset_partition=p_partition,assigned_at=now(),assigned_by=p_actor_key
  where physical_card_id=p_physical_card_id and dataset_partition='unassigned';
  if not found then raise exception 'partition_missing_or_already_frozen'; end if;
  update grading_private.training_examples
  set dataset_partition=p_partition,updated_at=now()
  where physical_card_id=p_physical_card_id;
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'physical_card_partition_assigned',p_actor_key,'physical_card',p_physical_card_id::text,
    jsonb_build_object('partition',p_partition)
  );
  return p_partition;
end $$;

create or replace function grading_private.freeze_dataset_manifest(
  p_version text,
  p_example_ids uuid[],
  p_actor_key text
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  manifest_id uuid:=gen_random_uuid();
  manifest_hash text;
  example_count integer;
  cohort_summary jsonb;
begin
  if p_version is null or char_length(p_version) not between 3 and 120 then
    raise exception 'invalid_manifest_version';
  end if;
  if cardinality(p_example_ids)=0 then raise exception 'manifest_is_empty'; end if;
  if exists(
    select 1 from unnest(p_example_ids) requested(id)
    left join grading_private.training_examples example on example.id=requested.id
    where example.id is null or example.eligibility_status<>'eligible'
      or example.dataset_partition='unassigned'
      or example.reviewer_status not in ('double_review','adjudicated')
      or not example.captured_before_outcome
  ) then raise exception 'manifest_contains_ineligible_example'; end if;
  if exists(
    select 1 from grading_private.training_examples example
    join grading_private.data_deletion_tombstones tombstone
      on tombstone.source_hash=example.source_hash
    where example.id=any(p_example_ids)
  ) then raise exception 'manifest_contains_deleted_source'; end if;

  select count(*),encode(extensions.digest(
    p_version || ':' || string_agg(
      example.source_hash || ':' || example.dataset_partition || ':' ||
      example.label_snapshot::text,'|' order by example.source_hash
    ),'sha256'
  ),'hex')
  into example_count,manifest_hash
  from grading_private.training_examples example
  where example.id=any(p_example_ids);
  if example_count<>cardinality(p_example_ids) then
    raise exception 'manifest_contains_duplicate_example_ids';
  end if;

  select coalesce(jsonb_object_agg(summary.cohort_key,summary.cases),'{}'::jsonb)
  into cohort_summary
  from (
    select example.cohort::text cohort_key,count(*) cases
    from grading_private.training_examples example
    where example.id=any(p_example_ids)
    group by example.cohort::text
    order by example.cohort::text
  ) summary;

  insert into grading_private.dataset_manifests(
    id,version,status,manifest_sha256,example_count,cohort_summary,frozen_at
  ) values(
    manifest_id,p_version,'frozen',manifest_hash,example_count,cohort_summary,now()
  );
  insert into grading_private.dataset_manifest_examples(
    manifest_id,example_id,physical_card_id,source_hash,dataset_partition,
    label_snapshot,cohort_snapshot
  )
  select manifest_id,example.id,example.physical_card_id,example.source_hash,
    example.dataset_partition,example.label_snapshot,example.cohort
  from grading_private.training_examples example
  where example.id=any(p_example_ids);
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'dataset_manifest_frozen',p_actor_key,'dataset_manifest',manifest_id::text,
    jsonb_build_object('version',p_version,'exampleCount',example_count,'sha256',manifest_hash)
  );
  return manifest_id;
end $$;

create or replace function grading_private.psa_pilot_dashboard()
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select jsonb_build_object(
    'targetExamples',100,
    'researchV2Sessions',(select count(*) from public.grading_scan_sessions
      where consent_mode='research' and consent_version='mica-grading-research-v2'),
    'proofAttachedOutcomes',(select count(*) from public.grading_outcomes
      where professional_grader='PSA' and verification_status='proof_attached'),
    'independentlyVerifiedOutcomes',(select count(*) from public.grading_outcomes
      where professional_grader='PSA' and verification_status='independently_verified'),
    'trainingExamples',(select count(*) from grading_private.training_examples),
    'eligibleExamples',(select count(*) from grading_private.training_examples
      where eligibility_status='eligible'),
    'pendingExamples',(select count(*) from grading_private.training_examples
      where eligibility_status='pending'),
    'excludedExamples',(select count(*) from grading_private.training_examples
      where eligibility_status='excluded'),
    'frozenManifests',(select count(*) from grading_private.dataset_manifests
      where status='frozen'),
    'pendingDeletionJobs',(select count(*) from grading_private.data_deletion_jobs
      where status in ('pending','failed')),
    'quarantinedModels',(select count(*) from grading_private.model_registry
      where status='quarantined'),
    'eligibilityProgress',round((select count(*) from grading_private.training_examples
      where eligibility_status='eligible')::numeric/100,4),
    'generatedAt',now()
  )
$$;

create or replace function grading_private.refresh_training_example_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  session_id uuid;
begin
  session_id:=case when tg_table_name='grading_captures'
    then coalesce(new.scan_session_id,old.scan_session_id)
    else coalesce(new.scan_session_id,old.scan_session_id) end;
  perform grading_private.refresh_training_example(session_id,'database-trigger');
  return coalesce(new,old);
end $$;

drop trigger if exists refresh_training_example_from_capture on public.grading_captures;
create trigger refresh_training_example_from_capture
after insert or update or delete on public.grading_captures
for each row execute function grading_private.refresh_training_example_trigger();
drop trigger if exists refresh_training_example_from_outcome on public.grading_outcomes;
create trigger refresh_training_example_from_outcome
after insert or update or delete on public.grading_outcomes
for each row execute function grading_private.refresh_training_example_trigger();

create or replace function grading_private.revoke_training_consent_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  session_id uuid;
begin
  if new.revoked_at is not null or not new.consented or not new.training_allowed then
    for session_id in
      select session.id from public.grading_scan_sessions session
      where session.user_id=new.user_id
    loop
      perform grading_private.delete_training_subject(
        session_id,'research_consent_revoked','database-trigger'
      );
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists revoke_private_training_on_consent on public.grading_research_consents;
create trigger revoke_private_training_on_consent
after update on public.grading_research_consents
for each row execute function grading_private.revoke_training_consent_trigger();

create or replace function grading_private.prevent_frozen_membership_change()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE'
    and old.example_id is not null and new.example_id is null
    and new.manifest_id=old.manifest_id
    and new.physical_card_id=old.physical_card_id
    and new.source_hash=old.source_hash
    and new.dataset_partition=old.dataset_partition
    and new.label_snapshot=old.label_snapshot
    and new.cohort_snapshot=old.cohort_snapshot then
    return new;
  end if;
  if exists(
    select 1 from grading_private.dataset_manifests manifest
    where manifest.id=coalesce(old.manifest_id,new.manifest_id)
      and manifest.status='frozen'
  ) then raise exception 'frozen_dataset_membership_is_immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists immutable_frozen_dataset_membership
  on grading_private.dataset_manifest_examples;
create trigger immutable_frozen_dataset_membership
before update or delete on grading_private.dataset_manifest_examples
for each row execute function grading_private.prevent_frozen_membership_change();

revoke all on all tables in schema grading_private from public,anon,authenticated;
revoke all on all functions in schema grading_private from public,anon,authenticated;
grant all on all tables in schema grading_private to service_role;
grant execute on all functions in schema grading_private to service_role;
