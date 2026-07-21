-- Let an owner complete missing history on an imported purchase lot without
-- replacing the position or inventing cost basis. Existing FIFO allocations
-- are rebalanced so remaining plus sold basis still equals the entered total.

create or replace function public.complete_unknown_purchase_lot(
  p_purchase_lot_id uuid,
  p_total_acquisition_cost numeric default null,
  p_acquired_at date default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  target_lot public.purchase_lots%rowtype;
  unit_amount numeric(14,2);
  subtotal_amount numeric(14,2);
  remaining_amount numeric(14,2);
  sold_amount numeric(14,2);
  sold_quantity integer;
  allocated_so_far numeric(14,2) := 0;
  allocation_number integer := 0;
  allocation_count integer := 0;
  allocation record;
  allocation_amount numeric(14,2);
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_total_acquisition_cost is null and p_acquired_at is null then
    raise exception 'missing_acquisition_detail';
  end if;
  if p_total_acquisition_cost is not null and
     (p_total_acquisition_cost < 0 or p_total_acquisition_cost > 999999999999.99) then
    raise exception 'invalid_total_acquisition_cost';
  end if;
  if p_acquired_at is not null and p_acquired_at > current_date then
    raise exception 'future_acquisition_date';
  end if;

  select lot.* into target_lot
  from public.purchase_lots lot
  where lot.id=p_purchase_lot_id and lot.user_id=owner_id
  for update;
  if not found then raise exception 'purchase_lot_not_found'; end if;
  if p_total_acquisition_cost is not null and target_lot.cost_basis_known then
    raise exception 'acquisition_cost_already_known';
  end if;
  if p_acquired_at is not null and target_lot.acquired_at_known then
    raise exception 'acquisition_date_already_known';
  end if;

  if p_total_acquisition_cost is not null then
    -- Use whole cents per unit and retain any remainder as an acquisition cost,
    -- matching Mica's existing one-total acquisition workflow.
    unit_amount := trunc((p_total_acquisition_cost*100)/target_lot.quantity_acquired)/100;
    subtotal_amount := round(unit_amount*target_lot.quantity_acquired,2);
    remaining_amount := round(
      p_total_acquisition_cost*target_lot.quantity_remaining/target_lot.quantity_acquired,
      2
    );
    sold_amount := p_total_acquisition_cost-remaining_amount;
    sold_quantity := target_lot.quantity_acquired-target_lot.quantity_remaining;

    update public.collection_transactions transaction
    set unit_price=unit_amount,
        subtotal=subtotal_amount,
        tax=0,
        shipping=0,
        marketplace_fees=0,
        grading_fees=0,
        other_costs=p_total_acquisition_cost-subtotal_amount,
        total_cost=p_total_acquisition_cost,
        updated_at=now()
    where transaction.id=target_lot.purchase_transaction_id
      and transaction.user_id=owner_id
      and transaction.collection_item_id=target_lot.collection_item_id
      and transaction.transaction_type='purchase';
    if not found then raise exception 'purchase_transaction_not_found'; end if;

    update public.purchase_lots lot
    set total_cost=p_total_acquisition_cost,
        remaining_cost=remaining_amount,
        cost_basis_known=true
    where lot.id=target_lot.id and lot.user_id=owner_id;

    -- Distribute the sold portion by allocation quantity, putting any rounding
    -- remainder on the final allocation so no cent disappears.
    if sold_quantity > 0 then
      select count(*) into allocation_count
      from public.fifo_lot_allocations fifo
      where fifo.purchase_lot_id=target_lot.id and fifo.user_id=owner_id;
      for allocation in
        select fifo.id,fifo.quantity
        from public.fifo_lot_allocations fifo
        where fifo.purchase_lot_id=target_lot.id and fifo.user_id=owner_id
        order by fifo.created_at,fifo.id
        for update
      loop
        allocation_number := allocation_number+1;
        allocation_amount := case
          when allocation_number=allocation_count
            then sold_amount-allocated_so_far
          else round(sold_amount*allocation.quantity/sold_quantity,2)
        end;
        update public.fifo_lot_allocations fifo
        set allocated_cost=allocation_amount,cost_basis_known=true
        where fifo.id=allocation.id and fifo.user_id=owner_id;
        allocated_so_far := allocated_so_far+allocation_amount;
      end loop;
      if allocated_so_far<>sold_amount then raise exception 'fifo_allocation_incomplete'; end if;
    end if;
  end if;

  if p_acquired_at is not null then
    update public.collection_transactions transaction
    set transaction_date=p_acquired_at,updated_at=now()
    where transaction.id=target_lot.purchase_transaction_id
      and transaction.user_id=owner_id
      and transaction.collection_item_id=target_lot.collection_item_id
      and transaction.transaction_type='purchase';
    if not found then raise exception 'purchase_transaction_not_found'; end if;
    update public.purchase_lots lot
    set acquired_at=p_acquired_at,acquired_at_known=true
    where lot.id=target_lot.id and lot.user_id=owner_id;
  end if;

  update public.collection_items item
  set identity_snapshot=(case
        when p_acquired_at is null then (case
          when p_total_acquisition_cost is null then item.identity_snapshot
          else jsonb_set(item.identity_snapshot,'{acquisitionCostKnown}','true'::jsonb,true)
        end)
        else jsonb_set((case
          when p_total_acquisition_cost is null then item.identity_snapshot
          else jsonb_set(item.identity_snapshot,'{acquisitionCostKnown}','true'::jsonb,true)
        end),'{acquisitionDateKnown}','true'::jsonb,true)
      end),
      updated_at=now()
  where item.id=target_lot.collection_item_id and item.user_id=owner_id;

  return target_lot.collection_item_id;
end $$;

revoke all on function public.complete_unknown_purchase_lot(uuid,numeric,date) from public,anon;
grant execute on function public.complete_unknown_purchase_lot(uuid,numeric,date) to authenticated;
