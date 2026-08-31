-- Make instrumentation gaps visible before any dataset is frozen. Empty and
-- unknown cohorts stay explicit instead of being silently dropped.

create or replace function grading_private.psa_pilot_dashboard()
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select jsonb_build_object(
    'targetExamples',100,
    'targetRepeatGroups',20,
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
    'repeatGroups',(select count(*) from (
      select physical_card_id from grading_private.training_examples
      group by physical_card_id having count(*)>=2
    ) repeated),
    'frozenManifests',(select count(*) from grading_private.dataset_manifests
      where status='frozen'),
    'pendingDeletionJobs',(select count(*) from grading_private.data_deletion_jobs
      where status in ('pending','failed')),
    'quarantinedModels',(select count(*) from grading_private.model_registry
      where status='quarantined'),
    'eligibilityProgress',round((select count(*) from grading_private.training_examples
      where eligibility_status='eligible')::numeric/100,4),
    'cohorts',jsonb_build_object(
      'finish',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
        from (select coalesce(nullif(cohort->>'finish',''),'unknown') cohort_key,
          count(*) cases from grading_private.training_examples
          group by 1 order by 1) grouped),
      'language',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
        from (select coalesce(nullif(cohort->>'language',''),'unknown') cohort_key,
          count(*) cases from grading_private.training_examples
          group by 1 order by 1) grouped),
      'returnedLabel',(select coalesce(jsonb_object_agg(cohort_key,cases),'{}'::jsonb)
        from (select coalesce(nullif(label_snapshot->>'returnedLabel',''),'unknown') cohort_key,
          count(*) cases from grading_private.training_examples
          group by 1 order by 1) grouped),
      'reviewerStatus',(select coalesce(jsonb_object_agg(reviewer_status,cases),'{}'::jsonb)
        from (select reviewer_status,count(*) cases
          from grading_private.training_examples group by reviewer_status
          order by reviewer_status) grouped),
      'partition',(select coalesce(jsonb_object_agg(dataset_partition,cases),'{}'::jsonb)
        from (select dataset_partition,count(*) cases
          from grading_private.training_examples group by dataset_partition
          order by dataset_partition) grouped)
    ),
    'generatedAt',now()
  )
$$;

revoke all on function grading_private.psa_pilot_dashboard()
  from public,anon,authenticated;
grant execute on function grading_private.psa_pilot_dashboard() to service_role;
