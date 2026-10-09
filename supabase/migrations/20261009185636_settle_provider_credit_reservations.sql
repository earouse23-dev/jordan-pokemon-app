-- Settle only a completed, bounded request; timeouts retain their reservation.
-- No budget increase and no reset of historical/account usage.
alter table public.provider_request_usage add column request_key uuid unique;
create function public.record_provider_request_usage(
 p_request_key uuid,p_endpoint text,p_reserved integer,p_returned integer,
 p_status integer,p_error text,p_credit_day date
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_reserved not between 1 and 365 or p_returned<0 or p_returned>p_reserved then
  raise exception 'invalid_provider_usage';
 end if;
 insert into public.provider_request_usage(request_key,endpoint,reserved_credits,returned_items,http_status,error_code)
 values(p_request_key,p_endpoint,p_reserved,p_returned,p_status,p_error)
 on conflict(request_key) do nothing;
 if found and p_status=200 and p_returned is not null then
  update public.provider_sync_status
  set daily_credit_reserved=greatest(0,daily_credit_reserved-(p_reserved-p_returned)),updated_at=now()
  where provider='pkmnprices' and daily_credit_day=p_credit_day;
 end if;
end $$;
revoke all on function public.record_provider_request_usage(uuid,text,integer,integer,integer,text,date) from public,anon,authenticated;
grant execute on function public.record_provider_request_usage(uuid,text,integer,integer,integer,text,date) to service_role;
