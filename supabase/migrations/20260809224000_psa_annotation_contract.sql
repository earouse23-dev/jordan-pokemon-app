-- Enforce the frozen human-annotation protocol before a review can influence
-- training eligibility. Model prose and predictions are intentionally absent.

create or replace function grading_private.annotation_labels_valid(p_labels jsonb)
returns boolean
language plpgsql
security invoker
set search_path=''
immutable
as $$
declare
  field text;
  condition_value jsonb;
  defect jsonb;
  point jsonb;
  signal jsonb;
  grade numeric;
  x numeric;
  y numeric;
  width numeric;
  height numeric;
begin
  if jsonb_typeof(p_labels) is distinct from 'object'
    or coalesce(p_labels->>'protocolVersion','')<>'mica-psa-label-protocol-v1'
    or jsonb_typeof(p_labels->'identityConfirmed') is distinct from 'boolean'
    or coalesce(p_labels->>'finish','') not in (
      'non_holo','traditional_holo','reverse_holo','full_art',
      'textured_full_art','rainbow_hyper_rare','radiant','etched',
      'vintage_foil','other_documented'
    )
    or jsonb_typeof(p_labels->'evidence') is distinct from 'object'
    or jsonb_typeof(p_labels->'condition') is distinct from 'object'
    or jsonb_typeof(p_labels->'noGradeSignals') is distinct from 'array'
    or jsonb_typeof(p_labels->'defects') is distinct from 'array'
    or jsonb_array_length(p_labels->'defects')>50
    or jsonb_typeof(p_labels->'notes') is distinct from 'string'
    or char_length(p_labels->>'notes')>1000 then
    return false;
  end if;

  foreach field in array array[
    'front','back','alternateFront','alternateBack','centering','corners',
    'edges','surface','structure','sufficient'
  ] loop
    if jsonb_typeof(p_labels->'evidence'->field) is distinct from 'boolean' then return false; end if;
  end loop;
  foreach field in array array[
    'centering','corners','edges','surface','structure','eyeAppeal'
  ] loop
    condition_value:=p_labels->'condition'->field;
    if jsonb_typeof(condition_value) is distinct from 'number' then return false; end if;
    grade:=(condition_value#>>'{}')::numeric;
    if grade<1 or grade>10 or grade*2<>trunc(grade*2) then return false; end if;
  end loop;

  for signal in
    select element.value
    from jsonb_array_elements(p_labels->'noGradeSignals') as element(value)
  loop
    if jsonb_typeof(signal) is distinct from 'string'
      or signal#>>'{}' not in (
        'trimming','alteration','cleaning','recoloring','restoration',
        'minimum_size','authenticity','other'
      ) then return false;
    end if;
  end loop;

  for defect in
    select element.value
    from jsonb_array_elements(p_labels->'defects') as element(value)
  loop
    if jsonb_typeof(defect) is distinct from 'object'
      or coalesce(defect->>'side','') not in ('front','back')
      or coalesce(defect->>'category','') not in (
        'centering','corner_whitening','corner_rounding','corner_compression',
        'edge_whitening','edge_chipping','rough_cut','peeling','scratch',
        'holo_scratch','print_line','scuff','stain','residue','dent',
        'indentation','crease','wrinkle','bend','warping','delamination',
        'trimming','cleaning','recoloring','restoration','other'
      )
      or coalesce(defect->>'severity','') not in (
        'minor','moderate','major','critical'
      )
      or jsonb_typeof(defect->'confidence') is distinct from 'number'
      or (defect->>'confidence')::numeric not between 0 and 1
      or jsonb_typeof(defect->'persistentAcrossLight') is distinct from 'boolean'
      or jsonb_typeof(defect->'region') is distinct from 'object'
      or jsonb_typeof(defect->'mask') is distinct from 'array'
      or jsonb_array_length(defect->'mask')<4 then
      return false;
    end if;
    if jsonb_typeof(defect->'region'->'x') is distinct from 'number'
      or jsonb_typeof(defect->'region'->'y') is distinct from 'number'
      or jsonb_typeof(defect->'region'->'width') is distinct from 'number'
      or jsonb_typeof(defect->'region'->'height') is distinct from 'number' then return false; end if;
    x:=(defect->'region'->>'x')::numeric;
    y:=(defect->'region'->>'y')::numeric;
    width:=(defect->'region'->>'width')::numeric;
    height:=(defect->'region'->>'height')::numeric;
    if x<0 or y<0 or width<=0 or height<=0 or x+width>1 or y+height>1 then
      return false;
    end if;
    for point in
      select element.value
      from jsonb_array_elements(defect->'mask') as element(value)
    loop
      if jsonb_typeof(point) is distinct from 'object'
        or jsonb_typeof(point->'x') is distinct from 'number'
        or jsonb_typeof(point->'y') is distinct from 'number'
        or (point->>'x')::numeric not between 0 and 1
        or (point->>'y')::numeric not between 0 and 1 then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end $$;

