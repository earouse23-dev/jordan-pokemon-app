-- Step 5: owner-scoped staging, atomic collection import, saved mappings, and
-- safe rollback. Staging may be retried without changing portfolio rows.

alter table public.import_jobs
  add column if not exists source_name text,
  add column if not exists file_sha256 text,
  add column if not exists header_signature text,
  add column if not exists mapping jsonb not null default '{}'::jsonb,
  add column if not exists preview jsonb not null default '{}'::jsonb,
  add column if not exists committed_at timestamptz,
  add column if not exists rolled_back_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.import_jobs
  drop constraint if exists import_jobs_source_name_length_check,
  add constraint import_jobs_source_name_length_check
    check (source_name is null or char_length(source_name) between 1 and 120),
  drop constraint if exists import_jobs_file_sha256_check,
  add constraint import_jobs_file_sha256_check
    check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$'),
  drop constraint if exists import_jobs_mapping_object_check,
  add constraint import_jobs_mapping_object_check
    check (jsonb_typeof(mapping)='object'),
  drop constraint if exists import_jobs_preview_object_check,
  add constraint import_jobs_preview_object_check
    check (jsonb_typeof(preview)='object'),
  drop constraint if exists import_jobs_id_user_key,
  add constraint import_jobs_id_user_key unique(id,user_id);

create table if not exists public.import_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text not null check (char_length(source_name) between 1 and 120),
  header_signature text not null check (char_length(header_signature) between 1 and 4000),
  mapping jsonb not null check (jsonb_typeof(mapping)='object'),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,header_signature)
);

create table if not exists public.import_staged_rows (
  import_job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  row_number integer not null check (row_number between 2 and 5001),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(import_job_id,row_number),
  unique(import_job_id,idempotency_key),
  foreign key(import_job_id,user_id)
    references public.import_jobs(id,user_id) on delete cascade
);

create table if not exists public.import_job_items (
  import_job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  row_number integer not null,
  collection_item_id uuid,
  idempotency_key text not null,
  action text not null check (action in ('created','reused')),
  item_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(item_snapshot)='object'),
  created_at timestamptz not null default now(),
  primary key(import_job_id,row_number),
  foreign key(import_job_id,user_id)
    references public.import_jobs(id,user_id) on delete cascade,
  foreign key(collection_item_id,user_id)
    references public.collection_items(id,user_id)
    on delete set null (collection_item_id)
);

create table if not exists public.ingestion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  channel text not null check (channel in ('camera','upload','search','manual','csv')),
  stage text not null check (stage in (
    'started','previewed','queued','confirmed','staged','committed','rolled_back','failed'
  )),
  outcome text not null check (outcome in (
    'success','failure','abandoned','recovered','correction','needs_confirmation'
  )),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create index if not exists import_mapping_profiles_owner_used_idx
  on public.import_mapping_profiles(user_id,last_used_at desc);
create index if not exists import_staged_rows_owner_job_idx
  on public.import_staged_rows(user_id,import_job_id,row_number);
create index if not exists import_job_items_owner_job_idx
  on public.import_job_items(user_id,import_job_id,row_number);
create index if not exists import_job_items_position_idx
  on public.import_job_items(collection_item_id) where collection_item_id is not null;
create index if not exists ingestion_events_owner_created_idx
  on public.ingestion_events(user_id,created_at desc);
create index if not exists ingestion_events_operational_idx
  on public.ingestion_events(channel,stage,outcome,created_at desc);

alter table public.import_mapping_profiles enable row level security;
alter table public.import_staged_rows enable row level security;
alter table public.import_job_items enable row level security;
alter table public.ingestion_events enable row level security;

create policy "import mappings own rows" on public.import_mapping_profiles
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "import staging own rows" on public.import_staged_rows
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "import results own rows" on public.import_job_items
  for select to authenticated
  using ((select auth.uid())=user_id);
create policy "ingestion events own rows" on public.ingestion_events
  for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.import_mapping_profiles,public.import_staged_rows,
  public.import_job_items,public.ingestion_events from public,anon,authenticated;
grant select,insert,update,delete on public.import_mapping_profiles,
  public.import_staged_rows to authenticated;
