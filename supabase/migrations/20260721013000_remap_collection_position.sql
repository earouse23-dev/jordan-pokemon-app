-- Owners may correct an imported or misidentified card without rebuilding its
-- financial ledger. Old position-scoped prices are deleted atomically so a
-- different card's observations cannot survive the identity correction.

drop policy if exists "position price history owners can delete" on public.position_price_observations;
create policy "position price history owners can delete" on public.position_price_observations
  for delete to authenticated using ((select auth.uid())=user_id);
grant delete on public.position_price_observations to authenticated;

create or replace function public.remap_collection_position(
  p_collection_item_id uuid,
  p_identity jsonb,
  p_card_id uuid default null,
  p_variant_id uuid default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  previous_identity jsonb;
  position_state text;
  next_identity jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_identity is null or jsonb_typeof(p_identity)<>'object' or octet_length(p_identity::text)>10000 then
    raise exception 'invalid_identity';
  end if;
  if char_length(trim(coalesce(p_identity->>'name',''))) not between 1 and 200
     or char_length(trim(coalesce(p_identity->>'set',''))) not between 1 and 200
     or char_length(trim(coalesce(p_identity->>'number',''))) not between 1 and 80
     or char_length(trim(coalesce(p_identity->>'variant',''))) not between 1 and 120
     or coalesce(p_identity->>'language','') !~ '^[a-z]{2}(-[a-z]{2})?$'
     or char_length(coalesce(p_identity->>'providerCardId','')) not between 1 and 160
     or jsonb_typeof(coalesce(p_identity->'externalIds','{}'::jsonb))<>'object' then
    raise exception 'invalid_identity';
  end if;

  select item.identity_snapshot,item.card_state
  into previous_identity,position_state
  from public.collection_items item
  where item.id=p_collection_item_id and item.user_id=owner_id
  for update;
  if not found then raise exception 'position_not_found'; end if;
  if position_state='sealed' then raise exception 'sealed_position_remap_not_supported'; end if;

  if p_card_id is not null and not exists(
    select 1 from public.cards card where card.id=p_card_id and card.game='pokemon'
  ) then raise exception 'card_not_found'; end if;
  if p_variant_id is not null and (
    p_card_id is null or not exists(
      select 1 from public.card_variants variant
      where variant.id=p_variant_id and variant.card_id=p_card_id
    )
  ) then raise exception 'variant_not_found'; end if;

  next_identity := p_identity;
  if previous_identity ? 'acquisitionCostKnown' then
    next_identity := jsonb_set(next_identity,'{acquisitionCostKnown}',previous_identity->'acquisitionCostKnown',true);
  end if;
  if previous_identity ? 'acquisitionDateKnown' then
    next_identity := jsonb_set(next_identity,'{acquisitionDateKnown}',previous_identity->'acquisitionDateKnown',true);
  end if;

  update public.collection_items item
  set identity_snapshot=next_identity,
      card_id=p_card_id,
      variant_id=p_variant_id,
      updated_at=now()
  where item.id=p_collection_item_id and item.user_id=owner_id;

  delete from public.position_price_observations observation
  where observation.collection_item_id=p_collection_item_id
    and observation.user_id=owner_id;

  return p_collection_item_id;
end $$;

revoke all on function public.remap_collection_position(uuid,jsonb,uuid,uuid) from public,anon;
grant execute on function public.remap_collection_position(uuid,jsonb,uuid,uuid) to authenticated;
