-- Mica digital grading V2 keeps its decimal pregrade distinct from PSA's
-- discrete returned label and records the evidence basis behind the number.
alter table public.grading_predictions
  add column if not exists pregrade_score numeric(4,1),
  add column if not exists pregrade_basis text not null
    default 'visible_condition_measurement',
  add column if not exists evidence_profile jsonb not null default '{}'::jsonb,
  add column if not exists outcome_risks jsonb not null default '{}'::jsonb;

alter table public.grading_predictions
  drop constraint if exists grading_predictions_pregrade_score_check,
  add constraint grading_predictions_pregrade_score_check
    check (pregrade_score is null or pregrade_score between 1 and 10),
  drop constraint if exists grading_predictions_pregrade_basis_check,
  add constraint grading_predictions_pregrade_basis_check check (
    pregrade_basis in (
      'calibrated_expected_psa_outcome',
      'visible_condition_measurement',
      'insufficient_evidence'
    )
  ),
  drop constraint if exists grading_predictions_v2_documents,
  add constraint grading_predictions_v2_documents check (
    jsonb_typeof(evidence_profile)='object'
    and jsonb_typeof(outcome_risks)='object'
  );

update public.grading_predictions
set pregrade_score=condition_score,
    pregrade_basis='visible_condition_measurement'
where pregrade_score is null and condition_score is not null;

