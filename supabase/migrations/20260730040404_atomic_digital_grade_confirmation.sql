create function public.confirm_digital_grade_assessment(
  p_collection_item_id uuid,
  p_predicted_grade numeric,
  p_predicted_grade_low numeric,
  p_predicted_grade_high numeric,
  p_derived_raw_condition text,
  p_subscores jsonb,
  p_defects jsonb,
  p_confidence numeric,
  p_photo_quality jsonb,
  p_model_version text
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  assessment_id uuid;
  item_state text;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select card_state into item_state
  from public.collection_items
  where id=p_collection_item_id and user_id=owner_id
  for update;
  if item_state is null then raise exception 'position_not_found'; end if;
  if item_state<>'raw' then raise exception 'digital_grade_requires_raw_card'; end if;

  update public.digital_grade_assessments
  set estimate_status='superseded'
  where user_id=owner_id
    and collection_item_id=p_collection_item_id
    and estimate_status='confirmed';

  insert into public.digital_grade_assessments(
    user_id,collection_item_id,predicted_grade,predicted_grade_low,
    predicted_grade_high,derived_raw_condition,subscores,defects,confidence,
    photo_quality,model_version,estimate_status
  ) values(
    owner_id,p_collection_item_id,p_predicted_grade,p_predicted_grade_low,
    p_predicted_grade_high,nullif(p_derived_raw_condition,''),
    coalesce(p_subscores,'{}'::jsonb),coalesce(p_defects,'[]'::jsonb),
    p_confidence,coalesce(p_photo_quality,'{}'::jsonb),p_model_version,
    'confirmed'
  ) returning id into assessment_id;

  if nullif(p_derived_raw_condition,'') is not null then
    update public.collection_items
    set raw_condition=p_derived_raw_condition,updated_at=now()
    where id=p_collection_item_id and user_id=owner_id;
  end if;
  return assessment_id;
end $$;

revoke all on function public.confirm_digital_grade_assessment(
  uuid,numeric,numeric,numeric,text,jsonb,jsonb,numeric,jsonb,text
) from public,anon;
grant execute on function public.confirm_digital_grade_assessment(
  uuid,numeric,numeric,numeric,text,jsonb,jsonb,numeric,jsonb,text
) to authenticated;

revoke insert,update on public.digital_grade_assessments from authenticated;
