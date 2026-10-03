import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { evaluateV3ShadowRun } from "../lib/grading-dataset-v3.js";

const sourcePath = process.argv[2];
const outputIndex = process.argv.indexOf("--output");
const outputPath = resolve(
  outputIndex >= 0
    ? process.argv[outputIndex + 1]
    : "private-grading-shadow-v3.json",
);
if (!sourcePath) {
  console.error(
    "Usage: npm run evaluate:grading-v3 -- <private-shadow-cases.json> [--dataset frozen-dataset.json --dataset-sha256 <pinned-file-sha256>] [--output private-report.json]",
  );
  process.exit(1);
}
const input = JSON.parse(await readFile(resolve(sourcePath), "utf8"));
const cases = Array.isArray(input) ? input : input.cases;
if (!Array.isArray(cases)) throw new Error("Shadow case manifest is invalid.");
const datasetIndex = process.argv.indexOf("--dataset");
const digestIndex = process.argv.indexOf("--dataset-sha256");
let datasetManifest = null;
let verifiedDatasetFileSha256 = null;
if (datasetIndex >= 0 || digestIndex >= 0) {
  const path = process.argv[datasetIndex + 1];
  const expectedDigest = process.argv[digestIndex + 1];
  if (
    datasetIndex < 0 ||
    digestIndex < 0 ||
    !path ||
    !/^[a-f0-9]{64}$/.test(expectedDigest || "")
  )
    throw new Error(
      "Provide both --dataset and its independently pinned --dataset-sha256.",
    );
  const bytes = await readFile(resolve(path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== expectedDigest)
    throw new Error("Dataset file does not match its pinned digest.");
  datasetManifest = JSON.parse(bytes.toString("utf8"));
  verifiedDatasetFileSha256 = digest;
}
const evaluation = evaluateV3ShadowRun(cases, { datasetManifest });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      evaluatedAt: new Date().toISOString(),
      verifiedDatasetFileSha256,
      ...evaluation,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `V3 candidate remains ${evaluation.status}: ${evaluation.cases} cases. ${outputPath}\n`,
);
if (evaluation.status !== "promotion_eligible") process.exitCode = 2;
