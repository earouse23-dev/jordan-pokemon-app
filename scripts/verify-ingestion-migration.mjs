import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260902120000_reliable_collection_ingestion.sql",
    import.meta.url,
  ),
  "utf8",
);
const integrationTest = await readFile(
  new URL(
    "../supabase/tests/database/reliable_ingestion.test.sql",
    import.meta.url,
  ),
  "utf8",
);
const failures = [];
const requirePattern = (pattern, message) => {
  if (!pattern.test(migration)) failures.push(message);
};

for (const table of [
  "import_mapping_profiles",
  "import_staged_rows",
  "import_job_items",
  "ingestion_events",
]) {
  requirePattern(
    new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
    `missing ingestion table: ${table}`,
  );
  requirePattern(
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    `RLS is not enabled for ${table}`,
  );
}

for (const name of [
  "begin_collection_import",
  "stage_collection_import_rows",
  "preview_collection_import",
])
  requirePattern(
    new RegExp(
      `function public\\.${name}[\\s\\S]+security invoker[\\s\\S]+auth\\.uid\\(\\)`,
      "i",
    ),
    `${name} is missing owner-scoped invoker security`,
  );

requirePattern(
  /function public\.commit_collection_import[\s\S]+security definer[\s\S]+set search_path=''[\s\S]+auth\.uid\(\)/i,
  "atomic commit lacks fixed-path definer security and an authenticated owner boundary",
);
requirePattern(
  /function public\.rollback_collection_import[\s\S]+security definer[\s\S]+set search_path=''[\s\S]+auth\.uid\(\)/i,
  "guarded rollback lacks fixed-path definer security and an authenticated owner boundary",
);

requirePattern(
  /commit_collection_import[\s\S]+preview_collection_import[\s\S]+import_validation_failed[\s\S]+create_collection_position/i,
  "commit does not validate every staged row before creating positions",
);
requirePattern(
  /stage_collection_import_rows[\s\S]+import_staged_rows[\s\S]+on conflict\(import_job_id,row_number\) do update/i,
  "staging is not idempotent by import and source row",
);
requirePattern(
  /rollback_collection_import[\s\S]+import_position_changed_after_commit[\s\S]+import_position_has_dependent_transactions[\s\S]+delete from public\.collection_items/i,
  "rollback does not protect later user work before deleting imported rows",
);
requirePattern(
  /action text not null check \(action in \('created','reused'\)\)/i,
  "created and reused import results are not distinguished",
);
requirePattern(
  /function public\.collection_import_row_error\(p_payload jsonb\)[\s\S]+stable[\s\S]+security invoker[\s\S]+grant execute on function public\.collection_import_row_error\(jsonb\)[\s\S]+to authenticated/i,
  "pure row validation is not safely callable by the invoker-owned preview",
);
requirePattern(
  /create policy "import results own rows"[\s\S]+for select to authenticated[\s\S]+revoke all on public\.import_mapping_profiles,public\.import_staged_rows,[\s\S]+public\.import_job_items,public\.ingestion_events from public,anon,authenticated[\s\S]+grant select on public\.import_job_items to authenticated/i,
  "committed import results do not enforce read-only client privileges",
);
requirePattern(
  /function public\.record_ingestion_event[\s\S]+security definer[\s\S]+set search_path=''[\s\S]+entry\.key in[\s\S]+'rowCount'[\s\S]+revoke all on function public\.record_ingestion_event[\s\S]+to authenticated/i,
  "ingestion instrumentation is not owner-bound and metadata-allowlisted",
);
if (/drop\s+(table|schema)\b/i.test(migration))
  failures.push("ingestion migration contains a destructive table/schema drop");

const requireTestPattern = (pattern, message) => {
  if (!pattern.test(integrationTest)) failures.push(message);
};
requireTestPattern(
  /select plan\(31\)/i,
  "integration test plan is not current",
);
requireTestPattern(
  /staging changes no collection rows/i,
  "integration coverage does not prove preview/staging is read-only",
);
requireTestPattern(
  /another owner cannot roll back the import/i,
  "integration coverage does not prove cross-owner isolation",
);
requireTestPattern(
  /untouched imported positions roll back together/i,
  "integration coverage does not prove guarded rollback",
);
requireTestPattern(
  /failed validation leaves the portfolio unchanged/i,
  "integration coverage does not prove atomic validation failure",
);
requireTestPattern(
  /event metadata keeps approved counters and drops arbitrary free text/i,
  "integration coverage does not prove instrumentation data minimization",
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "Verified owner-scoped staging, atomic commit, duplicate evidence, and guarded rollback contracts.",
);
