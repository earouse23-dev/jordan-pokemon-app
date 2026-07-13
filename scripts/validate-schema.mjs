import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const tables = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/gi)].map(match => match[1]);
const rlsTables = new Set(
  [...sql.matchAll(/alter table public\.([a-z_]+) enable row level security/gi)].map(match => match[1]),
);
const required = [
  'profiles', 'subscriptions', 'usage_events', 'card_sets', 'set_external_ids', 'cards', 'card_variants',
  'card_external_ids', 'variant_external_ids', 'card_images', 'catalog_sync_runs', 'catalog_sync_targets', 'scheduler_credentials', 'catalog_coverage_snapshots', 'collections', 'collection_items',
  'owned_copies', 'collection_tags', 'collection_item_tags', 'saved_views', 'card_scans',
  'scan_candidates', 'scan_feedback', 'price_sources', 'provider_policies', 'price_products', 'price_snapshots', 'price_daily_metrics',
  'sales_records', 'pricing_sync_runs', 'purchase_transactions', 'sale_transactions',
  'valuation_snapshots', 'provider_health_events', 'audit_events', 'import_jobs', 'export_jobs',
];

const failures = [];
for (const table of required) {
  if (!tables.includes(table)) failures.push(`missing required table: ${table}`);
}
for (const table of tables) {
  if (!rlsTables.has(table)) failures.push(`RLS is not enabled: public.${table}`);
}
if (!/revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated/i.test(sql)) {
  failures.push('rls_auto_enable execute privileges are not revoked from client roles');
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${tables.length} public tables; RLS is enabled on every table.`);
