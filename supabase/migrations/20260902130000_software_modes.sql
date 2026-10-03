-- Step 6: make Collector, Investor, and Seller reversible display preferences.

update public.profiles
set preferences = jsonb_set(
  coalesce(preferences, '{}'::jsonb),
  '{softwareMode}',
  to_jsonb(
    case
      when preferences->>'collectorGoal' = 'selling'
        or preferences->>'experienceLevel' = 'professional' then 'seller'
      when preferences->>'collectorGoal' = 'trading' then 'investor'
      else 'collector'
    end
  ),
  true
)
where not coalesce(preferences, '{}'::jsonb) ? 'softwareMode';

alter table public.profiles
  drop constraint if exists profiles_software_mode_check;

alter table public.profiles
  add constraint profiles_software_mode_check
  check (
    coalesce(preferences->>'softwareMode', 'collector')
      in ('collector', 'investor', 'seller')
  );

create table if not exists public.software_mode_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  from_mode text not null
    check (from_mode in ('collector', 'investor', 'seller')),
  to_mode text not null
    check (to_mode in ('collector', 'investor', 'seller')),
  source text not null default 'settings'
    check (source in ('header', 'settings', 'onboarding', 'migration')),
  created_at timestamptz not null default now(),
  check (from_mode <> to_mode)
);

comment on table public.software_mode_events is
  'Owner-private, content-free evidence that a reversible display mode changed.';

create index if not exists software_mode_events_owner_created_idx
  on public.software_mode_events (user_id, created_at desc);

alter table public.software_mode_events enable row level security;

drop policy if exists software_mode_events_select_own
  on public.software_mode_events;
create policy software_mode_events_select_own
  on public.software_mode_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists software_mode_events_insert_own
  on public.software_mode_events;
create policy software_mode_events_insert_own
  on public.software_mode_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on table public.software_mode_events from anon, authenticated;
grant select, insert on table public.software_mode_events to authenticated;
grant usage, select on sequence public.software_mode_events_id_seq
  to authenticated;
