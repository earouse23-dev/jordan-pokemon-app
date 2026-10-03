-- The existing sale ledger sets a fully disposed position to quantity zero,
-- but the launch constraint still required one. Permit the modeled sold state
-- without rewriting any position or changing the upper inventory bound.
alter table public.collection_items
  drop constraint if exists collection_items_quantity_check;
alter table public.collection_items
  add constraint collection_items_quantity_check
  check (quantity between 0 and 99999) not valid;
alter table public.collection_items
  validate constraint collection_items_quantity_check;
