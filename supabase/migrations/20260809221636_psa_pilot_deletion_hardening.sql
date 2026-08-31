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

revoke all on function grading_private.delete_training_subject(uuid,text,text)
  from public,anon,authenticated;
grant execute on function grading_private.delete_training_subject(uuid,text,text)
  to service_role;
