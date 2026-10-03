import { readFile } from "node:fs/promises";

const [lifecycle, data, app, shell, migration, databaseTest, browserTest] =
  await Promise.all([
    readFile(new URL("../lib/grading-lifecycle.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase-data.js", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260903021457_connect_grading_lifecycle.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/tests/database/grading_lifecycle.test.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../tests/browser/ui-regression.spec.js", import.meta.url),
      "utf8",
    ),
  ]);

const failures = [];
const requirePattern = (source, pattern, label) => {
  if (!pattern.test(source)) failures.push(label);
};

for (const state of [
  "candidate",
  "capture_incomplete",
  "analyzed",
  "selected",
  "submitted",
  "received",
  "grading",
  "shipped",
  "returned",
  "held",
  "listed",
  "traded",
  "sold",
  "rejected",
])
  requirePattern(lifecycle, new RegExp(`"${state}"`), `state ${state}`);

for (const table of [
  "grading_submission_batches",
  "grading_submission_status_events",
  "grading_lifecycle_events",
  "grading_input_corrections",
]) {
  requirePattern(
    migration,
    new RegExp(`create table if not exists public\\.${table}`, "i"),
    `table ${table}`,
  );
  requirePattern(
    migration,
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    `RLS ${table}`,
  );
}

for (const rpc of [
  "record_grading_submission_batch",
  "record_grading_lifecycle_decision",
  "record_grading_input_correction",
  "grading_calibration_summary",
])
  requirePattern(
    migration,
    new RegExp(`function public\\.${rpc}`),
    `RPC ${rpc}`,
  );

requirePattern(
  migration,
  /security invoker[\s\S]+set search_path=''/i,
  "pinned invoker functions",
);
requirePattern(
  migration,
  /capture_scan_lifecycle_trigger[\s\S]+capture_inventory_lifecycle_trigger/i,
  "automatic scan and disposition history",
);
requirePattern(
  migration,
  /grading_calibration_summary[\s\S]+professional_grader[\s\S]+quality,confidence/i,
  "grader and capture-quality calibration",
);
requirePattern(
  migration,
  /grading_input_corrections[\s\S]+original_value[\s\S]+corrected_value/i,
  "immutable correction overlay",
);
requirePattern(
  lifecycle,
  /requiresValidatedCalibration[\s\S]+requiresCompleteEvidence[\s\S]+requiresStableResult/,
  "confidence standard",
);
requirePattern(
  lifecycle,
  /missingGrades[\s\S]+status: "unsupported"/,
  "missing comparable fail-closed behavior",
);
requirePattern(
  data,
  /recordGradingSubmissionBatch[\s\S]+recordGradingInputCorrection[\s\S]+loadGradingCalibrationSummary/,
  "browser data contracts",
);
requirePattern(app, /gradingLifecycleMarkup/, "connected lifecycle UI");
requirePattern(app, /openBatchSubmissionSheet/, "durable batch UI");
requirePattern(app, /openGradingCorrectionSheet/, "correction UI");
requirePattern(
  shell,
  /id="gradingCalibrationSummary"/,
  "calibration dashboard",
);
requirePattern(
  databaseTest,
  /returned grades update the same owned item/i,
  "same-item database assertion",
);
requirePattern(
  browserTest,
  /grading-to-sale lifecycle/i,
  "browser lifecycle coverage",
);

if (failures.length)
  throw new Error(
    `Grading lifecycle verification failed: ${failures.join(", ")}`,
  );

console.info(
  "Verified the connected grading state machine, atomic batches, status history, corrections, confidence gate, and owner calibration contracts.",
);
