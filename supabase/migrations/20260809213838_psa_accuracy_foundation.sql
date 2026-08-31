-- PSA accuracy foundation: immutable physical-card lineage, exact returned
-- labels, scoped research consent, and service-only ML governance records.

create table if not exists public.grading_physical_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_item_id uuid,
  identity_snapshot jsonb not null default '{}'::jsonb,
  lineage_status text not null default 'active' check (
    lineage_status in ('active','submitted','returned','retired')
  ),
  chain_of_custody jsonb not null default '[]'::jsonb check (
    jsonb_typeof(chain_of_custody)='array'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key (collection_item_id,user_id)
    references public.collection_items(id,user_id)
    on delete set null (collection_item_id)
);

alter table public.grading_physical_cards enable row level security;
create policy "grading physical cards own rows"
  on public.grading_physical_cards for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
revoke all on public.grading_physical_cards from public,anon;
grant select,insert,update,delete on public.grading_physical_cards to authenticated;
grant all on public.grading_physical_cards to service_role;

alter table public.grading_scan_sessions
  add column if not exists physical_card_id uuid;

insert into public.grading_physical_cards(
  id,user_id,collection_item_id,identity_snapshot,chain_of_custody,created_at,updated_at
)
select session.id,session.user_id,session.collection_item_id,
  session.identity_snapshot,
  jsonb_build_array(jsonb_build_object(
    'event','lineage_imported','scanSessionId',session.id,'at',session.started_at
  )),session.started_at,session.updated_at
from public.grading_scan_sessions session
where session.physical_card_id is null;

update public.grading_scan_sessions session
set physical_card_id=card.id
from public.grading_physical_cards card
where session.physical_card_id is null
  and card.id=session.id
  and card.user_id=session.user_id;

-- Preserve lineage across known regrades.
update public.grading_scan_sessions child
set physical_card_id=parent.physical_card_id
from public.grading_scan_sessions parent
where child.previous_session_id=parent.id
  and child.user_id=parent.user_id
  and child.physical_card_id is distinct from parent.physical_card_id;

alter table public.grading_scan_sessions
  alter column physical_card_id set not null,
  drop constraint if exists grading_scan_sessions_physical_card_fkey,
  add constraint grading_scan_sessions_physical_card_fkey
    foreign key (physical_card_id,user_id)
    references public.grading_physical_cards(id,user_id) on delete restrict;

create index if not exists grading_sessions_physical_card_idx
  on public.grading_scan_sessions(physical_card_id,user_id,started_at);

create or replace function public.assign_grading_physical_card()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  previous_card uuid;
begin
  if new.physical_card_id is not null then return new; end if;
  if new.previous_session_id is not null then
    select session.physical_card_id into previous_card
    from public.grading_scan_sessions session
    where session.id=new.previous_session_id and session.user_id=new.user_id;
  end if;
  if previous_card is null then
    insert into public.grading_physical_cards(
      user_id,collection_item_id,identity_snapshot,chain_of_custody
    ) values(
      new.user_id,new.collection_item_id,coalesce(new.identity_snapshot,'{}'::jsonb),
      jsonb_build_array(jsonb_build_object(
        'event','scan_created','scanSessionId',new.id,'at',coalesce(new.started_at,now())
      ))
    ) returning id into previous_card;
  end if;
  new.physical_card_id:=previous_card;
  return new;
end $$;

revoke all on function public.assign_grading_physical_card()
  from public,anon,authenticated;

drop trigger if exists grading_session_physical_card_trigger
  on public.grading_scan_sessions;
create trigger grading_session_physical_card_trigger
before insert on public.grading_scan_sessions
for each row execute function public.assign_grading_physical_card();

alter table public.grading_research_consents
  add column if not exists training_allowed boolean not null default false,
  add column if not exists outcome_linkage_allowed boolean not null default false,
  add column if not exists retention_policy_version text,
  add column if not exists consent_scope jsonb not null default '{}'::jsonb;

