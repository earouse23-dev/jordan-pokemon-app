import { sameCatalogCard } from "./core.js";

const GRADE_MIN = 1;
const GRADE_MAX = 10;
export const PSA_NUMERIC_LABELS = Object.freeze([
  1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10,
]);
export const PSA_QUALIFIERS = Object.freeze([
  "OC",
  "PD",
  "ST",
  "OF",
  "MK",
  "MC",
]);
export const PSA_NO_GRADE_CODES = Object.freeze([
  "N1",
  "N2",
  "N3",
  "N4",
  "N5",
  "N6",
  "N7",
  "N8",
  "N9",
]);
const DEFECT_CATEGORIES = new Set([
  "centering",
  "corners",
  "edges",
  "surface",
  "structural_integrity",
  "corner_whitening",
  "corner_compression",
  "edge_whitening",
  "edge_chipping",
  "edge_wear",
  "scratch",
  "holo_scratch",
  "print_line",
  "indentation",
  "crease",
  "dent",
  "bend",
  "warping",
  "stain",
  "residue",
  "surface_scuff",
  "peeling",
  "delamination",
  "printing_defect",
  "other",
]);

const AREA_REGIONS = Object.freeze({
  "top left": { x: 0, y: 0, width: 0.28, height: 0.28 },
  "top right": { x: 0.72, y: 0, width: 0.28, height: 0.28 },
  "bottom left": { x: 0, y: 0.72, width: 0.28, height: 0.28 },
  "bottom right": { x: 0.72, y: 0.72, width: 0.28, height: 0.28 },
  top: { x: 0.18, y: 0, width: 0.64, height: 0.2 },
  bottom: { x: 0.18, y: 0.8, width: 0.64, height: 0.2 },
  left: { x: 0, y: 0.18, width: 0.2, height: 0.64 },
  right: { x: 0.8, y: 0.18, width: 0.2, height: 0.64 },
  center: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
  surface: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
});

function bounded(value, minimum = 0, maximum = 1) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : null;
}

