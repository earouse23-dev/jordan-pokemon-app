import { PSA_NUMERIC_LABELS } from "./grading.js";

export const PSA_CALIBRATION_FEATURES = Object.freeze([
  "condition_midpoint",
  "condition_width",
  "condition_confidence",
  "quality_confidence",
  "mica_score",
  "centering",
  "corners",
  "edges",
  "surface",
  "structural_integrity",
  "weakest_subscore",
  "minor_defects",
  "moderate_defects",
  "major_defects",
  "critical_defects",
  "review_disagreement",
  "reflective_finish",
  "japanese_language",
]);
export const PSA_CALIBRATION_FEATURE_VERSION = "mica-psa-features-v2";

const REFLECTIVE_FINISH = /holo|foil|rainbow|radiant|etched|texture/i;
const STRUCTURAL_CATEGORIES = new Set([
  "crease",
  "dent",
  "indentation",
  "bend",
  "warping",
  "peeling",
  "delamination",
  "structural_integrity",
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function midpoint(low, high, fallback = 0) {
  const left = Number(low);
  const right = Number(high);
  return Number.isFinite(left) && Number.isFinite(right)
    ? (left + right) / 2
    : fallback;
}

function canonicalLanguage(value) {
  const language = String(value || "")
    .trim()
    .toLowerCase();
  return language === "ja" || language === "japanese" ? "ja" : language;
}

export function psaCalibrationFeatureVector(analysis = {}) {
  const condition = analysis.condition || {};
  const conditionMidpoint = midpoint(
    condition.estimatedGradeLow,
    condition.estimatedGradeHigh,
    finite(analysis.micaConditionScore?.score, 5.5),
  );
  const subscores = new Map(
    (Array.isArray(condition.subscores) ? condition.subscores : []).map(
      (entry) => [
        entry.category,
        midpoint(entry.scoreLow, entry.scoreHigh, conditionMidpoint),
      ],
    ),
  );
  const defectCounts = {
    minor: 0,
    moderate: 0,
    major: 0,
    critical: 0,
  };
  for (const defect of Array.isArray(condition.defects)
    ? condition.defects
    : []) {
    if (defectCounts[defect?.severity] != null)
      defectCounts[defect.severity] += 1;
  }
  const subscoreValues = [
    "centering",
    "corners",
    "edges",
    "surface",
    "structural_integrity",
  ].map((category) => finite(subscores.get(category), conditionMidpoint));
  const width = Math.max(
    0,
    finite(condition.estimatedGradeHigh, conditionMidpoint) -
      finite(condition.estimatedGradeLow, conditionMidpoint),
  );
  const finish = [analysis.identity?.finish, analysis.identity?.variant]
    .filter(Boolean)
    .join(" ");
  return [
    conditionMidpoint / 10,
    width / 10,
    finite(condition.confidence),
    finite(analysis.quality?.confidence),
    finite(analysis.micaConditionScore?.score, conditionMidpoint) / 10,
    ...subscoreValues.map((value) => value / 10),
    Math.min(...subscoreValues) / 10,
    Math.min(1, defectCounts.minor / 8),
    Math.min(1, defectCounts.moderate / 5),
    Math.min(1, defectCounts.major / 3),
    Math.min(1, defectCounts.critical),
    Math.min(
      1,
      finite(
        analysis.consensus?.overallGradeDisagreement ??
          analysis.consensus?.gradeDisagreement,
      ) / 5,
    ),
    REFLECTIVE_FINISH.test(finish) ? 1 : 0,
    canonicalLanguage(analysis.identity?.language) === "ja" ? 1 : 0,
  ];
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column]))
        pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10)
      throw new Error("calibration_matrix_is_singular");
    [augmented[column], augmented[pivot]] = [
      augmented[pivot],
      augmented[column],
    ];
    const divisor = augmented[column][column];
    for (let index = column; index <= size; index += 1)
      augmented[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index <= size; index += 1)
        augmented[row][index] -= factor * augmented[column][index];
    }
  }
  return augmented.map((row) => row[size]);
}

