-- AI portfolio briefs receive aggregate signal counts only. Keep their usage
-- budget separate from image analysis and atomic across serverless instances.

create or replace function public.claim_advisor_usage(
  p_maximum integer default 10,
  p_window_seconds integer default 3600
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  window_start timestamptz;
  oldest_in_window timestamptz;
  usage_count integer;
  retry_after integer;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_maximum is null or p_maximum<1 or p_maximum>50 then
    raise exception 'invalid_rate_limit';
  end if;
  if p_window_seconds is null or p_window_seconds<60 or p_window_seconds>86400 then
    raise exception 'invalid_rate_window';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':advisor',0));
  window_start := clock_timestamp()-make_interval(secs=>p_window_seconds);

  delete from public.usage_events
  where user_id=owner_id
    and event_type='portfolio_advisor'
    and occurred_at<clock_timestamp()-interval '7 days';

  select count(*),min(occurred_at)
    into usage_count,oldest_in_window
  from public.usage_events
  where user_id=owner_id
    and event_type='portfolio_advisor'
    and occurred_at>=window_start;

  if usage_count>=p_maximum then
    retry_after := greatest(
      1,
      ceil(extract(epoch from (oldest_in_window+make_interval(secs=>p_window_seconds)-clock_timestamp())))::integer
    );
    return jsonb_build_object('allowed',false,'retryAfter',retry_after);
  end if;

  insert into public.usage_events(user_id,event_type,quantity)
  values(owner_id,'portfolio_advisor',1);
  return jsonb_build_object('allowed',true,'retryAfter',0);
end $$;

revoke all on function public.claim_advisor_usage(integer,integer) from public,anon;
grant execute on function public.claim_advisor_usage(integer,integer) to authenticated;
