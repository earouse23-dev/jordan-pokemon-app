create or replace function public.bulk_organize_collection_items(
  p_ids uuid[],
  p_label text default null,
  p_label_mode text default 'keep',
  p_location text default null,
  p_location_mode text default 'keep',
  p_status text default 'keep'
)
returns table(collection_item_id uuid)
language plpgsql
security invoker
set search_path=''
as $$
begin
  if coalesce(array_length(p_ids,1),0) not between 1 and 500 then
    raise exception 'Choose between 1 and 500 positions.';
  end if;
  if p_label_mode not in ('keep','add','remove')
    or p_location_mode not in ('keep','set','clear')
    or p_status not in ('keep','owned','archived') then
    raise exception 'Unsupported organization action.';
  end if;
  if p_label_mode <> 'keep' and (nullif(btrim(p_label),'') is null or char_length(btrim(p_label)) > 40) then
    raise exception 'Labels must contain 1 to 40 characters.';
  end if;
  if p_location_mode = 'set' and (nullif(btrim(p_location),'') is null or char_length(btrim(p_location)) > 250) then
    raise exception 'Storage locations must contain 1 to 250 characters.';
  end if;
  if p_label_mode = 'keep' and p_location_mode = 'keep' and p_status = 'keep' then
    raise exception 'Choose at least one change.';
  end if;

  return query
  update public.collection_items as item
  set tags = case p_label_mode
      when 'add' then case
        when exists(select 1 from unnest(item.tags) as tag where lower(tag)=lower(btrim(p_label))) then item.tags
        else item.tags || btrim(p_label)
      end
      when 'remove' then array(select tag from unnest(item.tags) as tag where lower(tag)<>lower(btrim(p_label)))
      else item.tags
    end,
    storage_location = case p_location_mode
      when 'set' then btrim(p_location)
      when 'clear' then null
      else item.storage_location
    end,
    status = case when p_status='keep' then item.status else p_status end,
    asking_price = case when p_status='keep' then item.asking_price else null end,
    listing_venue = case when p_status='keep' then item.listing_venue else null end,
    listed_at = case when p_status='keep' then item.listed_at else null end,
    price_reviewed_at = case when p_status='keep' then item.price_reviewed_at else null end,
    updated_at = now()
  where item.user_id=(select auth.uid())
    and item.id=any(p_ids)
  returning item.id;
end;
$$;

revoke all on function public.bulk_organize_collection_items(uuid[],text,text,text,text,text) from public,anon;
grant execute on function public.bulk_organize_collection_items(uuid[],text,text,text,text,text) to authenticated,service_role;

comment on function public.bulk_organize_collection_items(uuid[],text,text,text,text,text) is
  'Owner-scoped bulk organization for labels, storage location, and owned/archive status.';
