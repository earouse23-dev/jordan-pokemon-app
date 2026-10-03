const MONEY_LIMIT = 999_999_999_999.99;

export const GRADING_LIFECYCLE_STATES = Object.freeze([
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
]);

export const GRADING_CONFIDENCE_STANDARD = Object.freeze({
  version: "mica-grading-confidence-v1",
  minimumConfidence: 0.7,
  requiresValidatedCalibration: true,
  requiresCompleteEvidence: true,
  requiresStableResult: true,
});

const STATE_LABELS = Object.freeze({
  candidate: "Grading candidate",
  capture_incomplete: "Capture incomplete",
  analyzed: "Evidence analyzed",
  selected: "Selected to submit",
  submitted: "Submitted",
  received: "Received by grader",
  grading: "Professional grading",
  shipped: "Return shipped",
  returned: "Returned",
  held: "Held in collection",
  listed: "Listed for sale",
  traded: "Traded",
  sold: "Sold",
  rejected: "Kept ungraded",
});

const TRANSITIONS = Object.freeze({
  candidate: ["capture_incomplete", "analyzed", "rejected"],
  capture_incomplete: ["analyzed", "rejected"],
  analyzed: ["capture_incomplete", "selected", "rejected"],
  selected: ["analyzed", "submitted", "rejected"],
  submitted: ["received", "grading", "shipped", "returned", "rejected"],
  received: ["grading", "shipped", "returned", "rejected"],
  grading: ["shipped", "returned", "rejected"],
  shipped: ["returned", "rejected"],
  returned: ["held", "listed", "traded", "sold"],
  held: ["listed", "traded", "sold"],
  listed: ["held", "traded", "sold"],
  traded: [],
  sold: [],
  rejected: ["candidate", "capture_incomplete", "analyzed", "selected"],
});

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function boundedMoney(value) {
  const amount = finiteNumber(value);
  return amount !== null && amount >= 0 && amount <= MONEY_LIMIT
    ? amount
    : null;
}

function rounded(value, places = 2) {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function latestByDate(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) =>
    String(
      right?.occurredAt ||
        right?.occurred_at ||
        right?.date ||
        right?.statusUpdatedAt ||
        right?.updated_at ||
        right?.created_at ||
        "",
    ).localeCompare(
      String(
        left?.occurredAt ||
          left?.occurred_at ||
          left?.date ||
          left?.statusUpdatedAt ||
          left?.updated_at ||
          left?.created_at ||
          "",
      ),
    ),
  )[0];
}

export function gradingLifecycleLabel(state) {
  return STATE_LABELS[state] || "Grading status unavailable";
}

export function canTransitionGradingLifecycle(fromState, toState) {
  if (!GRADING_LIFECYCLE_STATES.includes(fromState)) return false;
  if (!GRADING_LIFECYCLE_STATES.includes(toState)) return false;
  return fromState === toState || TRANSITIONS[fromState].includes(toState);
}

function finalTransactionState(item = {}) {
  const transaction = latestByDate(item.transactions);
  if (
    transaction?.type === "trade_out" ||
    transaction?.transactionType === "trade_out"
  )
    return "traded";
  if (
    (transaction?.type === "sale" || transaction?.transactionType === "sale") &&
    Number(item.quantity) <= 0
  )
    return "sold";
  return null;
}

export function deriveGradingLifecycle({
  item = {},
  reports = [],
  lifecycleEvents = [],
} = {}) {
  const finalState = finalTransactionState(item);
  if (finalState) return finalState;
  if (item.status === "listed") return "listed";

  const activeSubmission = item.activeGradingSubmission;
  if (activeSubmission) {
    const status = activeSubmission.status;
    if (["submitted", "received", "shipped"].includes(status)) return status;
    if (["grading", "assembly"].includes(status)) return "grading";
  }

  const latestSubmission = latestByDate(item.gradingSubmissions);
  if (latestSubmission?.status === "returned") {
    if (item.status === "listed") return "listed";
    return item.status === "archived" ? "sold" : "held";
  }

  if (item.cardState === "graded" || item.gradingCompany) return "held";

  const latestDecision = latestByDate(
    (lifecycleEvents || []).filter((event) =>
      ["selected", "rejected"].includes(event.state),
    ),
  );
  const latestReport = latestByDate(reports);
  const reportDate = String(
    latestReport?.completed_at || latestReport?.updated_at || "",
  );
  const decisionDate = String(
    latestDecision?.occurredAt || latestDecision?.occurred_at || "",
  );
  if (latestDecision && decisionDate >= reportDate) return latestDecision.state;

  if (latestReport) {
    if (["capturing", "failed"].includes(latestReport.workflow_status))
      return "capture_incomplete";
    if (["completed", "abstained"].includes(latestReport.workflow_status))
      return "analyzed";
  }
  if (item.digitalGrade) return "analyzed";
  return "candidate";
}

