-- Run only in an owned isolated rehearsal. All synthetic rows and fault injection roll back.
begin;
create function pg_temp.require(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'consent regression: %',label; end if; end $$;
create function pg_temp.session(owner_id uuid, mode text, version text) returns uuid language plpgsql as $$
declare result uuid;
begin
  insert into public.grading_scan_sessions(user_id,consent_mode,consent_version,
    model_bundle_version,idempotency_key,identity_snapshot)
  values(owner_id,mode,version,'synthetic-consent-test',gen_random_uuid()::text,
    '{"name":"Synthetic","set":"Test","number":"001","language":"en","variant":"Normal"}')
  returning id into result;
  return result;
end $$;
create function pg_temp.capture(owner_id uuid, session_id uuid, retained boolean, kind text default 'front')
returns uuid language plpgsql as $$
declare result uuid;
begin
  insert into public.grading_captures(user_id,scan_session_id,capture_type,side,
    normalized_width,normalized_height,image_hash,retained_for_research,private_storage_path)
  values(owner_id,session_id,kind,case when kind like '%back' then 'back' else 'front' end,
    100,100,repeat('a',64),retained,case when retained then owner_id||'/synthetic/'||gen_random_uuid() else null end)
  returning id into result;
  return result;
end $$;
create function pg_temp.no_research(session_id uuid) returns void language plpgsql as $$
begin
  perform pg_temp.require(not exists(select 1 from grading_private.training_examples where scan_session_id=session_id),'no snapshot');
  perform pg_temp.require(not exists(select 1 from grading_private.physical_card_partitions p
    join public.grading_scan_sessions s on s.physical_card_id=p.physical_card_id where s.id=session_id),'no new partition');
end $$;
do $$
<<consent_test>>
declare
  owner_id uuid:=gen_random_uuid(); s uuid; c uuid; research uuid; example uuid;
  physical uuid; source text; mode text; version text; constraint_row record;
  manifest uuid; model uuid;
  kinds text[]:=array['front','back','alternate_front','alternate_back'];
begin
  insert into auth.users(id) values(owner_id);
  insert into public.grading_research_consents(user_id,consented,consent_version,consented_at,
    training_allowed,outcome_linkage_allowed,retention_policy_version)
  values(owner_id,true,'mica-grading-research-v2',now(),true,true,'synthetic');

  s:=pg_temp.session(owner_id,'normal',null);
  c:=pg_temp.capture(owner_id,s,false);
  perform pg_temp.no_research(s);
  perform pg_temp.require(grading_private.refresh_training_example(s,'synthetic-direct') is null,'normal direct denied');
  update public.grading_captures set image_hash=repeat('b',64) where id=c;
  insert into public.grading_outcomes(user_id,scan_session_id,professional_grader,returned_grade,returned_label)
  values(owner_id,s,'PSA',9,'9');
  perform pg_temp.no_research(s);
  delete from public.grading_captures where id=c;
  perform pg_temp.no_research(s);
  perform pg_temp.capture(owner_id,s,true);
  perform pg_temp.no_research(s);
  perform pg_temp.require(grading_private.refresh_training_example(gen_random_uuid(),'synthetic-direct') is null,'missing session denied');

  -- Corrupt/missing consent inputs are impossible through normal table constraints.
  -- Relax only those constraints in this rollback transaction to exercise fail-closed logic.
  set constraints all immediate;
  alter table public.grading_scan_sessions alter column consent_mode drop not null;
  for constraint_row in select conname from pg_constraint where conrelid='public.grading_scan_sessions'::regclass
    and contype='c' and pg_get_constraintdef(oid) ~ 'consent_mode|consent_version'
  loop execute format('alter table public.grading_scan_sessions drop constraint %I',constraint_row.conname); end loop;
  for mode,version in select * from (values (null::text,'mica-grading-research-v2'),
    ('invalid','mica-grading-research-v2'),('research',null),('research','old-version')) invalid
  loop
    s:=pg_temp.session(owner_id,mode,version);
    perform pg_temp.capture(owner_id,s,true);
    perform pg_temp.require(grading_private.refresh_training_example(s,'synthetic-direct') is null,'invalid session denied');
    perform pg_temp.no_research(s);
  end loop;

  s:=pg_temp.session(owner_id,'research','mica-grading-research-v2');
  perform pg_temp.require(grading_private.refresh_training_example(s,'synthetic-direct') is null,'empty captures denied');
  perform pg_temp.capture(owner_id,s,false);
  perform pg_temp.require(grading_private.refresh_training_example(s,'synthetic-direct') is null,'unretained direct denied');
  perform pg_temp.no_research(s);

  research:=pg_temp.session(owner_id,'research','mica-grading-research-v2');
  foreach mode in array kinds loop perform pg_temp.capture(owner_id,research,true,mode); end loop;
  select id,physical_card_id,source_hash into example,physical,source
  from grading_private.training_examples where scan_session_id=research;
  perform pg_temp.require(example is not null,'valid research trigger retained');
  perform pg_temp.require(grading_private.refresh_training_example(research,'synthetic-direct')=example,'valid direct same example');
  perform pg_temp.require((select jsonb_array_length(capture_manifest->'captures')=4 from grading_private.training_examples where id=example),'four retained snapshots');
  insert into public.grading_outcomes(user_id,scan_session_id,professional_grader,returned_grade,returned_label)
  values(owner_id,research,'PSA',9,'9');
  perform pg_temp.require((select label_snapshot->>'returnedLabel'='9' from grading_private.training_examples where id=example),'outcome trigger refresh');

  -- A newly unretained capture invalidates a prior example through the original cleanup path.
  perform pg_temp.capture(owner_id,research,false,'corner_closeup');
  perform pg_temp.require(not exists(select 1 from grading_private.training_examples where id=example),'mixed retention deletes stale example');
  perform pg_temp.require(exists(select 1 from grading_private.data_deletion_tombstones where physical_card_partition_key=physical::text),'cleanup tombstones');
  perform pg_temp.require(exists(select 1 from grading_private.data_deletion_jobs where cardinality(storage_paths)=4),'cleanup queues retained paths');

  research:=pg_temp.session(owner_id,'research','mica-grading-research-v2');
  c:=pg_temp.capture(owner_id,research,true);
  select source_hash into source from grading_private.training_examples where scan_session_id=research;
  perform pg_temp.require(grading_private.delete_training_subject(research,'synthetic-delete','synthetic-direct'),'direct deletion');
  perform pg_temp.require(grading_private.refresh_training_example(research,'synthetic-direct') is null,'deleted source not rebuilt directly');
  update public.grading_captures set normalized_width=101 where id=c;
  perform pg_temp.require(not exists(select 1 from grading_private.training_examples where scan_session_id=research),'deleted source not rebuilt by trigger');
  perform pg_temp.require(exists(select 1 from grading_private.data_deletion_tombstones where source_hash=source),'deletion tombstone retained');

  research:=pg_temp.session(owner_id,'research','mica-grading-research-v2');
  c:=pg_temp.capture(owner_id,research,true);
  select source_hash into source from grading_private.training_examples where scan_session_id=research;
  insert into grading_private.dataset_manifests(version,manifest_sha256)
  values(gen_random_uuid()::text,encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex')) returning id into manifest;
  insert into grading_private.dataset_manifest_examples(manifest_id,example_id,physical_card_id,
    source_hash,dataset_partition,label_snapshot,cohort_snapshot)
  select manifest,id,physical_card_id,source_hash,'train',label_snapshot,cohort
  from grading_private.training_examples where scan_session_id=research;
  update grading_private.dataset_manifests set status='frozen',frozen_at=now() where id=manifest;
  insert into grading_private.model_registry(model_version,model_role,dataset_manifest_id,artifact_sha256,status)
  values(gen_random_uuid()::text,'psa_fusion',manifest,repeat('c',64),'champion') returning id into model;
  insert into grading_private.calibration_registry(calibration_version,model_id,dataset_manifest_id,artifact_sha256,validated)
  values(gen_random_uuid()::text,model,manifest,repeat('d',64),true);
  update public.grading_research_consents set consented=false,training_allowed=false,revoked_at=now() where user_id=owner_id;
  perform pg_temp.require(not exists(select 1 from grading_private.training_examples e where e.owner_id=consent_test.owner_id),'withdrawal removes examples');
  perform pg_temp.require(exists(select 1 from grading_private.data_deletion_tombstones where source_hash=source),'withdrawal tombstones');
  perform pg_temp.require((select status='quarantined' from grading_private.model_registry where id=model),'withdrawal quarantines model');
  perform pg_temp.require((select not validated from grading_private.calibration_registry where model_id=model),'withdrawal invalidates calibration');
  perform pg_temp.require((select example_id is null from grading_private.dataset_manifest_examples where manifest_id=manifest),'frozen lineage survives withdrawal');
  perform pg_temp.require(grading_private.refresh_training_example(research,'synthetic-direct') is null,'withdrawn direct denied');
  update public.grading_captures set normalized_height=101 where id=c;
  perform pg_temp.require(not exists(select 1 from grading_private.training_examples where scan_session_id=research),'withdrawn trigger denied');
  delete from public.grading_research_consents where user_id=owner_id;
  perform pg_temp.require(grading_private.refresh_training_example(research,'synthetic-direct') is null,'missing account consent denied');
  -- 07G account-erasure entrypoint delegates to the same preserved deletion routine.
  if to_regprocedure('public.grading_withdraw_account_training_service(uuid,text)') is not null then
    owner_id:=gen_random_uuid();
    insert into auth.users(id) values(owner_id);
    insert into public.grading_research_consents(user_id,consented,consent_version,consented_at,
      training_allowed,outcome_linkage_allowed,retention_policy_version)
    values(owner_id,true,'mica-grading-research-v2',now(),true,true,'synthetic');
    research:=pg_temp.session(owner_id,'research','mica-grading-research-v2');
    perform pg_temp.capture(owner_id,research,true);
    select source_hash into source from grading_private.training_examples where scan_session_id=research;
    perform pg_temp.require(public.grading_withdraw_account_training_service(owner_id,'synthetic-account-erasure')=1,'account erasure withdrawal');
    perform pg_temp.require(exists(select 1 from grading_private.data_deletion_tombstones where source_hash=source),'account erasure tombstone');
    delete from auth.users where id=owner_id;
    perform pg_temp.require(not exists(select 1 from public.grading_scan_sessions where id=research),'account erasure cascades');
  end if;
end $$;
rollback;
