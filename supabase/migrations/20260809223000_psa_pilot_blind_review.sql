-- Keep prospective condition annotation blind to the returned PSA label and
-- prevent one reviewer from reviewing the same physical evidence twice.

create or replace function public.grading_pilot_review_queue_service(
  p_kind text,
  p_limit integer,
  p_reviewer_key text
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
  if p_reviewer_key is null or char_length(p_reviewer_key)<20 then
    raise exception 'reviewer_key_required';
  end if;
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
            'side',capture.side,'storagePath',capture.private_storage_path
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
        and not exists(
          select 1 from grading_private.outcome_verification_reviews review
          where review.outcome_id=outcome.id
            and review.reviewer_key=p_reviewer_key
        )
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
        'identity',session.identity_snapshot,
        'captures',coalesce((
          select jsonb_agg(jsonb_build_object(
            'captureId',capture.id,'type',capture.capture_type,
            'side',capture.side,'storagePath',capture.private_storage_path
          ) order by capture.captured_at)
          from public.grading_captures capture
          where capture.scan_session_id=example.scan_session_id
            and capture.user_id=example.owner_id
        ),'[]'::jsonb),
        'reviewCount',(select count(*)
          from grading_private.annotation_reviews review
          where review.training_example_id=example.id),
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
        and not exists(
          select 1 from grading_private.annotation_reviews review
          where review.training_example_id=example.id
            and review.reviewer_key=p_reviewer_key
        )
      order by example.created_at
      limit bounded_limit
    ) queue;
  else
    raise exception 'invalid_pilot_queue_kind';
  end if;
  return result;
end $$;

revoke all on function public.grading_pilot_review_queue_service(text,integer,text)
  from public,anon,authenticated;
grant execute on function public.grading_pilot_review_queue_service(text,integer,text)
  to service_role;

revoke all on function public.grading_pilot_review_queue_service(text,integer)
  from public,anon,authenticated,service_role;
drop function public.grading_pilot_review_queue_service(text,integer);
