import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260901014556_transparent_pricing_evidence.sql",
    import.meta.url,
  ),
  "utf8",
);
const integrationTest = await readFile(
  new URL(
    "../supabase/tests/database/transparent_pricing.test.sql",
    import.meta.url,
  ),
  "utf8",
);
const failures = [];

function requirePattern(pattern, message) {
  if (!pattern.test(migration)) failures.push(message);
}

function requireTestPattern(pattern, message) {
  if (!pattern.test(integrationTest)) failures.push(message);
}

for (const column of [
  "aggregator",
  "region",
  "language",
  "finish",
  "retrieved_at",
  "evidence_kind",
  "capability_status",
  "exclusion_status",
  "evidence_rule_version",
  "confidence_reason",
  "outlier_review",
]) {
  requirePattern(
    new RegExp(
      `alter table public\\.price_observations[\\s\\S]+add column if not exists ${column}\\b`,
      "i",
    ),
    `shared observations are missing ${column}`,
  );
  if (!["aggregator", "finish"].includes(column))
    requirePattern(
      new RegExp(
        `alter table public\\.position_price_observations[\\s\\S]+add column if not exists ${column}\\b`,
        "i",
      ),
      `position observations are missing ${column}`,
    );
}

for (const constraint of [
  "price_observations_evidence_kind_check",
  "price_observations_capability_status_check",
  "price_observations_exclusion_status_check",
  "position_prices_evidence_kind_check",
  "position_prices_capability_status_check",
  "position_prices_exclusion_status_check",
])
  requirePattern(
    new RegExp(`add constraint ${constraint}\\b`, "i"),
    `missing pricing constraint: ${constraint}`,
  );

requirePattern(
  /price_observations_comparable_current_idx[\s\S]+where capability_status='live' and exclusion_status='included'/i,
  "shared comparable lookup does not exclude unsupported or excluded evidence",
);
requirePattern(
  /position_prices_comparable_current_idx[\s\S]+where capability_status='live' and exclusion_status='included'/i,
  "position comparable lookup does not exclude unsupported or excluded evidence",
);
requirePattern(
  /freshness uses provider_updated_at\/observed_at, never this retrieval timestamp/i,
  "source time and retrieval time are not documented as separate boundaries",
);
requirePattern(
  /entitlement_snapshot jsonb not null default '\{\}'::jsonb/i,
  "runtime provider entitlement evidence is not durable",
);
requirePattern(
  /daily_credit_reserved integer not null default 0[\s\S]+daily_credit_day date/i,
  "provider daily credit reservations are not durable",
);
requirePattern(
  /create or replace function public\.reserve_provider_daily_credits[\s\S]+for update[\s\S]+greatest\(p_daily_budget-current_reserved,0\)/i,
  "provider credits are not reserved atomically within the daily allowance",
);
requirePattern(
  /revoke all on function public\.reserve_provider_daily_credits\(text,integer,integer\)[\s\S]+from public,anon,authenticated[\s\S]+grant execute[\s\S]+to service_role/i,
  "provider credit reservation is not restricted to the service role",
);

if (/drop\s+(table|schema)\b/i.test(migration))
  failures.push("pricing migration contains a destructive table/schema drop");
if (/grant\s+(insert|update|delete|all)[^;]+to authenticated/i.test(migration))
  failures.push("pricing migration grants client writes to evidence tables");

for (const [pattern, message] of [
  [/^begin;/im, "pricing integration test is not transactional"],
  [/^rollback;/im, "pricing integration test does not roll back fixtures"],
  [
    /31111111-1111-4111-8111-111111111111[\s\S]+32222222-2222-4222-8222-222222222222/i,
    "pricing integration test does not use two owners",
  ],
  [
    /RLS exposes only the signed-in owner position evidence/i,
    "pricing integration test does not exercise owner isolation",
  ],
  [
    /non-admin users cannot read anomaly review records/i,
    "pricing integration test does not protect anomaly review",
  ],
  [
    /live included observation remains valuation eligible/i,
    "pricing integration test does not prove explicit valuation eligibility",
  ],
  [
    /a second reservation cannot exceed the daily allowance/i,
    "pricing integration test does not prove the durable daily credit limit",
  ],
])
  requireTestPattern(pattern, message);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  "Verified the additive pricing-evidence migration, constraints, indexes, and RLS test coverage.",
);
