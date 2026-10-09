-- Additive derived caches. Never alter purchases, lots, sales, or the quota ledger.
create table public.provider_response_cache (
 cache_key text primary key, body jsonb not null, fetched_at timestamptz not null default now(), expires_at timestamptz not null, refresh_until timestamptz, refresh_token uuid
);
alter table public.provider_response_cache enable row level security;
revoke all on public.provider_response_cache from public,anon,authenticated;
grant select,insert,update,delete on public.provider_response_cache to service_role;
create table public.provider_request_usage (
 id bigint generated always as identity primary key, requested_at timestamptz not null default now(), endpoint text not null,
 reserved_credits integer not null check(reserved_credits>=0), returned_items integer, http_status integer, error_code text
);
alter table public.provider_request_usage enable row level security;
revoke all on public.provider_request_usage from public,anon,authenticated;
grant select,insert on public.provider_request_usage to service_role;
grant usage,select on sequence public.provider_request_usage_id_seq to service_role;
create index provider_request_usage_date on public.provider_request_usage(requested_at);
create table public.portfolio_views (
 user_id uuid primary key references auth.users(id) on delete cascade,
 view jsonb, updated_at timestamptz, attempted_at timestamptz, refresh_until timestamptz, refresh_token uuid, error_code text
);
alter table public.portfolio_views enable row level security;
revoke all on public.portfolio_views from public,anon,authenticated;
grant select on public.portfolio_views to authenticated;
grant select,insert,update,delete on public.portfolio_views to service_role;
create policy portfolio_view_owner on public.portfolio_views for select to authenticated using ((select auth.uid())=user_id);
create function public.claim_portfolio_refresh(p_user_id uuid,p_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 insert into public.portfolio_views(user_id) values(p_user_id) on conflict do nothing;
 update public.portfolio_views set refresh_until=now()+interval '60 seconds',refresh_token=p_token,attempted_at=now()
 where user_id=p_user_id and (refresh_until is null or refresh_until<now());
 return found;
end $$;
revoke all on function public.claim_portfolio_refresh(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_portfolio_refresh(uuid,uuid) to service_role;

create function public.claim_provider_cache(p_key text,p_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 insert into public.provider_response_cache(cache_key,body,expires_at) values(p_key,'{}'::jsonb,now()) on conflict do nothing;
 update public.provider_response_cache set refresh_until=now()+interval '20 seconds',refresh_token=p_token
 where cache_key=p_key and expires_at<=now() and (refresh_until is null or refresh_until<now());
 return found;
end $$;
revoke all on function public.claim_provider_cache(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_provider_cache(text,uuid) to service_role;
