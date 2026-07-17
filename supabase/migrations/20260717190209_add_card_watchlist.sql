create table if not exists public.card_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  provider_card_id text not null,
  variant_key text not null default '',
  identity_snapshot jsonb not null default '{}'::jsonb,
  card_state text not null default 'raw' check (card_state in ('raw','graded')),
  raw_condition text check (raw_condition is null or raw_condition in ('near_mint','lightly_played','moderately_played','heavily_played','damaged')),
  grader text,
  grade numeric(4,1) check (grade is null or grade between 1 and 10),
  target_price numeric(14,2) check (target_price is null or target_price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  starting_market_price numeric(14,2) check (starting_market_price is null or starting_market_price >= 0),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (card_state='raw' and raw_condition is not null and grader is null and grade is null)
    or (card_state='graded' and raw_condition is null and grader is not null and grade is not null)
  )
);

create unique index if not exists card_watchlist_exact_context_uidx
  on public.card_watchlist(
    user_id,
    provider_card_id,
    variant_key,
    card_state,
    coalesce(raw_condition,''),
    coalesce(grader,''),
    coalesce(grade,-1)
  );
create index if not exists card_watchlist_owner_created_idx
  on public.card_watchlist(user_id,created_at desc);
create index if not exists card_watchlist_card_idx
  on public.card_watchlist(card_id)
  where card_id is not null;

alter table public.card_watchlist enable row level security;

create policy "watchlist owners can select"
  on public.card_watchlist for select
  to authenticated
  using ((select auth.uid())=user_id);
create policy "watchlist owners can insert"
  on public.card_watchlist for insert
  to authenticated
  with check ((select auth.uid())=user_id);
create policy "watchlist owners can update"
  on public.card_watchlist for update
  to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "watchlist owners can delete"
  on public.card_watchlist for delete
  to authenticated
  using ((select auth.uid())=user_id);

revoke all on table public.card_watchlist from anon;
grant select,insert,update,delete on table public.card_watchlist to authenticated;
grant all on table public.card_watchlist to service_role;
