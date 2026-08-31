-- Account erasure must use the same lineage-aware withdrawal path as an
-- individual research-consent withdrawal. Direct FK cascades would otherwise
-- remove examples without tombstoning sources or quarantining derived models.
create or replace function public.grading_withdraw_account_training_service(
  p_owner_id uuid,
  p_actor_key text
)
returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  subject record;
  removed integer:=0;
begin
  if p_owner_id is null then raise exception 'owner_id_required'; end if;
  if p_actor_key is null or char_length(p_actor_key) not between 10 and 120 then
    raise exception 'actor_key_required';
  end if;
  for subject in
    select example.scan_session_id
    from grading_private.training_examples example
    where example.owner_id=p_owner_id
    order by example.created_at,example.id
  loop
    if grading_private.delete_training_subject(
      subject.scan_session_id,'account_deleted',p_actor_key
    ) then
      removed:=removed+1;
    end if;
  end loop;
  return removed;
end $$;

revoke all on function public.grading_withdraw_account_training_service(uuid,text)
  from public,anon,authenticated;
grant execute on function public.grading_withdraw_account_training_service(uuid,text)
  to service_role;
