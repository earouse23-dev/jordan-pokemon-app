-- CardVault — Pokémon inventory cloud sync
-- All objects are namespaced with the app prefix `app_c14bef07_` and isolated by Row Level Security.
-- This file is IDEMPOTENT: it can be re-run safely. ACE applies it automatically after a build;
-- to run it manually, paste it into the Supabase dashboard → SQL Editor and execute.
--
-- AUTH: the app uses Supabase Anonymous Sign-Ins — each device silently gets a real auth user, so
-- ownership is enforced server-side by `auth.uid()` (no shared/permissive anon access to user data).
-- Enable it in the dashboard: Authentication → Sign In / Providers → Anonymous Sign-ins → ON.
-- If it is left off, the client simply runs local-only (IndexedDB) and never exposes rows.

-- One row per card a user has added to their binder. A binder is owned by the device's auth user.
create table if not exists app_c14bef07_cards (
  owner_id      uuid        not null default auth.uid(),   -- = auth.uid() of the (anonymous) user
  uid           text        not null,                      -- pokemontcg.io card id (stable)
  name          text,
  set_name      text,
  series        text,
  release_date  text,
  number        text,
  rarity        text,
  image         text,                            -- catalog image url
  market        numeric,                         -- market price snapshot
  prices        jsonb,                           -- full price block (market/low/mid/high/source/url/trends)
  details       jsonb,                           -- Card Ladder-style identity (artist/year/pokedex/printRun)
  photo         text,                            -- the user's own snapped photo (downscaled jpeg data url)
  added_at      bigint,                          -- epoch ms the card was added
  created_at    timestamptz default now(),
  primary key (owner_id, uid)
);

-- Added after launch — bring existing tables up to date (no-op if the column already exists).
alter table app_c14bef07_cards add column if not exists details jsonb;

create index if not exists app_c14bef07_cards_owner_idx
  on app_c14bef07_cards (owner_id, added_at desc);

-- Row Level Security: a user can only read/write rows they own. Anonymous-sign-in users carry the
-- `authenticated` role with a real auth.uid(), so this enforces per-device isolation server-side.
alter table app_c14bef07_cards enable row level security;

drop policy if exists app_c14bef07_cards_rw on app_c14bef07_cards;
create policy app_c14bef07_cards_rw
  on app_c14bef07_cards
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
