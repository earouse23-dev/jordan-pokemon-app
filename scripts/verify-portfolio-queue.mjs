import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
// Only an explicitly selected local Docker database; all DDL/data roll back.
assert.equal(process.env.DOCKER_CONTEXT, 'colima-mica-dev');
const migration = readFileSync(new URL('../supabase/migrations/20261013003706_fair_portfolio_refresh_queue.sql', import.meta.url), 'utf8');
const dispatcher = readFileSync(new URL('../supabase/migrations/20261013004113_portfolio_refresh_dispatcher.sql', import.meta.url), 'utf8');
const sql = `begin;
create table public.portfolio_views(user_id uuid primary key, inventory_revision bigint not null default 0, view jsonb, attempted_at timestamptz,refresh_until timestamptz);
${migration}
${dispatcher}
do $$ begin
assert public.dispatch_portfolio_refresh() is null, 'Empty queue dispatched HTTP';
assert not exists(select 1 from cron.job where jobname='mica-portfolio-refresh' and active),'Unqualified scheduler activated';
assert not has_function_privilege('authenticated','public.dispatch_portfolio_refresh()','execute'),'Dispatcher exposed';
end $$;
insert into auth.users(id) select ('77777777-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,300) i;
insert into public.portfolio_views(user_id,inventory_revision,view,attempted_at)
select ('77777777-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,0,
case when i<=150 then '{"dailyVersion":1,"checkedDay":"2026-10-13","inventoryRevision":0}'::jsonb else '{}'::jsonb end,
case when i<=150 then '2026-10-12'::timestamptz else null end
from generate_series(1,300) i;
do $$ begin
assert (select count(*) from public.due_portfolio_refreshes('2026-10-13',100))=100,'Completed first 150 owners starved due owners';
assert not exists(select 1 from public.due_portfolio_refreshes('2026-10-13',100) where user_id::text<'77777777-0000-4000-8000-000000000151'),'Completed owners selected';
assert not has_function_privilege('authenticated','public.due_portfolio_refreshes(timestamptz,integer)','execute'),'Owner queue exposed';
assert not has_function_privilege('anon','public.due_portfolio_refreshes(timestamptz,integer)','execute'),'Anonymous queue exposed';
end $$;
update public.portfolio_views set attempted_at='2026-10-13',view='{"attemptDay":"2026-10-13","attemptRevision":0,"attemptCount":3}' where user_id::text between '77777777-0000-4000-8000-000000000151' and '77777777-0000-4000-8000-000000000250';
do $$ begin
assert (select count(*) from public.due_portfolio_refreshes('2026-10-13',100))=50,'Failed owners starve remaining queue';
assert (select count(*) from public.due_portfolio_refreshes('2026-10-14',100))=100,'Next UTC day did not reset queue';
end $$;
rollback;
`;
const result = spawnSync('docker', ['exec','-i','supabase_db_jordan-pokemon-app','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], {input:sql,encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
console.log('300-owner queue: fairness, failure backoff, UTC rollover, and role boundaries passed; rolled back.');
