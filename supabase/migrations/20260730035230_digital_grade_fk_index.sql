create index if not exists digital_grade_assessments_item_owner_idx
  on public.digital_grade_assessments(collection_item_id,user_id);
