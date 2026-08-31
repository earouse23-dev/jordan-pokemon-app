-- Complete the collection-first digital-grading report model. Normal capture
-- pixels remain transient; a small private card-only thumbnail may be retained.

alter table public.grading_scan_sessions
  add column if not exists thumbnail_path text,
  add column if not exists capture_progress jsonb not null default '{}'::jsonb,
  add column if not exists previous_session_id uuid,
  add column if not exists report_version integer not null default 1;

alter table public.grading_scan_sessions
  drop constraint if exists grading_scan_sessions_capture_progress_object,
  add constraint grading_scan_sessions_capture_progress_object
    check (jsonb_typeof(capture_progress)='object'),
  drop constraint if exists grading_scan_sessions_report_version_check,
  add constraint grading_scan_sessions_report_version_check
    check (report_version between 1 and 10000),
  drop constraint if exists grading_scan_sessions_previous_session_id_fkey,
  add constraint grading_scan_sessions_previous_session_id_fkey
    foreign key (previous_session_id)
    references public.grading_scan_sessions(id) on delete set null;

create index if not exists grading_sessions_previous_idx
  on public.grading_scan_sessions(previous_session_id,user_id);

alter table public.grading_predictions
  add column if not exists condition_score numeric(4,1),
  add column if not exists condition_status text not null default 'abstained',
  add column if not exists professional_prediction_status text not null default 'unavailable',
  add column if not exists stability jsonb not null default '{}'::jsonb,
  add column if not exists report_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists submission_decision jsonb not null default '{}'::jsonb,
  add column if not exists financial_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists card_family text;

alter table public.grading_predictions
  drop constraint if exists grading_predictions_check1;

update public.grading_predictions
set condition_score=round(((condition_low+condition_high)/2.0)::numeric,1),
    condition_status=case
      when condition_low is not null and condition_high is not null then 'estimate'
      else 'abstained'
    end,
    professional_prediction_status=case when estimate_status='abstained'
      then 'abstained' else 'unavailable' end,
    most_likely_grade=null,
    grade_probabilities='[]'::jsonb
where condition_score is null;

alter table public.grading_predictions
  drop constraint if exists grading_predictions_check1,
  drop constraint if exists grading_predictions_condition_score_check,
  add constraint grading_predictions_condition_score_check
    check (condition_score is null or condition_score between 1 and 10),
  drop constraint if exists grading_predictions_condition_status_check,
  add constraint grading_predictions_condition_status_check
    check (condition_status in ('estimate','abstained')),
  drop constraint if exists grading_predictions_professional_status_check,
  add constraint grading_predictions_professional_status_check
    check (professional_prediction_status in ('validated','unavailable','abstained')),
  drop constraint if exists grading_predictions_document_objects,
  add constraint grading_predictions_document_objects check (
    jsonb_typeof(stability)='object'
    and jsonb_typeof(report_snapshot)='object'
    and jsonb_typeof(submission_decision)='object'
    and jsonb_typeof(financial_snapshot)='object'
  ),
  drop constraint if exists grading_predictions_condition_state_consistent,
  add constraint grading_predictions_condition_state_consistent check (
    (condition_status='estimate' and condition_score is not null
      and condition_low is not null and condition_high is not null)
    or
    (condition_status='abstained' and condition_score is null)
  ),
  drop constraint if exists grading_predictions_professional_state_consistent,
  add constraint grading_predictions_professional_state_consistent check (
    (professional_prediction_status='validated' and most_likely_grade is not null
      and jsonb_array_length(grade_probabilities)>0)
    or
    (professional_prediction_status<>'validated' and most_likely_grade is null
      and jsonb_array_length(grade_probabilities)=0)
  );

alter table public.grading_evidence
  drop constraint if exists grading_evidence_defect_category_check;
alter table public.grading_evidence
  add constraint grading_evidence_defect_category_check check (
    defect_category in (
      'centering','corners','corner_whitening','corner_compression','edges',
      'edge_whitening','edge_chipping','edge_wear','surface','scratch',
      'holo_scratch','print_line','indentation','dent','crease','bend','warping',
      'stain','residue','scuff','surface_scuff','peeling','delamination','printing_defect',
      'structural_integrity','other'
    )
  );

