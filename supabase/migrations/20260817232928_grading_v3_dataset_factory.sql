-- Freeze the complete V3 training lineage: human condition labels, card-only
-- capture evidence, reference-comparison gates, and actual PSA outcomes.
-- Every object remains service-only; no research artifact is exposed to users.

alter table grading_private.training_examples
  add column if not exists annotation_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists pipeline_snapshot jsonb not null default '{}'::jsonb;

alter table grading_private.training_examples
  drop constraint if exists training_examples_v3_snapshot_objects,
  add constraint training_examples_v3_snapshot_objects check (
    jsonb_typeof(annotation_snapshot)='object'
    and jsonb_typeof(pipeline_snapshot)='object'
  );

alter table grading_private.dataset_manifest_examples
  add column if not exists annotation_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists pipeline_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists capture_snapshot jsonb not null default '{}'::jsonb;

alter table grading_private.dataset_manifest_examples
  drop constraint if exists dataset_manifest_examples_v3_snapshot_objects,
  add constraint dataset_manifest_examples_v3_snapshot_objects check (
    jsonb_typeof(annotation_snapshot)='object'
    and jsonb_typeof(pipeline_snapshot)='object'
    and jsonb_typeof(capture_snapshot)='object'
  );

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
    and new.cohort_snapshot=old.cohort_snapshot
    and new.annotation_snapshot=old.annotation_snapshot
    and new.pipeline_snapshot=old.pipeline_snapshot
    and new.capture_snapshot=old.capture_snapshot then
    return new;
  end if;
  if exists(
    select 1 from grading_private.dataset_manifests manifest
    where manifest.id=case when tg_op='DELETE'
      then old.manifest_id else new.manifest_id end
      and manifest.status='frozen'
  ) then raise exception 'frozen_dataset_membership_is_immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create or replace function grading_private.resolved_annotation_snapshot(
  p_example_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  with adjudicated as (
    select review.labels,review.created_at
    from grading_private.annotation_reviews review
    where review.training_example_id=p_example_id
      and review.decision='adjudicate'
    order by review.created_at desc
    limit 1
  ), agreed as (
    select min(review.labels::text)::jsonb labels,max(review.created_at) created_at
    from grading_private.annotation_reviews review
    where review.training_example_id=p_example_id
      and review.decision='approve'
    group by grading_private.annotation_label_fingerprint(review.labels)
    having count(distinct review.reviewer_key)>=2
    order by max(review.created_at) desc
    limit 1
  )
  select coalesce(
    (select labels from adjudicated),
    (select labels from agreed),
    '{}'::jsonb
  )
$$;

create or replace function grading_private.sync_annotation_snapshot()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  example_id uuid:=coalesce(new.training_example_id,old.training_example_id);
begin
  update grading_private.training_examples example
  set annotation_snapshot=grading_private.resolved_annotation_snapshot(example_id),
      updated_at=now()
  where example.id=example_id;
  return coalesce(new,old);
end $$;

drop trigger if exists sync_v3_annotation_snapshot
  on grading_private.annotation_reviews;
create trigger sync_v3_annotation_snapshot
after insert or update or delete on grading_private.annotation_reviews
for each row execute function grading_private.sync_annotation_snapshot();

