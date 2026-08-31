-- A confirmed report is historical evidence. An idempotent retry may return it,
-- but it must never downgrade or rewrite the prediction after confirmation.
create or replace function public.save_grading_scan_report(
  p_scan_session_id uuid,
  p_capture_metadata jsonb,
  p_prediction jsonb,
  p_evidence jsonb
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  prediction_id uuid;
  session_consent text;
  report_status text;
  capture_row jsonb;
  evidence_row jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select consent_mode into session_consent
  from public.grading_scan_sessions
  where id=p_scan_session_id and user_id=owner_id
  for update;
  if session_consent is null then raise exception 'grading_session_not_found'; end if;
  if jsonb_typeof(coalesce(p_capture_metadata,'[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_evidence,'[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_prediction,'{}'::jsonb))<>'object'
    then raise exception 'invalid_grading_report'; end if;

  select id into prediction_id
  from public.grading_predictions
  where scan_session_id=p_scan_session_id and user_id=owner_id
    and estimate_status='confirmed'
  for update;
  if prediction_id is not null then return prediction_id; end if;

  delete from public.grading_evidence
  where scan_session_id=p_scan_session_id and user_id=owner_id;
  delete from public.grading_captures
  where scan_session_id=p_scan_session_id and user_id=owner_id;

  for capture_row in
    select value from jsonb_array_elements(coalesce(p_capture_metadata,'[]'::jsonb))
  loop
    if session_consent='normal' and capture_row->>'privateStoragePath' is not null
      then raise exception 'normal_scan_cannot_retain_image'; end if;
    insert into public.grading_captures(
      user_id,scan_session_id,capture_type,side,normalized_width,
      normalized_height,quality_measurements,geometry_measurements,image_hash,
      private_storage_path,retained_for_research
    ) values(
      owner_id,p_scan_session_id,capture_row->>'captureType',
      capture_row->>'side',(capture_row->>'width')::integer,
      (capture_row->>'height')::integer,
      coalesce(capture_row->'qualityMeasurements','{}'::jsonb),
      coalesce(capture_row->'geometryMeasurements','{}'::jsonb),
      capture_row->>'imageHash',capture_row->>'privateStoragePath',
      coalesce((capture_row->>'retainedForResearch')::boolean,false)
    );
  end loop;

  report_status := case
    when p_prediction->>'status'='abstained' then 'abstained'
    else 'estimate'
  end;
  insert into public.grading_predictions(
    user_id,scan_session_id,collection_item_id,target_grader,most_likely_grade,
    grade_probabilities,condition_low,condition_high,subscores,
    centering_measurements,confidence,abstention_reason,model_bundle_version,
    rubric_version,calibration_version,estimate_status
  ) values(
    owner_id,p_scan_session_id,
    nullif(p_prediction->>'collectionItemId','')::uuid,'PSA',
    nullif(p_prediction->>'mostLikelyGrade','')::numeric,
    coalesce(p_prediction->'probabilities','[]'::jsonb),
    nullif(p_prediction->>'conditionLow','')::numeric,
    nullif(p_prediction->>'conditionHigh','')::numeric,
    coalesce(p_prediction->'subscores','[]'::jsonb),
    coalesce(p_prediction->'centering','{}'::jsonb),
    coalesce(nullif(p_prediction->>'confidence','')::numeric,0),
    nullif(p_prediction->>'abstentionReason',''),
    p_prediction->>'modelBundleVersion',
    p_prediction->>'rubricVersion',
    p_prediction->>'calibrationVersion',report_status
  )
  on conflict (scan_session_id) do update set
    most_likely_grade=excluded.most_likely_grade,
    grade_probabilities=excluded.grade_probabilities,
    condition_low=excluded.condition_low,
    condition_high=excluded.condition_high,
    subscores=excluded.subscores,
    centering_measurements=excluded.centering_measurements,
    confidence=excluded.confidence,
    abstention_reason=excluded.abstention_reason,
    model_bundle_version=excluded.model_bundle_version,
    rubric_version=excluded.rubric_version,
    calibration_version=excluded.calibration_version,
    estimate_status=excluded.estimate_status
  returning id into prediction_id;

  for evidence_row in
    select value from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb))
  loop
    insert into public.grading_evidence(
      user_id,scan_session_id,side,defect_category,region,severity,confidence,
      description,verification_status
    ) values(
      owner_id,p_scan_session_id,evidence_row->>'side',
      evidence_row->>'category',evidence_row->'region',
      evidence_row->>'severity',
      coalesce(nullif(evidence_row->>'confidence','')::numeric,0),
      evidence_row->>'evidence',evidence_row->>'verificationStatus'
    );
  end loop;

  update public.grading_scan_sessions
  set workflow_status=case when report_status='abstained' then 'abstained' else 'completed' end,
      completed_at=now(),updated_at=now(),error_code=null
  where id=p_scan_session_id and user_id=owner_id;
  return prediction_id;
end $$;

revoke all on function public.save_grading_scan_report(
  uuid,jsonb,jsonb,jsonb
) from public,anon;
grant execute on function public.save_grading_scan_report(
  uuid,jsonb,jsonb,jsonb
) to authenticated;