alter table public.grading_research_consents
  drop constraint if exists grading_research_consent_scope_object,
  add constraint grading_research_consent_scope_object check (
    jsonb_typeof(consent_scope)='object'
  ),
  drop constraint if exists grading_research_consent_v2_consistency,
  add constraint grading_research_consent_v2_consistency check (
    not training_allowed
    or (
      consented and outcome_linkage_allowed and revoked_at is null
      and consent_version='mica-grading-research-v2'
      and retention_policy_version is not null
    )
  );

alter table public.grading_outcomes
  alter column returned_grade drop not null,
  add column if not exists physical_card_id uuid,
  add column if not exists outcome_kind text not null default 'numeric',
  add column if not exists returned_label text,
  add column if not exists qualifier text,
  add column if not exists no_grade_code text,
  add column if not exists grader_notes text,
  add column if not exists proof_sha256 text,
  add column if not exists label_recorded_at timestamptz not null default now(),
  add column if not exists chain_of_custody jsonb not null default '[]'::jsonb;

alter table public.grading_outcomes
  drop constraint if exists grading_outcomes_id_owner_unique,
  add constraint grading_outcomes_id_owner_unique unique(id,user_id);

update public.grading_outcomes outcome
set physical_card_id=session.physical_card_id,
    outcome_kind='numeric',
    returned_label=coalesce(outcome.returned_label,outcome.returned_grade::text)
from public.grading_scan_sessions session
where outcome.scan_session_id=session.id and outcome.user_id=session.user_id;

alter table public.grading_outcomes
  alter column physical_card_id set not null,
  alter column returned_label set not null,
  drop constraint if exists grading_outcomes_physical_card_fkey,
  add constraint grading_outcomes_physical_card_fkey
    foreign key (physical_card_id,user_id)
    references public.grading_physical_cards(id,user_id) on delete restrict,
  drop constraint if exists grading_outcomes_kind_check,
  add constraint grading_outcomes_kind_check check (
    outcome_kind in ('numeric','qualified','no_grade','authentic','altered')
  ),
  drop constraint if exists grading_outcomes_psa_label_check,
  add constraint grading_outcomes_psa_label_check check (
    professional_grader<>'PSA'
    or (
      outcome_kind in ('numeric','qualified')
      and returned_grade in (
        1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,10
      )
      and no_grade_code is null
    )
    or (
      outcome_kind in ('no_grade','authentic','altered')
      and returned_grade is null
    )
  ),
  drop constraint if exists grading_outcomes_qualifier_check,
  add constraint grading_outcomes_qualifier_check check (
    qualifier is null or qualifier in ('OC','PD','ST','OF','MK','MC')
  ),
  drop constraint if exists grading_outcomes_no_grade_check,
  add constraint grading_outcomes_no_grade_check check (
    no_grade_code is null or no_grade_code ~ '^N[1-9]$'
  ),
  drop constraint if exists grading_outcomes_proof_hash_check,
  add constraint grading_outcomes_proof_hash_check check (
    proof_sha256 is null or proof_sha256 ~ '^[a-f0-9]{64}$'
  ),
  drop constraint if exists grading_outcomes_chain_object,
  add constraint grading_outcomes_chain_object check (
    jsonb_typeof(chain_of_custody)='array'
  ),
  drop constraint if exists grading_outcomes_verification_status_check,
  add constraint grading_outcomes_verification_status_check check (
    verification_status in (
      'user_reported','proof_attached','cert_verified','independently_verified','rejected'
    )
  );

create index if not exists grading_outcomes_physical_card_idx
  on public.grading_outcomes(physical_card_id,user_id,created_at);

create or replace function public.enforce_grading_outcome_lineage()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  session_card uuid;
  session_started timestamptz;
