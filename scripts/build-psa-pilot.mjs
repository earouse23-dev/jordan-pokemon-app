import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { selectStratifiedPsaPilot } from "../lib/psa-pilot.js";

const manifestPath = process.argv[2];
const outputFlag = process.argv.indexOf("--output");
const targetFlag = process.argv.indexOf("--target");
const outputPath = resolve(
  outputFlag >= 0 ? process.argv[outputFlag + 1] : "private-psa-pilot.json",
);
const target = targetFlag >= 0 ? Number(process.argv[targetFlag + 1]) : 50;
if (!manifestPath) {
  console.error(
    "Usage: npm run build:psa-pilot -- <private-verified-outcomes.json> [--target 50] [--output private-pilot.json]",
  );
  process.exit(1);
}
const source = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const entries = Array.isArray(source) ? source : source.cases;
if (!Array.isArray(entries))
  throw new Error("Verified outcome manifest is invalid.");
const result = selectStratifiedPsaPilot(entries, target);
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      actualPsaOutcomesRequired: true,
      ...result,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `PSA pilot ${result.status}: ${result.selected.length}/${result.target} selected. ${outputPath}\n`,
);
if (result.status !== "ready") {
  process.stdout.write(`Missing cohorts: ${JSON.stringify(result.gaps)}\n`);
  process.exitCode = 2;
}
