-- Claim/complete storage erasure jobs through service-only RPCs. Claims use
-- SKIP LOCKED so cron retries and manual runs cannot process one job twice.

create or replace function public.grading_pilot_claim_deletion_jobs_service(
  p_worker_key text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  result jsonb;
  bounded_limit integer:=least(25,greatest(1,coalesce(p_limit,10)));
begin
  if p_worker_key is null or char_length(p_worker_key) not between 10 and 120 then
    raise exception 'worker_key_required';
  end if;
  with selected as (
    select job.id
    from grading_private.data_deletion_jobs job
    where job.status in ('pending','failed') and job.attempts<20
    order by job.created_at
    for update skip locked
    limit bounded_limit
  ),claimed as (
    update grading_private.data_deletion_jobs job
    set status='processing',attempts=job.attempts+1,last_error=null
    from selected
    where job.id=selected.id
    returning job.id,job.subject_hash,job.storage_paths,job.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId',claimed.id,'subjectHash',claimed.subject_hash,
    'storagePaths',to_jsonb(claimed.storage_paths),'attempt',claimed.attempts
  ) order by claimed.id),'[]'::jsonb)
  into result from claimed;
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,details
  ) values(
    'deletion_jobs_claimed',p_worker_key,'data_deletion_job',
    jsonb_build_object('jobCount',jsonb_array_length(result))
  );
  return result;
end $$;

create or replace function public.grading_pilot_complete_deletion_job_service(
  p_job_id uuid,
  p_succeeded boolean,
  p_error text,
  p_worker_key text
)
returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  result_status text:=case when p_succeeded then 'complete' else 'failed' end;
begin
  if p_worker_key is null or char_length(p_worker_key) not between 10 and 120 then
    raise exception 'worker_key_required';
  end if;
  if p_error is not null and char_length(p_error)>1000 then
    raise exception 'deletion_error_too_long';
  end if;
  update grading_private.data_deletion_jobs
  set status=result_status,last_error=case when p_succeeded then null else p_error end,
    completed_at=case when p_succeeded then now() else null end
  where id=p_job_id and status='processing';
  if not found then raise exception 'deletion_job_not_processing'; end if;
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'deletion_job_completed',p_worker_key,'data_deletion_job',p_job_id::text,
    jsonb_build_object('status',result_status)
  );
  return result_status;
end $$;

revoke all on function public.grading_pilot_claim_deletion_jobs_service(text,integer)
  from public,anon,authenticated;
revoke all on function public.grading_pilot_complete_deletion_job_service(uuid,boolean,text,text)
  from public,anon,authenticated;
grant execute on function public.grading_pilot_claim_deletion_jobs_service(text,integer)
  to service_role;
grant execute on function public.grading_pilot_complete_deletion_job_service(uuid,boolean,text,text)
  to service_role;
