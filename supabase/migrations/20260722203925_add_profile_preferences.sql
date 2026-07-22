alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_preferences_object_check;

alter table public.profiles
  add constraint profiles_preferences_object_check
  check (jsonb_typeof(preferences) = 'object');

comment on column public.profiles.preferences is
  'Owner-scoped workflow defaults such as trade, direct-sale, and interface preferences.';

comment on column public.profiles.onboarding_completed_at is
  'When the owner finished or explicitly skipped the first-run setup.';
