const PARTITIONS = Object.freeze([
  "train",
  "validation",
  "calibration",
  "test",
  "external_holdout",
]);
const MODEL_ROLES = new Set([
  "geometry",
  "identity",
  "capture_quality",
  "centering",
  "corners",
  "edges",
  "surface",
  "structure",
  "eye_appeal",
  "psa_fusion",
]);
const REQUIRED_CAPTURES = Object.freeze([
  "front",
  "back",
  "alternate_front",
  "alternate_back",
]);
const REQUIRED_CONDITION_LABELS = Object.freeze([
  "centering",
  "corners",
  "edges",
  "surface",
  "structure",
  "eyeAppeal",
]);

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ""));
}

function finite(value, minimum = -Infinity, maximum = Infinity) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function canonicalCaptureType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function conditionLabels(labels = {}) {
  const condition = isObject(labels.condition) ? labels.condition : {};
  return Object.fromEntries(
    REQUIRED_CONDITION_LABELS.map((category) => [
      category,
      finite(condition[category], 1, 10),
    ]),
  );
}

function validateExample(example, index) {
  const reasons = [];
  const prefix = `example_${index + 1}`;
  if (!example?.physicalCardId) reasons.push(`${prefix}:physical_card_missing`);
  if (!sha256(example?.sourceHash))
    reasons.push(`${prefix}:source_hash_invalid`);
  if (!PARTITIONS.includes(example?.partition))
    reasons.push(`${prefix}:partition_invalid`);
  const captures = Array.isArray(example?.captures) ? example.captures : [];
  const types = new Set(
    captures.map((capture) => canonicalCaptureType(capture.type)),
  );
  for (const type of REQUIRED_CAPTURES)
    if (!types.has(type)) reasons.push(`${prefix}:capture_${type}_missing`);
  for (const capture of captures) {
    if (!sha256(capture?.imageHash))
      reasons.push(`${prefix}:capture_hash_invalid`);
    if (!capture?.storagePath)
      reasons.push(`${prefix}:capture_storage_missing`);
    if (
      !isObject(capture?.geometry) ||
      capture.geometry.normalizedCropApplied !== true ||
      capture.geometry.backgroundExcluded !== true
    )
      reasons.push(`${prefix}:capture_geometry_missing`);
  }
  const labels = example?.humanLabels;
  if (
    !isObject(labels) ||
    labels.protocolVersion !== "mica-psa-label-protocol-v1"
  )
    reasons.push(`${prefix}:human_labels_missing`);
  const subscores = conditionLabels(labels);
  for (const [category, value] of Object.entries(subscores))
    if (value == null) reasons.push(`${prefix}:${category}_label_invalid`);
  if (labels?.identityConfirmed !== true)
    reasons.push(`${prefix}:identity_not_human_confirmed`);
  for (const field of ["name", "set", "collectorNumber", "language", "finish"])
    if (!String(example?.cohort?.[field] || "").trim())
      reasons.push(`${prefix}:identity_${field}_missing`);
  const professional = example?.professionalOutcome;
  if (
    !isObject(professional) ||
    professional.grader !== "PSA" ||
    professional.verificationStatus !== "independently_verified"
  )
    reasons.push(`${prefix}:professional_outcome_unverified`);
  if (
    finite(professional?.returnedGrade, 1, 10) == null &&
    !String(professional?.noGradeCode || "").trim()
  )
    reasons.push(`${prefix}:professional_target_missing`);
  const pipeline = example?.pipelineEvidence;
  if (
    !isObject(pipeline) ||
    pipeline.evidenceProfile?.version !== "mica-evidence-profile-v3"
  )
    reasons.push(`${prefix}:v3_pipeline_evidence_missing`);
  if (pipeline?.gradingWorkflow?.complete !== true)
    reasons.push(`${prefix}:v3_workflow_incomplete`);
  if (
    pipeline?.referenceComparison?.status !== "compared" ||
    pipeline?.referenceComparison?.exactIdentityMatch !== true ||
    !String(pipeline?.referenceComparison?.catalogCardId || "").trim()
  )
    reasons.push(`${prefix}:reference_comparison_incomplete`);
  return {
    valid: reasons.length === 0,
    reasons,
    condition: subscores,
    captures,
  };
}

function partitionCounts(examples) {
  return Object.fromEntries(
    PARTITIONS.map((partition) => [
      partition,
      examples.filter((example) => example.partition === partition).length,
    ]),
  );
}

