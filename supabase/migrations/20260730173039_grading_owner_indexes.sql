-- Cover the direct auth.users foreign keys and the composite prediction link.
create index if not exists grading_captures_owner_idx
  on public.grading_captures(user_id);
create index if not exists grading_evidence_owner_idx
  on public.grading_evidence(user_id);
create index if not exists grading_feedback_owner_idx
  on public.grading_feedback(user_id);
create index if not exists grading_predictions_owner_idx
  on public.grading_predictions(user_id);
create index if not exists grading_predictions_session_owner_idx
  on public.grading_predictions(scan_session_id,user_id);