grant select on public.import_job_items to authenticated;
grant select on public.ingestion_events to authenticated;
grant all on public.import_mapping_profiles,public.import_staged_rows,
  public.import_job_items,public.ingestion_events to service_role;

create or replace function public.collection_import_row_error(p_payload jsonb)
returns text
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  state text := coalesce(p_payload->>'cardState','');
  quantity_text text := coalesce(p_payload->>'quantity','');
  date_text text := coalesce(p_payload->>'transactionDate','');
  amount_key text;
  amount_value text;
begin
  if jsonb_typeof(p_payload)<>'object' then return 'payload_not_object'; end if;
  if jsonb_typeof(p_payload->'identity')<>'object' then return 'identity_not_object'; end if;
  if state not in ('raw','graded','sealed') then return 'invalid_card_state'; end if;
  if quantity_text !~ '^\d{1,5}$' or quantity_text::integer not between 1 and 99999 then
    return 'invalid_quantity';
  end if;
  if date_text !~ '^\d{4}-\d{2}-\d{2}$' then return 'invalid_transaction_date'; end if;
  begin
    if date_text::date>current_date then return 'future_transaction_date'; end if;
  exception when others then
    return 'invalid_transaction_date';
  end;
  foreach amount_key in array array[
    'unitPrice','tax','shipping','marketplaceFees','gradingFees','otherCosts'
  ] loop
    amount_value := coalesce(p_payload->>amount_key,'0');
    if amount_value !~ '^\d+(\.\d{1,2})?$' or amount_value::numeric<0 then
      return 'invalid_'||lower(amount_key);
    end if;
  end loop;
  if coalesce(p_payload->>'currency','USD') !~ '^[A-Z]{3}$' then
    return 'invalid_currency';
  end if;
  if nullif(p_payload->>'cardId','') is not null
    and (p_payload->>'cardId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return 'invalid_card_id';
  end if;
  if nullif(p_payload->>'variantId','') is not null
    and (p_payload->>'variantId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return 'invalid_variant_id';
  end if;
  if state='raw' and (
    nullif(p_payload->>'grader','') is not null
    or nullif(p_payload->>'grade','') is not null
  ) then return 'invalid_raw_state'; end if;
  if state='graded' and (
    nullif(p_payload->>'grader','') is null
    or coalesce(p_payload->>'grade','') !~ '^\d+(\.\d)?$'
    or (p_payload->>'grade')::numeric not between 1 and 10
  ) then return 'invalid_graded_state'; end if;
  if state='sealed' and (
    nullif(p_payload->>'rawCondition','') is not null
    or nullif(p_payload->>'grader','') is not null
    or nullif(p_payload->>'grade','') is not null
  ) then return 'invalid_sealed_state'; end if;
  if char_length(coalesce(p_payload->>'notes',''))>10000 then return 'notes_too_long'; end if;
  if char_length(coalesce(p_payload->>'location',''))>250 then return 'location_too_long'; end if;
  if p_payload ? 'tags' and jsonb_typeof(p_payload->'tags')<>'array' then
    return 'tags_not_array';
  end if;
  if jsonb_array_length(coalesce(p_payload->'tags','[]'::jsonb))>50 then
    return 'too_many_tags';
  end if;
  if exists(
    select 1 from jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb)) tag
    where char_length(btrim(tag)) not between 1 and 40
  ) then return 'invalid_tag'; end if;
  return null;
end $$;

revoke all on function public.collection_import_row_error(jsonb)
  from public,anon;
grant execute on function public.collection_import_row_error(jsonb)
  to authenticated;

