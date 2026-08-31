import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { trainPsaCalibration } from "../lib/psa-calibration.js";

const manifestPath = process.argv[2];
const outputFlag = process.argv.indexOf("--output");
const outputPath = resolve(
  outputFlag >= 0
    ? process.argv[outputFlag + 1]
    : "private-psa-calibration.json",
);
if (!manifestPath) {
  console.error(
    "Usage: npm run train:psa-calibration -- <private-actual-psa-manifest.json> [--output private-artifact.json]",
  );
  process.exit(1);
}
const manifestBytes = await readFile(resolve(manifestPath));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const entries = Array.isArray(manifest) ? manifest : manifest.cases;
if (!Array.isArray(entries))
  throw new Error("Calibration manifest is invalid.");
const version = String(
  manifest.version ||
    `mica-psa-ordinal-${new Date().toISOString().slice(0, 10)}`,
);
const result = trainPsaCalibration(entries, {
  version,
  cohortEligibility: manifest.cohortEligibility || { all: true },
});
const report = {
  trainedAt: new Date().toISOString(),
  sourceManifestSha256: createHash("sha256")
    .update(manifestBytes)
    .digest("hex"),
  actualPsaOutcomesRequired: true,
  datasetManifestId: manifest.datasetManifestId || null,
  modelId: manifest.modelId || null,
  ...result,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
  mode: 0o600,
});
process.stdout.write(
  `PSA calibration ${report.artifact.validated ? "passed activation gates" : "remains shadow-only"}: ${outputPath}\n`,
);
if (!report.artifact.validated) process.exitCode = 2;
