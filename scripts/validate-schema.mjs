import { readFile, readdir } from "node:fs/promises";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrations = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = [
  await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ...(await Promise.all(
    migrations.map((file) =>
      readFile(new URL(file, migrationDirectory), "utf8"),
    ),
  )),
].join("\n");
const tables = [
  ...new Set(
    [...sql.matchAll(/create table if not exists public\.([a-z_]+)/gi)].map(
      (match) => match[1],
    ),
  ),
];
const rlsTables = new Set(
  [
    ...sql.matchAll(
      /alter table public\.([a-z_]+) enable row level security/gi,
    ),
  ].map((match) => match[1]),
);
const required = [
  "profiles",
  "subscriptions",
  "usage_events",
  "card_sets",
  "set_external_ids",
  "cards",
  "card_variants",
  "card_external_ids",
  "variant_external_ids",
  "card_images",
  "catalog_sync_runs",
  "catalog_sync_targets",
  "scheduler_credentials",
  "catalog_coverage_snapshots",
  "collections",
  "collection_items",
  "owned_copies",
  "collection_tags",
  "collection_item_tags",
  "saved_views",
  "card_scans",
  "scan_candidates",
  "scan_feedback",
  "price_sources",
  "provider_policies",
  "price_products",
  "price_snapshots",
  "price_daily_metrics",
  "sales_records",
  "pricing_sync_runs",
  "purchase_transactions",
  "sale_transactions",
  "valuation_snapshots",
  "provider_health_events",
  "audit_events",
  "import_jobs",
  "export_jobs",
  "card_provider_mappings",
  "price_observations",
  "collection_transactions",
  "purchase_lots",
  "fifo_lot_allocations",
  "price_anomalies",
  "provider_sync_status",
  "card_watchlist",
  "position_price_observations",
  "grading_submissions",
  "grading_research_consents",
  "grading_scan_sessions",
  "grading_captures",
  "grading_evidence",
  "grading_predictions",
  "grading_outcomes",
  "grading_feedback",
  "grading_physical_cards",
  "sealed_products",
  "collectible_identities",
  "identity_match_rule_versions",
  "collectible_provider_mappings",
  "identity_match_decisions",
  "identity_corrections",
  "identity_merge_proposals",
  "identity_merge_events",
];

const failures = [];
for (const table of required) {
  if (!tables.includes(table))
    failures.push(`missing required table: ${table}`);
}
for (const table of tables) {
  if (!rlsTables.has(table))
    failures.push(`RLS is not enabled: public.${table}`);
}
if (
  !/revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated/i.test(
    sql,
  )
) {
  failures.push(
    "rls_auto_enable execute privileges are not revoked from client roles",
  );
}
if (
  !/create policy "collection transactions own rows"[\s\S]+auth\.uid\(\)\)=user_id/i.test(
    sql,
  )
)
  failures.push("collection transaction ownership RLS is missing");
if (
  !/create or replace function public\.create_collection_position[\s\S]+security invoker/i.test(
    sql,
  )
)
  failures.push("transactional position RPC is missing or privileged");
if (!/order by acquired_at,id for update/i.test(sql))
  failures.push("FIFO sale allocation does not lock oldest lots first");
if (
  !/transaction_date date not null check \(transaction_date <= current_date\)/i.test(
    sql,
  )
)
  failures.push("future transaction date database safeguard is missing");
if (
  !/create policy "watchlist owners can update"[\s\S]+using \(\(select auth\.uid\(\)\)=user_id\)[\s\S]+with check \(\(select auth\.uid\(\)\)=user_id\)/i.test(
    sql,
  )
)
  failures.push("watchlist update ownership RLS is missing");
for (const table of [
  "physical_card_partitions",
  "training_examples",
  "annotation_reviews",
  "dataset_manifests",
  "model_registry",
  "calibration_registry",
  "evaluation_runs",
  "outcome_verification_reviews",
  "dataset_manifest_examples",
  "data_deletion_tombstones",
  "data_deletion_jobs",
  "pilot_audit_events",
]) {
  if (
    !new RegExp(
      `create table if not exists grading_private\\.${table}`,
      "i",
    ).test(sql)
  )
    failures.push(`missing private grading table: ${table}`);
  if (
    !new RegExp(
      `alter table grading_private\\.${table} enable row level security`,
      "i",
    ).test(sql)
  )
    failures.push(`RLS is not enabled: grading_private.${table}`);
}
if (
  !/revoke all on schema grading_private from public,anon,authenticated/i.test(
    sql,
  )
)
  failures.push("private grading schema is exposed to client roles");
for (const match of sql.matchAll(
  /create(?: or replace)? function public\.([a-z_]+)\s*\(([^)]*)\)([\s\S]*?)as \$\$/gi,
)) {
  const [, functionName, , header] = match;
  if (!/security definer/i.test(header)) continue;
  if (!/set search_path\s*=\s*''/i.test(header))
    failures.push(
      `public security-definer function has a writable search path: ${functionName}`,
    );
  if (
    !new RegExp(`revoke all on function public\\.${functionName}\\(`, "i").test(
      sql,
    )
  )
    failures.push(
      `public security-definer function keeps default execute access: ${functionName}`,
    );
}
if (/auth\.role\s*\(/i.test(sql))
  failures.push("deprecated auth.role() authorization remains in the schema");
for (const match of sql.matchAll(
  /create(?: or replace)? view public\.([a-z_]+)([\s\S]*?)\bas\b/gi,
)) {
  const [, viewName, header] = match;
  if (!/security_invoker\s*=\s*true/i.test(header))
    failures.push(`public view does not preserve caller RLS: ${viewName}`);
}
for (const signature of [
  "grading_v3_freeze_dataset_service\\(text,uuid\\[\\],text\\)",
  "grading_v3_dataset_export_service\\(uuid\\)",
  "grading_v3_dataset_candidates_service\\(integer\\)",
]) {
  if (
    !new RegExp(
      `revoke all on function public\\.${signature}[\\s\\S]+from public,anon,authenticated`,
      "i",
    ).test(sql) ||
    !new RegExp(
      `grant execute on function public\\.${signature}[\\s\\S]+to service_role`,
      "i",
    ).test(sql)
  )
    failures.push(`V3 dataset service is not service-only: ${signature}`);
}
if (
  !/add column if not exists annotation_snapshot jsonb[\s\S]+add column if not exists pipeline_snapshot jsonb[\s\S]+add column if not exists capture_snapshot jsonb/i.test(
    sql,
  )
)
  failures.push("V3 frozen dataset lineage snapshots are missing");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${tables.length} public tables; RLS is enabled on every table.`,
);