function rounded(value, places = 4) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function normalizedProbabilityRows(rows = []) {
  const combined = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const grade = Number(row?.grade);
    const probability = bounded(row?.probability);
    if (!PSA_NUMERIC_LABELS.includes(grade) || probability == null) continue;
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

export function probabilityWeightedPsaPregrade(rows = []) {
  const probabilities = normalizedProbabilityRows(rows);
  if (!probabilities.length) return null;
  return rounded(
    probabilities.reduce((sum, row) => sum + row.grade * row.probability, 0),
    1,
  );
}

function probabilityEntropy(rows = []) {
  const probabilities = normalizedProbabilityRows(rows);
  if (probabilities.length < 2) return probabilities.length ? 0 : null;
  const entropy = -probabilities.reduce(
    (sum, row) =>
      sum +
      (row.probability > 0 ? row.probability * Math.log(row.probability) : 0),
    0,
  );
  return rounded(entropy / Math.log(probabilities.length));
}

export function gradingEvidenceProfile({
  quality = {},
  identity = {},
  condition = {},
  consensus = {},
} = {}) {
  const requiredCategories = [
    "centering",
    "corners",
    "edges",
    "surface",
    "structural_integrity",
  ];
  const measured = new Map(
    (Array.isArray(condition.subscores) ? condition.subscores : []).map(
      (entry) => [entry.category, entry],
    ),
  );
  const areas = requiredCategories.map((category) => {
    const entry = measured.get(category);
    const measurable = Boolean(
      entry &&
      bounded(entry.scoreLow, GRADE_MIN, GRADE_MAX) != null &&
      bounded(entry.scoreHigh, GRADE_MIN, GRADE_MAX) != null,
    );
    return {
      category,
      measurable,
      confidence: measurable ? (bounded(entry.confidence) ?? 0) : 0,
    };
  });
  const measurableFraction =
    areas.filter((area) => area.measurable).length / areas.length;
  const weakestAreaConfidence = Math.min(
    ...areas.filter((area) => area.measurable).map((area) => area.confidence),
    1,
  );
  const evidenceCoverage = rounded(
    measurableFraction * 0.55 +
      (bounded(quality.confidence) ?? 0) * 0.2 +
      (bounded(condition.confidence) ?? 0) * 0.15 +
      weakestAreaConfidence * 0.1,
  );
  const identityConfidence = rounded(bounded(identity.confidence) ?? 0);
  const reviewAgreement = rounded(
    Math.max(
      0,
      1 -
        Math.min(
          1,
          Number(
            consensus.overallGradeDisagreement ??
              consensus.gradeDisagreement ??
              0,
          ) / 2,
        ),
    ),
  );
  return {
    version: "mica-evidence-profile-v2",
    evidenceCoverage,
    identityConfidence,
    reviewAgreement,
    finish:
      String(identity.finish || identity.variant || "unknown").trim() ||
      "unknown",
    areas,
    complete:
      quality.usable !== false &&
      measurableFraction === 1 &&
      evidenceCoverage >= 0.62,
  };
}

export function calculateMicaPregrade({
  conditionScore = {},
  psaPrediction = {},
} = {}) {
  const calibratedScore =
    psaPrediction.validated === true && psaPrediction.status === "estimate"
      ? probabilityWeightedPsaPregrade(psaPrediction.probabilities)
      : null;
  const visibleScore = bounded(conditionScore.score, GRADE_MIN, GRADE_MAX);
  const score = calibratedScore ?? visibleScore;
  return {
    status: score == null ? "unavailable" : "estimate",
    score: score == null ? null : rounded(score, 1),
    basis:
      calibratedScore != null
        ? "calibrated_expected_psa_outcome"
        : visibleScore != null
          ? "visible_condition_measurement"
          : "insufficient_evidence",
    targetGrader: "PSA",
    mostLikelyGrade:
      psaPrediction.validated === true
        ? bounded(psaPrediction.mostLikelyGrade, GRADE_MIN, GRADE_MAX)
        : null,
    probabilityEntropy:
      psaPrediction.validated === true
        ? probabilityEntropy(psaPrediction.probabilities)
        : null,
    validatedPsaProbabilities: psaPrediction.validated === true,
    rubricVersion: "mica-pregrade-v2",
  };
}

export function normalizePsaOutcome(input = {}) {
  const kind = String(input.outcomeKind || "numeric").toLowerCase();
  const grade = Number(input.returnedGrade);
  const qualifier =
    String(input.qualifier || "")
      .trim()
      .toUpperCase() || null;
  const noGradeCode =
    String(input.noGradeCode || "")
      .trim()
      .toUpperCase() || null;
  if (["numeric", "qualified"].includes(kind)) {
    if (!PSA_NUMERIC_LABELS.includes(grade)) return null;
    if (kind === "qualified" && !PSA_QUALIFIERS.includes(qualifier))
      return null;
    if (kind === "numeric" && qualifier) return null;
    return {
      outcomeKind: kind,
      returnedGrade: grade,
      returnedLabel: `${grade}${qualifier ? ` ${qualifier}` : ""}`,
      qualifier,
      noGradeCode: null,
    };
  }
  if (kind === "no_grade") {
    if (!PSA_NO_GRADE_CODES.includes(noGradeCode)) return null;
    return {
      outcomeKind: kind,
      returnedGrade: null,
      returnedLabel: noGradeCode,
      qualifier: null,
      noGradeCode,
    };
  }
  if (["authentic", "altered"].includes(kind))
    return {
      outcomeKind: kind,
      returnedGrade: null,
      returnedLabel: kind === "authentic" ? "AUTHENTIC" : "AUTHENTIC ALTERED",
      qualifier: null,
      noGradeCode,
    };
  return null;
}

function normalizedRegion(region) {
  if (!region || typeof region !== "object") return null;
  const x = bounded(region.x);
  const y = bounded(region.y);
  const width = bounded(region.width, 0.01, 1);
  const height = bounded(region.height, 0.01, 1);
  if ([x, y, width, height].some((value) => value == null)) return null;
  return {
    x: rounded(x),
    y: rounded(y),
    width: rounded(Math.min(width, 1 - x)),
    height: rounded(Math.min(height, 1 - y)),
  };
}

export function inferDefectRegion(area, category) {
  const description = String(area || "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [label, region] of Object.entries(AREA_REGIONS)) {
    if (description.includes(label)) return { ...region };
  }
  if (category === "corners") return { x: 0, y: 0, width: 1, height: 1 };
  if (category === "edges") return { x: 0, y: 0, width: 1, height: 1 };
  if (
    [
      "surface",
      "structural_integrity",
      "scratch",
      "holo_scratch",
      "print_line",
      "indentation",
      "crease",
      "dent",
      "bend",
      "warping",
      "stain",
      "residue",
      "surface_scuff",
      "peeling",
      "delamination",
      "printing_defect",
    ].includes(category)
  )
    return { ...AREA_REGIONS.surface };
  return null;
}

export function verifyDefectEvidence(
  defect = {},
  index = 0,
  { enforceSameSideEvidence = false, sideViewCounts = {} } = {},
) {
  const category = DEFECT_CATEGORIES.has(defect.category)
    ? defect.category
    : "other";
  const supplied = normalizedRegion(defect.region);
  const inferred = supplied ? null : inferDefectRegion(defect.area, category);
  const region = supplied || inferred;
  const evidence = String(defect.evidence || "").trim();
  const side = ["front", "back"].includes(defect.side)
    ? defect.side
    : "unknown";
  const confidence = bounded(defect.confidence) ?? 0;
  const visualCause = [
    "physical_damage",
    "intentional_print_effect",
    "lighting_artifact",
    "uncertain",
    "unclassified",
  ].includes(defect.visualCause)
    ? defect.visualCause
    : "unclassified";
  const reflectiveSurfaceFinding = [
    "surface",
    "scratch",
    "holo_scratch",
    "print_line",
    "surface_scuff",
    "printing_defect",
  ].includes(category);
  const rejectedVisualArtifact = [
    "intentional_print_effect",
    "lighting_artifact",
    "uncertain",
  ].includes(visualCause);
  const sameSideViewCount = Math.max(
    0,
    Math.trunc(Number(sideViewCounts?.[side]) || 0),
  );
  const claimedAcrossViews = defect.confirmedAcrossViews === true;
  const hasSameSideCorroboration = sameSideViewCount >= 2;
  const impossibleCrossViewClaim =
    enforceSameSideEvidence && claimedAcrossViews && !hasSameSideCorroboration;
  const contradictedByAlternateView =
    reflectiveSurfaceFinding && defect.confirmedAcrossViews === false;
  const missingRequiredCrossViewEvidence =
    enforceSameSideEvidence &&
    reflectiveSurfaceFinding &&
    (!hasSameSideCorroboration || !claimedAcrossViews);
  const supported =
    side !== "unknown" &&
    Boolean(region) &&
    evidence.length >= 8 &&
    confidence >= 0.35 &&
    !rejectedVisualArtifact &&
    !contradictedByAlternateView &&
    !missingRequiredCrossViewEvidence;
  return {
    id: String(defect.id || `finding-${index + 1}`),
    side,
    area: String(defect.area || "Area unclear").slice(0, 80),
    category,
    severity: ["minor", "moderate", "major", "critical"].includes(
      defect.severity,
    )
      ? defect.severity
      : "moderate",
    evidence: evidence.slice(0, 240) || "Visible concern requires review.",
    confidence,
    visualCause,
    confirmedAcrossViews: impossibleCrossViewClaim
      ? false
      : typeof defect.confirmedAcrossViews === "boolean"
        ? defect.confirmedAcrossViews
        : null,
    sameSideViewCount: enforceSameSideEvidence ? sameSideViewCount : null,
    region,
    verificationStatus: supported
      ? supplied
        ? "localized"
        : "region_inferred"
      : "unverified",
  };
}

export function verifyDefectList(defects = [], evidenceContext = {}) {
  return (Array.isArray(defects) ? defects : [])
    .slice(0, 24)
    .map((defect, index) =>
      verifyDefectEvidence(defect, index, evidenceContext),
    )
    .filter((defect) => defect.verificationStatus !== "unverified");
}

export function structuralDamageGuard(defects = []) {
  const findings = verifyDefectList(defects);
  const blocking = findings.filter(
    (defect) =>
      defect.severity === "critical" ||
      (defect.severity === "major" &&
        [
          "structural_integrity",
          "crease",
          "dent",
          "indentation",
          "bend",
          "warping",
          "peeling",
          "delamination",
        ].includes(defect.category)),
  );
  return {
    blocked: blocking.length > 0,
    findings: blocking,
    reason: blocking.length
      ? "Visible major structural damage needs an in-person review. Mica will not convert it into a confident professional-grade prediction."
      : null,
  };
}

export function evidenceConsistencyGuard(condition = {}, defects = []) {
  const structural = structuralDamageGuard(defects);
  if (structural.blocked) return structural;
  const findings = verifyDefectList(defects);
  const major = findings.filter((defect) => defect.severity === "major");
  const subscores = new Map(
    (Array.isArray(condition.subscores) ? condition.subscores : []).map(
      (entry) => [entry.category, entry],
    ),
  );
  const categoryFor = (defect) =>
    defect.category.includes("corner")
      ? "corners"
      : defect.category.includes("edge")
        ? "edges"
        : ["corners", "edges", "surface", "structural_integrity"].includes(
              defect.category,
            )
          ? defect.category
          : defect.category === "centering"
            ? "centering"
            : "surface";
  const predictedHigh = Number(condition.estimatedGradeLow) > 7;
  const conflicts = major.filter((defect) => {
    const subscore = subscores.get(categoryFor(defect));
    return predictedHigh || Number(subscore?.scoreLow) > 7;
  });
  return {
    blocked: conflicts.length > 0,
    findings: conflicts,
    reason: conflicts.length
      ? "A major visible finding conflicts with the high condition range. Mica will abstain until clearer evidence resolves that contradiction."
      : null,
  };
}

function subscoreMidpoints(subscores = []) {
  return (Array.isArray(subscores) ? subscores : [])
    .map((entry) => {
      const low = bounded(entry?.scoreLow, GRADE_MIN, GRADE_MAX);
      const high = bounded(entry?.scoreHigh, GRADE_MIN, GRADE_MAX);
      if (low == null || high == null) return null;
      return {
        category: entry.category,
        score: (low + high) / 2,
        confidence: bounded(entry.confidence) ?? 0,
      };
    })
    .filter(Boolean);
}

const CONDITION_WEIGHTS = Object.freeze({
  centering: 0.15,
  corners: 0.25,
  edges: 0.2,
  surface: 0.25,
  structural_integrity: 0.15,
});

export function calculateMicaConditionScore({
  condition = {},
  quality = {},
} = {}) {
  const consistencyGuard = evidenceConsistencyGuard(
    condition,
    condition.defects,
  );
  if (consistencyGuard.blocked)
    return {
      status: "unavailable",
      score: null,
      low: null,
      high: null,
      confidence: 0,
      rubricVersion: "mica-condition-rubric-v4",
      reason: consistencyGuard.reason,
      validated: false,
    };
  const subscores = (
    Array.isArray(condition.subscores) ? condition.subscores : []
  )
    .map((entry) => {
      const low = bounded(entry?.scoreLow, GRADE_MIN, GRADE_MAX);
      const high = bounded(entry?.scoreHigh, GRADE_MIN, GRADE_MAX);
      const weight = CONDITION_WEIGHTS[entry?.category];
      if (low == null || high == null || !weight) return null;
      return {
        low: Math.min(low, high),
        high: Math.max(low, high),
        weight,
        confidence: bounded(entry.confidence) ?? 0,
      };
    })
    .filter(Boolean);
  if (subscores.length < 3)
    return {
      status: "unavailable",
      score: null,
      low: null,
      high: null,
      confidence: 0,
      rubricVersion: "mica-condition-rubric-v4",
      reason: "At least three condition areas must be measurable.",
      validated: false,
    };
  const weightTotal = subscores.reduce((sum, item) => sum + item.weight, 0);
  const weightedLow =
    subscores.reduce((sum, item) => sum + item.low * item.weight, 0) /
    weightTotal;
  const weightedHigh =
    subscores.reduce((sum, item) => sum + item.high * item.weight, 0) /
    weightTotal;
  const weakestLow = Math.min(...subscores.map((item) => item.low));
  const weakestHigh = Math.min(...subscores.map((item) => item.high));
  const low = weightedLow * 0.65 + weakestLow * 0.35;
  const high = weightedHigh * 0.65 + weakestHigh * 0.35;
  const confidence = Math.min(
    bounded(condition.confidence) ?? 0,
    bounded(quality.confidence) ?? 0,
    ...subscores.map((item) => item.confidence),
  );
  return {
    status: confidence >= 0.5 ? "estimate" : "unavailable",
    score: confidence >= 0.5 ? rounded((low + high) / 2, 1) : null,
    low: rounded(low, 1),
    high: rounded(high, 1),
    confidence: rounded(confidence),
    rubricVersion: "mica-condition-rubric-v4",
    reason:
      confidence >= 0.5
        ? "Weighted visible-condition measurement with the weakest area limiting the result."
        : "The visible condition measurements are not confident enough.",
    validated: false,
  };
}

export function determineGradingAbstention({
  quality = {},
  condition = {},
  defects = [],
} = {}) {
  const blockers = Array.isArray(condition.blockers)
    ? condition.blockers.filter(Boolean)
    : [];
  const blockingIssues = (Array.isArray(quality.issues) ? quality.issues : [])
    .filter((issue) => issue?.severity === "blocking")
    .map((issue) => issue.message || issue.code)
    .filter(Boolean);
  const subscoreCount = subscoreMidpoints(condition.subscores).length;
  const reasons = [...blockingIssues, ...blockers];
  const consistencyGuard = evidenceConsistencyGuard(condition, defects);
  if (consistencyGuard.blocked) reasons.push(consistencyGuard.reason);
  if (!quality.usable) reasons.push("The photos are not reliable enough.");
  if ((bounded(quality.confidence) ?? 0) < 0.55)
    reasons.push("Photo confidence is too low.");
  if ((bounded(condition.confidence) ?? 0) < 0.5)
    reasons.push("Condition confidence is too low.");
  if (
    bounded(condition.estimatedGradeLow, GRADE_MIN, GRADE_MAX) == null ||
    bounded(condition.estimatedGradeHigh, GRADE_MIN, GRADE_MAX) == null
  )
    reasons.push("A responsible grade range could not be measured.");
  if (subscoreCount < 3)
    reasons.push("Too few condition areas could be measured.");
  if (
    (Array.isArray(defects) ? defects : []).some(
      (defect) =>
        ["critical", "major"].includes(defect.severity) &&
        defect.verificationStatus === "unverified",
    )
  )
    reasons.push("A major finding could not be tied to visible evidence.");
  const uniqueReasons = [...new Set(reasons)];
  return {
    abstained: uniqueReasons.length > 0,
    reasons: uniqueReasons.slice(0, 8),
  };
}

export function calibratePsaProbabilities({
  quality = {},
  condition = {},
  defects = [],
  calibration = null,
} = {}) {
  const evidenceConfidence = Math.min(
    bounded(quality.confidence) ?? 0,
    bounded(condition.confidence) ?? 0,
  );
  const abstention = determineGradingAbstention({
    quality,
    condition,
    defects: (Array.isArray(defects) ? defects : []).map(verifyDefectEvidence),
  });
  if (abstention.abstained)
    return {
      targetGrader: "PSA",
      calibrationVersion: "psa-held-out-calibration-required-v1",
      status: "abstained",
      mostLikelyGrade: null,
      probabilities: [],
      expectedGrade: null,
      confidence: evidenceConfidence,
      outcomeRisks: { status: "unavailable", validated: false },
      reasons: abstention.reasons,
      validated: false,
    };
  const supplied = normalizedProbabilityRows(calibration?.probabilities);
  const total = supplied.reduce((sum, row) => sum + row.probability, 0);
  const calibrationValidated =
    calibration?.validated === true &&
    typeof calibration?.version === "string" &&
    calibration.version.length >= 8 &&
    supplied.length >= 2 &&
    Math.abs(total - 1) <= 0.001;
  if (!calibrationValidated)
    return {
      targetGrader: "PSA",
      calibrationVersion: "psa-held-out-calibration-required-v1",
      status: "unavailable",
      mostLikelyGrade: null,
      probabilities: [],
      expectedGrade: null,
      confidence: 0,
      outcomeRisks: { status: "unavailable", validated: false },
      reasons: [
        "Mica has not yet validated a PSA outcome model on a sufficiently large held-out return set. A visible-condition score is still available, but professional-grade odds are withheld rather than invented.",
      ],
      validated: false,
    };
  const probabilities = supplied.map((row) => ({
    grade: row.grade,
    probability: rounded(row.probability / total),
  }));
  const mostLikely = probabilities.reduce((best, row) =>
    row.probability > best.probability ? row : best,
  );
  return {
    targetGrader: "PSA",
    calibrationVersion: calibration.version,
    status: "estimate",
    mostLikelyGrade: mostLikely.grade,
    probabilities,
    expectedGrade: probabilityWeightedPsaPregrade(probabilities),
    confidence: rounded(
      Math.min(evidenceConfidence, bounded(calibration.confidence) ?? 0),
    ),
    outcomeRisks: {
      status:
        calibration?.outcomeRisks?.validated === true
          ? "estimate"
          : "unavailable",
      gradeableProbability:
        calibration?.outcomeRisks?.validated === true
          ? bounded(calibration.outcomeRisks.gradeableProbability)
          : null,
      qualifierProbability:
        calibration?.outcomeRisks?.validated === true
          ? bounded(calibration.outcomeRisks.qualifierProbability)
          : null,
      noGradeProbability:
        calibration?.outcomeRisks?.validated === true
          ? bounded(calibration.outcomeRisks.noGradeProbability)
          : null,
      alterationProbability:
        calibration?.outcomeRisks?.validated === true
          ? bounded(calibration.outcomeRisks.alterationProbability)
          : null,
      validated: calibration?.outcomeRisks?.validated === true,
    },
    reasons: [],
    validated: true,
  };
}

export function gradingModelBundle({
  visionModel = "unknown",
  evidenceVerifier = "evidence-localization-v1",
  geometryModel = "client-geometry-v1",
} = {}) {
  return Object.freeze({
    version: `mica-psa-pregrade-v2:${visionModel}`,
    targetGrader: "PSA",
    visionModel,
    qualityModel: "client-quality-v2",
    geometryModel,
    evidenceVerifier,
    calibrationModel: "psa-ordinal-calibration-v2-required",
    rubricVersion: "mica-condition-rubric-v4",
    pregradeVersion: "mica-pregrade-v2",
    validated: false,
  });
}

export function digitalGradeTier(value) {
  const score = bounded(value, 0, 10);
  if (score == null) return "Unrated";
  if (score >= 9) return "Exceptional visible condition";
  if (score >= 8) return "Excellent visible condition";
  if (score >= 7) return "Strong visible condition";
  if (score >= 5) return "Moderate visible wear";
  if (score >= 3) return "Heavy visible wear";
  return "Severe visible wear";
}

const comparableIdentity = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const comparableLanguage = (value) => {
  const normalized = comparableIdentity(value);
  return (
    {
      english: "en",
      japanese: "ja",
      french: "fr",
      german: "de",
      spanish: "es",
      italian: "it",
      portuguese: "pt",
      korean: "ko",
      chinese: "zh",
      traditionalchinese: "zhtw",
      simplifiedchinese: "zhcn",
    }[normalized] || normalized
  );
};

export function gradingIdentityAgreementKey(identity = {}) {
  const parts = [
    comparableIdentity(identity.name),
    comparableIdentity(identity.setName || identity.set),
    comparableIdentity(identity.collectorNumber || identity.number),
    comparableLanguage(identity.language),
    comparableIdentity(identity.variant || identity.finish),
  ];
  return parts.some(Boolean) ? parts.join("|") : "";
}

export function compareGradeIdentity(target = {}, observed = {}) {
  const fields = [
    ["name", target.name, observed.name],
    ["set", target.setName || target.set, observed.setName || observed.set],
    [
      "number",
      target.collectorNumber || target.number,
      observed.collectorNumber || observed.number,
    ],
    ["language", target.language, observed.language],
    [
      "variant",
      target.variant || target.finish,
      observed.variant || observed.finish,
    ],
  ];
  const expectedFields = fields.filter(([, expected]) => expected);
  const missingFields = expectedFields
    .filter(([, , actual]) => !actual)
    .map(([field]) => field);
  const compared = expectedFields
    .filter(([, , actual]) => actual)
    .map(([field, expected, actual]) => ({
      field,
      matches:
        (field === "language" ? comparableLanguage : comparableIdentity)(
          expected,
        ) ===
        (field === "language" ? comparableLanguage : comparableIdentity)(
          actual,
        ),
    }));
  const mismatches = compared.filter((entry) => !entry.matches);
  return {
    status: mismatches.length
      ? "mismatch"
      : !missingFields.length && compared.length >= 2
        ? "match"
        : "insufficient",
    comparedFields: compared.map((entry) => entry.field),
    mismatches: mismatches.map((entry) => entry.field),
    missingFields,
  };
}

export function resolveAutomaticGradeMatch({
  items = [],
  observed = {},
  catalogCard = null,
} = {}) {
  const eligible = (Array.isArray(items) ? items : []).filter(
    (item) =>
      item?.cardState !== "sealed" &&
      !item?.gradingCompany &&
      item?.status === "owned" &&
      Number(item?.quantity || 1) > 0,
  );
  const exactPrinting = (item, card) => {
    if (!sameCatalogCard(item, card)) return false;
    const expectedVariant = comparableIdentity(card?.variant || card?.finish);
    const ownedVariant = comparableIdentity(item?.variant || item?.finish);
    return Boolean(
      expectedVariant && ownedVariant && expectedVariant === ownedVariant,
    );
  };
  let matches = catalogCard
    ? eligible.filter((item) => exactPrinting(item, catalogCard))
    : [];
  const source = matches.length ? "catalog" : "printed_identity";
  if (!matches.length) {
    matches = eligible.filter(
      (item) => compareGradeIdentity(item, observed).status === "match",
    );
  }
  if (!matches.length)
    return { status: "not_found", item: null, candidateCount: 0, source };
  if (!matches.every((item) => sameCatalogCard(item, matches[0])))
    return {
      status: "ambiguous",
      item: null,
      candidateCount: matches.length,
      source,
    };
  return {
    status: "matched",
    item: matches.find((item) => !item.digitalGrade) || matches[0],
    candidateCount: matches.length,
    source,
  };
}

function digitalGradeCenter(value = {}) {
  const direct = Number(value.predictedGrade ?? value.mostLikelyGrade);
  if (Number.isFinite(direct)) return direct;
  const low = Number(
    value.predictedGradeLow ?? value.estimatedGradeLow ?? value.low,
  );
  const high = Number(
    value.predictedGradeHigh ?? value.estimatedGradeHigh ?? value.high,
  );
  return Number.isFinite(low) && Number.isFinite(high)
    ? (low + high) / 2
    : null;
}

export function compareDigitalGradeStability(previous = {}, next = {}) {
  const previousScore = digitalGradeCenter(previous);
  const nextScore = digitalGradeCenter(next);
  if (previousScore == null || nextScore == null)
    return {
      status: "insufficient",
      stable: false,
      gradeDelta: null,
      reasons: ["Both scans need a measurable digital grade."],
    };
  const gradeDelta = rounded(Math.abs(nextScore - previousScore), 1);
  const previousDefects = verifyDefectList(previous.defects);
  const nextDefects = verifyDefectList(next.defects);
  const previousKeys = new Set(
    previousDefects.map((item) => `${item.side}:${item.category}`),
  );
  const nextKeys = new Set(
    nextDefects.map((item) => `${item.side}:${item.category}`),
  );
  const shared = [...previousKeys].filter((key) => nextKeys.has(key)).length;
  const union = new Set([...previousKeys, ...nextKeys]).size;
  const defectAgreement = union ? rounded(shared / union) : 1;
  const highConfidence =
    Number(previous.confidence || 0) >= 0.65 &&
    Number(next.confidence || 0) >= 0.65;
  const reasons = [];
  if (gradeDelta > 0.8)
    reasons.push(
      `The new DG result moved ${gradeDelta.toFixed(1)} points from the saved result.`,
    );
  if (
    highConfidence &&
    union >= 2 &&
    defectAgreement < 0.34 &&
    previousDefects.length &&
    nextDefects.length
  )
    reasons.push("The visible defect categories changed substantially.");
  return {
    status: reasons.length ? "unstable" : "stable",
    stable: reasons.length === 0,
    requiresConfirmation: reasons.length === 0 && gradeDelta > 0.3,
    gradeDelta,
    defectAgreement,
    reasons,
  };
}

export function gradingLimitingEvidence({
  condition = {},
  score = {},
  quality = {},
} = {}) {
  const blockingIssue = (quality.issues || []).find(
    (issue) => issue?.severity === "blocking",
  );
  if (blockingIssue)
    return {
      category: "capture",
      title: "Capture evidence limits this report",
      detail: blockingIssue.message,
      verified: false,
    };
  const verified = verifyDefectList(condition.defects || []).sort(
    (left, right) => {
      const weight = { critical: 4, major: 3, moderate: 2, minor: 1 };
      return weight[right.severity] - weight[left.severity];
    },
  );
  if (verified[0])
    return {
      category: verified[0].category,
      title: `${verified[0].side === "back" ? "Back" : "Front"} ${verified[0].area} is the strongest limiting evidence`,
      detail: verified[0].evidence,
      verified: true,
    };
  const measurable = subscoreMidpoints(condition.subscores || []).sort(
    (left, right) => left.score - right.score,
  );
  if (measurable[0])
    return {
      category: measurable[0].category,
      title: `${measurable[0].category} is the lowest measured condition area`,
      detail:
        "No localized defect was verified there, so the measured range—not a claimed flawless surface—limits the result.",
      verified: false,
    };
  return {
    category: "evidence",
    title: "Photographs cannot prove a flawless physical card",
    detail:
      score.status === "estimate"
        ? "No limiting defect reached the independent evidence threshold, but hidden dents, texture changes, or surface marks may still exist."
        : "The available views do not cover enough condition evidence for a responsible score.",
    verified: false,
  };
}

export function submissionRecommendation({
  prediction = {},
  financial = null,
} = {}) {
  if (prediction.status !== "estimate" || prediction.validated !== true)
    return {
      status: "not_recommended",
      title: "Do not submit based on this scan alone",
      reason:
        "Professional-grade outcome probabilities are not validated yet. Use the visible-condition report to inspect the card, not as a promise of a PSA result.",
      minimumOutcome: null,
    };
  if (!financial?.available)
    return {
      status: "needs_value_data",
      title: "Submission value is unavailable",
      reason:
        "Mica needs exact raw and grader-specific prices plus complete grading costs before recommending a paid submission.",
      minimumOutcome: financial?.minimumOutcome || null,
    };
  return {
    status: financial.expectedProfit > 0 ? "consider" : "not_recommended",
    title:
      financial.expectedProfit > 0
        ? "Consider submitting after an in-hand review"
        : "Submission is not expected to add value",
    reason: financial.reason,
    minimumOutcome: financial.minimumOutcome || null,
  };
}

export function compareGradingPredictions(older = {}, newer = {}) {
  const oldFindings = new Map(
    verifyDefectList(older.defects).map((item) => [
      `${item.side}:${item.category}:${item.area.toLowerCase()}`,
      item,
    ]),
  );
  const newFindings = new Map(
    verifyDefectList(newer.defects).map((item) => [
      `${item.side}:${item.category}:${item.area.toLowerCase()}`,
      item,
    ]),
  );
  return {
    gradeChange:
      Number.isFinite(Number(older.mostLikelyGrade)) &&
      Number.isFinite(Number(newer.mostLikelyGrade))
        ? Number(newer.mostLikelyGrade) - Number(older.mostLikelyGrade)
        : null,
    addedFindings: [...newFindings.entries()]
      .filter(([key]) => !oldFindings.has(key))
      .map(([, value]) => value),
    removedFindings: [...oldFindings.entries()]
      .filter(([key]) => !newFindings.has(key))
      .map(([, value]) => value),
    unchangedFindings: [...newFindings.entries()]
      .filter(([key]) => oldFindings.has(key))
      .map(([, value]) => value),
  };
}
