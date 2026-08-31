import { normalizeCardImageSource } from "./image-source.js";

const REFERENCE_PROVIDER_PRIORITY = Object.freeze([
  "tcgplayer",
  "pokemon-tcg-api",
  "pokemontcg",
  "tcgdex",
  "catalog",
]);

const PIPELINE_STAGES = Object.freeze([
  "card_isolation",
  "identity_resolution",
  "reference_resolution",
  "geometric_registration",
  "difference_detection",
  "defect_classification",
  "subgrade_calculation",
  "overall_grade",
]);

function bounded(value, minimum = 0, maximum = 1) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : null;
}

function clean(value, maximum = 240) {
  if (value == null) return null;
  const normalized = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

function normalizedProvider(value) {
  return String(value || "catalog")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function providerRank(provider) {
  const normalized = normalizedProvider(provider);
  const index = REFERENCE_PROVIDER_PRIORITY.indexOf(normalized);
  return index < 0 ? REFERENCE_PROVIDER_PRIORITY.length : index;
}

function exactCatalogCard(catalogResolution = {}) {
  const resolution = catalogResolution?.resolution || {};
  if (resolution.status !== "exact" || !resolution.recommendedId) return null;
  return (
    Array.isArray(catalogResolution.cards) ? catalogResolution.cards : []
  ).find((card) => card?.id === resolution.recommendedId);
}

/**
 * Selects a printing reference only after the catalog has produced one exact
 * card. The image is a design reference, never evidence that the pictured
 * marketplace copy was itself a professional grade 10.
 */
export function selectGradingReference(catalogResolution = {}) {
  const card = exactCatalogCard(catalogResolution);
  if (!card)
    return {
      status: "unavailable",
      reason: "exact_printing_not_resolved",
      reference: null,
    };
  const candidates = (
    Array.isArray(card.referenceImages) ? card.referenceImages : []
  )
    .map((entry) => {
      const source = normalizeCardImageSource(entry?.url);
      return source
        ? {
            provider: normalizedProvider(entry.provider),
            size: clean(entry.size, 30) || "unknown",
            url: source.href,
          }
        : null;
    })
    .filter(Boolean);
  const primarySource = normalizeCardImageSource(card.image);
  if (primarySource)
    candidates.push({
      provider: normalizedProvider(card.imageProvider || "catalog"),
      size: "large",
      url: primarySource.href,
    });
  const unique = [
    ...new Map(candidates.map((entry) => [entry.url, entry])).values(),
  ].sort(
    (left, right) =>
      providerRank(left.provider) - providerRank(right.provider) ||
      Number(right.size === "large") - Number(left.size === "large"),
  );
  const selected = unique[0];
  if (!selected)
    return {
      status: "unavailable",
      reason: "reference_image_missing",
      reference: null,
    };
  return {
    status: "ready",
    reason: null,
    reference: {
      catalogCardId: String(card.id),
      internalCardId: card.internalId || null,
      name: clean(card.name, 120),
      set: clean(card.set, 120),
      number: clean(card.number, 60),
      language: clean(card.language, 20),
      variants: (Array.isArray(card.variants) ? card.variants : [])
        .map((entry) => clean(entry, 100))
        .filter(Boolean)
        .slice(0, 12),
      provider: selected.provider,
      url: selected.url,
      purpose: "printing_design_reference",
      assumedProfessionalGrade: false,
    },
  };
}

export function normalizeReferenceComparison(value = {}, reference = null) {
  const allowedStatuses = new Set(["not_provided", "compared", "rejected"]);
  const status = allowedStatuses.has(value?.status)
    ? value.status
    : reference
      ? "rejected"
      : "not_provided";
  const allowedRegistration = new Set([
    "none",
    "rectified_card_plane",
    "corner_homography",
  ]);
  const allowedNormalization = new Set([
    "none",
    "per_channel_linear",
    "illumination_robust",
  ]);
  return {
    version: "mica-reference-comparison-v3",
    status,
    catalogCardId: reference?.catalogCardId || null,
    provider: reference?.provider || clean(value?.provider, 40),
    purpose: "printing_design_reference",
    assumedProfessionalGrade: false,
    exactIdentityMatch: value?.exactIdentityMatch === true,
    identityConfidence: bounded(value?.identityConfidence) ?? 0,
    registration: {
      method: allowedRegistration.has(value?.registration?.method)
        ? value.registration.method
        : "none",
      confidence: bounded(value?.registration?.confidence) ?? 0,
      residualPixels: bounded(value?.registration?.residualPixels, 0, 100),
    },
    photometricNormalization: allowedNormalization.has(
      value?.photometricNormalization,
    )
      ? value.photometricNormalization
      : "none",
    inspectedCardFraction: bounded(value?.inspectedCardFraction) ?? 0,
    excludedArtifactFraction: bounded(value?.excludedArtifactFraction) ?? 0,
    notes: (Array.isArray(value?.notes) ? value.notes : [])
      .map((entry) => clean(entry, 180))
      .filter(Boolean)
      .slice(0, 6),
  };
}

export function combineReferenceComparisons(analyses = [], reference = null) {
  const comparisons = (Array.isArray(analyses) ? analyses : [])
    .map((analysis) =>
      normalizeReferenceComparison(analysis?.referenceComparison, reference),
    )
    .filter((entry) => entry.status === "compared");
  const required = Math.floor(Math.max(2, analyses.length) / 2) + 1;
  const accepted = comparisons.filter(
    (entry) =>
      entry.exactIdentityMatch &&
      entry.identityConfidence >= 0.75 &&
      entry.registration.confidence >= 0.65 &&
      entry.inspectedCardFraction >= 0.72,
  );
  if (!reference)
    return normalizeReferenceComparison({ status: "not_provided" }, null);
  if (accepted.length < required)
    return {
      ...normalizeReferenceComparison({ status: "rejected" }, reference),
      notes: [
        "Independent comparison reviews did not agree that identity and alignment were reliable.",
      ],
    };
  const minimum = (read) => Math.min(...accepted.map(read));
  const maximum = (read) => Math.max(...accepted.map(read));
  const residuals = accepted
    .map((entry) => entry.registration.residualPixels)
    .filter((entry) => entry != null);
  return {
    ...accepted.sort(
      (left, right) =>
        right.registration.confidence - left.registration.confidence,
    )[0],
    identityConfidence: minimum((entry) => entry.identityConfidence),
    registration: {
      ...accepted[0].registration,
      confidence: minimum((entry) => entry.registration.confidence),
      residualPixels: residuals.length ? maximum((entry) => entry) : null,
    },
    inspectedCardFraction: minimum((entry) => entry.inspectedCardFraction),
    excludedArtifactFraction: maximum(
      (entry) => entry.excludedArtifactFraction,
    ),
    notes: [
      `Reference alignment passed ${accepted.length} independent reviews.`,
      ...new Set(accepted.flatMap((entry) => entry.notes)),
    ].slice(0, 6),
  };
}

function stage(name, status, reason = null, confidence = null) {
  return {
    name,
    status,
    reason,
    confidence: bounded(confidence),
  };
}

export function buildGradingWorkflowV3({
  analysis = {},
  catalogResolution = null,
  referenceSelection = null,
  referenceComparison = null,
  captureGeometry = [],
} = {}) {
  const geometry = Array.isArray(captureGeometry) ? captureGeometry : [];
  const primary = geometry.slice(0, 2);
  const isolated =
    primary.length === 2 &&
    primary.every(
      (entry) =>
        entry?.normalizedCropApplied === true &&
        entry?.backgroundExcluded !== false &&
        Number(entry?.boundaryConfidence || 0) >= 0.55,
    );
  const exactIdentity =
    catalogResolution?.resolution?.status === "exact" &&
    Number(analysis.identity?.confidence || 0) >= 0.7;
  const referenceReady = referenceSelection?.status === "ready";
  const registered =
    referenceComparison?.status === "compared" &&
    referenceComparison.exactIdentityMatch === true &&
    Number(referenceComparison.registration?.confidence || 0) >= 0.65;
  const conditionMeasured =
    Array.isArray(analysis.condition?.subscores) &&
    analysis.condition.subscores.filter(
      (entry) => entry?.scoreLow != null && entry?.scoreHigh != null,
    ).length >= 4;
  const overallMeasured = analysis.micaConditionScore?.status === "estimate";
  const stages = [
    stage(
      "card_isolation",
      isolated ? "complete" : "blocked",
      isolated ? null : "Both primary views need verified card-only crops.",
      primary.length
        ? Math.min(...primary.map((entry) => entry.boundaryConfidence || 0))
        : 0,
    ),
    stage(
      "identity_resolution",
      exactIdentity ? "complete" : "blocked",
      exactIdentity ? null : "The exact printing is not resolved.",
      Math.min(
        Number(analysis.identity?.confidence || 0),
        Number(catalogResolution?.resolution?.confidence || 0),
      ),
    ),
    stage(
      "reference_resolution",
      referenceReady ? "complete" : "blocked",
      referenceReady
        ? null
        : referenceSelection?.reason ||
            "A trusted design reference is unavailable.",
      referenceReady ? catalogResolution?.resolution?.confidence : 0,
    ),
    stage(
      "geometric_registration",
      registered ? "complete" : "blocked",
      registered
        ? null
        : "Reference comparison requires reliable card-plane alignment.",
      referenceComparison?.registration?.confidence || 0,
    ),
    stage(
      "difference_detection",
      registered ? "complete" : "blocked",
      registered
        ? null
        : "Pixel/color differences are ignored until registration passes.",
      referenceComparison?.inspectedCardFraction || 0,
    ),
    stage(
      "defect_classification",
      conditionMeasured ? "complete" : "blocked",
      conditionMeasured ? null : "Too few defect categories are measurable.",
      analysis.condition?.confidence || 0,
    ),
    stage(
      "subgrade_calculation",
      conditionMeasured ? "complete" : "blocked",
      conditionMeasured ? null : "Subgrades need localized visible evidence.",
      analysis.condition?.confidence || 0,
    ),
    stage(
      "overall_grade",
      overallMeasured ? "complete" : "blocked",
      overallMeasured
        ? null
        : analysis.micaConditionScore?.reason || "The engine abstained.",
      analysis.micaConditionScore?.confidence || 0,
    ),
  ];
  return {
    version: "mica-grading-workflow-v3",
    stages,
    complete: stages.every((entry) => entry.status === "complete"),
    completedStages: stages.filter((entry) => entry.status === "complete")
      .length,
    totalStages: PIPELINE_STAGES.length,
    nextBlockedStage:
      stages.find((entry) => entry.status !== "complete")?.name || null,
    safeguards: {
      backgroundPixelsExcluded: isolated,
      exactPrintingRequired: true,
      marketplaceImageTreatedAsGrade10: false,
      rawHexDifferenceUsedAsDamage: false,
      lightingAndRegistrationRequired: true,
      crossViewConfirmationRequiredForReflectiveDefects: true,
    },
  };
}

export function applyGradingV3Contract(
  analysis = {},
  { catalogResolution, referenceSelection, captureGeometry } = {},
) {
  const referenceComparison = normalizeReferenceComparison(
    analysis.referenceComparison,
    referenceSelection?.reference || null,
  );
  const gradingWorkflow = buildGradingWorkflowV3({
    analysis,
    catalogResolution,
    referenceSelection,
    referenceComparison,
    captureGeometry,
  });
  return {
    ...analysis,
    micaPregrade: analysis.micaPregrade
      ? { ...analysis.micaPregrade, rubricVersion: "mica-pregrade-v3" }
      : analysis.micaPregrade,
    referenceComparison,
    gradingWorkflow,
    evidenceProfile: {
      ...(analysis.evidenceProfile || {}),
      version: "mica-evidence-profile-v3",
      referenceComparison,
      workflow: gradingWorkflow,
      complete:
        analysis.evidenceProfile?.complete === true && gradingWorkflow.complete,
    },
    modelBundle: {
      ...(analysis.modelBundle || {}),
      version: String(
        analysis.modelBundle?.version || "mica-psa-pregrade-v2:unknown",
      ).replace("mica-psa-pregrade-v2", "mica-grading-v3"),
      geometryModel: "client-card-isolation-v3",
      evidenceVerifier: "registered-reference-majority-v3",
      pregradeVersion: "mica-pregrade-v3",
    },
  };
}

export const gradingV3Constants = Object.freeze({
  pipelineStages: PIPELINE_STAGES,
  referenceProviderPriority: REFERENCE_PROVIDER_PRIORITY,
});
