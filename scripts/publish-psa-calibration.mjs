import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const reportPath = process.argv[2];
const confirmed = process.argv.includes("--confirm-activate");
if (!reportPath || !confirmed) {
  console.error(
    "Usage: npm run publish:psa-calibration -- <private-artifact.json> --confirm-activate",
  );
  process.exit(1);
}
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const actorKey = String(process.env.MICA_CALIBRATION_ACTOR_KEY || "");
if (!supabaseUrl || !secretKey || actorKey.length < 10)
  throw new Error("Secure calibration publishing configuration is missing.");
const report = JSON.parse(await readFile(resolve(reportPath), "utf8"));
if (
  report.artifact?.validated !== true ||
  !/^[0-9a-f-]{36}$/i.test(String(report.datasetManifestId || "")) ||
  !/^[0-9a-f-]{36}$/i.test(String(report.modelId || ""))
)
  throw new Error(
    "Only a validated artifact with frozen dataset and champion model lineage can be published.",
  );
const artifactText = JSON.stringify(report.artifact);
const artifactSha256 = createHash("sha256").update(artifactText).digest("hex");
const database = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: calibrationId, error: registrationError } = await database.rpc(
  "grading_register_calibration_service",
  {
    p_calibration_version: report.artifact.version,
    p_model_id: report.modelId,
    p_dataset_manifest_id: report.datasetManifestId,
    p_artifact_sha256: artifactSha256,
    p_artifact: report.artifact,
    p_cohort_eligibility: report.artifact.cohortEligibility || {},
    p_metrics: report.metrics || {},
    p_actor_key: actorKey,
  },
);
if (registrationError) throw registrationError;
const { data: version, error: activationError } = await database.rpc(
  "grading_activate_calibration_service",
  { p_calibration_id: calibrationId, p_actor_key: actorKey },
);
if (activationError) throw activationError;
process.stdout.write(`Activated PSA calibration ${version}.\n`);
