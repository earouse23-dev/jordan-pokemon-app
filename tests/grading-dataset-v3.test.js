import test from "node:test";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  assessV3DatasetReadiness,
  evaluateV3ShadowRun,
  trainingViewForRole,
} from "../lib/grading-dataset-v3.js";

const hash = (digit) => String(digit).repeat(64);

function example(index, partition) {
  const capture = (type, side) => ({
    type,
    side,
    storagePath: `owner/session/${type}.jpg`,
    imageHash: hash((index % 9) + 1),
    geometry: {
      normalizedCropApplied: true,
      backgroundExcluded: true,
      boundaryConfidence: 0.9,
    },
  });
  return {
    physicalCardId: `card-${index}`,
    sourceHash: hash(((index + 4) % 9) + 1),
    partition,
    cohort: {
      name: "Test Card",
      set: "Test Set",
      collectorNumber: String(index + 1),
      language: "en",
      finish: index === 0 ? "traditional_holo" : "non_holo",
    },
    professionalOutcome: {
      grader: "PSA",
      returnedGrade: 8,
      verificationStatus: "independently_verified",
    },
    humanLabels: {
      protocolVersion: "mica-psa-label-protocol-v1",
      identityConfirmed: true,
      finish: index === 0 ? "traditional_holo" : "non_holo",
      evidence: { sufficient: true },
      condition: {
        centering: 8,
        corners: 8,
        edges: 8,
        surface: 8,
        structure: 8,
        eyeAppeal: 8,
      },
      defects: index === 1 ? [{ category: "corner_whitening" }] : [],
    },
    pipelineEvidence: {
      evidenceProfile: { version: "mica-evidence-profile-v3" },
      gradingWorkflow: { complete: true },
      referenceComparison: {
        status: "compared",
        exactIdentityMatch: true,
        catalogCardId: "base1-4",
        provider: "tcgdex",
        excludedArtifactFraction: index === 0 ? 0.08 : 0,
      },
    },
    captures: [
      capture("front", "front"),
      capture("back", "back"),
      capture("alternate_front", "front"),
      capture("alternate_back", "back"),
    ],
  };
}

function manifest() {
  const examples = [
    example(0, "train"),
    example(1, "validation"),
    example(2, "calibration"),
    example(3, "test"),
  ];
  return {
    version: "mica-grading-v3-test",
    manifestSha256: hash(9),
    exampleCount: examples.length,
    examples,
  };
}

test("V3 dataset readiness requires complete labels, captures, and isolated cards", () => {
  const result = assessV3DatasetReadiness(manifest(), {
    minimumExamples: 4,
    minimumPartitions: {
      train: 1,
      validation: 1,
      calibration: 1,
      test: 1,
      external_holdout: 0,
    },
  });
  assert.equal(result.status, "ready");
  assert.equal(result.validExamples, 4);
  assert.equal(result.hardNegatives.cleanExamples, 3);

  const broken = manifest();
  broken.examples[0].captures = broken.examples[0].captures.slice(0, 3);
  const rejected = assessV3DatasetReadiness(broken, {
    minimumExamples: 4,
    minimumPartitions: {},
  });
  assert.equal(rejected.status, "blocked");
  assert.ok(
    rejected.failures.some((failure) =>
      failure.includes("capture_alternate_back_missing"),
    ),
  );
});

test("role-specific training views do not leak PSA outcomes into defect models", () => {
  const conditionRows = trainingViewForRole(manifest(), "corners");
  assert.equal(conditionRows[0].professionalOutcome, undefined);
  assert.equal(conditionRows[0].pipelineEvidence, undefined);
  assert.equal(conditionRows[1].target.score, 8);
  assert.equal(conditionRows[1].target.defects.length, 1);

  const geometryRows = trainingViewForRole(manifest(), "geometry");
  const composite = geometryRows[0].target.composites[0];
  assert.equal(composite.target.mask, "analytic_transformed_card_quad");
  assert.equal(composite.safeguards.artifactsRestrictedOutsideCardMask, true);
  assert.equal(composite.safeguards.syntheticPositiveCardDamageAllowed, false);
  assert.equal(geometryRows[0].captures[0].geometry, undefined);

  const fusionRows = trainingViewForRole(manifest(), "psa_fusion");
  assert.equal(fusionRows[0].target.returnedGrade, 8);
  assert.equal(fusionRows[0].auxiliaryTargets.condition.surface, 8);
  assert.equal(fusionRows[0].captures, undefined);
});

