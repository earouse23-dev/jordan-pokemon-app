import { readFile } from "node:fs/promises";
import {
  PRICE_EVIDENCE_RULE_VERSION,
  reviewComparableOutliers,
} from "../lib/pricing.js";

const benchmark = JSON.parse(
  await readFile(
    new URL(
      "../tests/fixtures/pricing-outlier-benchmark.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const failures = [];

if (benchmark.ruleVersion !== PRICE_EVIDENCE_RULE_VERSION)
  failures.push(
    `benchmark rule ${benchmark.ruleVersion} does not match ${PRICE_EVIDENCE_RULE_VERSION}`,
  );

for (const testCase of benchmark.cases || []) {
  const reviewed = reviewComparableOutliers(
    testCase.amounts.map((amount, index) => ({
      id: `${testCase.id}-${index}`,
      amount,
    })),
  );
  const actual = reviewed
    .map((row, index) => (row.outlierReview.flagged ? index : null))
    .filter((index) => index !== null);
  if (JSON.stringify(actual) !== JSON.stringify(testCase.flaggedIndexes))
    failures.push(
      `${testCase.id}: expected [${testCase.flaggedIndexes}] but got [${actual}]`,
    );
  if (reviewed.some((row) => row.outlierReview.excluded === true))
    failures.push(`${testCase.id}: the review rule silently excluded evidence`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Pricing outlier benchmark passed ${benchmark.cases.length}/${benchmark.cases.length} cases (${benchmark.reviewStatus}).`,
);
