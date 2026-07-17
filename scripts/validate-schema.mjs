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
  ...sql.matchAll(/create table if not exists public\.([a-z_]+)/gi),
].map((match) => match[1]);
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
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${tables.length} public tables; RLS is enabled on every table.`,
);
