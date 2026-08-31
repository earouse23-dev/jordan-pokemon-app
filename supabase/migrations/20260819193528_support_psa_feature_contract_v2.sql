-- Accept the runtime's V2 calibration feature contract while retaining V1\n-- artifacts during a controlled model transition.

alter table grading_private.calibration_registry
  add column if not exists artifact jsonb not null default '{}'::jsonb,
  add column if not exists active boolean not null default false,
  add column if not exists activated_at timestamptz;

alter table grading_private.calibration_registry
  drop constraint if exists calibration_registry_artifact_check,
  add constraint calibration_registry_artifact_check check (
    jsonb_typeof(artifact)='object'
  ),
  drop constraint if exists calibration_registry_activation_check,
  add constraint calibration_registry_activation_check check (
    not active or (
      validated
      and activated_at is not null
      and coalesce(artifact->>'version','')=calibration_version
      and coalesce(artifact->>'featureVersion','') in (
        'mica-psa-features-v1','mica-psa-features-v2'
      )
      and coalesce(artifact->>'validated','')='true'
      and jsonb_typeof(artifact->'coefficients')='array'
      and jsonb_array_length(artifact->'coefficients')=19
      and jsonb_typeof(artifact->'featureMeans')='array'
      and jsonb_array_length(artifact->'featureMeans')=18
      and jsonb_typeof(artifact->'featureScales')='array'
      and jsonb_array_length(artifact->'featureScales')=18
    )
  );

create unique index if not exists one_active_psa_calibration
  on grading_private.calibration_registry(active)
  where active;

create or replace function public.grading_active_calibration_service(
  p_cohort jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select calibration.artifact || jsonb_build_object(
    'version',calibration.calibration_version,
    'validated',calibration.validated,
    'cohortEligibility',calibration.cohort_eligibility,
    'requestedCohort',coalesce(p_cohort,'{}'::jsonb)
  )
  from grading_private.calibration_registry calibration
  join grading_private.model_registry model on model.id=calibration.model_id
  join grading_private.dataset_manifests manifest
    on manifest.id=calibration.dataset_manifest_id
  where calibration.active
    and calibration.validated
    and model.status='champion'
    and manifest.status='frozen'
  order by calibration.activated_at desc
  limit 1
$$;

create or replace function public.grading_activate_calibration_service(
  p_calibration_id uuid,
  p_actor_key text
)
returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  candidate grading_private.calibration_registry%rowtype;
  candidate_model grading_private.model_registry%rowtype;
  candidate_manifest grading_private.dataset_manifests%rowtype;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 10 and 120 then
    raise exception 'actor_key_required';
  end if;
  select * into candidate
  from grading_private.calibration_registry
  where id=p_calibration_id for update;
  if candidate.id is null then raise exception 'calibration_not_found'; end if;
  select * into candidate_model from grading_private.model_registry
  where id=candidate.model_id for update;
  select * into candidate_manifest from grading_private.dataset_manifests
  where id=candidate.dataset_manifest_id for update;
  if not candidate.validated
    or candidate.artifact->>'validated' is distinct from 'true'
    or candidate.artifact->>'version' is distinct from candidate.calibration_version
    or coalesce(candidate.artifact->>'featureVersion','') not in (
      'mica-psa-features-v1','mica-psa-features-v2'
    )
    or candidate_model.status<>'champion'
    or candidate_manifest.status<>'frozen' then
    raise exception 'calibration_not_eligible';
  end if;
  update grading_private.calibration_registry
  set active=false,activated_at=null
  where active and id<>candidate.id;
  update grading_private.calibration_registry
  set active=true,activated_at=now()
  where id=candidate.id;
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'calibration_activated',p_actor_key,'calibration',candidate.id::text,
    jsonb_build_object(
      'calibrationVersion',candidate.calibration_version,
      'datasetManifest',candidate.dataset_manifest_id,
      'modelVersion',candidate_model.model_version
    )
  );
  return candidate.calibration_version;
end $$;

create or replace function public.grading_register_calibration_service(
  p_calibration_version text,
  p_model_id uuid,
  p_dataset_manifest_id uuid,
  p_artifact_sha256 text,
  p_artifact jsonb,
  p_cohort_eligibility jsonb,
  p_metrics jsonb,
  p_actor_key text
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  candidate_id uuid;
  candidate_model grading_private.model_registry%rowtype;
  candidate_manifest grading_private.dataset_manifests%rowtype;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 10 and 120 then
    raise exception 'actor_key_required';
  end if;
  if p_calibration_version is null
    or char_length(p_calibration_version) not between 8 and 120
    or p_artifact_sha256 !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_artifact) is distinct from 'object'
    or p_artifact->>'validated' is distinct from 'true'
    or p_artifact->>'version' is distinct from p_calibration_version
    or coalesce(p_artifact->>'featureVersion','') not in (
      'mica-psa-features-v1','mica-psa-features-v2'
    )
    or jsonb_typeof(p_artifact->'coefficients') is distinct from 'array'
    or jsonb_array_length(p_artifact->'coefficients')<>19 then
    raise exception 'invalid_calibration_artifact';
  end if;
  select * into candidate_model from grading_private.model_registry
  where id=p_model_id;
  select * into candidate_manifest from grading_private.dataset_manifests
  where id=p_dataset_manifest_id;
  if candidate_model.id is null or candidate_model.status<>'champion'
    or candidate_model.dataset_manifest_id<>p_dataset_manifest_id
    or candidate_manifest.id is null or candidate_manifest.status<>'frozen' then
    raise exception 'calibration_lineage_not_eligible';
  end if;
  insert into grading_private.calibration_registry(
    calibration_version,model_id,dataset_manifest_id,artifact_sha256,
    cohort_eligibility,metrics,validated,artifact
  ) values(
    p_calibration_version,p_model_id,p_dataset_manifest_id,p_artifact_sha256,
    coalesce(p_cohort_eligibility,'{}'::jsonb),coalesce(p_metrics,'{}'::jsonb),
    true,p_artifact
  )
  returning id into candidate_id;
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'calibration_registered',p_actor_key,'calibration',candidate_id::text,
    jsonb_build_object(
      'calibrationVersion',p_calibration_version,
      'datasetManifest',p_dataset_manifest_id,
      'modelVersion',candidate_model.model_version,
      'artifactSha256',p_artifact_sha256
    )
  );
  return candidate_id;
end $$;

revoke all on function public.grading_active_calibration_service(jsonb)
  from public,anon,authenticated;
revoke all on function public.grading_activate_calibration_service(uuid,text)
  from public,anon,authenticated;
revoke all on function public.grading_register_calibration_service(
  text,uuid,uuid,text,jsonb,jsonb,jsonb,text
) from public,anon,authenticated;
grant execute on function public.grading_active_calibration_service(jsonb)
  to service_role;
grant execute on function public.grading_activate_calibration_service(uuid,text)
  to service_role;
grant execute on function public.grading_register_calibration_service(
  text,uuid,uuid,text,jsonb,jsonb,jsonb,text
) to service_role;
