-- Add privacy-safe capture/device tiers and reviewer-confirmed finish to the
-- cohort snapshot used for balance checks and immutable manifests.

create or replace function grading_private.enrich_training_example_cohort()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  identity jsonb:='{}'::jsonb;
  reviewed_labels jsonb;
begin
  select session.identity_snapshot into identity
  from public.grading_scan_sessions session
  where session.id=new.scan_session_id and session.user_id=new.owner_id;
  select review.labels into reviewed_labels
  from grading_private.annotation_reviews review
  where review.training_example_id=new.id
    and review.decision in ('adjudicate','approve')
  order by case when review.decision='adjudicate' then 0 else 1 end,
    review.review_round desc,review.created_at desc
  limit 1;
  update grading_private.training_examples example
  set cohort=example.cohort || jsonb_build_object(
    'finishClass',coalesce(
      nullif(reviewed_labels->>'finish',''),
      nullif(identity->>'finishClass',''),'unknown'
    ),
    'manufacturingEra',coalesce(nullif(identity->>'manufacturingEra',''),'unknown'),
    'designType',coalesce(nullif(identity->>'designType',''),'unknown'),
    'deviceClass',coalesce(
      nullif(example.capture_manifest#>>'{captures,0,quality,deviceClass}',''),'unknown'
    ),
    'deviceTier',coalesce(
      nullif(example.capture_manifest#>>'{captures,0,quality,evidenceResolutionTier}',''),'unknown'
    ),
    'captureMethod',coalesce(
      nullif(example.capture_manifest#>>'{captures,0,quality,captureMethod}',''),
      nullif(example.capture_manifest#>>'{captures,0,geometry,captureMethod}',''),
      'unknown'
    )
  ),updated_at=now()
  where example.id=new.id;
  return new;
end $$;

drop trigger if exists enrich_psa_training_cohort
  on grading_private.training_examples;
create trigger enrich_psa_training_cohort
after insert or update of capture_manifest,reviewer_status
on grading_private.training_examples
for each row execute function grading_private.enrich_training_example_cohort();

create or replace function grading_private.psa_pilot_cohort_balance()
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select jsonb_build_object(
    'finish',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(cohort->>'finishClass',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'language',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(cohort->>'language',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'manufacturingEra',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(cohort->>'manufacturingEra',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'designType',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(cohort->>'designType',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'deviceClass',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(cohort->>'deviceClass',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'deviceTier',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(cohort->>'deviceTier',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'captureMethod',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(cohort->>'captureMethod',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'returnedLabel',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
      from (select coalesce(nullif(label_snapshot->>'returnedLabel',''),'unknown') cohort_key,
        count(*) cases from grading_private.training_examples group by 1 order by 1) grouped),
    'reviewerStatus',(select coalesce(jsonb_object_agg(reviewer_status,cases),'{}'::jsonb)
      from (select reviewer_status,count(*) cases from grading_private.training_examples
        group by reviewer_status order by reviewer_status) grouped),
    'partition',(select coalesce(jsonb_object_agg(dataset_partition,cases),'{}'::jsonb)
      from (select dataset_partition,count(*) cases from grading_private.training_examples
        group by dataset_partition order by dataset_partition) grouped)
  )
$$;

create or replace function public.grading_pilot_dashboard_service()
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select grading_private.psa_pilot_dashboard()
    || jsonb_build_object('cohorts',grading_private.psa_pilot_cohort_balance())
$$;

revoke all on function grading_private.enrich_training_example_cohort()
  from public,anon,authenticated;
revoke all on function grading_private.psa_pilot_cohort_balance()
  from public,anon,authenticated;
grant execute on function grading_private.psa_pilot_cohort_balance() to service_role;
revoke all on function public.grading_pilot_dashboard_service()
  from public,anon,authenticated;
grant execute on function public.grading_pilot_dashboard_service() to service_role;