create or replace function public.record_ingestion_event(
  p_session_id uuid,
  p_channel text,
  p_stage text,
  p_outcome text,
  p_duration_ms integer,
  p_metadata jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_event uuid;
  safe_metadata jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if p_session_id is null then raise exception 'ingestion_session_required'; end if;
  if p_channel not in ('camera','upload','search','manual','csv') then
    raise exception 'invalid_ingestion_channel';
  end if;
  if p_stage not in (
    'started','previewed','queued','confirmed','staged','committed','rolled_back','failed'
  ) then raise exception 'invalid_ingestion_stage'; end if;
  if p_outcome not in (
    'success','failure','abandoned','recovered','correction','needs_confirmation'
  ) then raise exception 'invalid_ingestion_outcome'; end if;
  if p_duration_ms is not null and p_duration_ms not between 0 and 3600000 then
    raise exception 'invalid_ingestion_duration';
  end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object' then
    raise exception 'invalid_ingestion_metadata';
  end if;
  select coalesce(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb)
  into safe_metadata
  from jsonb_each(coalesce(p_metadata,'{}'::jsonb)) entry
  where entry.key in (
    'rowCount','stagedCount','invalidCount','duplicateCount','queuedCount',
    'language','reason','offline','retry','candidateStatus'
  );
  if pg_column_size(safe_metadata)>2048 then raise exception 'ingestion_metadata_too_large'; end if;
  insert into public.ingestion_events(
    user_id,session_id,channel,stage,outcome,duration_ms,metadata
  ) values(
    owner_id,p_session_id,p_channel,p_stage,p_outcome,p_duration_ms,safe_metadata
  ) returning id into target_event;
  return target_event;
end $$;

revoke all on function public.record_ingestion_event(uuid,text,text,text,integer,jsonb)
  from public,anon;
grant execute on function public.record_ingestion_event(uuid,text,text,text,integer,jsonb)
  to authenticated;

create or replace function public.begin_collection_import(
  p_source_name text,
  p_file_sha256 text,
  p_header_signature text,
  p_mapping jsonb,
  p_preview jsonb
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  target_job uuid;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if char_length(btrim(coalesce(p_source_name,''))) not between 1 and 120 then
    raise exception 'invalid_source_name';
  end if;
  if coalesce(p_file_sha256,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_file_hash';
  end if;
  if char_length(coalesce(p_header_signature,'')) not between 1 and 4000 then
    raise exception 'invalid_header_signature';
  end if;
  if jsonb_typeof(coalesce(p_mapping,'{}'::jsonb))<>'object'
    or jsonb_typeof(coalesce(p_preview,'{}'::jsonb))<>'object' then
    raise exception 'invalid_import_metadata';
  end if;
  insert into public.import_jobs(
    user_id,status,totals,source_name,file_sha256,header_signature,mapping,preview
  ) values(
    owner_id,'staging','{}'::jsonb,btrim(p_source_name),p_file_sha256,
    p_header_signature,coalesce(p_mapping,'{}'::jsonb),coalesce(p_preview,'{}'::jsonb)
  ) returning id into target_job;
  return target_job;
end $$;

revoke all on function public.begin_collection_import(text,text,text,jsonb,jsonb)
  from public,anon;
grant execute on function public.begin_collection_import(text,text,text,jsonb,jsonb)
  to authenticated;

create or replace function public.stage_collection_import_rows(
  p_import_job_id uuid,
  p_rows jsonb
) returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  job_status text;
  staged_count integer;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'stage_between_1_and_500_rows';
  end if;
  select status into job_status from public.import_jobs
  where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status not in ('staging','ready') then raise exception 'import_not_stageable'; end if;

  insert into public.import_staged_rows(
    import_job_id,user_id,row_number,idempotency_key,payload,updated_at
  )
  select p_import_job_id,owner_id,(row->>'rowNumber')::integer,
    row->>'idempotencyKey',row->'payload',now()
  from jsonb_array_elements(p_rows) row
  on conflict(import_job_id,row_number) do update
  set idempotency_key=excluded.idempotency_key,payload=excluded.payload,updated_at=now()
  where public.import_staged_rows.user_id=owner_id;

  select count(*) into staged_count from public.import_staged_rows
  where import_job_id=p_import_job_id and user_id=owner_id;
  update public.import_jobs
  set status='ready',totals=jsonb_set(totals,'{stagedRows}',to_jsonb(staged_count),true),
    updated_at=now()
  where id=p_import_job_id and user_id=owner_id;
  return staged_count;
end $$;

revoke all on function public.stage_collection_import_rows(uuid,jsonb)
  from public,anon;
grant execute on function public.stage_collection_import_rows(uuid,jsonb)
  to authenticated;

create or replace function public.preview_collection_import(p_import_job_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  result jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  if not exists(
    select 1 from public.import_jobs where id=p_import_job_id and user_id=owner_id
  ) then raise exception 'import_not_found'; end if;
  select jsonb_build_object(
    'stagedRows',count(*),
    'validRows',count(*) filter(where public.collection_import_row_error(payload) is null),
    'invalidRows',count(*) filter(where public.collection_import_row_error(payload) is not null),
    'totalQuantity',coalesce(sum((payload->>'quantity')::integer)
      filter(where coalesce(payload->>'quantity','') ~ '^\d{1,5}$'),0),
    'issues',coalesce(jsonb_agg(jsonb_build_object(
      'rowNumber',row_number,
      'code',public.collection_import_row_error(payload)
    ) order by row_number) filter(where public.collection_import_row_error(payload) is not null),'[]'::jsonb)
  ) into result
  from public.import_staged_rows
  where import_job_id=p_import_job_id and user_id=owner_id;
  return result;
end $$;

revoke all on function public.preview_collection_import(uuid) from public,anon;
grant execute on function public.preview_collection_import(uuid) to authenticated;

create or replace function public.commit_collection_import(p_import_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  job_status text;
  validation jsonb;
  staged record;
  row_payload jsonb;
  target_item uuid;
  existing_item uuid;
  action_name text;
  created_count integer := 0;
  reused_count integer := 0;
  result jsonb;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select status into job_status from public.import_jobs
  where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status='committed' then
    select totals into result from public.import_jobs
    where id=p_import_job_id and user_id=owner_id;
    return result;
  end if;
  if job_status<>'ready' then raise exception 'import_not_ready'; end if;
  validation := public.preview_collection_import(p_import_job_id);
  if coalesce((validation->>'stagedRows')::integer,0)=0 then
    raise exception 'import_has_no_rows';
  end if;
  if coalesce((validation->>'invalidRows')::integer,0)>0 then
    raise exception 'import_validation_failed';
  end if;

  for staged in
    select * from public.import_staged_rows
    where import_job_id=p_import_job_id and user_id=owner_id
    order by row_number for update
  loop
    row_payload := staged.payload;
    select transaction.collection_item_id into existing_item
    from public.collection_transactions transaction
    where transaction.user_id=owner_id
      and transaction.idempotency_key=staged.idempotency_key;
    target_item := public.create_collection_position(
      p_identity => row_payload->'identity',
      p_card_id => nullif(row_payload->>'cardId','')::uuid,
      p_variant_id => nullif(row_payload->>'variantId','')::uuid,
      p_card_state => row_payload->>'cardState',
      p_raw_condition => nullif(row_payload->>'rawCondition',''),
      p_grader => nullif(row_payload->>'grader',''),
      p_grade => nullif(row_payload->>'grade','')::numeric,
      p_certification_number => nullif(row_payload->>'certificationNumber',''),
      p_quantity => (row_payload->>'quantity')::integer,
      p_transaction_date => (row_payload->>'transactionDate')::date,
      p_unit_price => (row_payload->>'unitPrice')::numeric,
      p_tax => coalesce((row_payload->>'tax')::numeric,0),
      p_shipping => coalesce((row_payload->>'shipping')::numeric,0),
      p_marketplace_fees => coalesce((row_payload->>'marketplaceFees')::numeric,0),
      p_grading_fees => coalesce((row_payload->>'gradingFees')::numeric,0),
      p_other_costs => coalesce((row_payload->>'otherCosts')::numeric,0),
      p_currency => coalesce(row_payload->>'currency','USD'),
      p_marketplace => nullif(row_payload->>'marketplace',''),
      p_notes => nullif(row_payload->>'notes',''),
      p_idempotency_key => staged.idempotency_key,
      p_acquisition_method => coalesce(nullif(row_payload->>'acquisitionMethod',''),'unknown')
    );
    action_name := case when existing_item is null then 'created' else 'reused' end;
    if action_name='created' then
      update public.collection_items item
      set storage_location=nullif(row_payload->>'location',''),
        tags=array(
          select distinct btrim(tag)
          from jsonb_array_elements_text(coalesce(row_payload->'tags','[]'::jsonb)) tag
          order by btrim(tag)
        ),updated_at=now()
      where item.id=target_item and item.user_id=owner_id;
      created_count := created_count+1;
    else
      reused_count := reused_count+1;
    end if;
    insert into public.import_job_items(
      import_job_id,user_id,row_number,collection_item_id,idempotency_key,action,item_snapshot
    )
    select p_import_job_id,owner_id,staged.row_number,item.id,
      staged.idempotency_key,action_name,
      jsonb_build_object(
        'identitySnapshot',item.identity_snapshot,'quantity',item.quantity,
        'cardState',item.card_state,'rawCondition',item.raw_condition,
        'grader',item.grader,'grade',item.grade,
        'certificationNumber',item.certification_number,'notes',item.notes,
        'location',item.storage_location,'status',item.status,
        'currency',item.currency,'tags',to_jsonb(item.tags)
      )
    from public.collection_items item
    where item.id=target_item and item.user_id=owner_id
    on conflict(import_job_id,row_number) do nothing;
  end loop;

  delete from public.valuation_snapshots snapshot
  where snapshot.user_id=owner_id;
  result := validation||jsonb_build_object(
    'createdRows',created_count,'reusedRows',reused_count,'status','committed'
  );
  update public.import_jobs
  set status='committed',totals=result,committed_at=now(),updated_at=now()
  where id=p_import_job_id and user_id=owner_id;
  return result;
end $$;

revoke all on function public.commit_collection_import(uuid) from public,anon;
grant execute on function public.commit_collection_import(uuid) to authenticated;

create or replace function public.rollback_collection_import(p_import_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  owner_id uuid := (select auth.uid());
  job_status text;
  imported record;
  current_snapshot jsonb;
  transaction_count integer;
  removed_count integer := 0;
begin
  if owner_id is null then raise exception 'authentication_required'; end if;
  select status into job_status from public.import_jobs
  where id=p_import_job_id and user_id=owner_id for update;
  if job_status is null then raise exception 'import_not_found'; end if;
  if job_status='rolled_back' then
    return jsonb_build_object('status','rolled_back','removedRows',0);
  end if;
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
      'currency',item.currency,'tags',to_jsonb(item.tags)
    ) into current_snapshot
    from public.collection_items item
    where item.id=imported.collection_item_id and item.user_id=owner_id;
    if current_snapshot is null then continue; end if;
    if current_snapshot is distinct from imported.item_snapshot then
      raise exception 'import_position_changed_after_commit';
    end if;
    select count(*) into transaction_count
    from public.collection_transactions transaction
    where transaction.collection_item_id=imported.collection_item_id
      and transaction.user_id=owner_id;
    if transaction_count<>1 or not exists(
      select 1 from public.collection_transactions transaction
      where transaction.collection_item_id=imported.collection_item_id
        and transaction.user_id=owner_id
        and transaction.idempotency_key=imported.idempotency_key
    ) then raise exception 'import_position_has_dependent_transactions'; end if;
    if exists(
      select 1 from public.grading_submissions submission
      where submission.collection_item_id=imported.collection_item_id
        and submission.user_id=owner_id
    ) or exists(
      select 1 from public.grading_scan_sessions session
      where session.collection_item_id=imported.collection_item_id
        and session.user_id=owner_id
    ) or exists(
      select 1 from public.digital_grade_assessments assessment
      where assessment.collection_item_id=imported.collection_item_id
        and assessment.user_id=owner_id
    ) or exists(
      select 1 from public.identity_corrections correction
      where correction.collection_item_id=imported.collection_item_id
        and correction.user_id=owner_id
    ) then raise exception 'import_position_has_dependent_activity'; end if;
  end loop;

  for imported in
    select * from public.import_job_items
    where import_job_id=p_import_job_id and user_id=owner_id and action='created'
    order by row_number desc
  loop
    if imported.collection_item_id is null then continue; end if;
    delete from public.collection_items item
    where item.id=imported.collection_item_id and item.user_id=owner_id;
    if found then removed_count := removed_count+1; end if;
  end loop;
  delete from public.valuation_snapshots snapshot where snapshot.user_id=owner_id;
  update public.import_jobs
  set status='rolled_back',rolled_back_at=now(),updated_at=now(),
    totals=totals||jsonb_build_object('status','rolled_back','removedRows',removed_count)
  where id=p_import_job_id and user_id=owner_id;
  return jsonb_build_object('status','rolled_back','removedRows',removed_count);
end $$;

revoke all on function public.rollback_collection_import(uuid) from public,anon;
grant execute on function public.rollback_collection_import(uuid) to authenticated;