create or replace function public.create_grading_scan_session(
  p_collection_item_id uuid,
  p_identity_snapshot jsonb,
  p_idempotency_key text,
  p_consent_mode text,
  p_consent_version text,
  p_model_bundle_version text
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  existing_id uuid;
  new_id uuid;
  previous_id uuid;
  next_version integer := 1;
  requested_consent text := lower(coalesce(nullif(trim(p_consent_mode),''),'normal'));
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200
    then raise exception 'invalid_idempotency_key'; end if;
  if requested_consent not in ('normal','research')
    then raise exception 'invalid_consent_mode'; end if;
  if p_collection_item_id is not null and not exists (
    select 1 from public.collection_items
    where id=p_collection_item_id and user_id=owner_id
      and card_state='raw' and status in ('owned','archived')
  ) then raise exception 'raw_position_not_found'; end if;
  if requested_consent='research' and not exists (
    select 1 from public.grading_research_consents
    where user_id=owner_id and consented
      and consent_version=p_consent_version and revoked_at is null
  ) then raise exception 'research_consent_required'; end if;

  select id into existing_id
  from public.grading_scan_sessions
  where user_id=owner_id and idempotency_key=p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  if p_collection_item_id is not null then
    select session.id,session.report_version+1
    into previous_id,next_version
    from public.grading_scan_sessions session
    join public.grading_predictions prediction
      on prediction.scan_session_id=session.id and prediction.user_id=owner_id
    where session.user_id=owner_id
      and session.collection_item_id=p_collection_item_id
      and prediction.estimate_status='confirmed'
    order by session.report_version desc,session.completed_at desc nulls last
    limit 1;
    next_version:=coalesce(next_version,1);
  end if;

  insert into public.grading_scan_sessions(
    user_id,collection_item_id,identity_snapshot,consent_mode,consent_version,
    model_bundle_version,idempotency_key,previous_session_id,report_version
  ) values(
    owner_id,p_collection_item_id,coalesce(p_identity_snapshot,'{}'::jsonb),
    requested_consent,
    case when requested_consent='research' then p_consent_version else null end,
    p_model_bundle_version,p_idempotency_key,previous_id,next_version
  ) returning id into new_id;
  return new_id;
end $$;

revoke all on function public.create_grading_scan_session(
  uuid,jsonb,text,text,text,text
) from public,anon;
grant execute on function public.create_grading_scan_session(
  uuid,jsonb,text,text,text,text
) to authenticated;

create or replace function public.update_grading_capture_progress(
  p_scan_session_id uuid,
  p_completed_capture_types text[],
  p_next_capture_type text,
  p_total_required integer
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  allowed_types text[] := array['front','back','alternate_front','alternate_back'];
  normalized text[];
  result jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_total_required<>4 then raise exception 'four_views_required'; end if;
  select coalesce(array_agg(distinct value),'{}'::text[]) into normalized
  from unnest(coalesce(p_completed_capture_types,'{}'::text[])) value
  where value=any(allowed_types);
  if cardinality(normalized)<>cardinality(coalesce(p_completed_capture_types,'{}'::text[]))
    then raise exception 'invalid_capture_progress'; end if;
  if p_next_capture_type is not null and not p_next_capture_type=any(allowed_types)
    then raise exception 'invalid_next_capture'; end if;
  result:=jsonb_build_object(
    'completedCaptureTypes',to_jsonb(normalized),
    'nextCaptureType',p_next_capture_type,
    'totalRequired',4,
    'pixelsStored',false,
    'updatedAt',now()
  );
  update public.grading_scan_sessions
  set capture_progress=result,workflow_status='capturing',updated_at=now(),error_code=null
  where id=p_scan_session_id and user_id=owner_id;
  if not found then raise exception 'grading_session_not_found'; end if;
  return result;
end $$;

revoke all on function public.update_grading_capture_progress(uuid,text[],text,integer)
  from public,anon;
grant execute on function public.update_grading_capture_progress(uuid,text[],text,integer)
  to authenticated;

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
  lifecycle_status text;
  condition_state text;
  professional_state text;
  capture_row jsonb;
  evidence_row jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select consent_mode into session_consent
  from public.grading_scan_sessions
  where id=p_scan_session_id and user_id=owner_id for update;
  if session_consent is null then raise exception 'grading_session_not_found'; end if;
  if jsonb_typeof(coalesce(p_capture_metadata,'[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_evidence,'[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_prediction,'{}'::jsonb))<>'object'
    then raise exception 'invalid_grading_report'; end if;

  select id into prediction_id from public.grading_predictions
  where scan_session_id=p_scan_session_id and user_id=owner_id
    and estimate_status='confirmed' for update;
  if prediction_id is not null then return prediction_id; end if;

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
    user_id,scan_session_id,collection_item_id,target_grader,condition_score,
    condition_status,professional_prediction_status,most_likely_grade,
    grade_probabilities,condition_low,condition_high,subscores,
    centering_measurements,review_consensus,confidence,abstention_reason,
    model_bundle_version,rubric_version,calibration_version,estimate_status,
    stability,report_snapshot,submission_decision,financial_snapshot,card_family
  ) values(
    owner_id,p_scan_session_id,nullif(p_prediction->>'collectionItemId','')::uuid,'PSA',
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

create or replace function public.create_identified_grade_position(
  p_identity jsonb,
  p_card_id uuid,
  p_variant_id uuid,
  p_idempotency_key text
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  item_id uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if trim(coalesce(p_identity->>'name',''))=''
    or trim(coalesce(p_identity->>'set',''))=''
    or trim(coalesce(p_identity->>'number',''))=''
    or trim(coalesce(p_identity->>'variant',''))=''
  then raise exception 'exact_card_identity_required'; end if;
  item_id:=public.create_collection_position(
    p_identity,p_card_id,p_variant_id,'raw','unknown',null,null,null,1,
    current_date,0,0,0,0,0,0,'USD',null,
    'Automatically identified during digital grading. Acquisition amount and date were not provided.',
    p_idempotency_key,'unknown'
  );
  update public.purchase_lots
  set cost_basis_known=false,acquired_at_known=false
  where collection_item_id=item_id and user_id=owner_id;
  return item_id;
end $$;

revoke all on function public.create_identified_grade_position(jsonb,uuid,uuid,text)
  from public,anon;
grant execute on function public.create_identified_grade_position(jsonb,uuid,uuid,text)
  to authenticated;

create or replace function public.confirm_mica_grading_report(
  p_scan_session_id uuid,
  p_collection_item_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  prediction_id uuid;
  target_item public.collection_items%rowtype;
  session_identity jsonb;
  target_identity jsonb;
  attached_item_id uuid;
  was_split boolean := false;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select item.* into target_item from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id
    and item.card_state='raw' and item.status in ('owned','archived') for update;
  if not found then raise exception 'raw_position_not_found'; end if;

  select session.identity_snapshot into session_identity
  from public.grading_scan_sessions session
  where session.id=p_scan_session_id and session.user_id=owner_id for update;
  if session_identity is null then raise exception 'grading_session_not_found'; end if;
  target_identity:=target_item.identity_snapshot;

  if lower(trim(coalesce(session_identity->>'name','')))<>lower(trim(coalesce(target_identity->>'name','')))
    or lower(trim(coalesce(session_identity->>'set','')))<>lower(trim(coalesce(target_identity->>'set',target_identity->>'setName','')))
    or lower(trim(coalesce(session_identity->>'number','')))<>lower(trim(coalesce(target_identity->>'number',target_identity->>'collectorNumber','')))
    or lower(trim(coalesce(session_identity->>'language','')))<>lower(trim(coalesce(target_identity->>'language','')))
    or lower(trim(coalesce(session_identity->>'variant','')))<>lower(trim(coalesce(target_identity->>'variant',target_identity->>'finish','')))
    or trim(coalesce(session_identity->>'name',''))=''
    or trim(coalesce(session_identity->>'set',''))=''
    or trim(coalesce(session_identity->>'number',''))=''
    or trim(coalesce(session_identity->>'variant',''))=''
  then raise exception 'exact_card_identity_required'; end if;

  select id into prediction_id from public.grading_predictions
  where scan_session_id=p_scan_session_id and user_id=owner_id
    and estimate_status='estimate' and condition_status='estimate'
  for update;
  if prediction_id is null then raise exception 'prediction_not_confirmable'; end if;

  attached_item_id:=target_item.id;
  if target_item.quantity>1 then
    attached_item_id:=public.split_collection_position(
      target_item.id,1,'oldest','digital-grade:'||p_scan_session_id::text
    );
    was_split:=true;
  end if;

  update public.grading_predictions set estimate_status='superseded'
  where user_id=owner_id and collection_item_id=attached_item_id
    and estimate_status='confirmed';
  update public.grading_predictions
  set collection_item_id=attached_item_id,estimate_status='confirmed',confirmed_at=now()
  where id=prediction_id and user_id=owner_id;
  update public.grading_scan_sessions
  set collection_item_id=attached_item_id,updated_at=now()
  where id=p_scan_session_id and user_id=owner_id;

  return jsonb_build_object(
    'predictionId',prediction_id,
    'collectionItemId',attached_item_id,
    'split',was_split
  );
end $$;

revoke all on function public.confirm_mica_grading_report(uuid,uuid)
  from public,anon;
grant execute on function public.confirm_mica_grading_report(uuid,uuid)
  to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'grading-report-thumbnails','grading-report-thumbnails',false,180000,
  array['image/jpeg']
)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "grading thumbnails owners can read" on storage.objects;
drop policy if exists "grading thumbnails owners can insert" on storage.objects;
drop policy if exists "grading thumbnails owners can update" on storage.objects;
drop policy if exists "grading thumbnails owners can delete" on storage.objects;

create policy "grading thumbnails owners can read"
on storage.objects for select to authenticated using (
  bucket_id='grading-report-thumbnails'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "grading thumbnails owners can insert"
on storage.objects for insert to authenticated with check (
  bucket_id='grading-report-thumbnails'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "grading thumbnails owners can update"
on storage.objects for update to authenticated using (
  bucket_id='grading-report-thumbnails'
  and (storage.foldername(name))[1]=(select auth.uid())::text
) with check (
  bucket_id='grading-report-thumbnails'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "grading thumbnails owners can delete"
on storage.objects for delete to authenticated using (
  bucket_id='grading-report-thumbnails'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

comment on column public.grading_predictions.condition_score is
  'Mica visible-condition score; separate from any professional grader outcome.';
comment on column public.grading_predictions.professional_prediction_status is
  'Validated only when probabilities came from a held-out calibration artifact.';
comment on column public.grading_scan_sessions.thumbnail_path is
  'Optional private card-only JPEG; normal capture photos are not retained.';
