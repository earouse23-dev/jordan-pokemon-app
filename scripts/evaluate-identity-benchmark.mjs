import { readFile } from "node:fs/promises";
import { resolveIdentityCandidates } from "../lib/identity.js";

const fixtures = JSON.parse(
  await readFile(
    new URL("../tests/fixtures/identity-benchmark-v1.json", import.meta.url),
    "utf8",
  ),
);

let exact = 0;
let silentSubstitutions = 0;
let requiredReviews = 0;
const failures = [];

for (const fixture of fixtures) {
  const result = resolveIdentityCandidates(
    fixture.observed,
    fixture.candidates,
  );
  if (result.recommendedId === fixture.expectedId) exact += 1;
  else
    failures.push(
      `${fixture.caseId}: expected ${fixture.expectedId}, received ${result.recommendedId}`,
    );
  if (fixture.expectedId === null && result.recommendedId !== null)
    silentSubstitutions += 1;
  if (result.requiresConfirmation) requiredReviews += 1;
}

const report = {
  benchmarkVersion: "identity-benchmark-v1",
  cases: fixtures.length,
  exactOutcomes: exact,
  outcomeAccuracy: exact / fixtures.length,
  silentSubstitutions,
  confirmationCoverage: requiredReviews / fixtures.length,
  failures,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (
  failures.length ||
  silentSubstitutions !== 0 ||
  requiredReviews !== fixtures.length
)
  process.exit(1);
