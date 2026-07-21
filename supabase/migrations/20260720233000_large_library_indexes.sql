-- Match the owner-scoped stable paging and complete FIFO-lot lookup used by the app.
create index if not exists collection_items_owner_created_id_idx
  on public.collection_items(user_id,created_at desc,id desc);

create index if not exists purchase_lots_item_owner_acquired_idx
  on public.purchase_lots(collection_item_id,user_id,acquired_at,id);
