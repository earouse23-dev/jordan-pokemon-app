-- Step 8: one owner-scoped organization model for folders, labels, physical
-- locations, saved views, exact goals, attachments, custom fields, and
-- recoverable bulk changes. This migration is staged only; production remains
-- unchanged until the Step 12 release gate.

create schema if not exists organization_private;
revoke all on schema organization_private from public,anon,authenticated;

alter table public.collections
  add column if not exists description text,
  add column if not exists color text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.saved_views
  add column if not exists collection_id uuid,
  add column if not exists configuration_version text not null default 'mica-organization-v1',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists(select 1 from pg_constraint where conname='saved_views_collection_owner_fk') then
    alter table public.saved_views add constraint saved_views_collection_owner_fk
      foreign key(collection_id,user_id) references public.collections(id,user_id) on delete cascade;
  end if;
  if not exists(select 1 from pg_constraint where conname='saved_views_name_length_check') then
    alter table public.saved_views add constraint saved_views_name_length_check
      check(char_length(btrim(name)) between 1 and 100);
  end if;
  if not exists(select 1 from pg_constraint where conname='saved_views_configuration_object_check') then
    alter table public.saved_views add constraint saved_views_configuration_object_check
      check(jsonb_typeof(configuration)='object' and pg_column_size(configuration)<=16384);
  end if;
end
$$;

create index if not exists saved_views_owner_name_idx
  on public.saved_views(user_id,lower(name));
create index if not exists saved_views_owner_collection_idx
  on public.saved_views(user_id,collection_id,updated_at desc);

