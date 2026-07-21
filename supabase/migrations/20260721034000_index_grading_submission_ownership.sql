-- Cover the composite owner foreign key and owner-scoped position lookup used
-- by grading return and inventory-integrity triggers.
create index if not exists grading_submissions_position_owner_idx
  on public.grading_submissions(collection_item_id,user_id);