export function evaluateGradingConfidence(prediction = {}) {
  const confidence = finiteNumber(prediction.confidence) ?? 0;
  const calibrated =
    prediction.validated === true ||
    prediction.professional_prediction_status === "validated";
  const evidenceComplete =
    prediction.evidenceProfile?.complete === true ||
    prediction.evidence_profile?.complete === true;
  const stable =
    prediction.stability?.stable === true ||
    prediction.stability?.status === "stable";
  const reasons = [];
  if (!calibrated)
    reasons.push("Held-out grader calibration is not validated.");
  if (!evidenceComplete)
    reasons.push("Required condition evidence is incomplete.");
  if (!stable) reasons.push("The result did not pass the repeatability check.");
  if (confidence < GRADING_CONFIDENCE_STANDARD.minimumConfidence)
    reasons.push(
      `Evidence confidence is below ${Math.round(
        GRADING_CONFIDENCE_STANDARD.minimumConfidence * 100,
      )}%.`,
    );
  return {
    version: GRADING_CONFIDENCE_STANDARD.version,
    approved: reasons.length === 0,
    confidence: rounded(confidence, 3),
    reasons,
  };
}

function normalizedProbabilities(rows = []) {
  const combined = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const grade = finiteNumber(row?.grade);
    const probability = finiteNumber(row?.probability);
    if (
      grade === null ||
      grade < 1 ||
      grade > 10 ||
      probability === null ||
      probability < 0 ||
      probability > 1
    )
      continue;
    combined.set(grade, (combined.get(grade) || 0) + probability);
  }
  const total = [...combined.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  return [...combined.entries()]
    .map(([grade, probability]) => ({
      grade,
      probability: probability / total,
    }))
    .sort((left, right) => left.grade - right.grade);
}

function comparableMap(rows = []) {
  const result = new Map();
  const entries = Array.isArray(rows)
    ? rows
    : Object.entries(rows || {}).map(([grade, amount]) => ({ grade, amount }));
  for (const row of entries) {
    const grade = finiteNumber(row?.grade);
    const amount = boundedMoney(row?.amount ?? row?.value);
    if (grade !== null && amount !== null) result.set(grade, amount);
  }
  return result;
}