test("shadow candidates need enough card-disjoint cases and must beat champion", () => {
  const cases = Array.from({ length: 100 }, (_, index) => ({
    physicalCardId: `shadow-${index}`,
    partition: index < 80 ? "test" : "external_holdout",
    expectedGrade: 8,
    cohort: {
      finish: index < 50 ? "non_holo" : "traditional_holo",
      language: index % 4 ? "en" : "ja",
      deviceTier: index % 2 ? "standard" : "limited",
    },
    champion: { grade: index % 2 ? 7 : 8, falsePositiveDefects: 1 },
    candidate: { grade: 8, falsePositiveDefects: 0 },
  }));
  const datasetManifest = shadowManifest(cases);
  const result = evaluateV3ShadowRun(cases, { datasetManifest });
  assert.equal(result.status, "promotion_eligible");
  assert.equal(result.candidate.meanAbsoluteError, 0);
  assert.equal(result.gates.falseDefects, true);
  assert.equal(result.gates.cohortCoverage, true);
  assert.equal(result.gates.cohortFloor, true);
  assert.equal(result.cohorts["language:ja"].cases, 25);

  assert.throws(
    () =>
      evaluateV3ShadowRun([cases[0], { ...cases[0], partition: "validation" }]),
    /physical_card_partition_leakage/,
  );
  assert.throws(
    () => evaluateV3ShadowRun([cases[0], { ...cases[0] }]),
    /physical_card_has_multiple_shadow_cases/,
  );
});

function shadowCases() {
  return Array.from({ length: 100 }, (_, i) => ({
    physicalCardId: `card-${i}`,
    partition: "test",
    expectedGrade: 8,
    cohort: { finish: "holo", language: "en", deviceTier: "standard" },
    champion: { grade: 8, falsePositiveDefects: 0 },
    candidate: { grade: 8, falsePositiveDefects: 0 },
  }));
}

test("shadow promotion rejects training data and missing comparison evidence", () => {
  for (const [gate, change] of [
    ["heldOutOnly", (row) => ({ ...row, partition: "train" })],
    ["heldOutOnly", (row) => ({ ...row, partition: undefined })],
    ["completeComparisons", (row) => ({ ...row, champion: undefined })],
    ["completeComparisons", (row) => ({ ...row, candidate: { grade: 8 } })],
    ["completeLabels", (row) => ({ ...row, expectedGrade: null })],
    [
      "completeComparisons",
      (row) => ({ ...row, candidate: { grade: 8, falsePositiveDefects: -1 } }),
    ],
    ["completeCohorts", (row) => ({ ...row, cohort: {} })],
  ]) {
    const rows = shadowCases();
    const datasetManifest = shadowManifest(rows);
    const result = evaluateV3ShadowRun(rows.map(change), { datasetManifest });
    assert.equal(result.status, "shadow_only");
    assert.equal(result.gates[gate], false, gate);
  }
  assert.throws(() => evaluateV3ShadowRun([null]), /invalid_shadow_cases/);
  assert.throws(() => evaluateV3ShadowRun({}), /invalid_shadow_cases/);
});

test("small and regressing cohorts cannot disappear behind aggregate improvement", () => {
  const rare = shadowCases();
  rare[0].cohort.language = "ja";
  const small = evaluateV3ShadowRun(rare, {
    datasetManifest: shadowManifest(rare),
  });
  assert.equal(small.gates.datasetProvenance, true);
  assert.equal(small.gates.cohortFloor, false);
  assert.equal(small.cohorts["language:ja"].cases, 1);
  assert.equal(small.status, "shadow_only");
  const rows = shadowCases().map((row, i) => ({
    ...row,
    cohort: { ...row.cohort, language: i < 10 ? "ja" : "en" },
    champion: { grade: i < 10 ? 8 : 7, falsePositiveDefects: 0 },
    candidate: { grade: i < 10 ? 7.5 : 8, falsePositiveDefects: 0 },
  }));
  const result = evaluateV3ShadowRun(rows, {
    datasetManifest: shadowManifest(rows),
  });
  assert.equal(result.gates.datasetProvenance, true);
  assert.ok(
    result.candidate.meanAbsoluteError < result.champion.meanAbsoluteError,
  );
  assert.equal(result.gates.cohortFloor, false);
  assert.equal(result.status, "shadow_only");
});

function shadowManifest(rows) {
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const examples = rows.map((row, index) => {
    row.sourceHash = digest(`source-${index}`);
    const entry = example(index, row.partition);
    return {
      ...entry,
      physicalCardId: row.physicalCardId,
      sourceHash: row.sourceHash,
      cohort: { ...entry.cohort, ...row.cohort },
      professionalOutcome: {
        ...entry.professionalOutcome,
        returnedGrade: row.expectedGrade,
      },
      captures: entry.captures.map((capture) => ({
        ...capture,
        imageHash: digest(`${index}-${capture.type}`),
      })),
    };
  });
  return {
    version: "synthetic-provenance-fixture",
    manifestSha256: digest("synthetic-fixture"),
    exampleCount: examples.length,
    examples,
  };
}

