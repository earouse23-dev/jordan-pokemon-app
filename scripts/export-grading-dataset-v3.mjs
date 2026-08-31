import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  assessV3DatasetReadiness,
  trainingViewForRole,
} from "../lib/grading-dataset-v3.js";

function flag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const source = process.argv[2];
const outputPath = resolve(flag("--output", "private-grading-dataset-v3.json"));
const modelRole = flag("--role");
if (!source) {
  console.error(
    "Usage: npm run export:grading-v3 -- <manifest-uuid|private-export.json> [--role corners] [--output private-dataset.json]",
  );
  process.exit(1);
}

async function loadManifest() {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      source,
    )
  )
    return JSON.parse(await readFile(resolve(source), "utf8"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for a remote private export.",
    );
  const database = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await database.rpc(
    "grading_v3_dataset_export_service",
    { p_manifest_id: source },
  );
  if (error) throw error;
  return data;
}

const manifest = await loadManifest();
const readiness = assessV3DatasetReadiness(manifest);
const output = {
  exportedAt: new Date().toISOString(),
  privateResearchData: true,
  trainingUseRequiresActiveConsent: true,
  readiness,
  manifest: modelRole
    ? {
        datasetManifestId: manifest.datasetManifestId,
        version: manifest.version,
        manifestSha256: manifest.manifestSha256,
        modelRole,
        examples: trainingViewForRole(manifest, modelRole),
      }
    : manifest,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
  mode: 0o600,
});
process.stdout.write(
  `V3 dataset ${readiness.status}: ${readiness.validExamples}/${readiness.examples} valid examples. ${outputPath}\n`,
);
if (readiness.status !== "ready") {
  process.stdout.write(`Blocking gates: ${readiness.failures.join(", ")}\n`);
  process.exitCode = 2;
}