begin
  if (select auth.uid()) is not null and (select auth.uid())<>new.user_id then
    raise exception 'grading_outcome_owner_mismatch';
  end if;
  select session.physical_card_id,session.started_at
  into session_card,session_started
  from public.grading_scan_sessions session
  where session.id=new.scan_session_id and session.user_id=new.user_id;
  if session_card is null then raise exception 'grading_session_not_found'; end if;
  new.physical_card_id:=session_card;
  new.label_recorded_at:=coalesce(new.label_recorded_at,now());
  if new.return_date is not null and session_started::date>new.return_date then
    raise exception 'grading_outcome_predates_capture';
  end if;
  if (select auth.uid()) is not null then
    new.verification_status:=case
      when new.proof_storage_path is not null and new.proof_sha256 is not null
        then 'proof_attached'
      else 'user_reported'
    end;
  end if;
  new.chain_of_custody:=coalesce(new.chain_of_custody,'[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'event',case when tg_op='INSERT' then 'outcome_recorded' else 'outcome_updated' end,
      'scanSessionId',new.scan_session_id,
      'label',new.returned_label,
      'at',now()
    ));
  return new;
end $$;

revoke all on function public.enforce_grading_outcome_lineage()
  from public,anon,authenticated;
drop trigger if exists grading_outcome_lineage_trigger on public.grading_outcomes;
create trigger grading_outcome_lineage_trigger
before insert or update on public.grading_outcomes
for each row execute function public.enforce_grading_outcome_lineage();

-- ML governance records are intentionally outside the exposed public schema.
create schema if not exists grading_private;
revoke all on schema grading_private from public,anon,authenticated;
grant usage on schema grading_private to service_role;

create table if not exists grading_private.physical_card_partitions (
  physical_card_id uuid primary key,
  owner_id uuid not null,
  dataset_partition text not null default 'unassigned' check (
    dataset_partition in (
      'unassigned','train','validation','calibration','test','external_holdout'
    )
  ),
  partition_key text generated always as (physical_card_id::text) stored unique,
  assigned_at timestamptz not null default now(),
  assigned_by text not null,
  unique(physical_card_id,owner_id,dataset_partition),
  foreign key (physical_card_id,owner_id)
    references public.grading_physical_cards(id,user_id) on delete cascade
);

create table if not exists grading_private.training_examples (
  id uuid primary key default gen_random_uuid(),
  physical_card_id uuid not null,
  scan_session_id uuid not null unique,
  outcome_id uuid unique,
  owner_id uuid not null,
  eligibility_status text not null default 'pending' check (
    eligibility_status in ('pending','eligible','excluded','deleted')
  ),
  exclusion_reasons text[] not null default '{}',
  dataset_partition text not null default 'unassigned' check (
    dataset_partition in (
      'unassigned','train','validation','calibration','test','external_holdout'
    )
  ),
  cohort jsonb not null default '{}'::jsonb check (jsonb_typeof(cohort)='object'),
  label_snapshot jsonb not null default '{}'::jsonb check (
    jsonb_typeof(label_snapshot)='object'
  ),
  capture_manifest jsonb not null default '{}'::jsonb check (
    jsonb_typeof(capture_manifest)='object'
  ),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  consent_version text not null,
  captured_before_outcome boolean not null,
  reviewer_status text not null default 'unreviewed' check (
    reviewer_status in ('unreviewed','single_review','double_review','adjudicated','rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (physical_card_id,owner_id)
    references public.grading_physical_cards(id,user_id) on delete cascade,
  foreign key (scan_session_id,owner_id)
    references public.grading_scan_sessions(id,user_id) on delete cascade,
  foreign key (physical_card_id,owner_id,dataset_partition)
    references grading_private.physical_card_partitions(
      physical_card_id,owner_id,dataset_partition
    ) on delete restrict,
  foreign key (outcome_id,owner_id)
    references public.grading_outcomes(id,user_id)
    on delete set null (outcome_id)
);

create or replace function grading_private.prevent_partition_reassignment()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if old.dataset_partition<>'unassigned'
    and new.dataset_partition is distinct from old.dataset_partition then
    raise exception 'physical_card_partition_is_immutable';
  end if;
  return new;
end $$;

drop trigger if exists physical_card_partition_immutability
  on grading_private.physical_card_partitions;
create trigger physical_card_partition_immutability
before update on grading_private.physical_card_partitions
for each row execute function grading_private.prevent_partition_reassignment();

create table if not exists grading_private.annotation_reviews (
  id uuid primary key default gen_random_uuid(),
  training_example_id uuid not null references grading_private.training_examples(id) on delete cascade,
  reviewer_key text not null,
  review_round integer not null check (review_round between 1 and 3),
  decision text not null check (decision in ('approve','revise','reject','adjudicate')),
  labels jsonb not null check (jsonb_typeof(labels)='object'),
  created_at timestamptz not null default now(),
  unique(training_example_id,reviewer_key,review_round)
);

create table if not exists grading_private.dataset_manifests (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'draft' check (status in ('draft','frozen','retired')),
  manifest_sha256 text not null unique check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  example_count integer not null default 0 check (example_count>=0),
  cohort_summary jsonb not null default '{}'::jsonb check (
    jsonb_typeof(cohort_summary)='object'
  ),
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status='frozen' and frozen_at is not null) or status<>'frozen')
);