export function assessV3DatasetReadiness(
  manifest = {},
  {
    minimumExamples = 100,
    minimumPartitions = {
      train: 50,
      validation: 15,
      calibration: 15,
      test: 20,
      external_holdout: 0,
    },
  } = {},
) {
  const examples = Array.isArray(manifest?.examples) ? manifest.examples : [];
  const failures = [];
  if (!/^mica-grading-v3-/.test(String(manifest?.version || "")))
    failures.push("manifest_version_is_not_v3");
  if (!sha256(manifest?.manifestSha256)) failures.push("manifest_hash_invalid");
  if (Number(manifest?.exampleCount) !== examples.length)
    failures.push("manifest_example_count_mismatch");
  const validations = examples.map(validateExample);
  failures.push(...validations.flatMap((entry) => entry.reasons));

  const partitionsByCard = new Map();
  for (const example of examples) {
    const partitions =
      partitionsByCard.get(example.physicalCardId) || new Set();
    partitions.add(example.partition);
    partitionsByCard.set(example.physicalCardId, partitions);
  }
  const leakedCards = [...partitionsByCard.entries()]
    .filter(([, partitions]) => partitions.size > 1)
    .map(([physicalCardId]) => physicalCardId);
  if (leakedCards.length) failures.push("physical_card_partition_leakage");
  if (partitionsByCard.size !== examples.length)
    failures.push("physical_card_has_multiple_examples");
  if (examples.length < minimumExamples)
    failures.push(
      `minimum_examples_missing:${minimumExamples - examples.length}`,
    );

  const partitions = partitionCounts(examples);
  for (const [partition, minimum] of Object.entries(minimumPartitions)) {
    const gap = Math.max(
      0,
      Number(minimum) - Number(partitions[partition] || 0),
    );
    if (gap) failures.push(`partition_${partition}_missing:${gap}`);
  }
  const cleanExamples = examples.filter(
    (example) => (example.humanLabels?.defects || []).length === 0,
  ).length;
  const artifactExcludedExamples = examples.filter(
    (example) =>
      Number(
        example.pipelineEvidence?.referenceComparison
          ?.excludedArtifactFraction || 0,
      ) > 0,
  ).length;
  const reflectiveExamples = examples.filter((example) =>
    /holo|foil|rainbow|radiant|etched|texture/i.test(
      String(example.humanLabels?.finish || example.cohort?.finish || ""),
    ),
  ).length;
  if (cleanExamples < Math.min(20, Math.ceil(minimumExamples * 0.2)))
    failures.push("clean_hard_negative_coverage_low");
  if (artifactExcludedExamples < Math.min(20, Math.ceil(minimumExamples * 0.2)))
    failures.push("artifact_hard_negative_coverage_low");
  if (reflectiveExamples < Math.min(20, Math.ceil(minimumExamples * 0.2)))
    failures.push("reflective_finish_coverage_low");

  return {
    version: "mica-dataset-readiness-v3",
    status: failures.length ? "blocked" : "ready",
    examples: examples.length,
    physicalCards: partitionsByCard.size,
    validExamples: validations.filter((entry) => entry.valid).length,
    partitions,
    hardNegatives: {
      cleanExamples,
      artifactExcludedExamples,
      reflectiveExamples,
    },
    leakedCards,
    failures: [...new Set(failures)].slice(0, 200),
  };
}

function capturesForInput(example, { includeMeasurements = true } = {}) {
  return (example.captures || []).map((capture) => ({
    captureId: capture.captureId,
    type: capture.type,
    side: capture.side,
    storagePath: capture.storagePath,
    imageHash: capture.imageHash,
    ...(includeMeasurements
      ? { quality: capture.quality || {}, geometry: capture.geometry || {} }
      : {}),
  }));
}

function baseTrainingRow(example, options) {
  return {
    physicalCardId: example.physicalCardId,
    sourceHash: example.sourceHash,
    partition: example.partition,
    cohort: example.cohort || {},
    captures: capturesForInput(example, options),
    reference: {
      catalogCardId:
        example.pipelineEvidence?.referenceComparison?.catalogCardId || null,
      provider: example.pipelineEvidence?.referenceComparison?.provider || null,
    },
  };
}

