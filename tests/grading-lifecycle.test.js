import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionGradingLifecycle,
  deriveGradingLifecycle,
  evaluateGradingConfidence,
  gradingCalibrationCohorts,
  gradingExpectedValueScenario,
  gradingLifecycleLabel,
  normalizeGradingCorrection,
} from "../lib/grading-lifecycle.js";

const approvedPrediction = {
  status: "estimate",
  validated: true,
  confidence: 0.88,
  evidenceProfile: { complete: true },
  stability: { stable: true },
  probabilities: [
    { grade: 8, probability: 0.25 },
    { grade: 9, probability: 0.5 },
    { grade: 10, probability: 0.25 },
  ],
};

test("grading lifecycle validates forward paths and deliberate reconsideration", () => {
  assert.equal(canTransitionGradingLifecycle("candidate", "analyzed"), true);
  assert.equal(canTransitionGradingLifecycle("analyzed", "submitted"), false);
  assert.equal(canTransitionGradingLifecycle("selected", "submitted"), true);
  assert.equal(canTransitionGradingLifecycle("returned", "listed"), true);
  assert.equal(canTransitionGradingLifecycle("sold", "held"), false);
  assert.equal(canTransitionGradingLifecycle("rejected", "analyzed"), true);
});

test("derived lifecycle follows the same owned item from scan through sale", () => {
  assert.equal(deriveGradingLifecycle({ item: {} }), "candidate");
  assert.equal(
    deriveGradingLifecycle({
      item: {},
      reports: [{ workflow_status: "capturing", updated_at: "2026-09-01" }],
    }),
    "capture_incomplete",
  );
  assert.equal(
    deriveGradingLifecycle({
      item: {
        activeGradingSubmission: { status: "assembly" },
      },
    }),
    "grading",
  );
  assert.equal(
    deriveGradingLifecycle({
      item: { cardState: "graded", status: "listed" },
    }),
    "listed",
  );
  assert.equal(
    deriveGradingLifecycle({
      item: {
        quantity: 0,
        transactions: [{ type: "sale", date: "2026-09-02" }],
      },
    }),
    "sold",
  );
});

test("a newer explicit decision overrides an older report without deleting it", () => {
  assert.equal(
    deriveGradingLifecycle({
      item: {},
      reports: [{ workflow_status: "completed", updated_at: "2026-09-01" }],
      lifecycleEvents: [
        { state: "rejected", occurredAt: "2026-09-02T12:00:00Z" },
      ],
    }),
    "rejected",
  );
});

test("confidence standard fails closed until every evidence gate passes", () => {
  const result = evaluateGradingConfidence({
    validated: true,
    confidence: 0.9,
    evidenceProfile: { complete: true },
    stability: { stable: false },
  });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(" "), /repeatability/i);
  assert.equal(evaluateGradingConfidence(approvedPrediction).approved, true);
});

test("expected value uses the full calibrated distribution and every cost", () => {
  const result = gradingExpectedValueScenario({
    prediction: approvedPrediction,
    rawValue: 100,
    gradedComparables: [
      { grade: 8, amount: 110 },
      { grade: 9, amount: 180 },
      { grade: 10, amount: 400 },
    ],
    gradingFee: 25,
    shipping: 8,
    insurance: 2,
    marketplaceFeePercent: 10,
    otherSellingCosts: 5,
    turnaroundDays: 45,
  });
  assert.equal(result.status, "supported");
  assert.equal(result.expectedGross, 217.5);
  assert.equal(result.expectedSellingFees, 26.75);
  assert.equal(result.submissionCosts, 35);
  assert.equal(result.expectedNet, 155.75);
  assert.equal(result.expectedLift, 55.75);
  assert.equal(result.recommendation, "consider");
  assert.equal(result.assumptions.timeValueIncluded, false);
});

test("expected value withholds instead of substituting a missing grade comparable", () => {
  const result = gradingExpectedValueScenario({
    prediction: approvedPrediction,
    rawValue: 100,
    gradedComparables: [
      { grade: 8, amount: 110 },
      { grade: 9, amount: 180 },
    ],
    gradingFee: 25,
  });
  assert.equal(result.status, "unsupported");
  assert.equal(result.recommendation, "withheld");
  assert.deepEqual(result.assumptions.missingGrades, [10]);
});

test("expected value withholds when calibration or capture confidence is absent", () => {
  const result = gradingExpectedValueScenario({
    prediction: { ...approvedPrediction, validated: false },
    rawValue: 100,
    gradedComparables: { 8: 110, 9: 180, 10: 400 },
    gradingFee: 25,
  });
  assert.equal(result.status, "unsupported");
  assert.ok(result.missingInputs.includes("approved_confidence"));
});

test("calibration cohorts split outcomes by grader and capture quality", () => {
  const cohorts = gradingCalibrationCohorts([
    { grader: "PSA", captureQuality: 0.9, predictedGrade: 9, returnedGrade: 8 },
    { grader: "PSA", captureQuality: 0.9, predictedGrade: 9, returnedGrade: 9 },
    { grader: "PSA", captureQuality: 0.7, predictedGrade: 8, returnedGrade: 6 },
    {
      grader: "CGC",
      captureQuality: null,
      predictedGrade: 9,
      returnedGrade: 8.5,
    },
    {
      grader: "PSA",
      captureQuality: 0.9,
      predictedGrade: 9,
      returnedGrade: null,
    },
  ]);
  assert.deepEqual(
    cohorts.map((cohort) => [
      cohort.grader,
      cohort.captureQuality,
      cohort.outcomeCount,
    ]),
    [
      ["CGC", "unknown", 1],
      ["PSA", "high", 2],
      ["PSA", "medium", 1],
    ],
  );
  assert.equal(cohorts[1].meanAbsoluteError, 0.5);
  assert.equal(cohorts[1].withinOneRate, 1);
});

test("user corrections are bounded structured overlays", () => {
  assert.deepEqual(
    normalizeGradingCorrection({
      correctionType: "defect",
      originalValue: { severity: "major" },
      correctedValue: { severity: "minor" },
      reason: "Verified under angled light.",
    }),
    {
      correctionType: "defect",
      originalValue: { severity: "major" },
      correctedValue: { severity: "minor" },
      reason: "Verified under angled light.",
    },
  );
  assert.equal(
    normalizeGradingCorrection({
      correctionType: "official_grade",
      originalValue: {},
      correctedValue: {},
      reason: "No",
    }),
    null,
  );
});

test("every lifecycle state has clear user-facing copy", () => {
  for (const state of [
    "candidate",
    "capture_incomplete",
    "analyzed",
    "selected",
    "submitted",
    "received",
    "grading",
    "shipped",
    "returned",
    "held",
    "listed",
    "traded",
    "sold",
    "rejected",
  ])
    assert.doesNotMatch(gradingLifecycleLabel(state), /unavailable/i);
});
