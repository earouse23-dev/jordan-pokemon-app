alter table public.collection_items
  add column if not exists tags text[] not null default '{}'::text[];

comment on column public.collection_items.tags is
  'User-defined private position labels such as Favorites.';

create index if not exists collection_items_tags_gin_idx
  on public.collection_items using gin (tags);