function geometryCompositePlan(example, capture, index) {
  return {
    version: "mica-geometry-composite-v1",
    foreground: {
      storagePath: capture.storagePath,
      imageHash: capture.imageHash,
      side: capture.side,
      captureType: capture.type,
    },
    deterministicSeed: `${String(example.sourceHash || "").slice(0, 16)}-${String(
      capture.imageHash || "",
    ).slice(0, 16)}-${index}`,
    canvas: { width: 1024, height: 1024 },
    transformRanges: {
      cardScale: { minimum: 0.55, maximum: 0.9 },
      rotationDegrees: { minimum: -14, maximum: 14 },
      perspectiveFraction: { minimum: 0, maximum: 0.08 },
      exposureStops: { minimum: -0.8, maximum: 0.8 },
      whiteBalanceKelvin: { minimum: 3200, maximum: 7200 },
      jpegQuality: { minimum: 62, maximum: 96 },
    },
    backgroundFamilies: [
      "dark_fabric",
      "light_fabric",
      "wood_grain",
      "neutral_mat",
      "speckled_table",
    ],
    outsideCardArtifacts: [
      "scratch",
      "lint",
      "dust",
      "shadow",
      "specular_highlight",
    ],
    safeguards: {
      artifactsRestrictedOutsideCardMask: true,
      syntheticPositiveCardDamageAllowed: false,
      preserveForegroundPixelsInsideCardMask: true,
    },
    target: {
      mask: "analytic_transformed_card_quad",
      corners: "analytic_transformed_card_corners",
      backgroundArtifactsAreDefects: false,
    },
  };
}

export function trainingViewForRole(manifest = {}, modelRole) {
  if (!MODEL_ROLES.has(modelRole)) throw new Error("invalid_v3_model_role");
  const examples = Array.isArray(manifest?.examples) ? manifest.examples : [];
  return examples.map((example) => {
    if (modelRole === "geometry")
      return {
        ...baseTrainingRow(example, { includeMeasurements: false }),
        target: {
          composites: (example.captures || []).map((capture, index) =>
            geometryCompositePlan(example, capture, index),
          ),
          evidenceSufficient:
            example.humanLabels?.evidence?.sufficient === true,
        },
      };
    if (modelRole === "capture_quality")
      return {
        ...baseTrainingRow(example, { includeMeasurements: false }),
        target: {
          captures: (example.captures || []).map((capture) => ({
            captureId: capture.captureId,
            quality: capture.quality || {},
          })),
          evidence: example.humanLabels?.evidence || {},
        },
      };
    if (modelRole === "identity")
      return {
        ...baseTrainingRow(example, { includeMeasurements: false }),
        target: {
          identityConfirmed: example.humanLabels?.identityConfirmed === true,
          finish: example.humanLabels?.finish || null,
          identity: example.cohort || {},
        },
      };
    if (modelRole === "psa_fusion")
      return {
        physicalCardId: example.physicalCardId,
        sourceHash: example.sourceHash,
        partition: example.partition,
        cohort: example.cohort || {},
        modelEvidence: example.pipelineEvidence || {},
        auxiliaryTargets: {
          condition: example.humanLabels?.condition || {},
          noGradeSignals: example.humanLabels?.noGradeSignals || [],
        },
        target: example.professionalOutcome || {},
      };
    const conditionKey = modelRole === "eye_appeal" ? "eyeAppeal" : modelRole;
    const base = baseTrainingRow(example);
    return {
      ...base,
      target: {
        score: finite(example.humanLabels?.condition?.[conditionKey], 1, 10),
        defects: (example.humanLabels?.defects || []).filter((defect) => {
          if (modelRole === "eye_appeal") return true;
          if (modelRole === "corners") return /corner/.test(defect.category);
          if (modelRole === "edges")
            return /edge|rough_cut|peeling/.test(defect.category);
          if (modelRole === "structure")
            return /dent|indentation|crease|wrinkle|bend|warping|delamination/.test(
              defect.category,
            );
          if (modelRole === "surface")
            return !/centering|corner|edge|rough_cut|peeling|dent|indentation|crease|wrinkle|bend|warping|delamination/.test(
              defect.category,
            );
          return defect.category === "centering";
        }),
      },
    };
  });
}

function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function predictionMetrics(rows, key) {
  const measured = rows
    .map((row) => {
      const expected = finite(row?.expectedGrade, 1, 10);
      const predicted = finite(row?.[key]?.grade, 1, 10);
      return expected == null || predicted == null
        ? null
        : Math.abs(expected - predicted);
    })
    .filter((value) => value != null);
  return {
    coverage: rows.length ? measured.length / rows.length : 0,
    meanAbsoluteError: mean(measured),
    withinHalf: measured.length
      ? measured.filter((error) => error <= 0.5).length / measured.length
      : 0,
    withinOne: measured.length
      ? measured.filter((error) => error <= 1).length / measured.length
      : 0,
  };
}

