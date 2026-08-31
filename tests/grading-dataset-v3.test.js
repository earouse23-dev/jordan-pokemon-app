import test from "node:test";
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
  const result = evaluateV3ShadowRun(cases);
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