test("shadow reports expose exact agreement uncertainty and missing PSA-10 coverage", () => {
  const rows = shadowCases();
  const report = evaluateV3ShadowRun(rows, { datasetManifest: shadowManifest(rows) });
  assert.equal(report.candidate.scoredCases, 100);
  assert.equal(report.candidate.exactAgreement, 1);
  assert.ok(report.candidate.exactWilson95.low > 0.96);
  assert.ok(report.candidate.exactWilson95.low < 1);
  assert.equal(report.candidate.predictedPsa10Cases, 0);
  assert.equal(report.candidate.falsePsa10Rate, null);
  assert.deepEqual(report.candidate.falsePsa10Wilson95, { low: null, high: null });
});

test("lower average error cannot hide increased false PSA-10 recommendations", () => {
  const rows = shadowCases().map((row, index) => ({
    ...row, expectedGrade: index < 10 ? 9 : 8,
    champion: { grade: index < 10 ? 9 : 7, falsePositiveDefects: 0 },
    candidate: { grade: index < 10 ? 10 : 8, falsePositiveDefects: 0 },
  }));
  const report = evaluateV3ShadowRun(rows, { datasetManifest: shadowManifest(rows) });
  assert.equal(report.gates.datasetProvenance, true);
  assert.ok(report.candidate.meanAbsoluteError < report.champion.meanAbsoluteError);
  assert.equal(report.candidate.falsePsa10Cases, 10);
  assert.equal(report.candidate.falsePsa10Rate, 1);
  assert.equal(report.gates.falsePsa10NonRegression, false);
  assert.equal(report.gates.cohortFloor, false);
  assert.equal(report.status, "shadow_only");
});

test("shadow results require full matching dataset lineage, not just asserted test labels", () => {
  const rows = shadowCases();
  const datasetManifest = shadowManifest(rows);
  assert.equal(evaluateV3ShadowRun(rows).gates.datasetProvenance, false);
  assert.equal(
    evaluateV3ShadowRun(rows, { datasetManifest }).status,
    "promotion_eligible",
  );
  for (const mutate of [
    (data) => {
      data[0].sourceHash = "0".repeat(64);
    },
    (data) => {
      data[0].expectedGrade = 9;
    },
    (data) => {
      data[0].partition = "external_holdout";
    },
    (data) => {
      data[0].cohort.language = "ja";
    },
    (data) => {
      data.pop();
    },
  ]) {
    const changed = structuredClone(rows);
    mutate(changed);
    assert.equal(
      evaluateV3ShadowRun(changed, { datasetManifest }).gates.datasetProvenance,
      false,
    );
  }
});

test("renaming a physical card cannot hide evidence reused across training and testing", () => {
  const rows = shadowCases();
  const datasetManifest = shadowManifest(rows);
  const training = structuredClone(datasetManifest.examples[0]);
  training.physicalCardId = "renamed-training-card";
  training.partition = "train";
  datasetManifest.examples.push(training);
  datasetManifest.exampleCount++;
  assert.equal(
    evaluateV3ShadowRun(rows, { datasetManifest }).gates.datasetProvenance,
    false,
  );
});

test("reused capture evidence cannot inflate held-out sample size under different card IDs", () => {
  const rows = shadowCases();
  const datasetManifest = shadowManifest(rows);
  datasetManifest.examples[1].captures[0].imageHash =
    datasetManifest.examples[0].captures[0].imageHash;
  assert.equal(
    evaluateV3ShadowRun(rows, { datasetManifest }).status,
    "shadow_only",
  );
});

test("shadow CLI requires a matching pinned dataset file for promotion eligibility", () => {
  const directory = mkdtempSync(join(tmpdir(), "mica-shadow-lineage-"));
  try {
    const rows = shadowCases();
    const bytes = JSON.stringify(shadowManifest(rows));
    const source = join(directory, "cases.json");
    const dataset = join(directory, "dataset.json");
    writeFileSync(source, JSON.stringify(rows));
    writeFileSync(dataset, bytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    for (const [name, flags, exitCode, status] of [
      ["unbound", [], 2, "shadow_only"],
      [
        "bound",
        ["--dataset", dataset, "--dataset-sha256", digest],
        0,
        "promotion_eligible",
      ],
      [
        "mismatch",
        ["--dataset", dataset, "--dataset-sha256", "0".repeat(64)],
        1,
        null,
      ],
    ]) {
      const output = join(directory, `${name}.json`);
      const result = spawnSync(
        process.execPath,
        [
          "scripts/evaluate-grading-shadow-v3.mjs",
          source,
          ...flags,
          "--output",
          output,
        ],
        { encoding: "utf8" },
      );
      assert.equal(result.status, exitCode, result.stderr);
      if (status) {
        const report = JSON.parse(readFileSync(output, "utf8"));
        assert.equal(report.status, status);
        assert.equal(
          report.verifiedDatasetFileSha256,
          name === "bound" ? digest : null,
        );
      } else {
        assert.equal(existsSync(output), false);
        assert.match(result.stderr, /does not match its pinned digest/);
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