create or replace function public.save_grading_scan_report(
  p_scan_session_id uuid,
  p_capture_metadata jsonb,
  p_prediction jsonb,
  p_evidence jsonb
) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  owner_id uuid:=auth.uid();
  prediction_id uuid;
  capture_row jsonb;
  evidence_row jsonb;
  session_consent text;
  condition_state text;
  professional_state text;
  lifecycle_status text;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select consent_mode into session_consent from public.grading_scan_sessions
  where id=p_scan_session_id and user_id=owner_id for update;
  if not found then raise exception 'grading_session_not_found'; end if;

  condition_state:=case when p_prediction->>'conditionStatus'='estimate'
    then 'estimate' else 'abstained' end;
  professional_state:=case
    when p_prediction->>'professionalPredictionStatus'='validated' then 'validated'
    when p_prediction->>'professionalPredictionStatus'='abstained' then 'abstained'
    else 'unavailable' end;
  lifecycle_status:=case when condition_state='estimate' then 'estimate' else 'abstained' end;

  if jsonb_array_length(coalesce(p_capture_metadata,'[]'::jsonb))<4
    then raise exception 'four_views_required'; end if;

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
      owner_id,p_scan_session_id,capture_row->>'captureType',capture_row->>'side',
      (capture_row->>'width')::integer,(capture_row->>'height')::integer,
      coalesce(capture_row->'qualityMeasurements','{}'::jsonb),
      coalesce(capture_row->'geometryMeasurements','{}'::jsonb),
      capture_row->>'imageHash',capture_row->>'privateStoragePath',
      coalesce((capture_row->>'retainedForResearch')::boolean,false)
    );
  end loop;

  insert into public.grading_predictions(
    user_id,scan_session_id,collection_item_id,target_grader,
    pregrade_score,pregrade_basis,evidence_profile,outcome_risks,
    condition_score,condition_status,professional_prediction_status,
    most_likely_grade,grade_probabilities,condition_low,condition_high,
    subscores,centering_measurements,review_consensus,confidence,
    abstention_reason,model_bundle_version,rubric_version,calibration_version,
    estimate_status,stability,report_snapshot,submission_decision,
    financial_snapshot,card_family
  ) values(
    owner_id,p_scan_session_id,nullif(p_prediction->>'collectionItemId','')::uuid,'PSA',
    nullif(p_prediction->>'pregradeScore','')::numeric,
    coalesce(nullif(p_prediction->>'pregradeBasis',''),'insufficient_evidence'),
    coalesce(p_prediction->'evidenceProfile','{}'::jsonb),
    coalesce(p_prediction->'outcomeRisks','{}'::jsonb),
    case when condition_state='estimate' then nullif(p_prediction->>'conditionScore','')::numeric else null end,
    condition_state,professional_state,
    case when professional_state='validated' then nullif(p_prediction->>'mostLikelyGrade','')::numeric else null end,
    case when professional_state='validated' then coalesce(p_prediction->'probabilities','[]'::jsonb) else '[]'::jsonb end,
    case when condition_state='estimate' then nullif(p_prediction->>'conditionLow','')::numeric else null end,
    case when condition_state='estimate' then nullif(p_prediction->>'conditionHigh','')::numeric else null end,
    coalesce(p_prediction->'subscores','[]'::jsonb),
    coalesce(p_prediction->'centering','{}'::jsonb),
    coalesce(p_prediction->'consensus','{}'::jsonb),
    coalesce(nullif(p_prediction->>'confidence','')::numeric,0),
    nullif(p_prediction->>'abstentionReason',''),p_prediction->>'modelBundleVersion',
    p_prediction->>'rubricVersion',p_prediction->>'calibrationVersion',lifecycle_status,
    coalesce(p_prediction->'stability','{}'::jsonb),
    coalesce(p_prediction->'reportSnapshot','{}'::jsonb),
    coalesce(p_prediction->'submissionDecision','{}'::jsonb),
    coalesce(p_prediction->'financialSnapshot','{}'::jsonb),
    nullif(p_prediction->>'cardFamily','')
  )
  on conflict (scan_session_id) do update set
    collection_item_id=excluded.collection_item_id,
    pregrade_score=excluded.pregrade_score,
    pregrade_basis=excluded.pregrade_basis,
    evidence_profile=excluded.evidence_profile,
    outcome_risks=excluded.outcome_risks,
    condition_score=excluded.condition_score,
    condition_status=excluded.condition_status,
    professional_prediction_status=excluded.professional_prediction_status,
    most_likely_grade=excluded.most_likely_grade,
    grade_probabilities=excluded.grade_probabilities,
    condition_low=excluded.condition_low,condition_high=excluded.condition_high,
    subscores=excluded.subscores,centering_measurements=excluded.centering_measurements,
    review_consensus=excluded.review_consensus,confidence=excluded.confidence,
    abstention_reason=excluded.abstention_reason,
    model_bundle_version=excluded.model_bundle_version,rubric_version=excluded.rubric_version,
    calibration_version=excluded.calibration_version,estimate_status=excluded.estimate_status,
    stability=excluded.stability,report_snapshot=excluded.report_snapshot,
    submission_decision=excluded.submission_decision,
    financial_snapshot=excluded.financial_snapshot,card_family=excluded.card_family
  returning id into prediction_id;

  for evidence_row in
    select value from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb))
  loop
    insert into public.grading_evidence(
      user_id,scan_session_id,side,defect_category,region,severity,confidence,
      description,verification_status
    ) values(
      owner_id,p_scan_session_id,coalesce(nullif(evidence_row->>'side',''),'unknown'),
      coalesce(nullif(evidence_row->>'category',''),'other'),evidence_row->'region',
      coalesce(nullif(evidence_row->>'severity',''),'minor'),
      greatest(0,least(1,coalesce(nullif(evidence_row->>'confidence','')::numeric,0))),
      left(coalesce(nullif(evidence_row->>'evidence',''),'Visible finding requires review.'),500),
      coalesce(nullif(evidence_row->>'verificationStatus',''),'region_inferred')
    );
  end loop;

  update public.grading_scan_sessions
  set workflow_status=case when condition_state='estimate' then 'completed' else 'abstained' end,
      capture_progress=jsonb_build_object(
        'completedCaptureTypes',jsonb_build_array('front','back','alternate_front','alternate_back'),
        'nextCaptureType',null,'totalRequired',4,'pixelsStored',false,'updatedAt',now()
      ),
      completed_at=now(),updated_at=now(),error_code=null
  where id=p_scan_session_id and user_id=owner_id;
  return prediction_id;
end $$;

revoke all on function public.save_grading_scan_report(uuid,jsonb,jsonb,jsonb)
  from public,anon;
grant execute on function public.save_grading_scan_report(uuid,jsonb,jsonb,jsonb)
  to authenticated;

comment on column public.grading_predictions.pregrade_score is
  'One-decimal Mica pregrade. It is not a PSA-issued decimal label.';
comment on column public.grading_predictions.pregrade_basis is
  'Whether the decimal is a calibrated expected PSA outcome or visible-condition measurement.';
