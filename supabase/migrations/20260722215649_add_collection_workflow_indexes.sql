create index if not exists collection_items_card_id_idx
  on public.collection_items (card_id)
  where card_id is not null;

create index if not exists collection_transactions_item_owner_idx
  on public.collection_transactions (collection_item_id, user_id);

create index if not exists purchase_lots_owner_idx
  on public.purchase_lots (user_id);