function standardizer(vectors) {
  const width = vectors[0].length;
  const means = Array.from(
    { length: width },
    (_, index) =>
      vectors.reduce((sum, vector) => sum + vector[index], 0) / vectors.length,
  );
  const scales = means.map((mean, index) => {
    const variance =
      vectors.reduce((sum, vector) => sum + (vector[index] - mean) ** 2, 0) /
      vectors.length;
    return Math.sqrt(variance) || 1;
  });
  return { means, scales };
}

function standardized(vector, artifact) {
  return vector.map(
    (value, index) =>
      (value - artifact.featureMeans[index]) / artifact.featureScales[index],
  );
}

function structuralCap(analysis = {}) {
  const defects = Array.isArray(analysis.condition?.defects)
    ? analysis.condition.defects
    : [];
  if (
    defects.some(
      (defect) =>
        defect.severity === "critical" &&
        STRUCTURAL_CATEGORIES.has(defect.category),
    )
  )
    return 3;
  if (
    defects.some(
      (defect) =>
        defect.severity === "major" &&
        STRUCTURAL_CATEGORIES.has(defect.category),
    )
  )
    return 6;
  return 10;
}

function probabilityRows(mean, sigma, temperature, maximumGrade = 10) {
  const width = Math.max(0.2, finite(sigma, 1) * finite(temperature, 1));
  const rows = PSA_NUMERIC_LABELS.filter((grade) => grade <= maximumGrade).map(
    (grade) => ({
      grade,
      probability: Math.exp(-0.5 * ((grade - mean) / width) ** 2),
    }),
  );
  const total = rows.reduce((sum, row) => sum + row.probability, 0) || 1;
  return rows.map((row) => ({
    grade: row.grade,
    probability: row.probability / total,
  }));
}

function cohortSupported(artifact, cohort = {}) {
  const eligibility = artifact?.cohortEligibility;
  if (!eligibility || typeof eligibility !== "object") return false;
  if (eligibility.all === true) return true;
  const checks = [
    ["finishClass", cohort.finishClass],
    ["language", cohort.language],
    ["manufacturingEra", cohort.manufacturingEra],
  ];
  return checks.every(([key, value]) => {
    const allowed = eligibility[key];
    return (
      !Array.isArray(allowed) ||
      !allowed.length ||
      allowed.includes(value || "unknown")
    );
  });
}

