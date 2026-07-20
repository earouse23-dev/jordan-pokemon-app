-- Sealed targets reuse the existing private owner-scoped watchlist and exact-product identity snapshot.

alter table public.card_watchlist
  drop constraint if exists card_watchlist_card_state_check;

alter table public.card_watchlist
  add constraint card_watchlist_card_state_check
  check (card_state in ('raw','graded','sealed'));

alter table public.card_watchlist
  drop constraint if exists card_watchlist_check;

alter table public.card_watchlist
  add constraint card_watchlist_check
  check (
    (card_state='raw' and raw_condition is not null and grader is null and grade is null)
    or (card_state='graded' and raw_condition is null and grader is not null and grade is not null)
    or (card_state='sealed' and raw_condition is null and grader is null and grade is null)
  );

comment on constraint card_watchlist_card_state_check on public.card_watchlist is
  'Watch targets may follow raw cards, graded cards, or sealed products.';
