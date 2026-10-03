-- Review candidate: separate transaction before frozen CLIENT-07F and CLIENT-07G.
-- No hosted execution is authorized. Replaces only the shared function; preserves ACLs.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

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
  current_source_hash text;
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

  -- Session permission is independent of account permission; NULL fails closed.
  if session_row.consent_mode is distinct from 'research'
    or session_row.consent_version is distinct from 'mica-grading-research-v2' then
    perform grading_private.delete_training_subject(
      p_scan_session_id,'session_research_consent_missing',p_actor_key
    );
    return null;
  end if;

  select * into consent_row
  from public.grading_research_consents
  where user_id=session_row.user_id;
  if consent_row.user_id is null
    or consent_row.consented is distinct from true
    or consent_row.revoked_at is not null
    or consent_row.training_allowed is distinct from true
    or consent_row.outcome_linkage_allowed is distinct from true
    or consent_row.consent_version is distinct from 'mica-grading-research-v2' then
    perform grading_private.delete_training_subject(
      p_scan_session_id,'consent_missing_or_revoked',p_actor_key
    );
    return null;
  end if;

  -- Do not materialize even pending research metadata from unretained captures.
  if not exists (
    select 1 from public.grading_captures
    where scan_session_id=p_scan_session_id and user_id=session_row.user_id
  ) or exists (
    select 1 from public.grading_captures
    where scan_session_id=p_scan_session_id and user_id=session_row.user_id
      and retained_for_research is distinct from true
  ) then
    perform grading_private.delete_training_subject(
      p_scan_session_id,'research_captures_not_retained',p_actor_key
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

  current_source_hash:=encode(extensions.digest(
    session_row.id::text || ':' || capture_hash_material || ':' ||
    coalesce(outcome_row.proof_sha256,'no-outcome-proof'),'sha256'
  ),'hex');
  -- An unchanged deleted source cannot be reconstructed by a later caller.
  if exists (
    select 1 from grading_private.data_deletion_tombstones tombstone
    where tombstone.source_hash=current_source_hash
  ) then return null; end if;
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
    current_source_hash,consent_row.consent_version,captured_before,current_review_status
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

commit;