export function gradingExpectedValueScenario({
  prediction = {},
  rawValue,
  gradedComparables = [],
  gradingFee,
  shipping = 0,
  insurance = 0,
  marketplaceFeePercent = 0,
  otherSellingCosts = 0,
  turnaroundDays = null,
  currency = "USD",
} = {}) {
  const confidence = evaluateGradingConfidence(prediction);
  const probabilities = normalizedProbabilities(
    prediction.probabilities || prediction.grade_probabilities,
  );
  const comparables = comparableMap(gradedComparables);
  const inputs = {
    rawValue: boundedMoney(rawValue),
    gradingFee: boundedMoney(gradingFee),
    shipping: boundedMoney(shipping),
    insurance: boundedMoney(insurance),
    marketplaceFeePercent: finiteNumber(marketplaceFeePercent),
    otherSellingCosts: boundedMoney(otherSellingCosts),
    turnaroundDays:
      turnaroundDays === null || turnaroundDays === ""
        ? null
        : finiteNumber(turnaroundDays),
    currency: String(currency || "USD").toUpperCase(),
  };
  const missingInputs = [];
  if (!confidence.approved) missingInputs.push("approved_confidence");
  if (!probabilities.length) missingInputs.push("grade_probabilities");
  if (inputs.rawValue === null) missingInputs.push("raw_value");
  if (inputs.gradingFee === null) missingInputs.push("grading_fee");
  if (inputs.shipping === null) missingInputs.push("shipping");
  if (inputs.insurance === null) missingInputs.push("insurance");
  if (inputs.otherSellingCosts === null) missingInputs.push("selling_costs");
  if (
    inputs.marketplaceFeePercent === null ||
    inputs.marketplaceFeePercent < 0 ||
    inputs.marketplaceFeePercent > 100
  )
    missingInputs.push("marketplace_fee_percent");
  if (
    inputs.turnaroundDays !== null &&
    (inputs.turnaroundDays < 0 || inputs.turnaroundDays > 3650)
  )
    missingInputs.push("turnaround_days");
  const missingGrades = probabilities
    .filter((row) => !comparables.has(row.grade))
    .map((row) => row.grade);
  if (missingGrades.length) missingInputs.push("graded_comparables");
  const assumptions = {
    version: "mica-grading-ev-v1",
    probabilitySource: "held-out calibrated grade distribution",
    comparableRule: "exact grader and grade only",
    timeValueIncluded: false,
    taxIncluded: false,
    valuesAreEstimates: true,
    missingGrades,
  };
  if (missingInputs.length)
    return {
      status: "unsupported",
      recommendation: "withheld",
      confidence,
      inputs,
      assumptions,
      missingInputs: [...new Set(missingInputs)],
    };

  const expectedGross = probabilities.reduce(
    (sum, row) => sum + row.probability * comparables.get(row.grade),
    0,
  );
  const sellingFees =
    expectedGross * (inputs.marketplaceFeePercent / 100) +
    inputs.otherSellingCosts;
  const submissionCosts =
    inputs.gradingFee + inputs.shipping + inputs.insurance;
  const expectedNet = expectedGross - sellingFees - submissionCosts;
  const expectedLift = expectedNet - inputs.rawValue;
  return {
    status: "supported",
    recommendation: expectedLift > 0 ? "consider" : "keep_raw",
    confidence,
    inputs,
    assumptions,
    probabilities: probabilities.map((row) => ({
      ...row,
      comparable: comparables.get(row.grade),
    })),
    expectedGross: rounded(expectedGross),
    expectedSellingFees: rounded(sellingFees),
    submissionCosts: rounded(submissionCosts),
    expectedNet: rounded(expectedNet),
    expectedLift: rounded(expectedLift),
    missingInputs: [],
  };
}

function captureQualityBucket(value) {
  if (["high", "medium", "low", "unknown"].includes(value)) return value;
  const score = finiteNumber(value);
  if (score === null) return "unknown";
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

export function gradingCalibrationCohorts(records = []) {
  const groups = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const predicted = finiteNumber(
      record.predictedGrade ?? record.predicted_grade,
    );
    const returned = finiteNumber(
      record.returnedGrade ?? record.returned_grade,
    );
    if (predicted === null || returned === null) continue;
    const grader = String(record.grader || "OTHER")
      .trim()
      .toUpperCase();
    const captureQuality = captureQualityBucket(
      record.captureQuality ?? record.capture_quality,
    );
    const key = `${grader}:${captureQuality}`;
    const group = groups.get(key) || {
      grader,
      captureQuality,
      count: 0,
      absoluteError: 0,
      signedError: 0,
      exact: 0,
      withinOne: 0,
    };
    const error = predicted - returned;
    group.count += 1;
    group.absoluteError += Math.abs(error);
    group.signedError += error;
    if (Math.abs(error) < 0.001) group.exact += 1;
    if (Math.abs(error) <= 1) group.withinOne += 1;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      grader: group.grader,
      captureQuality: group.captureQuality,
      outcomeCount: group.count,
      meanAbsoluteError: rounded(group.absoluteError / group.count, 3),
      meanBias: rounded(group.signedError / group.count, 3),
      exactRate: rounded(group.exact / group.count, 4),
      withinOneRate: rounded(group.withinOne / group.count, 4),
    }))
    .sort(
      (left, right) =>
        left.grader.localeCompare(right.grader) ||
        left.captureQuality.localeCompare(right.captureQuality),
    );
}

export function normalizeGradingCorrection(input = {}) {
  const correctionType = String(input.correctionType || "");
  if (
    !["defect", "grade_range", "subscore", "economics"].includes(correctionType)
  )
    return null;
  const originalValue = input.originalValue;
  const correctedValue = input.correctedValue;
  if (
    !originalValue ||
    typeof originalValue !== "object" ||
    Array.isArray(originalValue) ||
    !correctedValue ||
    typeof correctedValue !== "object" ||
    Array.isArray(correctedValue)
  )
    return null;
  const reason = String(input.reason || "").trim();
  if (!reason || reason.length > 1000) return null;
  if (JSON.stringify(originalValue).length > 10_000) return null;
  if (JSON.stringify(correctedValue).length > 10_000) return null;
  return { correctionType, originalValue, correctedValue, reason };
}