function cohortKey(row) {
  const cohort = row?.cohort || {};
  return [
    ["finish", cohort.finish || cohort.finishClass],
    ["language", cohort.language],
    ["device", cohort.deviceTier || cohort.deviceClass],
    ["era", cohort.manufacturingEra],
  ]
    .filter(([, value]) => String(value || "").trim())
    .map(([dimension, value]) => `${dimension}:${String(value).toLowerCase()}`);
}

function cohortMetrics(cases, minimumCases = 10) {
  const grouped = new Map();
  for (const row of cases) {
    for (const key of cohortKey(row)) {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
  }
  return Object.fromEntries(
    [...grouped.entries()]
      .filter(([, rows]) => rows.length >= minimumCases)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => [
        key,
        {
          cases: rows.length,
          champion: predictionMetrics(rows, "champion"),
          candidate: predictionMetrics(rows, "candidate"),
          falsePositiveDefects: {
            champion: rows.reduce(
              (sum, row) =>
                sum + Number(row.champion?.falsePositiveDefects || 0),
              0,
            ),
            candidate: rows.reduce(
              (sum, row) =>
                sum + Number(row.candidate?.falsePositiveDefects || 0),
              0,
            ),
          },
        },
      ]),
  );
}

export function evaluateV3ShadowRun(rows = []) {
  const cases = Array.isArray(rows) ? rows : [];
  const cardsByPartition = new Map();
  for (const row of cases) {
    const partitions = cardsByPartition.get(row.physicalCardId) || new Set();
    partitions.add(row.partition);
    cardsByPartition.set(row.physicalCardId, partitions);
  }
  if ([...cardsByPartition.values()].some((partitions) => partitions.size > 1))
    throw new Error("physical_card_partition_leakage");
  if (cardsByPartition.size !== cases.length)
    throw new Error("physical_card_has_multiple_shadow_cases");
  const champion = predictionMetrics(cases, "champion");
  const candidate = predictionMetrics(cases, "candidate");
  const candidateFalseDefects = cases.reduce(
    (sum, row) => sum + Number(row.candidate?.falsePositiveDefects || 0),
    0,
  );
  const championFalseDefects = cases.reduce(
    (sum, row) => sum + Number(row.champion?.falsePositiveDefects || 0),
    0,
  );
  const cohorts = cohortMetrics(cases);
  const cohortEntries = Object.values(cohorts);
  const cohortDimensions = new Set(
    Object.keys(cohorts).map((key) => key.split(":", 1)[0]),
  );
  const gates = {
    enoughCases: cases.length >= 100,
    candidateCoverage: candidate.coverage >= 0.9,
    meanAbsoluteError:
      candidate.meanAbsoluteError != null &&
      candidate.meanAbsoluteError <= 0.65 &&
      (champion.meanAbsoluteError == null ||
        candidate.meanAbsoluteError <= champion.meanAbsoluteError),
    withinHalf:
      candidate.withinHalf >= 0.65 &&
      candidate.withinHalf >= champion.withinHalf,
    withinOne:
      candidate.withinOne >= 0.9 && candidate.withinOne >= champion.withinOne,
    falseDefects: candidateFalseDefects <= championFalseDefects,
    cohortCoverage: ["finish", "language", "device"].every((dimension) =>
      cohortDimensions.has(dimension),
    ),
    cohortFloor: cohortEntries.every(
      (cohort) =>
        cohort.candidate.coverage >= 0.9 &&
        cohort.candidate.meanAbsoluteError != null &&
        cohort.candidate.meanAbsoluteError <= 0.9 &&
        cohort.candidate.withinOne >= 0.8 &&
        cohort.falsePositiveDefects.candidate <=
          cohort.falsePositiveDefects.champion,
    ),
  };
  return {
    version: "mica-shadow-evaluation-v3",
    status: Object.values(gates).every(Boolean)
      ? "promotion_eligible"
      : "shadow_only",
    cases: cases.length,
    physicalCards: cardsByPartition.size,
    champion,
    candidate,
    falsePositiveDefects: {
      champion: championFalseDefects,
      candidate: candidateFalseDefects,
    },
    cohorts,
    gates,
  };
}

export const gradingDatasetV3Constants = Object.freeze({
  partitions: PARTITIONS,
  requiredCaptures: REQUIRED_CAPTURES,
  conditionLabels: REQUIRED_CONDITION_LABELS,
});
