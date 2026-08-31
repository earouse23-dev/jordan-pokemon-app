-- Narrow service-role RPC facade used by the authenticated reviewer API. The
-- private schema itself remains unexposed and inaccessible to app users.

create or replace function public.grading_pilot_dashboard_service()
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$
  select grading_private.psa_pilot_dashboard()
$$;

create or replace function public.grading_pilot_review_queue_service(
  p_kind text,
  p_limit integer default 25
)
returns jsonb
language plpgsql
security invoker
set search_path=''
stable
as $$
declare
  bounded_limit integer:=least(100,greatest(1,coalesce(p_limit,25)));
  result jsonb;
begin
  if p_kind='outcome' then
    select coalesce(jsonb_agg(row_payload order by created_at),'[]'::jsonb)
    into result
    from (
      select outcome.created_at,jsonb_build_object(
        'kind','outcome',
        'outcomeId',outcome.id,
        'scanSessionId',outcome.scan_session_id,
        'returnedLabel',outcome.returned_label,
        'verificationStatus',outcome.verification_status,
        'certificationNumber',outcome.certification_number,
        'proofStoragePath',outcome.proof_storage_path,
        'proofSha256',outcome.proof_sha256,
        'submissionDate',outcome.submission_date,
        'returnDate',outcome.return_date,
        'identity',session.identity_snapshot,
        'captures',coalesce((
          select jsonb_agg(jsonb_build_object(
            'captureId',capture.id,'type',capture.capture_type,
            'side',capture.side,'storagePath',capture.private_storage_path,
            'imageHash',capture.image_hash,'quality',capture.quality_measurements,
            'geometry',capture.geometry_measurements
          ) order by capture.captured_at)
          from public.grading_captures capture
          where capture.scan_session_id=outcome.scan_session_id
            and capture.user_id=outcome.user_id
        ),'[]'::jsonb),
        'reviewCount',(select count(*)
          from grading_private.outcome_verification_reviews review
          where review.outcome_id=outcome.id)
      ) row_payload
      from public.grading_outcomes outcome
      join public.grading_scan_sessions session
        on session.id=outcome.scan_session_id and session.user_id=outcome.user_id
      where outcome.professional_grader='PSA'
        and outcome.verification_status in ('proof_attached','cert_verified')
        and outcome.proof_storage_path is not null
        and outcome.proof_sha256 is not null
        and outcome.certification_number is not null
      order by outcome.created_at
      limit bounded_limit
    ) queue;
  elsif p_kind='annotation' then
    select coalesce(jsonb_agg(row_payload order by created_at),'[]'::jsonb)
    into result
    from (
      select example.created_at,jsonb_build_object(
        'kind','annotation',
        'exampleId',example.id,
        'scanSessionId',example.scan_session_id,
        'physicalCardId',example.physical_card_id,
        'reviewerStatus',example.reviewer_status,
        'eligibilityStatus',example.eligibility_status,
        'exclusionReasons',to_jsonb(example.exclusion_reasons),
        'identity',session.identity_snapshot,
        'label',example.label_snapshot,
        'cohort',example.cohort,
        'captures',coalesce((
          select jsonb_agg(jsonb_build_object(
            'captureId',capture.id,'type',capture.capture_type,
            'side',capture.side,'storagePath',capture.private_storage_path,
            'imageHash',capture.image_hash,'quality',capture.quality_measurements,
            'geometry',capture.geometry_measurements
          ) order by capture.captured_at)
          from public.grading_captures capture
          where capture.scan_session_id=example.scan_session_id
            and capture.user_id=example.owner_id
        ),'[]'::jsonb),
        'reviews',coalesce((
          select jsonb_agg(jsonb_build_object(
            'round',review.review_round,'decision',review.decision,
            'labels',review.labels,'createdAt',review.created_at
          ) order by review.review_round)
          from grading_private.annotation_reviews review
          where review.training_example_id=example.id
        ),'[]'::jsonb)
      ) row_payload
      from grading_private.training_examples example
      join public.grading_scan_sessions session
        on session.id=example.scan_session_id and session.user_id=example.owner_id
      join public.grading_outcomes outcome on outcome.id=example.outcome_id
      where outcome.verification_status='independently_verified'
        and example.reviewer_status in ('unreviewed','single_review')
        and example.eligibility_status<>'deleted'
      order by example.created_at
      limit bounded_limit
    ) queue;
  else
    raise exception 'invalid_pilot_queue_kind';
  end if;
  return result;
end $$;

create or replace function public.grading_pilot_record_outcome_review_service(
  p_outcome_id uuid,
  p_reviewer_key text,
  p_decision text,
  p_notes text default null
)
returns text
language sql
security invoker
set search_path=''
as $$
  select grading_private.record_outcome_verification_review(
    p_outcome_id,p_reviewer_key,p_decision,p_notes
  )
$$;

create or replace function public.grading_pilot_record_annotation_review_service(
  p_example_id uuid,
  p_reviewer_key text,
  p_review_round integer,
  p_decision text,
  p_labels jsonb
)
returns text
language sql
security invoker
set search_path=''
as $$
  select grading_private.record_annotation_review(
    p_example_id,p_reviewer_key,p_review_round,p_decision,p_labels
  )
$$;

create or replace function public.grading_pilot_assign_partition_service(
  p_physical_card_id uuid,
  p_partition text,
  p_actor_key text
)
returns text
language sql
security invoker
set search_path=''
as $$
  select grading_private.assign_physical_card_partition(
    p_physical_card_id,p_partition,p_actor_key
  )
$$;

revoke all on function public.grading_pilot_dashboard_service()
  from public,anon,authenticated;
revoke all on function public.grading_pilot_review_queue_service(text,integer)
  from public,anon,authenticated;
revoke all on function public.grading_pilot_record_outcome_review_service(uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.grading_pilot_record_annotation_review_service(uuid,text,integer,text,jsonb)
  from public,anon,authenticated;
revoke all on function public.grading_pilot_assign_partition_service(uuid,text,text)
  from public,anon,authenticated;

grant execute on function public.grading_pilot_dashboard_service() to service_role;
grant execute on function public.grading_pilot_review_queue_service(text,integer) to service_role;
grant execute on function public.grading_pilot_record_outcome_review_service(uuid,text,text,text) to service_role;
grant execute on function public.grading_pilot_record_annotation_review_service(uuid,text,integer,text,jsonb) to service_role;
grant execute on function public.grading_pilot_assign_partition_service(uuid,text,text) to service_role;
