import test from "node:test";
import assert from "node:assert/strict";
import {
  applyGradingV3Contract,
  combineReferenceComparisons,
  selectGradingReference,
} from "../lib/grading-v3.js";

const reference = {
  catalogCardId: "tcgdex:en:sv3-198",
  provider: "tcgplayer",
  url: "https://example.invalid/not-forwarded.jpg",
};

function comparison(confidence = 0.9) {
  return {
    status: "compared",
    exactIdentityMatch: true,
    identityConfidence: 0.94,
    registration: {
      method: "corner_homography",
      confidence,
      residualPixels: 1.8,
    },
    photometricNormalization: "illumination_robust",
    inspectedCardFraction: 0.91,
    excludedArtifactFraction: 0.07,
    notes: ["Glare and compression differences were excluded."],
  };
}

test("v3 selects TCGplayer media only after an exact catalog resolution", () => {
  const selected = selectGradingReference({
    resolution: {
      status: "exact",
      recommendedId: "tcgdex:en:sv3-198",
    },
    cards: [
      {
        id: "tcgdex:en:sv3-198",
        name: "Charizard ex",
        set: "Obsidian Flames",
        number: "198/197",
        referenceImages: [
          {
            provider: "tcgdex",
            size: "large",
            url: "https://assets.tcgdex.net/en/sv/sv03/198/high.png",
          },
          {
            provider: "tcgplayer",
            size: "large",
            url: "https://6d4be195623157e28848-7697ece4918e0a73861de0eb37d08968.ssl.cf1.rackcdn.com/198_200w.jpg",
          },
        ],
      },
    ],
  });
  assert.equal(selected.status, "ready");
  assert.equal(selected.reference.provider, "tcgplayer");
  assert.equal(selected.reference.assumedProfessionalGrade, false);

  const ambiguous = selectGradingReference({
    resolution: { status: "review", recommendedId: null },
    cards: [],
  });
  assert.equal(ambiguous.status, "unavailable");
});

test("v3 reference evidence needs two independently registered reviews", () => {
  const accepted = combineReferenceComparisons(
    [
      { referenceComparison: comparison(0.88) },
      { referenceComparison: comparison(0.82) },
    ],
    reference,
  );
  assert.equal(accepted.status, "compared");
  assert.equal(accepted.registration.confidence, 0.82);

  const rejected = combineReferenceComparisons(
    [
      { referenceComparison: comparison(0.88) },
      { referenceComparison: comparison(0.42) },
    ],
    reference,
  );
  assert.equal(rejected.status, "rejected");
});

test("v3 exposes every gated workflow stage in persisted evidence", () => {
  const analysis = applyGradingV3Contract(
    {
      identity: { confidence: 0.94 },
      condition: {
        confidence: 0.86,
        subscores: ["centering", "corners", "edges", "surface"].map(
          (category) => ({ category, scoreLow: 8, scoreHigh: 9 }),
        ),
      },
      micaConditionScore: { status: "estimate", confidence: 0.82 },
      micaPregrade: { status: "estimate", score: 8.6 },
      evidenceProfile: { complete: true },
      referenceComparison: comparison(),
      modelBundle: { version: "mica-psa-pregrade-v2:test" },
    },
    {
      catalogResolution: {
        resolution: { status: "exact", confidence: 0.96 },
      },
      referenceSelection: { status: "ready", reference },
      captureGeometry: [
        {
          normalizedCropApplied: true,
          backgroundExcluded: true,
          boundaryConfidence: 0.9,
        },
        {
          normalizedCropApplied: true,
          backgroundExcluded: true,
          boundaryConfidence: 0.88,
        },
      ],
    },
  );
  assert.equal(analysis.gradingWorkflow.complete, true);
  assert.equal(analysis.gradingWorkflow.stages.length, 8);
  assert.equal(analysis.evidenceProfile.version, "mica-evidence-profile-v3");
  assert.equal(analysis.micaPregrade.rubricVersion, "mica-pregrade-v3");
  assert.match(analysis.modelBundle.version, /mica-grading-v3/);
});
