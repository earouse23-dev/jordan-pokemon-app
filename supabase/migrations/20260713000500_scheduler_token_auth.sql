-- Replace legacy service-role JWT dispatch with a generated single-purpose scheduler token.
create table if not exists public.scheduler_credentials (
  name text primary key,
  secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default now()
);
alter table public.scheduler_credentials enable row level security;
revoke all on public.scheduler_credentials from anon,authenticated;

do $$
declare raw_token text;
begin
  if not exists(select 1 from vault.decrypted_secrets where name='catalog_sync_dispatch_token') then
    raw_token := encode(extensions.gen_random_bytes(32),'hex');
    perform vault.create_secret(raw_token,'catalog_sync_dispatch_token','Single-purpose catalog scheduler token');
    insert into public.scheduler_credentials(name,secret_hash)
    values('catalog_sync',encode(extensions.digest(raw_token,'sha256'),'hex'))
    on conflict(name) do update set secret_hash=excluded.secret_hash,rotated_at=now();
  end if;
end $$;

create or replace function public.dispatch_catalog_sync()
returns bigint language plpgsql security definer set search_path='' as $$
declare project_url text; dispatch_token text; target_language text; target_page integer; target_page_size integer; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='catalog_sync_project_url' limit 1;
  select decrypted_secret into dispatch_token from vault.decrypted_secrets where name='catalog_sync_dispatch_token' limit 1;
  if nullif(project_url,'') is null or nullif(dispatch_token,'') is null then return null; end if;
  update public.catalog_sync_targets set next_page=1,status='pending',completed_at=null,cycle_started_at=now(),next_attempt_at=now(),updated_at=now()
    where status='completed' and completed_at <= now()-refresh_interval;
  with candidate as (
    select language from public.catalog_sync_targets where status in ('pending','running') and next_page is not null
      and next_attempt_at <= now() and (claimed_at is null or claimed_at < now()-interval '10 minutes')
    order by case when language='en' then 0 else 1 end,updated_at,language for update skip locked limit 1
  )
  update public.catalog_sync_targets target set status='running',claimed_at=now(),attempts=attempts+1,last_error=null,updated_at=now()
    from candidate where target.language=candidate.language
    returning target.language,target.next_page,target.page_size into target_language,target_page,target_page_size;
  if target_language is null then return null; end if;
  request_id := net.http_post(url=>rtrim(project_url,'/')||'/functions/v1/sync-catalog',
    headers=>jsonb_build_object('Content-Type','application/json','X-Catalog-Sync-Token',dispatch_token),
    body=>jsonb_build_object('language',target_language,'page',target_page,'pageSize',target_page_size),timeout_milliseconds=>5000);
  update public.catalog_sync_targets set last_request_id=request_id,updated_at=now() where language=target_language;
  return request_id;
exception when others then
  if target_language is not null then update public.catalog_sync_targets set status='pending',claimed_at=null,last_error='dispatch failed',
    next_attempt_at=now()+interval '5 minutes',updated_at=now() where language=target_language; end if;
  return null;
end $$;
revoke all on function public.dispatch_catalog_sync() from public,anon,authenticated;
