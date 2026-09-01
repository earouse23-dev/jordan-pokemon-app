import { readFile } from "node:fs/promises";

const files = [
  "../supabase/migrations/20260831235837_canonical_collectible_identity.sql",
  "../supabase/migrations/20260901002305_canonical_identity_runtime.sql",
];
const migrations = await Promise.all(
  files.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
);
const sql = migrations.join("\n");
const integrationTest = await readFile(
  new URL(
    "../supabase/tests/database/canonical_identity.test.sql",
    import.meta.url,
  ),
  "utf8",
);
const failures = [];

function requirePattern(pattern, message) {
  if (!pattern.test(sql)) failures.push(message);
}

function requireTestPattern(pattern, message) {
  if (!pattern.test(integrationTest)) failures.push(message);
}

for (const table of [
  "sealed_products",
  "collectible_identities",
  "identity_match_rule_versions",
  "collectible_provider_mappings",
  "identity_match_decisions",
  "identity_corrections",
  "identity_merge_proposals",
  "identity_merge_events",
]) {
  requirePattern(
    new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
    `missing identity table: ${table}`,
  );
  requirePattern(
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    `RLS is not enabled: ${table}`,
  );
}

for (const table of [
  "collection_items",
  "collection_transactions",
  "purchase_lots",
  "position_price_observations",
  "card_watchlist",
  "price_products",
  "price_observations",
  "card_provider_mappings",
  "scan_candidates",
  "owned_copies",
  "purchase_transactions",
  "sale_transactions",
  "digital_grade_assessments",
  "grading_submissions",
  "grading_physical_cards",
  "grading_scan_sessions",
  "grading_captures",
  "grading_evidence",
  "grading_predictions",
  "grading_outcomes",
  "grading_feedback",
]) {
  requirePattern(
    new RegExp(
      `alter table public\\.${table} add column if not exists collectible_id uuid`,
      "i",
    ),
    `missing collectible_id: ${table}`,
  );
  requirePattern(
    new RegExp(
      `alter table public\\.${table} alter column collectible_id set not null`,
      "i",
    ),
    `collectible_id remains nullable after backfill: ${table}`,
  );
}

for (const functionName of [
  "resolve_collectible_identity",
  "derive_collection_item_identity",
  "propagate_collection_item_identity",
]) {
  requirePattern(
    new RegExp(
      `function identity_private\\.${functionName}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path=''`,
      "i",
    ),
    `private identity function is missing or unsafe: ${functionName}`,
  );
}

for (const functionName of [
  "remap_collection_position",
  "revert_collection_identity_correction",
  "propose_collectible_identity_merge",
  "resolve_collectible_identity_merge",
  "reverse_collectible_identity_merge",
]) {
  requirePattern(
    new RegExp(
      `function public\\.${functionName}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path=''`,
      "i",
    ),
    `public identity RPC is missing or unsafe: ${functionName}`,
  );
  requirePattern(
    new RegExp(`revoke all on function public\\.${functionName}\\(`, "i"),
    `public identity RPC keeps default execute: ${functionName}`,
  );
}

for (const triggerName of [
  "collection_item_collectible_identity_trigger",
  "collection_transaction_collectible_identity_trigger",
  "watchlist_collectible_identity_trigger",
  "price_observation_collectible_identity_trigger",
  "grading_physical_collectible_identity_trigger",
  "zz_grading_session_collectible_identity_trigger",
  "grading_prediction_collectible_identity_trigger",
  "collection_item_identity_propagation_trigger",
]) {
  requirePattern(
    new RegExp(`create trigger ${triggerName}\\b`, "i"),
    `missing identity trigger: ${triggerName}`,
  );
}

