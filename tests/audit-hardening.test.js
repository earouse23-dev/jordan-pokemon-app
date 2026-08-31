import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  completedPriceSyncCursor,
  priceSyncLookupKey,
} from "../api/price-sync.js";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("price sync checkpoints only a contiguous attempted identity prefix", () => {
  const items = [
    { id: "a-1", identity_snapshot: { name: "A" } },
    { id: "b-1", identity_snapshot: { name: "B" } },
    { id: "a-2", identity_snapshot: { name: "A" } },
  ];
  const completed = new Set([priceSyncLookupKey(items[0])]);
  assert.equal(completedPriceSyncCursor(items, completed, "previous"), "a-1");
  completed.add(priceSyncLookupKey(items[1]));
  assert.equal(completedPriceSyncCursor(items, completed, "previous"), "a-2");
});

test("unmatched price lookups still reach the cursor checkpoint", async () => {
  const source = await readProjectFile("api/price-sync.js");
  assert.match(
    source,
    /if \(!result\.card\) throw new Error\("provider_card_not_found"\)/,
  );
  assert.doesNotMatch(source, /if \(!result\.card\)[\s\S]{0,100}continue/);
});

test("confirmed grading reports are checked before evidence is replaced", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260819193524_preserve_confirmed_grading_reports.sql",
  );
  const frozenCheck = migration.indexOf("estimate_status='confirmed'");
  assert.ok(frozenCheck > 0);
  assert.ok(
    frozenCheck < migration.indexOf("delete from public.grading_evidence"),
  );
  assert.match(
    migration,
    /if prediction_id is not null then return prediction_id/,
  );
});

test("database hardening retains coverage, leases erasure, and accepts V2 calibration", async () => {
  const [valuation, deletion, calibration] = await Promise.all([
    readProjectFile(
      "supabase/migrations/20260819193525_prefer_best_portfolio_snapshots.sql",
    ),
    readProjectFile(
      "supabase/migrations/20260819193526_lease_grading_deletion_jobs.sql",
    ),
    readProjectFile(
      "supabase/migrations/20260819193528_support_psa_feature_contract_v2.sql",
    ),
  ]);
  assert.match(
    valuation,
    /excluded\.priced_items>public\.valuation_snapshots\.priced_items/,
  );
  assert.match(
    deletion,
    /coalesce\(job\.claimed_at,job\.created_at\)<now\(\)-interval '15 minutes'/,
  );
  assert.match(calibration, /mica-psa-features-v2/);
});

test("live vision benchmark sends production grading capture descriptors", async () => {
  const evaluator = await readProjectFile("scripts/evaluate-vision.mjs");
  assert.match(evaluator, /payload\.captureDescriptors/);
  assert.match(evaluator, /alternate_front/);
  assert.match(evaluator, /alternate_back/);
});

test("account deletion withdraws training through the lineage-aware path", async () => {
  const [endpoint, migration] = await Promise.all([
    readProjectFile("api/account.js"),
    readProjectFile(
      "supabase/migrations/20260819194052_withdraw_account_training_before_deletion.sql",
    ),
  ]);
  assert.match(endpoint, /grading_withdraw_account_training_service/);
  assert.match(migration, /grading_private\.delete_training_subject/);
  assert.match(migration, /to service_role/);
});