create or replace function organization_private.valid_custom_fields(p_value jsonb)
returns boolean
language sql
immutable
set search_path=''
as $$
  select jsonb_typeof(coalesce(p_value,'{}'::jsonb))='object'
    and pg_column_size(coalesce(p_value,'{}'::jsonb))<=16384
    and (select count(*)<=20 from jsonb_each(coalesce(p_value,'{}'::jsonb)))
    and not exists(
      select 1 from jsonb_each(coalesce(p_value,'{}'::jsonb)) field
      where char_length(field.key) not between 1 and 40
        or field.key !~ '^[a-z0-9][a-z0-9_-]*$'
        or jsonb_typeof(field.value) not in ('string','number','boolean')
        or (jsonb_typeof(field.value)='string' and char_length(field.value #>> '{}')>500)
    );
$$;

create or replace function organization_private.searchable_labels(p_value text[])
returns text
language sql
immutable
set search_path=''
as $$
  select array_to_string(coalesce(p_value,'{}'::text[]),' ');
$$;

create or replace function organization_private.indexed_item_aliases(
  p_collectible_id uuid,
  p_variant_id uuid,
  p_identity jsonb
)
returns text[]
language sql
immutable
set search_path=''
as $$
  select array_remove(array[
    p_collectible_id::text,
    p_variant_id::text,
    p_identity #>> '{externalIds,tcgdex}',
    p_identity #>> '{externalIds,pkmnprices}',
    p_identity #>> '{externalIds,tcgplayer}',
    p_identity #>> '{externalIds,justtcg}',
    case when
      p_collectible_id is null and p_variant_id is null
      and nullif(p_identity #>> '{externalIds,tcgdex}','') is null
      and nullif(p_identity #>> '{externalIds,pkmnprices}','') is null
      and nullif(p_identity #>> '{externalIds,tcgplayer}','') is null
      and nullif(p_identity #>> '{externalIds,justtcg}','') is null
      and nullif(p_identity->>'language','') is not null
      and nullif(coalesce(p_identity->>'setId',p_identity->>'set'),'') is not null
      and nullif(coalesce(p_identity->>'number',p_identity->>'collectorNumber'),'') is not null
      and nullif(coalesce(p_identity->>'variant',p_identity->>'finish'),'') is not null
    then 'identity:'||lower(p_identity->>'language')||':'||
      lower(coalesce(p_identity->>'setId',p_identity->>'set'))||':'||
      lower(coalesce(p_identity->>'number',p_identity->>'collectorNumber'))||':'||
      lower(coalesce(p_identity->>'variant',p_identity->>'finish'))
    end
  ],null);
$$;

alter table public.collection_items
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add column if not exists organization_version text not null default 'mica-organization-v1',
  add column if not exists organization_aliases text[] generated always as (
    organization_private.indexed_item_aliases(collectible_id,variant_id,identity_snapshot)
  ) stored;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='collection_items_custom_fields_check') then
    alter table public.collection_items add constraint collection_items_custom_fields_check
      check(organization_private.valid_custom_fields(custom_fields));
  end if;
end
$$;

alter table public.collection_items
  add column if not exists organization_search tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(identity_snapshot->>'name','') || ' ' ||
      coalesce(identity_snapshot->>'set','') || ' ' ||
      coalesce(identity_snapshot->>'setName','') || ' ' ||
      coalesce(identity_snapshot->>'number','') || ' ' ||
      coalesce(identity_snapshot->>'collectorNumber','') || ' ' ||
      coalesce(identity_snapshot->>'artist','') || ' ' ||
      coalesce(identity_snapshot->>'rarity','') || ' ' ||
      coalesce(storage_location,'') || ' ' ||
      organization_private.searchable_labels(tags)
    )
  ) stored;

create index if not exists collection_items_organization_search_idx
  on public.collection_items using gin(organization_search);
create index if not exists collection_items_organization_aliases_idx
  on public.collection_items using gin(organization_aliases);
create index if not exists collection_items_owner_updated_idx
  on public.collection_items(user_id,updated_at desc,id desc);
create index if not exists collection_items_owner_name_idx
  on public.collection_items(user_id,lower(coalesce(identity_snapshot->>'name','')),id);
create index if not exists collection_items_owner_location_idx
  on public.collection_items(user_id,lower(coalesce(storage_location,'')),id);
create index if not exists collection_items_owner_set_idx
  on public.collection_items(user_id,lower(coalesce(identity_snapshot->>'set',identity_snapshot->>'setName','')),id);
create index if not exists collection_items_owner_language_idx
  on public.collection_items(user_id,lower(coalesce(identity_snapshot->>'language','')),id);

-- Preserve any early normalized tag records in the now-canonical item labels.
update public.collection_items item
set tags=(
  select coalesce(array_agg(value order by value),'{}'::text[])
  from (
    select distinct on (lower(value)) value
    from (
      select unnest(item.tags) value
      union all
      select tag.name
      from public.collection_item_tags link
      join public.collection_tags tag on tag.id=link.tag_id and tag.user_id=link.user_id
      where link.collection_item_id=item.id and link.user_id=item.user_id
    ) source
    where nullif(btrim(value),'') is not null and char_length(btrim(value))<=40
    order by lower(value),value
  ) labels
)
where exists(
  select 1 from public.collection_item_tags link
  where link.collection_item_id=item.id and link.user_id=item.user_id
);

comment on table public.collections is
  'Owner digital folders. Each position belongs to one folder; labels remain flexible many-to-one organization.';
comment on column public.collection_items.tags is
  'Canonical flexible labels. collection_tags and collection_item_tags are retained only for legacy migration compatibility.';
comment on column public.collection_items.storage_location is
  'Owner-entered physical path such as room, shelf, box, binder, page, or display.';
comment on table public.saved_views is
  'Versioned reusable filters/sorts. Saved views are dynamic queries and never duplicate or move inventory.';
comment on table public.card_watchlist is
  'Buying intent and price-alert state; not a collection folder, label, or saved view.';

create table if not exists public.collection_custom_field_definitions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check(key ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  name text not null check(char_length(btrim(name)) between 1 and 80),
  value_type text not null check(value_type in ('text','number','boolean','date')),
  help_text text check(char_length(help_text)<=300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,key),
  unique(id,user_id)
);
create index if not exists collection_custom_fields_owner_idx
  on public.collection_custom_field_definitions(user_id,lower(name));

create or replace function organization_private.validate_item_custom_fields()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  field record;
  expected_type text;
begin
  if not organization_private.valid_custom_fields(new.custom_fields) then
    raise exception 'invalid_custom_fields';
  end if;
  for field in select key,value from jsonb_each(new.custom_fields) loop
    select definition.value_type into expected_type
    from public.collection_custom_field_definitions definition
    where definition.user_id=new.user_id and definition.key=field.key;
    if expected_type is null then raise exception 'custom_field_definition_missing'; end if;
    if (expected_type='text' and jsonb_typeof(field.value)<>'string')
      or (expected_type='number' and jsonb_typeof(field.value)<>'number')
      or (expected_type='boolean' and jsonb_typeof(field.value)<>'boolean')
      or (expected_type='date' and (
        jsonb_typeof(field.value)<>'string'
        or (field.value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$'
      ))
    then raise exception 'custom_field_type_mismatch'; end if;
    if expected_type='date' then
      begin
        perform (field.value #>> '{}')::date;
      exception when others then
        raise exception 'custom_field_type_mismatch';
      end;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function organization_private.protect_used_custom_field_definition()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists(
    select 1 from public.collection_items item
    where item.user_id=old.user_id and item.custom_fields ? old.key
  ) then raise exception 'custom_field_definition_in_use'; end if;
  return old;
end;
$$;

drop trigger if exists collection_items_validate_custom_fields on public.collection_items;
create trigger collection_items_validate_custom_fields
before insert or update of custom_fields on public.collection_items
for each row execute function organization_private.validate_item_custom_fields();

drop trigger if exists collection_custom_field_definition_delete_guard on public.collection_custom_field_definitions;
create trigger collection_custom_field_definition_delete_guard
before delete on public.collection_custom_field_definitions
for each row execute function organization_private.protect_used_custom_field_definition();

create table if not exists public.collection_item_attachments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid not null,
  kind text not null check(kind in ('photo','document')),
  storage_path text not null check(char_length(storage_path) between 1 and 500),
  filename text not null check(char_length(filename) between 1 and 255),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  byte_size integer not null check(byte_size between 1 and 10485760),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  caption text check(char_length(caption)<=500),
  created_at timestamptz not null default now(),
  foreign key(collection_item_id,user_id) references public.collection_items(id,user_id) on delete cascade,
  unique(user_id,storage_path),
  unique(id,user_id)
);
create index if not exists collection_attachments_item_idx
  on public.collection_item_attachments(user_id,collection_item_id,created_at desc);

create table if not exists public.collection_goals(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid,
  name text not null check(char_length(btrim(name)) between 1 and 120),
  goal_type text not null check(goal_type in ('checklist','quantity')),
  dimension text not null check(dimension in ('set','subset','artist','character','rarity','language','finish','condition')),
  criteria jsonb not null default '{}'::jsonb check(jsonb_typeof(criteria)='object' and pg_column_size(criteria)<=8192),
  targets jsonb not null default '[]'::jsonb check(jsonb_typeof(targets)='array' and jsonb_array_length(targets)<=2000 and pg_column_size(targets)<=524288),
  target_count integer check(target_count between 1 and 1000000),
  metadata_status text not null default 'incomplete' check(metadata_status in ('verified','incomplete','unsupported')),
  catalog_source text,
  catalog_version text,
  last_progress jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(collection_id,user_id) references public.collections(id,user_id) on delete cascade,
  unique(id,user_id),
  check((goal_type='checklist' and target_count is null) or (goal_type='quantity' and target_count is not null))
);
create index if not exists collection_goals_owner_idx
  on public.collection_goals(user_id,archived_at,updated_at desc);

create table if not exists public.collection_goal_events(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  event_type text not null check(event_type in ('created','completed','reopened','archived','restored')),
  progress jsonb not null check(jsonb_typeof(progress)='object'),
  occurred_at timestamptz not null default now(),
  foreign key(goal_id,user_id) references public.collection_goals(id,user_id) on delete cascade
);
create index if not exists collection_goal_events_owner_idx
  on public.collection_goal_events(user_id,goal_id,occurred_at desc);

create table if not exists public.collection_organization_operations(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null check(operation_type in ('bulk_edit','undo')),
  item_count integer not null check(item_count between 1 and 500),
  requested_changes jsonb not null check(jsonb_typeof(requested_changes)='object'),
  item_snapshots jsonb not null check(jsonb_typeof(item_snapshots)='array'),
  reverses_operation_id uuid,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key(reverses_operation_id,user_id) references public.collection_organization_operations(id,user_id)
);
create index if not exists collection_org_operations_owner_idx
  on public.collection_organization_operations(user_id,created_at desc);

create or replace function organization_private.item_aliases(p_item public.collection_items)
returns text[]
language sql
stable
set search_path=''
as $$
  select p_item.organization_aliases;
$$;

create or replace function organization_private.item_matches_criteria(
  p_item public.collection_items,
  p_criteria jsonb
)
returns boolean
language sql
stable
set search_path=''
as $$
  select
    (not p_criteria ? 'set' or lower(coalesce(p_item.identity_snapshot->>'set',p_item.identity_snapshot->>'setName',''))=lower(p_criteria->>'set'))
    and (not p_criteria ? 'subset' or lower(coalesce(p_item.identity_snapshot->>'subset',p_item.identity_snapshot->>'set',''))=lower(p_criteria->>'subset'))
    and (not p_criteria ? 'artist' or lower(coalesce(p_item.identity_snapshot->>'artist',''))=lower(p_criteria->>'artist'))
    and (not p_criteria ? 'character' or lower(coalesce(p_item.identity_snapshot->>'character',p_item.identity_snapshot->>'name',''))=lower(p_criteria->>'character'))
    and (not p_criteria ? 'rarity' or lower(coalesce(p_item.identity_snapshot->>'rarity',''))=lower(p_criteria->>'rarity'))
    and (not p_criteria ? 'language' or lower(coalesce(p_item.identity_snapshot->>'language',''))=lower(p_criteria->>'language'))
    and (not p_criteria ? 'finish' or lower(coalesce(p_item.identity_snapshot->>'finish',p_item.identity_snapshot->>'variant',''))=lower(p_criteria->>'finish'))
    and (not p_criteria ? 'condition' or lower(case when p_item.card_state='graded' then coalesce(p_item.grader,'')||' '||coalesce(p_item.grade::text,'') else coalesce(p_item.raw_condition,'') end)=lower(p_criteria->>'condition'));
$$;

create or replace function organization_private.calculate_goal(p_goal public.collection_goals)
returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare
  owned integer:=0;
  target integer:=0;
  missing jsonb:='[]'::jsonb;
begin
  if p_goal.metadata_status<>'verified' then
    return jsonb_build_object(
      'status',p_goal.metadata_status,'current',null,'target',null,
      'percent',null,'complete',false,'missing','[]'::jsonb
    );
  end if;
  if p_goal.goal_type='checklist' then
    target:=jsonb_array_length(p_goal.targets);
    if target=0 then
      return jsonb_build_object(
        'status','incomplete','current',null,'target',null,
        'percent',null,'complete',false,'missing','[]'::jsonb
      );
    end if;
    with target_rows as (
      select value as target_value
      from jsonb_array_elements(p_goal.targets)
    ), unmatched as (
      select target.target_value
      from target_rows target
      where not exists(
        select 1 from public.collection_items item
        where item.user_id=p_goal.user_id
          and (p_goal.collection_id is null or item.collection_id=p_goal.collection_id)
          and item.status not in ('sold','deleted') and item.quantity>0
          and (
            p_goal.criteria='{}'::jsonb
            or organization_private.item_matches_criteria(item,p_goal.criteria)
          )
          and item.organization_aliases && array(
            select alias from (
              select target.target_value->>'key' alias
              union all
              select jsonb_array_elements_text(coalesce(target.target_value->'aliases','[]'::jsonb))
            ) aliases where nullif(alias,'') is not null
          )
      )
    )
    select count(*),coalesce(jsonb_agg(target_value order by target_value->>'label'),'[]'::jsonb)
      into owned,missing from unmatched;
    owned:=target-owned;
  else
    target:=p_goal.target_count;
    select coalesce(sum(item.quantity),0)::integer into owned
    from public.collection_items item
    where item.user_id=p_goal.user_id
      and (p_goal.collection_id is null or item.collection_id=p_goal.collection_id)
      and item.status not in ('sold','deleted') and item.quantity>0
      and organization_private.item_matches_criteria(item,p_goal.criteria);
  end if;
  return jsonb_build_object(
    'status','ready','current',owned,'target',target,
    'percent',least(100,round((owned::numeric/nullif(target,0))*100,1)),
    'complete',owned>=target,'missing',missing
  );
end;
$$;

create or replace function organization_private.refresh_goals(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  goal_row public.collection_goals%rowtype;
  progress jsonb;
  was_complete boolean;
  is_complete boolean;
begin
  if p_user_id is null then return; end if;
  for goal_row in
    select * from public.collection_goals
    where user_id=p_user_id and archived_at is null
    for update
  loop
    progress:=organization_private.calculate_goal(goal_row);
    was_complete:=coalesce((goal_row.last_progress->>'complete')::boolean,false);
    is_complete:=coalesce((progress->>'complete')::boolean,false);
    update public.collection_goals
      set last_progress=progress,updated_at=now()
      where id=goal_row.id and user_id=p_user_id;
    if goal_row.last_progress<>'{}'::jsonb and was_complete is distinct from is_complete then
      insert into public.collection_goal_events(user_id,goal_id,event_type,progress)
      values(p_user_id,goal_row.id,case when is_complete then 'completed' else 'reopened' end,progress);
    end if;
  end loop;
end;
$$;

create or replace function organization_private.refresh_goal_definition()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='INSERT' then
    insert into public.collection_goal_events(user_id,goal_id,event_type,progress)
    values(new.user_id,new.id,'created','{}'::jsonb);
  elsif old.archived_at is distinct from new.archived_at then
    insert into public.collection_goal_events(user_id,goal_id,event_type,progress)
    values(new.user_id,new.id,case when new.archived_at is null then 'restored' else 'archived' end,new.last_progress);
  end if;
  perform organization_private.refresh_goals(new.user_id);
  return new;
end;
$$;

drop trigger if exists collection_goal_definition_refresh on public.collection_goals;
create trigger collection_goal_definition_refresh
after insert or update of goal_type,dimension,criteria,targets,target_count,metadata_status,collection_id,archived_at
on public.collection_goals for each row execute function organization_private.refresh_goal_definition();

create or replace function organization_private.refresh_goals_from_new_rows()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid;
begin
  for owner_id in select distinct user_id from new_rows loop
    perform organization_private.refresh_goals(owner_id);
  end loop;
  return null;
end;
$$;
create or replace function organization_private.refresh_goals_from_old_rows()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid;
begin
  for owner_id in select distinct user_id from old_rows loop
    perform organization_private.refresh_goals(owner_id);
  end loop;
  return null;
end;
$$;
create or replace function organization_private.refresh_goals_from_updated_rows()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid;
begin
  for owner_id in
    select distinct changed.user_id
    from (
      select new_item.user_id
      from new_rows new_item
      join old_rows old_item on old_item.id=new_item.id
      where (
        new_item.quantity,new_item.status,new_item.collection_id,
        new_item.identity_snapshot,new_item.collectible_id,new_item.variant_id,
        new_item.raw_condition,new_item.grader,new_item.grade
      ) is distinct from (
        old_item.quantity,old_item.status,old_item.collection_id,
        old_item.identity_snapshot,old_item.collectible_id,old_item.variant_id,
        old_item.raw_condition,old_item.grader,old_item.grade
      )
    ) changed
  loop
    perform organization_private.refresh_goals(owner_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists collection_items_goal_insert on public.collection_items;
drop trigger if exists collection_items_goal_update on public.collection_items;
drop trigger if exists collection_items_goal_delete on public.collection_items;
create trigger collection_items_goal_insert after insert on public.collection_items
  referencing new table as new_rows for each statement
  execute function organization_private.refresh_goals_from_new_rows();
create trigger collection_items_goal_update after update
  on public.collection_items referencing old table as old_rows new table as new_rows for each statement
  execute function organization_private.refresh_goals_from_updated_rows();
create trigger collection_items_goal_delete after delete on public.collection_items
  referencing old table as old_rows for each statement
  execute function organization_private.refresh_goals_from_old_rows();

create or replace function organization_private.apply_import_organization()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  imported record;
  folder_id uuid;
  folder_name text;
  custom_values jsonb;
  field record;
  field_type text;
begin
  if new.status<>'committed' or old.status='committed' then return new; end if;
  for imported in
    select item.row_number,item.collection_item_id,staged.payload
    from public.import_job_items item
    join public.import_staged_rows staged
      on staged.import_job_id=item.import_job_id
      and staged.user_id=item.user_id
      and staged.row_number=item.row_number
    where item.import_job_id=new.id and item.user_id=new.user_id and item.action='created'
    order by item.row_number
  loop
    folder_name:=nullif(btrim(imported.payload->>'folder'),'');
    custom_values:=coalesce(imported.payload->'customFields','{}'::jsonb);
    if folder_name is not null and char_length(folder_name)>100 then raise exception 'import_folder_too_long'; end if;
    if not organization_private.valid_custom_fields(custom_values) then raise exception 'invalid_import_custom_fields'; end if;
    folder_id:=null;
    if folder_name is not null then
      select id into folder_id from public.collections
      where user_id=new.user_id and lower(name)=lower(folder_name)
      order by created_at,id limit 1;
      if folder_id is null then
        insert into public.collections(user_id,name)
        values(new.user_id,folder_name) returning id into folder_id;
      end if;
    end if;
    for field in select key,value from jsonb_each(custom_values) loop
      field_type:=case jsonb_typeof(field.value)
        when 'number' then 'number' when 'boolean' then 'boolean' else 'text' end;
      insert into public.collection_custom_field_definitions(user_id,key,name,value_type)
      values(new.user_id,field.key,initcap(replace(field.key,'_',' ')),field_type)
      on conflict(user_id,key) do nothing;
    end loop;
    update public.collection_items set
      collection_id=coalesce(folder_id,collection_id),
      custom_fields=custom_values,
      updated_at=now()
    where id=imported.collection_item_id and user_id=new.user_id;
    update public.import_job_items job_item set item_snapshot=(
      select jsonb_build_object(
        'identitySnapshot',item.identity_snapshot,'quantity',item.quantity,
        'cardState',item.card_state,'rawCondition',item.raw_condition,
        'grader',item.grader,'grade',item.grade,
        'certificationNumber',item.certification_number,'notes',item.notes,
        'location',item.storage_location,'status',item.status,
        'currency',item.currency,'tags',to_jsonb(item.tags),
        'collectionId',item.collection_id,'customFields',item.custom_fields
      ) from public.collection_items item
      where item.id=imported.collection_item_id and item.user_id=new.user_id
    ) where job_item.import_job_id=new.id
      and job_item.row_number=imported.row_number
      and job_item.user_id=new.user_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists collection_import_organization on public.import_jobs;
create trigger collection_import_organization
after update of status on public.import_jobs for each row
execute function organization_private.apply_import_organization();

create or replace function public.rollback_collection_import_v2(p_import_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  job_status text;
  imported record;
  current_snapshot jsonb;
  transaction_count integer;
  removed_count integer:=0;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select status into job_status from public.import_jobs
    where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status='rolled_back' then return jsonb_build_object('status','rolled_back','removedRows',0); end if;
  if job_status<>'committed' then raise exception 'import_not_committed'; end if;
  for imported in
    select * from public.import_job_items
    where import_job_id=p_import_job_id and user_id=owner_id and action='created'
    order by row_number for update
  loop
    if imported.collection_item_id is null then continue; end if;
    select jsonb_build_object(
      'identitySnapshot',item.identity_snapshot,'quantity',item.quantity,
      'cardState',item.card_state,'rawCondition',item.raw_condition,
      'grader',item.grader,'grade',item.grade,
      'certificationNumber',item.certification_number,'notes',item.notes,
      'location',item.storage_location,'status',item.status,
      'currency',item.currency,'tags',to_jsonb(item.tags),
      'collectionId',item.collection_id,'customFields',item.custom_fields
    ) into current_snapshot from public.collection_items item
    where item.id=imported.collection_item_id and item.user_id=owner_id;
    if current_snapshot is null then continue; end if;
    if current_snapshot is distinct from imported.item_snapshot then raise exception 'import_position_changed_after_commit'; end if;
    select count(*) into transaction_count from public.collection_transactions transaction
    where transaction.collection_item_id=imported.collection_item_id and transaction.user_id=owner_id;
    if transaction_count<>1 or not exists(
      select 1 from public.collection_transactions transaction
      where transaction.collection_item_id=imported.collection_item_id
        and transaction.user_id=owner_id and transaction.idempotency_key=imported.idempotency_key
    ) then raise exception 'import_position_has_dependent_transactions'; end if;
    if exists(select 1 from public.grading_submissions submission where submission.collection_item_id=imported.collection_item_id and submission.user_id=owner_id)
      or exists(select 1 from public.grading_scan_sessions session where session.collection_item_id=imported.collection_item_id and session.user_id=owner_id)
      or exists(select 1 from public.digital_grade_assessments assessment where assessment.collection_item_id=imported.collection_item_id and assessment.user_id=owner_id)
      or exists(select 1 from public.identity_corrections correction where correction.collection_item_id=imported.collection_item_id and correction.user_id=owner_id)
      or exists(select 1 from public.collection_item_attachments attachment where attachment.collection_item_id=imported.collection_item_id and attachment.user_id=owner_id)
    then raise exception 'import_position_has_dependent_activity'; end if;
  end loop;
  for imported in
    select * from public.import_job_items
    where import_job_id=p_import_job_id and user_id=owner_id and action='created'
    order by row_number desc
  loop
    if imported.collection_item_id is null then continue; end if;
    delete from public.collection_items item
      where item.id=imported.collection_item_id and item.user_id=owner_id;
    if found then removed_count:=removed_count+1; end if;
  end loop;
  delete from public.valuation_snapshots snapshot where snapshot.user_id=owner_id;
  update public.import_jobs set
    status='rolled_back',rolled_back_at=now(),updated_at=now(),
    totals=totals||jsonb_build_object('status','rolled_back','removedRows',removed_count)
  where id=p_import_job_id and user_id=owner_id;
  return jsonb_build_object('status','rolled_back','removedRows',removed_count);
end;
$$;

create or replace function public.get_collection_organization_summary()
returns jsonb
language sql
security invoker
stable
set search_path=''
as $$
  select jsonb_build_object(
    'version','mica-organization-v1',
    'positionCount',count(*),
    'quantity',coalesce(sum(item.quantity),0),
    'missingLocationCount',count(*) filter(where nullif(btrim(item.storage_location),'') is null),
    'folderCount',(select count(*) from public.collections folder where folder.user_id=(select auth.uid()) and folder.archived_at is null),
    'labelCount',(select count(distinct lower(tag.value)) from public.collection_items labeled cross join lateral unnest(labeled.tags) as tag(value) where labeled.user_id=(select auth.uid())),
    'customFieldCount',(select count(*) from public.collection_custom_field_definitions field where field.user_id=(select auth.uid())),
    'attachmentCount',(select count(*) from public.collection_item_attachments attachment where attachment.user_id=(select auth.uid()))
  )
  from public.collection_items item
  where item.user_id=(select auth.uid()) and item.status not in ('sold','deleted');
$$;

create or replace function public.get_collection_goal_progress(p_goal_id uuid default null)
returns table(goal_id uuid,progress jsonb)
language plpgsql
security definer
set search_path=''
as $$
declare owner_id uuid:=(select auth.uid());
begin
  if owner_id is null then raise exception 'Sign in is required.'; end if;
  perform organization_private.refresh_goals(owner_id);
  return query select goal.id,goal.last_progress
    from public.collection_goals goal
    where goal.user_id=owner_id and (p_goal_id is null or goal.id=p_goal_id)
    order by goal.updated_at desc,goal.id;
end;
$$;

create or replace function public.search_collection_positions(
  p_query text default '',
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'name',
  p_limit integer default 100,
  p_after_value text default null,
  p_after_id uuid default null
)
returns table(position_row jsonb,total_count bigint,sort_value text)
language plpgsql
security invoker
stable
set search_path=''
as $$
begin
  if jsonb_typeof(coalesce(p_filters,'{}'::jsonb))<>'object' then raise exception 'Filters must be an object.'; end if;
  if p_filters ? 'labels' and jsonb_typeof(p_filters->'labels')<>'array' then raise exception 'Labels must be an array.'; end if;
  if p_filters ? 'graded' and jsonb_typeof(p_filters->'graded')<>'boolean' then raise exception 'Graded must be a boolean.'; end if;
  if p_sort not in ('name','updated-desc','created-desc','location') then raise exception 'Unsupported sort.'; end if;
  if p_limit not between 1 and 200 then raise exception 'Choose between 1 and 200 results.'; end if;
  if char_length(coalesce(p_query,''))>200 then raise exception 'Search is too long.'; end if;
  if (p_after_value is null) is distinct from (p_after_id is null) then raise exception 'Both cursor values are required.'; end if;
  return query
  with base as (
    select
      to_jsonb(item)-'organization_search' as row_json,
      item.id,
      case p_sort
        when 'updated-desc' then item.updated_at::text
        when 'created-desc' then item.created_at::text
        when 'location' then lower(coalesce(item.storage_location,''))
        else lower(coalesce(item.identity_snapshot->>'name',''))
      end as row_sort
    from public.collection_items item
    where item.user_id=(select auth.uid())
      and (nullif(btrim(p_query),'') is null or item.organization_search @@ websearch_to_tsquery('simple'::regconfig,p_query))
      and (not p_filters ? 'collectionId' or item.collection_id=(p_filters->>'collectionId')::uuid)
      and (not p_filters ? 'status' or item.status=p_filters->>'status')
      and (not p_filters ? 'cardState' or item.card_state=p_filters->>'cardState')
      and (not p_filters ? 'graded' or (
        (coalesce((p_filters->>'graded')::boolean,false) and (item.card_state='graded' or item.grader is not null))
        or (not coalesce((p_filters->>'graded')::boolean,false) and item.card_state<>'graded' and item.grader is null)
      ))
      and (not p_filters ? 'rawCondition' or item.raw_condition=p_filters->>'rawCondition')
      and (not p_filters ? 'grader' or lower(coalesce(item.grader,''))=lower(p_filters->>'grader'))
      and (not p_filters ? 'grade' or item.grade::text=p_filters->>'grade')
      and (not p_filters ? 'set' or lower(coalesce(item.identity_snapshot->>'set',item.identity_snapshot->>'setName',''))=lower(p_filters->>'set'))
      and (not p_filters ? 'language' or lower(coalesce(item.identity_snapshot->>'language',''))=lower(p_filters->>'language'))
      and (not p_filters ? 'rarity' or lower(coalesce(item.identity_snapshot->>'rarity',''))=lower(p_filters->>'rarity'))
      and (not p_filters ? 'artist' or lower(coalesce(item.identity_snapshot->>'artist',''))=lower(p_filters->>'artist'))
      and (not p_filters ? 'location' or lower(coalesce(item.storage_location,'')) like '%'||lower(p_filters->>'location')||'%')
      and (not p_filters ? 'labels' or item.tags @> array(select jsonb_array_elements_text(p_filters->'labels')))
  ), tallied as (
    select base.*,count(*) over() as matched_count from base
  ), paged as (
    select * from tallied
    where p_after_id is null
      or (p_sort in ('name','location') and (row_sort,id)>(p_after_value,p_after_id))
      or (p_sort in ('updated-desc','created-desc') and (row_sort,id)<(p_after_value,p_after_id))
    order by
      case when p_sort in ('name','location') then row_sort end asc,
      case when p_sort in ('updated-desc','created-desc') then row_sort end desc,
      case when p_sort in ('name','location') then id end asc,
      case when p_sort in ('updated-desc','created-desc') then id end desc
    limit p_limit
  )
  select row_json,matched_count,row_sort from paged;
end;
$$;

create or replace function public.bulk_organize_collection_items_v2(
  p_ids uuid[],
  p_label text default null,
  p_label_mode text default 'keep',
  p_location text default null,
  p_location_mode text default 'keep',
  p_status text default 'keep',
  p_collection_id uuid default null,
  p_collection_mode text default 'keep',
  p_custom_field_key text default null,
  p_custom_field_value jsonb default null,
  p_custom_field_mode text default 'keep'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  operation_id uuid:=gen_random_uuid();
  before_rows jsonb;
  after_rows jsonb;
  requested jsonb;
  custom_field_type text;
begin
  if owner_id is null then raise exception 'Sign in is required.'; end if;
  if coalesce(array_length(p_ids,1),0) not between 1 and 500 then raise exception 'Choose between 1 and 500 positions.'; end if;
  if (select count(distinct id) from public.collection_items where user_id=owner_id and id=any(p_ids))<>array_length(p_ids,1) then
    raise exception 'Some selected positions are unavailable.';
  end if;
  if p_label_mode not in ('keep','add','remove') or p_location_mode not in ('keep','set','clear')
    or p_status not in ('keep','owned','archived') or p_collection_mode not in ('keep','set')
    or p_custom_field_mode not in ('keep','set','clear') then raise exception 'Unsupported organization action.'; end if;
  if p_label_mode<>'keep' and (nullif(btrim(p_label),'') is null or char_length(btrim(p_label))>40) then raise exception 'Labels must contain 1 to 40 characters.'; end if;
  if p_location_mode='set' and (nullif(btrim(p_location),'') is null or char_length(btrim(p_location))>250) then raise exception 'Storage locations must contain 1 to 250 characters.'; end if;
  if p_collection_mode='set' and not exists(select 1 from public.collections where id=p_collection_id and user_id=owner_id and archived_at is null) then raise exception 'Folder is unavailable.'; end if;
  if p_custom_field_mode<>'keep' and (p_custom_field_key is null or p_custom_field_key !~ '^[a-z0-9][a-z0-9_-]{0,39}$') then raise exception 'Custom field is unavailable.'; end if;
  if p_custom_field_mode<>'keep' then
    select definition.value_type into custom_field_type
    from public.collection_custom_field_definitions definition
    where definition.user_id=owner_id and definition.key=p_custom_field_key;
    if custom_field_type is null then raise exception 'Custom field is unavailable.'; end if;
  end if;
  if p_custom_field_mode='set' and (p_custom_field_value is null or jsonb_typeof(p_custom_field_value) not in ('string','number','boolean')) then raise exception 'Custom field value is invalid.'; end if;
  if p_custom_field_mode='set' and (
    (custom_field_type='text' and jsonb_typeof(p_custom_field_value)<>'string')
    or (custom_field_type='number' and jsonb_typeof(p_custom_field_value)<>'number')
    or (custom_field_type='boolean' and jsonb_typeof(p_custom_field_value)<>'boolean')
    or (custom_field_type='date' and (jsonb_typeof(p_custom_field_value)<>'string' or (p_custom_field_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$'))
  ) then raise exception 'Custom field value does not match its definition.'; end if;
  if p_label_mode='keep' and p_location_mode='keep' and p_status='keep' and p_collection_mode='keep' and p_custom_field_mode='keep' then raise exception 'Choose at least one change.'; end if;

  perform 1 from public.collection_items item
    where item.user_id=owner_id and item.id=any(p_ids)
    order by item.id for update;
  select jsonb_agg(jsonb_build_object(
    'id',item.id,'before',jsonb_build_object(
      'collectionId',item.collection_id,'labels',to_jsonb(item.tags),
      'location',item.storage_location,'status',item.status,'customFields',item.custom_fields
    )
  ) order by item.id) into before_rows
  from public.collection_items item where item.user_id=owner_id and item.id=any(p_ids);

  update public.collection_items item set
    collection_id=case when p_collection_mode='set' then p_collection_id else item.collection_id end,
    tags=case p_label_mode
      when 'add' then case when exists(select 1 from unnest(item.tags) tag where lower(tag)=lower(btrim(p_label))) then item.tags else item.tags||btrim(p_label) end
      when 'remove' then array(select tag from unnest(item.tags) tag where lower(tag)<>lower(btrim(p_label)))
      else item.tags end,
    storage_location=case p_location_mode when 'set' then btrim(p_location) when 'clear' then null else item.storage_location end,
    status=case when p_status='keep' then item.status else p_status end,
    asking_price=case when p_status='keep' then item.asking_price else null end,
    listing_venue=case when p_status='keep' then item.listing_venue else null end,
    listed_at=case when p_status='keep' then item.listed_at else null end,
    price_reviewed_at=case when p_status='keep' then item.price_reviewed_at else null end,
    custom_fields=case p_custom_field_mode
      when 'set' then jsonb_set(item.custom_fields,array[p_custom_field_key],p_custom_field_value,true)
      when 'clear' then item.custom_fields-p_custom_field_key
      else item.custom_fields end,
    updated_at=now()
  where item.user_id=owner_id and item.id=any(p_ids);

  select jsonb_agg(entry||jsonb_build_object('after',jsonb_build_object(
    'collectionId',item.collection_id,'labels',to_jsonb(item.tags),
    'location',item.storage_location,'status',item.status,'customFields',item.custom_fields
  )) order by item.id) into after_rows
  from jsonb_array_elements(before_rows) entry
  join public.collection_items item on item.id=(entry->>'id')::uuid and item.user_id=owner_id;
  requested:=jsonb_build_object(
    'label',p_label,'labelMode',p_label_mode,'location',p_location,
    'locationMode',p_location_mode,'status',p_status,'collectionId',p_collection_id,
    'collectionMode',p_collection_mode,'customFieldKey',p_custom_field_key,
    'customFieldMode',p_custom_field_mode
  );
  insert into public.collection_organization_operations(id,user_id,operation_type,item_count,requested_changes,item_snapshots)
  values(operation_id,owner_id,'bulk_edit',array_length(p_ids,1),requested,after_rows);
  return operation_id;
end;
$$;

create or replace function public.undo_collection_organization_operation(p_operation_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid:=(select auth.uid());
  operation public.collection_organization_operations%rowtype;
  snapshot jsonb;
  item public.collection_items%rowtype;
  current_state jsonb;
  restored integer:=0;
  undo_id uuid:=gen_random_uuid();
begin
  if owner_id is null then raise exception 'Sign in is required.'; end if;
  select * into operation from public.collection_organization_operations
    where id=p_operation_id and user_id=owner_id for update;
  if operation.id is null or operation.operation_type<>'bulk_edit' then raise exception 'Organization change is unavailable.'; end if;
  if operation.undone_at is not null then raise exception 'This change was already undone.'; end if;
  for snapshot in select value from jsonb_array_elements(operation.item_snapshots) loop
    select * into item from public.collection_items
      where id=(snapshot->>'id')::uuid and user_id=owner_id for update;
    if item.id is null then raise exception 'A changed item no longer exists.'; end if;
    current_state:=jsonb_build_object(
      'collectionId',item.collection_id,'labels',to_jsonb(item.tags),
      'location',item.storage_location,'status',item.status,'customFields',item.custom_fields
    );
    if current_state<>snapshot->'after' then raise exception 'A changed item was edited again; undo would overwrite newer work.'; end if;
  end loop;
  for snapshot in select value from jsonb_array_elements(operation.item_snapshots) loop
    update public.collection_items set
      collection_id=(snapshot #>> '{before,collectionId}')::uuid,
      tags=array(select jsonb_array_elements_text(snapshot #> '{before,labels}')),
      storage_location=nullif(snapshot #>> '{before,location}',''),
      status=snapshot #>> '{before,status}',
      custom_fields=snapshot #> '{before,customFields}',
      updated_at=now()
    where id=(snapshot->>'id')::uuid and user_id=owner_id;
    restored:=restored+1;
  end loop;
  update public.collection_organization_operations set undone_at=now()
    where id=operation.id and user_id=owner_id;
  insert into public.collection_organization_operations(
    id,user_id,operation_type,item_count,requested_changes,item_snapshots,reverses_operation_id
  ) values(
    undo_id,owner_id,'undo',restored,
    jsonb_build_object('reversesOperationId',operation.id),operation.item_snapshots,operation.id
  );
  return restored;
end;
$$;

alter table public.collection_custom_field_definitions enable row level security;
alter table public.collection_item_attachments enable row level security;
alter table public.collection_goals enable row level security;
alter table public.collection_goal_events enable row level security;
alter table public.collection_organization_operations enable row level security;

drop policy if exists "custom field definitions own rows" on public.collection_custom_field_definitions;
drop policy if exists "collection attachments own rows" on public.collection_item_attachments;
drop policy if exists "collection goals own rows" on public.collection_goals;
drop policy if exists "collection goal events own rows" on public.collection_goal_events;
drop policy if exists "collection operations own rows" on public.collection_organization_operations;
create policy "custom field definitions own rows" on public.collection_custom_field_definitions for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "collection attachments own rows" on public.collection_item_attachments for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "collection goals own rows" on public.collection_goals for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "collection goal events own rows" on public.collection_goal_events for select to authenticated
  using((select auth.uid())=user_id);
create policy "collection operations own rows" on public.collection_organization_operations for select to authenticated
  using((select auth.uid())=user_id);

revoke all on public.collection_custom_field_definitions,public.collection_item_attachments,public.collection_goals,public.collection_goal_events,public.collection_organization_operations from anon,authenticated;
grant select,insert,update,delete on public.collection_custom_field_definitions,public.collection_goals to authenticated;
grant select,insert,delete on public.collection_item_attachments to authenticated;
grant select on public.collection_goal_events,public.collection_organization_operations to authenticated;
revoke all on all sequences in schema public from anon,authenticated;
grant usage,select on sequence public.collection_goal_events_id_seq to authenticated;

revoke all on function public.get_collection_organization_summary() from public,anon;
revoke all on function public.get_collection_goal_progress(uuid) from public,anon;
revoke all on function public.search_collection_positions(text,jsonb,text,integer,text,uuid) from public,anon;
revoke all on function public.bulk_organize_collection_items_v2(uuid[],text,text,text,text,text,uuid,text,text,jsonb,text) from public,anon;
revoke all on function public.undo_collection_organization_operation(uuid) from public,anon;
revoke all on function public.rollback_collection_import(uuid) from public,anon,authenticated;
revoke all on function public.rollback_collection_import_v2(uuid) from public,anon;
grant execute on function public.get_collection_organization_summary() to authenticated,service_role;
grant execute on function public.get_collection_goal_progress(uuid) to authenticated,service_role;
grant execute on function public.search_collection_positions(text,jsonb,text,integer,text,uuid) to authenticated,service_role;
grant execute on function public.bulk_organize_collection_items_v2(uuid[],text,text,text,text,text,uuid,text,text,jsonb,text) to authenticated,service_role;
grant execute on function public.undo_collection_organization_operation(uuid) to authenticated,service_role;
grant execute on function public.rollback_collection_import_v2(uuid) to authenticated,service_role;

revoke all on function organization_private.valid_custom_fields(jsonb) from public,anon,authenticated;
revoke all on function organization_private.searchable_labels(text[]) from public,anon,authenticated;
revoke all on function organization_private.indexed_item_aliases(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function organization_private.item_aliases(public.collection_items) from public,anon,authenticated;
revoke all on function organization_private.item_matches_criteria(public.collection_items,jsonb) from public,anon,authenticated;
revoke all on function organization_private.calculate_goal(public.collection_goals) from public,anon,authenticated;
revoke all on function organization_private.refresh_goals(uuid) from public,anon,authenticated;
revoke all on function organization_private.refresh_goal_definition() from public,anon,authenticated;
revoke all on function organization_private.refresh_goals_from_new_rows() from public,anon,authenticated;
revoke all on function organization_private.refresh_goals_from_old_rows() from public,anon,authenticated;
revoke all on function organization_private.refresh_goals_from_updated_rows() from public,anon,authenticated;
revoke all on function organization_private.apply_import_organization() from public,anon,authenticated;
revoke all on function organization_private.validate_item_custom_fields() from public,anon,authenticated;
revoke all on function organization_private.protect_used_custom_field_definition() from public,anon,authenticated;

-- These two immutable scalar helpers are evaluated by collection_items
-- constraints/generated columns during an authenticated write. The schema is
-- not exposed through the Data API and no table or user data is readable.
grant usage on schema organization_private to authenticated,service_role;
grant execute on function organization_private.valid_custom_fields(jsonb) to authenticated,service_role;
grant execute on function organization_private.searchable_labels(text[]) to authenticated,service_role;
grant execute on function organization_private.indexed_item_aliases(uuid,uuid,jsonb) to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'collection-item-files','collection-item-files',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "collection file owners can insert" on storage.objects;
drop policy if exists "collection file owners can read" on storage.objects;
drop policy if exists "collection file owners can delete" on storage.objects;
create policy "collection file owners can insert" on storage.objects for insert to authenticated
  with check(bucket_id='collection-item-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "collection file owners can read" on storage.objects for select to authenticated
  using(bucket_id='collection-item-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "collection file owners can delete" on storage.objects for delete to authenticated
  using(bucket_id='collection-item-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
