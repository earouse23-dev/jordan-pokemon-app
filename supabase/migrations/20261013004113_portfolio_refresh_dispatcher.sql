-- Reuse the installed Cron/pg_net/Vault services. Activation follows bounded
-- provider acceptance; never put credentials in cron command text.
create function public.dispatch_portfolio_refresh() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text;
begin
  if not exists(select 1 from public.due_portfolio_refreshes(now(),1)) then return null; end if;
  select decrypted_secret into token from vault.decrypted_secrets
    where name='portfolio_refresh_cron_secret' limit 1;
  if token is null then raise exception 'portfolio_dispatch_unconfigured'; end if;
  return net.http_get(
    url:='https://jordan-pokemon-app.vercel.app/api/capabilities?surface=portfolio-sync',
    headers:=jsonb_build_object('Authorization','Bearer '||token),
    timeout_milliseconds:=55000
  );
end $$;
revoke all on function public.dispatch_portfolio_refresh() from public,anon,authenticated;
grant execute on function public.dispatch_portfolio_refresh() to service_role;
select cron.schedule('mica-portfolio-refresh','*/5 * * * *','select public.dispatch_portfolio_refresh();');
select cron.alter_job((select jobid from cron.job where jobname='mica-portfolio-refresh'), active:=false);