requirePattern(
  /identity_kind in \('card_variant','card_printing','sealed_product','unresolved'\)/i,
  "identity kinds do not include explicit unresolved records",
);
requirePattern(
  /"requiredConfirmation":true/i,
  "matching rules do not require user confirmation",
);
requirePattern(
  /create unique index if not exists identity_corrections_one_reversal_uidx/i,
  "a correction can be reversed more than once",
);
requirePattern(
  /if hop_count>20 then raise exception 'collectible_identity_merge_cycle'/i,
  "merge aliases do not have a cycle guard",
);
requirePattern(
  /grant select on public\.sealed_products,public\.collectible_identities,[\s\S]+to authenticated/i,
  "new Data API reads do not have explicit authenticated grants",
);
requirePattern(
  /revoke all on schema identity_private from public, anon, authenticated/i,
  "private identity schema is exposed",
);
requirePattern(
  /authenticated collectible identities read[\s\S]+owner_id is null or owner_id=\(select auth\.uid\(\)\)/i,
  "owner-created unresolved identities are not owner-scoped",
);
requirePattern(
  /jsonb_build_object\([\s\S]+?'sourceType',p_source_type,[\s\S]+?'subjectId',coalesce\(p_subject_id,p_source_id\)/i,
  "unresolved identities do not retain a non-content owner binding",
);
requirePattern(
  /collectible_id uuid references public\.collectible_identities\(id\) on delete no action deferrable initially deferred/i,
  "identity references are not deferred for safe account deletion",
);
requirePattern(
  /actor_id uuid references auth\.users\(id\) on delete set null/i,
  "identity audit events can block actor account deletion",
);

if (/user_metadata/i.test(sql))
  failures.push("identity authorization trusts user-editable metadata");
if (/references auth\.users\(id\) on delete restrict/i.test(sql))
  failures.push("identity history can block account deletion");
if (/'snapshot',coalesce\(p_snapshot/i.test(sql))
  failures.push(
    "private identity snapshots are copied into the shared registry",
  );
if (/drop\s+(table|schema)\b/i.test(sql))
  failures.push("identity migration contains a destructive table/schema drop");
if (/from \(select 1\) anchor/i.test(sql))
  failures.push(
    "identity backfill contains a target-table-dependent join anchor",
  );
if ((sql.match(/\$\$/g) || []).length % 2 !== 0)
  failures.push("identity migration has an unmatched function body delimiter");

for (const [pattern, message] of [
  [/^begin;/im, "identity integration test is not transactional"],
  [/^rollback;/im, "identity integration test does not roll back fixtures"],
  [
    /11111111-1111-4111-8111-111111111111[\s\S]+22222222-2222-4222-8222-222222222222/i,
    "identity integration test does not use two owners",
  ],
  [
    /RLS filters a cross-owner update/i,
    "identity integration test does not exercise RLS isolation",
  ],
  [
    /cross_owner_merge_not_allowed/i,
    "identity integration test does not reject cross-owner merges",
  ],
  [
    /correction_already_reversed/i,
    "identity integration test does not prove correction reversal is one-shot",
  ],
  [
    /merge_not_active/i,
    "identity integration test does not prove merge reversal is one-shot",
  ],
  [
    /delete from auth\.users/i,
    "identity integration test does not exercise account deletion",
  ],
]) {
  requireTestPattern(pattern, message);
}

const declaredPlan = Number(
  integrationTest.match(/select plan\((\d+)\)/i)?.[1] || 0,
);
const testAssertions = (
  integrationTest.match(
    /^select (?:has_table|col_not_null|is|is_empty|ok|throws_ok|lives_ok)\(/gim,
  ) || []
).length;
if (!declaredPlan || declaredPlan !== testAssertions)
  failures.push(
    `identity integration plan declares ${declaredPlan} but has ${testAssertions} assertions`,
  );

if (failures.length) {
  for (const failure of failures)
    console.error(`identity-migration: ${failure}`);
  process.exit(1);
}

console.info(
  "Identity migration verified: additive registry, complete references, RLS, " +
    "pinned privileged functions, reversible corrections, merge aliases, and " +
    `${testAssertions} transactional integration assertions.`,
);
