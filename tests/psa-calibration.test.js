import test from "node:test";
import assert from "node:assert/strict";
import {
  predictPsaCalibration,
  psaCalibrationFeatureVector,
  trainPsaCalibration,
} from "../lib/psa-calibration.js";
import { selectGatewayVisionModels } from "../lib/gateway-models.js";

function analysisFor(grade, options = {}) {
  const low = Math.max(1, grade - 0.5);
  const high = Math.min(10, grade + 0.5);
  return {
    quality: { usable: true, confidence: 0.9 },
    identity: {
      finish: options.finish || "non_holo",
      language: options.language || "en",
    },
    condition: {
      estimatedGradeLow: low,
      estimatedGradeHigh: high,
      confidence: 0.85,
      defects: options.defects || [],
      subscores: [
        "centering",
        "corners",
        "edges",
        "surface",
        "structural_integrity",
      ].map((category) => ({
        category,
        scoreLow: low,
        scoreHigh: high,
        confidence: 0.85,
      })),
    },
    micaConditionScore: { score: grade },
    consensus: { overallGradeDisagreement: 0.5 },
  };
}

function calibrationRows() {
  const partitions = [
    ...Array(30).fill("train"),
    ...Array(10).fill("calibration"),
    ...Array(10).fill("test"),
  ];
  return partitions.map((partition, index) => {
    const grade = 4 + (index % 7);
    return {
      physicalCardId: `card-${index}`,
      partition,
      returnedGrade: grade,
      professionalGrader: "PSA",
      verificationStatus: "independently_verified",
      proofVerified: true,
      analysis: analysisFor(grade),
      cohort: { finishClass: "non_holo", language: "en" },
    };
  });
}

test("PSA calibration trains only from isolated actual-outcome partitions", () => {
  const result = trainPsaCalibration(calibrationRows(), {
    version: "mica-psa-test-v1",
  });
  assert.deepEqual(result.partitions, { train: 30, calibration: 10, test: 10 });
  assert.equal(result.artifact.validated, false);
  assert.ok(result.metrics.withinOneAgreement >= 0.9);
  assert.equal(predictPsaCalibration(analysisFor(8), result.artifact), null);

  assert.throws(
    () =>
      trainPsaCalibration([
        ...calibrationRows(),
        {
          ...calibrationRows()[0],
          partition: "test",
        },
      ]),
    /physical_card_partition_leakage/,
  );
});

test("validated ordinal calibration returns PSA-label probabilities and hard caps structural damage", () => {
  const trained = trainPsaCalibration(calibrationRows(), {
    version: "mica-psa-test-v1",
  }).artifact;
  const artifact = { ...trained, validated: true };
  const prediction = predictPsaCalibration(analysisFor(9), artifact, {});
  assert.ok(prediction.probabilities.length > 2);
  assert.ok(
    Math.abs(
      prediction.probabilities.reduce((sum, row) => sum + row.probability, 0) -
        1,
    ) < 1e-9,
  );
  assert.ok(prediction.probabilities.every((row) => row.grade !== 9.5));
  assert.ok(prediction.expectedGrade >= 1 && prediction.expectedGrade <= 10);
  assert.equal(prediction.outcomeRisks.validated, false);

  const damaged = predictPsaCalibration(
    analysisFor(9, {
      defects: [
        {
          category: "crease",
          severity: "critical",
          side: "front",
        },
      ],
    }),
    artifact,
    {},
  );
  assert.ok(damaged.probabilities.every((row) => row.grade <= 3));
});

test("calibration feature contract is stable and reviewer routing stays provider-diverse", () => {
  assert.equal(psaCalibrationFeatureVector(analysisFor(8)).length, 18);
  const available = [
    { id: "openai/a", provider: "openai" },
    { id: "openai/b", provider: "openai" },
    { id: "zai/c", provider: "zai" },
    { id: "amazon/d", provider: "amazon" },
  ];
  assert.deepEqual(
    selectGatewayVisionModels(
      available,
      ["openai/a", "openai/b", "zai/c", "amazon/d"],
      { uniqueProviders: true, maximum: 3 },
    ),
    ["openai/a", "zai/c", "amazon/d"],
  );
});