create table if not exists grading_private.model_registry (
  id uuid primary key default gen_random_uuid(),
  model_version text not null unique,
  model_role text not null check (
    model_role in ('geometry','identity','capture_quality','centering','corners','edges','surface','structure','eye_appeal','psa_fusion')
  ),
  dataset_manifest_id uuid not null references grading_private.dataset_manifests(id) on delete restrict,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'candidate' check (
    status in ('candidate','shadow','champion','retired','rejected')
  ),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics)='object'),
  created_at timestamptz not null default now()
);

create table if not exists grading_private.calibration_registry (
  id uuid primary key default gen_random_uuid(),
  calibration_version text not null unique,
  model_id uuid not null references grading_private.model_registry(id) on delete restrict,
  dataset_manifest_id uuid not null references grading_private.dataset_manifests(id) on delete restrict,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  cohort_eligibility jsonb not null default '{}'::jsonb check (
    jsonb_typeof(cohort_eligibility)='object'
  ),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics)='object'),
  validated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists grading_private.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references grading_private.model_registry(id) on delete restrict,
  calibration_id uuid references grading_private.calibration_registry(id) on delete restrict,
  dataset_manifest_id uuid not null references grading_private.dataset_manifests(id) on delete restrict,
  run_kind text not null check (
    run_kind in ('development','shadow','locked_holdout','temporal_holdout','ablation')
  ),
  code_sha256 text not null check (code_sha256 ~ '^[a-f0-9]{64}$'),
  metrics jsonb not null check (jsonb_typeof(metrics)='object'),
  passed boolean not null,
  created_at timestamptz not null default now()
);

alter table grading_private.physical_card_partitions enable row level security;
alter table grading_private.training_examples enable row level security;
alter table grading_private.annotation_reviews enable row level security;
alter table grading_private.dataset_manifests enable row level security;
alter table grading_private.model_registry enable row level security;
alter table grading_private.calibration_registry enable row level security;
alter table grading_private.evaluation_runs enable row level security;

revoke all on all tables in schema grading_private from public,anon,authenticated;
revoke all on all functions in schema grading_private from public,anon,authenticated;
grant all on all tables in schema grading_private to service_role;
grant execute on all functions in schema grading_private to service_role;

create or replace function grading_private.prevent_frozen_manifest_change()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if old.status='frozen' then
    raise exception 'frozen_dataset_manifest_is_immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists immutable_frozen_dataset_manifest
  on grading_private.dataset_manifests;
create trigger immutable_frozen_dataset_manifest
before update or delete on grading_private.dataset_manifests
for each row execute function grading_private.prevent_frozen_manifest_change();

revoke all on function grading_private.prevent_frozen_manifest_change()
  from public,anon,authenticated;
