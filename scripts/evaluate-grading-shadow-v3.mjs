import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
    "Usage: npm run evaluate:grading-v3 -- <private-shadow-cases.json> [--output private-report.json]",
  );
  process.exit(1);
}
const input = JSON.parse(await readFile(resolve(sourcePath), "utf8"));
const cases = Array.isArray(input) ? input : input.cases;
if (!Array.isArray(cases)) throw new Error("Shadow case manifest is invalid.");
const evaluation = evaluateV3ShadowRun(cases);
await writeFile(
  outputPath,
  `${JSON.stringify(
    { evaluatedAt: new Date().toISOString(), ...evaluation },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `V3 candidate remains ${evaluation.status}: ${evaluation.cases} cases. ${outputPath}\n`,
);
if (evaluation.status !== "promotion_eligible") process.exitCode = 2;
