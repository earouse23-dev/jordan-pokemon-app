-- Store the printed denominator and support deterministic identity lookups
-- before any provider fallback. Counts remain nullable because some upstream
-- languages and legacy sets do not publish them.
create extension if not exists pg_trgm with schema extensions;

alter table public.card_sets
  add column if not exists official_count integer
    check (official_count is null or official_count > 0),
  add column if not exists total_count integer
    check (total_count is null or total_count > 0);

alter table public.cards
  add column if not exists name_key text
    generated always as (lower(btrim(name))) stored,
  add column if not exists collector_key text
    generated always as (
      upper(regexp_replace(collector_number, '[^A-Za-z0-9]', '', 'g'))
    ) stored;

create index if not exists cards_identity_number_idx
  on public.cards(language, collector_key, set_id);
create index if not exists cards_identity_name_idx
  on public.cards(language, name_key);
create index if not exists cards_name_trgm_idx
  on public.cards using gin(name extensions.gin_trgm_ops);
create index if not exists card_sets_identity_count_idx
  on public.card_sets(language, official_count, id);