export function predictPsaCalibration(analysis, artifact, cohort = {}) {
  if (
    artifact?.validated !== true ||
    ![PSA_CALIBRATION_FEATURE_VERSION, "mica-psa-features-v1"].includes(
      artifact?.featureVersion,
    ) ||
    !Array.isArray(artifact.coefficients) ||
    artifact.coefficients.length !== PSA_CALIBRATION_FEATURES.length + 1 ||
    !Array.isArray(artifact.featureMeans) ||
    !Array.isArray(artifact.featureScales) ||
    !cohortSupported(artifact, cohort)
  )
    return null;
  const vector = standardized(psaCalibrationFeatureVector(analysis), artifact);
  const mean = clamp(
    artifact.coefficients[0] + dot(artifact.coefficients.slice(1), vector),
    1,
    structuralCap(analysis),
  );
  const probabilities = probabilityRows(
    mean,
    artifact.residualSigma,
    artifact.temperature,
    structuralCap(analysis),
  );
  return {
    version: artifact.version,
    validated: true,
    probabilities,
    confidence: Math.max(...probabilities.map((row) => row.probability)),
    mean,
    expectedGrade: probabilities.reduce(
      (sum, row) => sum + row.grade * row.probability,
      0,
    ),
    outcomeRisks:
      artifact.outcomeRiskModel?.validated === true
        ? predictOutcomeRisks(analysis, artifact.outcomeRiskModel)
        : { validated: false },
  };
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function predictOutcomeRisks(analysis, model = {}) {
  const vector = psaCalibrationFeatureVector(analysis);
  const probabilityFor = (name) => {
    const coefficients = model?.[name];
    if (
      !Array.isArray(coefficients) ||
      coefficients.length !== vector.length + 1
    )
      return null;
    return clamp(
      sigmoid(coefficients[0] + dot(coefficients.slice(1), vector)),
      0,
      1,
    );
  };
  const qualifierProbability = probabilityFor("qualifier");
  const noGradeProbability = probabilityFor("noGrade");
  const alterationProbability = probabilityFor("alteration");
  if (
    [qualifierProbability, noGradeProbability, alterationProbability].some(
      (value) => value == null,
    )
  )
    return { validated: false };
  return {
    validated: true,
    gradeableProbability: clamp(
      1 - qualifierProbability - noGradeProbability - alterationProbability,
      0,
      1,
    ),
    qualifierProbability,
    noGradeProbability,
    alterationProbability,
  };
}

function negativeLogLikelihood(entries, artifact, temperature) {
  return (
    entries.reduce((sum, entry) => {
      const mean = clamp(
        artifact.coefficients[0] +
          dot(
            artifact.coefficients.slice(1),
            standardized(psaCalibrationFeatureVector(entry.analysis), artifact),
          ),
        1,
        10,
      );
      const rows = probabilityRows(mean, artifact.residualSigma, temperature);
      const probability =
        rows.find((row) => row.grade === Number(entry.returnedGrade))
          ?.probability || 1e-9;
      return sum - Math.log(Math.max(1e-9, probability));
    }, 0) / entries.length
  );
}

function evaluate(entries, artifact) {
  const rows = entries.map((entry) => {
    const prediction = predictPsaCalibration(entry.analysis, artifact, {
      ...(entry.cohort || {}),
    });
    const mostLikely = prediction?.probabilities.reduce((best, row) =>
      row.probability > best.probability ? row : best,
    );
    return {
      expected: Number(entry.returnedGrade),
      predicted: mostLikely?.grade ?? null,
      confidence: mostLikely?.probability ?? 0,
    };
  });
  const scored = rows.filter((row) => row.predicted != null);
  const exact = scored.filter((row) => row.predicted === row.expected).length;
  const withinOne = scored.filter(
    (row) => Math.abs(row.predicted - row.expected) <= 1,
  ).length;
  const mae = scored.length
    ? scored.reduce(
        (sum, row) => sum + Math.abs(row.predicted - row.expected),
        0,
      ) / scored.length
    : null;
  const ece = scored.length
    ? scored.reduce(
        (sum, row) =>
          sum +
          Math.abs(row.confidence - (row.predicted === row.expected ? 1 : 0)),
        0,
      ) / scored.length
    : null;
  return {
    cases: scored.length,
    exactAgreement: scored.length ? exact / scored.length : null,
    withinOneAgreement: scored.length ? withinOne / scored.length : null,
    meanAbsoluteError: mae,
    expectedCalibrationError: ece,
  };
}

export function trainPsaCalibration(entries = [], options = {}) {
  const rows = (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    returnedGrade: Number(entry.returnedGrade),
  }));
  for (const entry of rows) {
    if (
      !entry.physicalCardId ||
      !["train", "calibration", "test", "external_holdout"].includes(
        entry.partition,
      ) ||
      !PSA_NUMERIC_LABELS.includes(entry.returnedGrade) ||
      String(entry.professionalGrader || "").toUpperCase() !== "PSA" ||
      entry.verificationStatus !== "independently_verified" ||
      entry.proofVerified !== true ||
      !entry.analysis?.condition
    )
      throw new Error("invalid_psa_calibration_entry");
  }
  const partitionsByCard = new Map();
  for (const entry of rows) {
    const partitions = partitionsByCard.get(entry.physicalCardId) || new Set();
    partitions.add(entry.partition);
    partitionsByCard.set(entry.physicalCardId, partitions);
  }
  if ([...partitionsByCard.values()].some((partitions) => partitions.size > 1))
    throw new Error("physical_card_partition_leakage");
  const train = rows.filter((entry) => entry.partition === "train");
  const calibration = rows.filter((entry) => entry.partition === "calibration");
  const test = rows.filter((entry) =>
    ["test", "external_holdout"].includes(entry.partition),
  );
  const minimumTrain = Math.max(20, Number(options.minimumTrain) || 20);
  const minimumCalibration = Math.max(
    10,
    Number(options.minimumCalibration) || 10,
  );
  const minimumTest = Math.max(10, Number(options.minimumTest) || 10);
  if (
    train.length < minimumTrain ||
    calibration.length < minimumCalibration ||
    test.length < minimumTest
  )
    throw new Error("insufficient_partitioned_psa_outcomes");
  const vectors = train.map((entry) =>
    psaCalibrationFeatureVector(entry.analysis),
  );
  const { means, scales } = standardizer(vectors);
  const design = vectors.map((vector) => [
    1,
    ...vector.map((value, index) => (value - means[index]) / scales[index]),
  ]);
  const dimension = design[0].length;
  const lambda = Math.max(0.01, finite(options.lambda, 0.25));
  const matrix = Array.from({ length: dimension }, (_, row) =>
    Array.from({ length: dimension }, (_, column) =>
      design.reduce(
        (sum, vector) => sum + vector[row] * vector[column],
        row === column && row > 0 ? lambda : 0,
      ),
    ),
  );
  const vector = Array.from({ length: dimension }, (_, index) =>
    design.reduce(
      (sum, features, row) => sum + features[index] * train[row].returnedGrade,
      0,
    ),
  );
  const coefficients = solveLinearSystem(matrix, vector);
  const baseArtifact = {
    version: String(options.version || `mica-psa-ordinal-${Date.now()}`),
    featureVersion: PSA_CALIBRATION_FEATURE_VERSION,
    featureNames: [...PSA_CALIBRATION_FEATURES],
    featureMeans: means,
    featureScales: scales,
    coefficients,
    residualSigma: 1,
    temperature: 1,
    cohortEligibility: options.cohortEligibility || { all: true },
    validated: true,
  };
  const residuals = calibration.map((entry) => {
    const prediction =
      coefficients[0] +
      dot(
        coefficients.slice(1),
        standardized(psaCalibrationFeatureVector(entry.analysis), baseArtifact),
      );
    return entry.returnedGrade - prediction;
  });
  baseArtifact.residualSigma = Math.max(
    0.35,
    Math.sqrt(
      residuals.reduce((sum, residual) => sum + residual ** 2, 0) /
        residuals.length,
    ),
  );
  baseArtifact.temperature = Array.from(
    { length: 17 },
    (_, index) => 0.5 + index * 0.125,
  ).reduce((best, candidate) =>
    negativeLogLikelihood(calibration, baseArtifact, candidate) <
    negativeLogLikelihood(calibration, baseArtifact, best)
      ? candidate
      : best,
  );
  const metrics = evaluate(test, baseArtifact);
  const activationMinimums = {
    train: Math.max(100, Number(options.activationMinimumTrain) || 100),
    calibration: Math.max(
      50,
      Number(options.activationMinimumCalibration) || 50,
    ),
    test: Math.max(50, Number(options.activationMinimumTest) || 50),
  };
  const activationGates = {
    withinOneAgreement: finite(options.minimumWithinOneAgreement, 0.9),
    meanAbsoluteError: finite(options.maximumMeanAbsoluteError, 0.75),
    expectedCalibrationError: finite(
      options.maximumExpectedCalibrationError,
      0.15,
    ),
  };
  baseArtifact.validated =
    train.length >= activationMinimums.train &&
    calibration.length >= activationMinimums.calibration &&
    test.length >= activationMinimums.test &&
    metrics.withinOneAgreement >= activationGates.withinOneAgreement &&
    metrics.meanAbsoluteError <= activationGates.meanAbsoluteError &&
    metrics.expectedCalibrationError <=
      activationGates.expectedCalibrationError;
  return {
    artifact: baseArtifact,
    metrics,
    partitions: {
      train: train.length,
      calibration: calibration.length,
      test: test.length,
    },
    activationMinimums,
    activationGates,
  };
}