create or replace function grading_private.enforce_annotation_labels()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if not grading_private.annotation_labels_valid(new.labels) then
    raise exception 'invalid_annotation_labels';
  end if;
  if new.decision in ('approve','adjudicate') and (
    not (new.labels->>'identityConfirmed')::boolean
    or not (new.labels->'evidence'->>'sufficient')::boolean
  ) then raise exception 'approval_requires_sufficient_evidence'; end if;
  return new;
end $$;

drop trigger if exists validate_psa_annotation_labels
  on grading_private.annotation_reviews;
create trigger validate_psa_annotation_labels
before insert or update on grading_private.annotation_reviews
for each row execute function grading_private.enforce_annotation_labels();

create or replace function grading_private.annotation_label_fingerprint(p_labels jsonb)
returns text
language sql
security invoker
set search_path=''
immutable
as $$
  select encode(extensions.digest((p_labels-'notes')::text,'sha256'),'hex')
$$;

create or replace function grading_private.record_annotation_review(
  p_example_id uuid,
  p_reviewer_key text,
  p_review_round integer,
  p_decision text,
  p_labels jsonb
)
returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  example grading_private.training_examples%rowtype;
  reviewer_count integer;
  approval_count integer;
  distinct_labels integer;
  rejection_count integer;
  adjudication_count integer;
  result_status text;
begin
  select * into example from grading_private.training_examples
  where id=p_example_id for update;
  if example.id is null then raise exception 'training_example_not_found'; end if;
  if p_review_round not between 1 and 3 then raise exception 'invalid_review_round'; end if;
  if not grading_private.annotation_labels_valid(p_labels) then
    raise exception 'invalid_annotation_labels';
  end if;
  if p_review_round=3 and p_decision<>'adjudicate' then
    raise exception 'round_three_requires_adjudication';
  end if;
  if exists(
    select 1 from grading_private.annotation_reviews
    where training_example_id=p_example_id and reviewer_key=p_reviewer_key
  ) then raise exception 'reviewer_must_be_independent'; end if;

  insert into grading_private.annotation_reviews(
    training_example_id,reviewer_key,review_round,decision,labels
  ) values(p_example_id,p_reviewer_key,p_review_round,p_decision,p_labels);

  select count(distinct reviewer_key),
    count(*) filter (where decision='approve'),
    count(distinct grading_private.annotation_label_fingerprint(labels))
      filter (where decision='approve'),
    count(*) filter (where decision='reject'),
    count(*) filter (where decision='adjudicate')
  into reviewer_count,approval_count,distinct_labels,rejection_count,adjudication_count
  from grading_private.annotation_reviews
  where training_example_id=p_example_id;

  result_status:=case
    when rejection_count>0 then 'rejected'
    when adjudication_count>0 then 'adjudicated'
    when reviewer_count>=2 and approval_count>=2 and distinct_labels=1 then 'double_review'
    when reviewer_count>=1 then 'single_review'
    else 'unreviewed'
  end;
  update grading_private.training_examples
  set reviewer_status=result_status,updated_at=now()
  where id=p_example_id;
  perform grading_private.refresh_training_example(example.scan_session_id,p_reviewer_key);
  insert into grading_private.pilot_audit_events(
    event_type,actor_key,object_type,object_id,details
  ) values(
    'annotation_reviewed',p_reviewer_key,'training_example',p_example_id::text,
    jsonb_build_object(
      'round',p_review_round,'decision',p_decision,'resultStatus',result_status,
      'protocolVersion',p_labels->>'protocolVersion'
    )
  );
  return result_status;
end $$;

revoke all on function grading_private.annotation_labels_valid(jsonb)
  from public,anon,authenticated;
revoke all on function grading_private.enforce_annotation_labels()
  from public,anon,authenticated;
revoke all on function grading_private.annotation_label_fingerprint(jsonb)
  from public,anon,authenticated;
revoke all on function grading_private.record_annotation_review(uuid,text,integer,text,jsonb)
  from public,anon,authenticated;
grant execute on function grading_private.annotation_labels_valid(jsonb) to service_role;
grant execute on function grading_private.annotation_label_fingerprint(jsonb) to service_role;
grant execute on function grading_private.record_annotation_review(uuid,text,integer,text,jsonb)
  to service_role;