create or replace function grading_private.pipeline_snapshot_for_scan(
  p_scan_session_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select coalesce((
    select jsonb_build_object(
      'version','mica-training-pipeline-v3',
      'modelBundleVersion',prediction.model_bundle_version,
      'rubricVersion',prediction.rubric_version,
      'evidenceProfile',prediction.evidence_profile,
      'gradingWorkflow',coalesce(prediction.evidence_profile->'workflow','{}'::jsonb),
      'referenceComparison',coalesce(
        prediction.evidence_profile->'referenceComparison','{}'::jsonb
      ),
      'subscores',prediction.subscores,
      'centering',prediction.centering_measurements,
      'conditionLow',prediction.condition_low,
      'conditionHigh',prediction.condition_high,
      'conditionScore',prediction.condition_score,
      'professionalPredictionStatus',prediction.professional_prediction_status
    )
    from public.grading_predictions prediction
    where prediction.scan_session_id=p_scan_session_id
    order by prediction.created_at desc
    limit 1
  ),'{}'::jsonb)
$$;

create or replace function grading_private.sync_training_pipeline_snapshot()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  scan_id uuid:=coalesce(new.scan_session_id,old.scan_session_id);
begin
  update grading_private.training_examples example
  set pipeline_snapshot=grading_private.pipeline_snapshot_for_scan(scan_id),
      updated_at=now()
  where example.scan_session_id=scan_id;
  return coalesce(new,old);
end $$;

drop trigger if exists sync_v3_pipeline_from_prediction
  on public.grading_predictions;
create trigger sync_v3_pipeline_from_prediction
after insert or update on public.grading_predictions
for each row execute function grading_private.sync_training_pipeline_snapshot();

create or replace function grading_private.initialize_training_v3_snapshots()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  update grading_private.training_examples example
  set annotation_snapshot=grading_private.resolved_annotation_snapshot(new.id),
      pipeline_snapshot=grading_private.pipeline_snapshot_for_scan(new.scan_session_id),
      updated_at=now()
  where example.id=new.id;
  return new;
end $$;

drop trigger if exists initialize_v3_training_snapshots
  on grading_private.training_examples;
create trigger initialize_v3_training_snapshots
after insert on grading_private.training_examples
for each row execute function grading_private.initialize_training_v3_snapshots();

update grading_private.training_examples example
set annotation_snapshot=grading_private.resolved_annotation_snapshot(example.id),
    pipeline_snapshot=grading_private.pipeline_snapshot_for_scan(example.scan_session_id),
    updated_at=now();

create or replace function grading_private.capture_snapshot_for_example(
  p_example_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select jsonb_build_object(
    'captures',coalesce(jsonb_agg(jsonb_build_object(
      'captureId',capture.id,'type',capture.capture_type,'side',capture.side,
      'storagePath',capture.private_storage_path,'imageHash',capture.image_hash,
      'capturedAt',capture.captured_at,'quality',capture.quality_measurements,
      'geometry',capture.geometry_measurements
    ) order by capture.captured_at) filter (where capture.id is not null),'[]'::jsonb),
    'captureCount',count(capture.id),
    'requiredCaptureTypes',count(distinct capture.capture_type) filter (
      where capture.capture_type in (
        'front','back','alternate_front','alternate_back'
      )
      and capture.geometry_measurements->>'normalizedCropApplied'='true'
      and capture.geometry_measurements->>'backgroundExcluded'='true'
    )
  )
  from grading_private.training_examples example
  left join public.grading_captures capture
    on capture.scan_session_id=example.scan_session_id
    and capture.user_id=example.owner_id
    and capture.retained_for_research
    and capture.private_storage_path is not null
  where example.id=p_example_id
$$;

create or replace function grading_private.freeze_v3_dataset_manifest(
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
  if p_version is null or p_version!~'^mica-grading-v3-[a-z0-9._-]{3,96}$' then
    raise exception 'invalid_v3_manifest_version';
  end if;
  if cardinality(p_example_ids)=0 then raise exception 'manifest_is_empty'; end if;
  if exists(
    select 1 from unnest(p_example_ids) requested(id)
    left join grading_private.training_examples example on example.id=requested.id
    where example.id is null or example.eligibility_status<>'eligible'
      or example.dataset_partition='unassigned'
      or example.reviewer_status not in ('double_review','adjudicated')
      or not example.captured_before_outcome
      or example.annotation_snapshot='{}'::jsonb
      or example.pipeline_snapshot->'evidenceProfile'->>'version'
        is distinct from 'mica-evidence-profile-v3'
      or example.pipeline_snapshot->'gradingWorkflow'->>'complete'
        is distinct from 'true'
      or example.pipeline_snapshot->'referenceComparison'->>'status'
        is distinct from 'compared'
      or example.pipeline_snapshot->'referenceComparison'->>'exactIdentityMatch'
        is distinct from 'true'
      or nullif(
        example.pipeline_snapshot->'referenceComparison'->>'catalogCardId',''
      ) is null
      or coalesce((
        grading_private.capture_snapshot_for_example(example.id)
          ->>'requiredCaptureTypes'
      )::integer,0)<4
      or example.label_snapshot->>'grader' is distinct from 'PSA'
      or example.label_snapshot->>'verificationStatus'
        is distinct from 'independently_verified'
  ) then raise exception 'manifest_contains_incomplete_v3_example'; end if;
  if exists(
    select 1 from grading_private.training_examples example
    join grading_private.data_deletion_tombstones tombstone
      on tombstone.source_hash=example.source_hash
    where example.id=any(p_example_ids)
  ) then raise exception 'manifest_contains_deleted_source'; end if;
  if exists(
    select 1
    from grading_private.training_examples example
    where example.id=any(p_example_ids)
    group by example.physical_card_id
    having count(*)>1
  ) then raise exception 'manifest_contains_duplicate_physical_card'; end if;

  select count(*),encode(extensions.digest(
    p_version || ':' || string_agg(
      example.source_hash || ':' || example.dataset_partition || ':' ||
      example.label_snapshot::text || ':' || example.annotation_snapshot::text || ':' ||
      example.pipeline_snapshot::text || ':' ||
      grading_private.capture_snapshot_for_example(example.id)::text,
      '|' order by example.source_hash
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
    label_snapshot,cohort_snapshot,annotation_snapshot,pipeline_snapshot,
    capture_snapshot
  )
  select manifest_id,example.id,example.physical_card_id,example.source_hash,
    example.dataset_partition,example.label_snapshot,example.cohort,
    example.annotation_snapshot,example.pipeline_snapshot,
    grading_private.capture_snapshot_for_example(example.id)
  from grading_private.training_examples example
  where example.id=any(p_example_ids);
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'v3_dataset_manifest_frozen',p_actor_key,'dataset_manifest',manifest_id::text,
    jsonb_build_object(
      'version',p_version,'exampleCount',example_count,'sha256',manifest_hash,
      'includesHumanConditionLabels',true,'includesV3PipelineEvidence',true
    )
  );
  return manifest_id;
end $$;

create or replace function public.grading_v3_freeze_dataset_service(
  p_version text,
  p_example_ids uuid[],
  p_actor_key text
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select grading_private.freeze_v3_dataset_manifest(
    p_version,p_example_ids,p_actor_key
  )
$$;

create or replace function public.grading_v3_dataset_export_service(
  p_manifest_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=''
stable
as $$
declare
  manifest grading_private.dataset_manifests%rowtype;
  result jsonb;
begin
  select * into manifest from grading_private.dataset_manifests
  where id=p_manifest_id and status='frozen';
  if manifest.id is null then raise exception 'frozen_manifest_not_found'; end if;
  if exists(
    select 1 from grading_private.dataset_manifest_examples membership
    join grading_private.data_deletion_tombstones tombstone
      on tombstone.source_hash=membership.source_hash
    where membership.manifest_id=p_manifest_id
  ) or exists(
    select 1 from grading_private.dataset_manifest_examples membership
    where membership.manifest_id=p_manifest_id and membership.example_id is null
  ) then raise exception 'manifest_quarantined_by_deletion'; end if;

  select jsonb_build_object(
    'datasetManifestId',manifest.id,
    'version',manifest.version,
    'manifestSha256',manifest.manifest_sha256,
    'frozenAt',manifest.frozen_at,
    'exampleCount',manifest.example_count,
    'cohortSummary',manifest.cohort_summary,
    'examples',coalesce(jsonb_agg(jsonb_build_object(
      'physicalCardId',membership.physical_card_id,
      'sourceHash',membership.source_hash,
      'partition',membership.dataset_partition,
      'cohort',membership.cohort_snapshot,
      'professionalOutcome',membership.label_snapshot,
      'humanLabels',membership.annotation_snapshot,
      'pipelineEvidence',membership.pipeline_snapshot,
      'captures',coalesce(membership.capture_snapshot->'captures','[]'::jsonb)
    ) order by membership.source_hash),'[]'::jsonb)
  ) into result
  from grading_private.dataset_manifest_examples membership
  where membership.manifest_id=p_manifest_id;
  return result;
end $$;

create or replace function public.grading_v3_dataset_candidates_service(
  p_limit integer default 500
)
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  with eligible as (
    select example.id,example.physical_card_id,example.dataset_partition,
      example.eligibility_status,example.reviewer_status,
      example.annotation_snapshot->>'protocolVersion' annotation_protocol,
      example.pipeline_snapshot->'evidenceProfile'->>'version' evidence_version,
      coalesce((
        grading_private.capture_snapshot_for_example(example.id)
          ->>'requiredCaptureTypes'
      )::integer,0)
        required_capture_types,
      example.cohort,example.created_at
    from grading_private.training_examples example
    where example.eligibility_status='eligible'
      and example.dataset_partition<>'unassigned'
      and example.reviewer_status in ('double_review','adjudicated')
      and example.annotation_snapshot<>'{}'::jsonb
      and example.annotation_snapshot->>'protocolVersion'
        ='mica-psa-label-protocol-v1'
      and example.annotation_snapshot->>'identityConfirmed'='true'
      and example.annotation_snapshot->'evidence'->>'sufficient'='true'
      and example.pipeline_snapshot->'evidenceProfile'->>'version'
        ='mica-evidence-profile-v3'
      and example.pipeline_snapshot->'gradingWorkflow'->>'complete'='true'
      and example.pipeline_snapshot->'referenceComparison'->>'status'='compared'
      and example.pipeline_snapshot->'referenceComparison'->>'exactIdentityMatch'
        ='true'
      and nullif(
        example.pipeline_snapshot->'referenceComparison'->>'catalogCardId',''
      ) is not null
      and coalesce((
        grading_private.capture_snapshot_for_example(example.id)
          ->>'requiredCaptureTypes'
      )::integer,0)>=4
      and not exists(
        select 1 from grading_private.data_deletion_tombstones tombstone
        where tombstone.source_hash=example.source_hash
      )
  ), candidates as (
    select distinct on (physical_card_id) *
    from eligible
    order by physical_card_id,created_at
  ), limited as (
    select * from candidates order by created_at
    limit least(1000,greatest(1,coalesce(p_limit,500)))
  )
  select jsonb_build_object(
    'eligibleV3Examples',(select count(*) from limited),
    'eligiblePhysicalCards',(select count(*) from candidates),
    'partitions',coalesce((
      select jsonb_object_agg(dataset_partition,cases)
      from (
        select dataset_partition,count(*) cases
        from limited group by dataset_partition order by dataset_partition
      ) grouped
    ),'{}'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(jsonb_build_object(
        'exampleId',id,'physicalCardId',physical_card_id,
        'partition',dataset_partition,'reviewerStatus',reviewer_status,
        'annotationProtocol',annotation_protocol,'evidenceVersion',evidence_version,
        'requiredCaptureTypes',required_capture_types,'cohort',cohort
      ) order by created_at)
      from limited
    ),'[]'::jsonb)
  )
$$;

revoke all on function grading_private.resolved_annotation_snapshot(uuid)
  from public,anon,authenticated;
revoke all on function grading_private.prevent_frozen_membership_change()
  from public,anon,authenticated;
revoke all on function grading_private.sync_annotation_snapshot()
  from public,anon,authenticated;
revoke all on function grading_private.pipeline_snapshot_for_scan(uuid)
  from public,anon,authenticated;
revoke all on function grading_private.sync_training_pipeline_snapshot()
  from public,anon,authenticated;
revoke all on function grading_private.initialize_training_v3_snapshots()
  from public,anon,authenticated;
revoke all on function grading_private.capture_snapshot_for_example(uuid)
  from public,anon,authenticated;
revoke all on function grading_private.freeze_v3_dataset_manifest(text,uuid[],text)
  from public,anon,authenticated;
revoke all on function public.grading_v3_freeze_dataset_service(text,uuid[],text)
  from public,anon,authenticated;
revoke all on function public.grading_v3_dataset_export_service(uuid)
  from public,anon,authenticated;
revoke all on function public.grading_v3_dataset_candidates_service(integer)
  from public,anon,authenticated;
grant execute on function grading_private.resolved_annotation_snapshot(uuid)
  to service_role;
grant execute on function grading_private.pipeline_snapshot_for_scan(uuid)
  to service_role;
grant execute on function grading_private.capture_snapshot_for_example(uuid)
  to service_role;
grant execute on function grading_private.freeze_v3_dataset_manifest(text,uuid[],text)
  to service_role;
grant execute on function public.grading_v3_freeze_dataset_service(text,uuid[],text)
  to service_role;
grant execute on function public.grading_v3_dataset_export_service(uuid)
  to service_role;
grant execute on function public.grading_v3_dataset_candidates_service(integer)
  to service_role;
